# Legali Filing Service

Automated court filing service using Playwright browser automation. This service enables programmatic submission of small claims and other legal filings to court systems.

## Features

- **Browser Automation**: Playwright-powered automation for web-based court filing systems
- **Modular Court Support**: Easy-to-extend architecture for adding new courts
- **REST API**: Simple HTTP API for integration with frontend applications
- **Error Handling**: Comprehensive error capture with screenshots and traces
- **Type Safety**: Full TypeScript support

## Project Structure

```
legali-filing-service/
├── src/
│   ├── courts/                    # Court-specific automation implementations
│   │   ├── base-court-automation.ts
│   │   └── example-court.automation.ts
│   ├── services/                  # Business logic services
│   │   ├── court-registry.ts
│   │   └── filing-service.ts
│   ├── types/                     # TypeScript type definitions
│   │   ├── filing.types.ts
│   │   └── court-automation.interface.ts
│   └── index.ts                   # Express server entry point
├── logs/                          # Screenshots, traces, videos
├── package.json
└── tsconfig.json
```

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

3. **Configure environment variables** in `.env`:
   ```
   PORT=3001
   HEADLESS=true
   ```

## Running the Service

### Development Mode
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

## API Endpoints

### Health Check
```
GET /health
```

### Get Available Courts
```
GET /api/courts
```

Returns list of all registered courts.

### Get Courts by Case Type
```
GET /api/courts/case-type/:caseType
```

Returns courts that support a specific case type (e.g., `small_claims`).

### Execute Filing
```
POST /api/file
```

Submit a filing request.

**Request Body**:
```json
{
  "courtId": "example-court",
  "courtName": "Example Small Claims Court",
  "caseData": {
    "plaintiff": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phone": "555-0100"
    },
    "defendant": {
      "firstName": "Jane",
      "lastName": "Smith"
    },
    "caseType": "small_claims",
    "claimAmount": 5000,
    "description": "Breach of contract for unpaid services"
  },
  "documents": [
    {
      "filename": "contract.pdf",
      "filepath": "/path/to/contract.pdf",
      "documentType": "contract"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "courtId": "example-court",
  "caseNumber": "SC-2025-12345",
  "confirmationNumber": "CONF-98765",
  "filingDate": "2025-10-23T12:00:00.000Z",
  "screenshots": ["./logs/confirmation-1234567890.png"],
  "logs": [...]
}
```

## Adding a New Court

1. **Create court automation class** in `src/courts/`:

```typescript
import { BaseCourtAutomation } from './base-court-automation';
import { FilingRequest, FilingResult } from '../types/filing.types';

export class MyCourtAutomation extends BaseCourtAutomation {
  courtId = 'my-court-id';
  courtName = 'My Court Name';

  protected async executeFilingProcess(request: FilingRequest): Promise<FilingResult> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    // 1. Navigate to court website
    await this.page.goto('https://my-court.gov/filing');

    // 2. Fill out form fields
    await this.page.fill('#plaintiff-name', request.caseData.plaintiff.firstName);

    // 3. Upload documents
    for (const doc of request.documents) {
      await this.page.setInputFiles('#document-upload', doc.filepath);
    }

    // 4. Submit and get confirmation
    await this.page.click('button[type="submit"]');
    const confirmationNumber = await this.page.textContent('#confirmation');

    return {
      success: true,
      courtId: this.courtId,
      confirmationNumber: confirmationNumber || undefined,
      filingDate: new Date().toISOString(),
    };
  }
}
```

2. **Register the court** in `src/services/court-registry.ts`:

```typescript
import { MyCourtAutomation } from '../courts/my-court.automation';

private registerCourts(): void {
  // ... existing courts

  const myCourt = new MyCourtAutomation();
  this.courts.set(myCourt.courtId, myCourt);
}
```

## Debugging

### Run with Headed Browser
Set `HEADLESS=false` in `.env` to see the browser in action.

### Use Playwright Inspector
```bash
npm run test:debug
```

### View Traces
After a filing, check `./logs/` for:
- Screenshots
- Video recordings
- Trace files (open with `npx playwright show-trace trace-*.zip`)

## Integration with Frontend

From your frontend application (e.g., `legali-users-fe`), call the filing service:

```typescript
const filingRequest = {
  courtId: 'example-court',
  courtName: 'Example Small Claims Court',
  caseData: {
    // ... case data from your form
  },
  documents: [
    // ... generated documents
  ]
};

const response = await fetch('http://localhost:3001/api/file', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(filingRequest),
});

const result = await response.json();
console.log(result);
```

## Considerations

### CAPTCHAs
- Courts with CAPTCHAs will require manual intervention or third-party solving services
- Consider assisted filing mode where users complete CAPTCHAs

### Terms of Service
- Review each court's website terms before automating
- Some courts may prohibit automated access

### Maintenance
- Court websites change frequently
- Monitor for failures and update selectors as needed
- Use data-testid or stable selectors when possible

## Next Steps

1. Implement real court automations for your target jurisdictions
2. Add authentication if courts require login
3. Implement email-based filing for courts that support it
4. Add status tracking for filed cases
5. Implement retry logic for transient failures

## License

ISC
