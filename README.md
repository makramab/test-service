# Legali Filing Service

Automated court filing service using Playwright browser automation. Submits small claims filings to Tyler Technologies' California eFile portal on behalf of users who complete the Legali litigation workflow.

## How It Works

This service is the final step in the Legali litigation pipeline. It receives structured filing data (plaintiff, defendant, document URL) and drives a headless browser through the Tyler Technologies eFile California portal to create a draft filing.

### Integration Flow

```
legali-users-fe (frontend)
  → Stripe payment checkout
    → Stripe webhook → legali-be-platform (Node backend)
      → triggerEFiling() fetches litigation state from legali-rag (Python backend)
        → mapLitigationStateToFilingRequest() maps state → filing format
          → POST /api/california-efile/file → legali-filing-service (this service)
            → Playwright browser automation → Tyler eFile CA portal
              → Draft # returned → polled via GET /api/california-efile/status/:jobId
```

### Service Dependencies

| Service | Role |
|---|---|
| **legali-users-fe** | Frontend triggers e-filing via Stripe checkout at stage 5 |
| **legali-be-platform** | Node backend orchestrates: receives Stripe webhook, fetches litigation state, maps data, POSTs to this service. Key files: `subscriptionController.js` (`triggerEFiling()`), `stripeWebhookController.js` (`mapLitigationStateToFilingRequest()`) |
| **legali-rag** | Python backend stores litigation state in Supabase. Exposes `GET /agent/litigation/case-info/{conversation_id}` to retrieve the full `case_builder_state` |

### Data Flow

The mapping function in `legali-be-platform` extracts:

| Filing Field | Source in Litigation State |
|---|---|
| Plaintiff name | `stage_1.eligibility.plaintiff_name` |
| Plaintiff address | `stage_1.eligibility.plaintiff_street_address`, `plaintiff_city`, `plaintiff_state`, `plaintiff_zip_code` |
| Plaintiff phone | `stage_1.eligibility.plaintiff_phone` |
| Defendant name | `stage_3.defendant_info.defendant_name` |
| Defendant address | `stage_3.defendant_info.defendant_address`, `defendant_city`, `defendant_state`, `defendant_zip_code` |
| Defendant phone | `stage_3.defendant_info.defendant_phone` |
| Filing description | `stage_1.claim_viability.case_description` |
| SC-100 document URL | `stage_4.court_ready_packet.sc100_s3_url` |
| SC-100 filename | `stage_4.court_ready_packet.sc100_filename` |

## Known Issues / Caveats

### 1. Plaintiff address not collected (RAG prompt gap)

The litigation workflow (stage 1) currently does **not** collect the plaintiff's full contact info. The fields `plaintiff_street_address`, `plaintiff_city`, `plaintiff_state`, `plaintiff_zip_code`, and `plaintiff_phone` are all `null` in the litigation state. The mapping falls back to empty strings, causing the eFile portal to reject the filing for missing required address fields.

**Fix needed in**: `legali-rag` — stage 1 prompts need to collect plaintiff address and phone.

### 2. Defendant state stored as abbreviation

The RAG service stores `defendant_state` as a lowercase abbreviation (e.g., `"ca"`) but the Tyler eFile portal's State dropdown expects the full name (e.g., `"California"`). Since `"ca"` is truthy, the mapping's `|| 'California'` fallback doesn't trigger, and the dropdown fails to match.

**Fix needed in**: `legali-be-platform` — `mapLitigationStateToFilingRequest()` needs a state abbreviation-to-full-name lookup.

### 3. Defendant full address in Address Line 1

`defendant_address` contains the full address string (e.g., `"518 Hamilton Avenue, Menlo Park, CA 94025"`) which gets placed entirely into `addressLine1`. The separate `defendant_city`, `defendant_state`, `defendant_zip_code` fields exist but `addressLine1` is redundantly stuffed with everything. Tyler may accept this but it's not ideal.

**Fix options**: Either parse the full string to extract just the street portion for `addressLine1`, or rely on the already-parsed separate fields and ignore the composite `defendant_address`.

## Project Structure

```
src/
  index.ts                              # Express server, API routes
  utils/
    deep-merge.ts                       # Config merge utility
  types/
    filing.types.ts                     # Generic filing interfaces
    court-automation.interface.ts        # Court automation interface
    california-efile.types.ts            # CA eFile types, StepContext, overrides
  services/
    court-registry.ts                   # Court registration
    filing-service.ts                   # Filing orchestration
    job-status-store.ts                 # In-memory job status tracking
  courts/
    base-court-automation.ts            # Base class (template method pattern)
    california-efile/
      automation.ts                     # Thin orchestrator (~100 lines)
      selectors.ts                      # All CSS selectors in one file
      defaults.ts                       # Default config from env + JSON
      helpers/
        form.ts                         # fillField, fillAutocomplete, fillFieldByForAttr
        click.ts                        # clickWithFallback
        iframe.ts                       # findFrameWithInputs
        screenshot.ts                   # createScreenshotHelper
        file.ts                         # downloadFile, cleanupTempFile
      steps/
        authentication.ts              # Phase 1: login
        case-information.ts            # Phase 2: court, category, type
        parties.ts                     # Phase 3: plaintiff + defendant
        filings.ts                     # Phase 4: filing details + doc upload
        fees.ts                        # Phase 5: payment + calculate
        summary.ts                     # Phase 6: extract draft number
  data/
    party-data.json                    # Default plaintiff data
    defendant-data.json                # Default defendant data
    filing-data.json                   # Default filing data
    document-data.json                 # Default document data
```

## Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Install Playwright browsers**:
   ```bash
   npx playwright install chromium
   ```

3. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

4. **Configure `.env`**:
   ```
   PORT=3001
   HEADLESS=true
   SLOW_MO=0
   AUTOMATION_TIMEOUT=30000
   SAVE_LOGS=false
   EFILE_EMAIL=your-email@example.com
   EFILE_PASSWORD=your-password
   ```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server port |
| `NODE_ENV` | `development` | Environment |
| `HEADLESS` | `true` | Run browser in headless mode |
| `SLOW_MO` | `0` | Playwright slowMo (ms between actions) |
| `AUTOMATION_TIMEOUT` | `30000` | Default Playwright timeout (ms) |
| `SAVE_LOGS` | `false` | Enable screenshots, traces, videos, and draft file saving to `./logs/` |
| `EFILE_EMAIL` | — | California eFile login email |
| `EFILE_PASSWORD` | — | California eFile login password |

## Running

### Development
```bash
pnpm run dev
```

### Production
```bash
pnpm run build
pnpm start
```

## API Endpoints

### California eFile

**Start filing (fire-and-forget)**:
```
POST /api/california-efile/file
```

Request body — all fields optional, defaults loaded from env + JSON files:
```json
{
  "headless": true,
  "credentials": {
    "email": "override@example.com",
    "password": "override-password"
  },
  "caseConfig": {
    "courtLocation": "Santa Clara",
    "courtLocationFull": "Santa Clara - Civil",
    "caseCategory": "Small Claims",
    "caseType": "5000",
    "paymentAccount": "Waiver"
  },
  "partyData": {
    "firstName": "Jane",
    "lastName": "Doe",
    "phoneNumber": "555-0100",
    "address": {
      "addressLine1": "123 Main St",
      "city": "San Jose",
      "state": "California",
      "zipCode": "95110"
    }
  },
  "defendantData": {
    "firstName": "John",
    "lastName": "Smith",
    "phoneNumber": "555-0200",
    "address": {
      "addressLine1": "456 Oak Ave",
      "city": "Menlo Park",
      "state": "California",
      "zipCode": "94025"
    }
  },
  "filingData": {
    "filingCode": "Small Claims AB 3088 Declaration",
    "filingDescription": "Property damage claim",
    "filingOnBehalfOf": "Jane Doe"
  },
  "documentData": {
    "leadDocument": {
      "url": "https://example.com/sc-100.docx",
      "filename": "SC-100.docx",
      "documentType": "Small Claims Complaint"
    }
  }
}
```

Returns immediately with a job ID:
```json
{
  "success": true,
  "message": "Filing started",
  "jobId": "abc-123"
}
```

**Poll job status**:
```
GET /api/california-efile/status/:jobId
```

Returns:
```json
{
  "status": "completed",
  "phase": 6,
  "draftText": "Draft # 2578382"
}
```

### Generic Endpoints

| Endpoint | Description |
|---|---|
| `GET /health` | Health check |
| `GET /api/courts` | List registered courts |
| `GET /api/courts/case-type/:type` | Courts by case type |
| `POST /api/file` | Generic filing (not used for CA eFile) |

## Debugging

- Set `HEADLESS=false` to watch the browser
- Set `SLOW_MO=100` to slow down actions
- Set `SAVE_LOGS=true` to save screenshots/traces/videos to `./logs/`
- View traces: `npx playwright show-trace logs/trace-*.zip`

## Deployment Notes

- On EC2/remote servers, keep `SAVE_LOGS=false` to prevent storage from filling up
- `AUTOMATION_TIMEOUT` should be higher on remote servers (30000+) due to network latency
- The service uses `waitUntil: 'domcontentloaded'` for navigation (Tyler's SPA never reaches `networkidle`)
