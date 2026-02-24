import { BaseCourtAutomation } from '../base-court-automation';
import { FilingRequest, FilingResult } from '../../types/filing.types';
import { CaliforniaEFileOverrides, CaliforniaEFileConfig, StepContext } from '../../types/california-efile.types';
import { deepMerge } from '../../utils/deep-merge';
import { getDefaultConfig } from './defaults';
import { createScreenshotHelper } from './helpers/screenshot';
import { jobStatusStore } from '../../services/job-status-store';

import { authenticate } from './steps/authentication';
import { fillCaseInformation } from './steps/case-information';
import { fillParties } from './steps/parties';
import { fillFilings } from './steps/filings';
import { fillFees } from './steps/fees';
import { extractSummary } from './steps/summary';

export class CaliforniaEFileAutomation extends BaseCourtAutomation {
  courtId = 'california-efile';
  courtName = 'California eFile (Tyler Technologies)';

  private resolvedConfig: CaliforniaEFileConfig;
  private jobId?: string;

  constructor(overrides?: CaliforniaEFileOverrides) {
    const headlessMode = overrides?.headless !== undefined
      ? overrides.headless
      : process.env.HEADLESS !== 'false';

    super({
      headless: headlessMode,
      slowMo: parseInt(process.env.SLOW_MO || '0', 10),
      timeout: parseInt(process.env.AUTOMATION_TIMEOUT || '30000', 10),
    });

    // Build fully resolved config: defaults ← overrides
    // Call getDefaultConfig() at construction time (after dotenv.config() has run)
    const defaults = getDefaultConfig();
    this.resolvedConfig = {
      credentials: overrides?.credentials
        ? deepMerge(defaults.credentials, overrides.credentials)
        : defaults.credentials,
      caseConfig: overrides?.caseConfig
        ? deepMerge(defaults.caseConfig, overrides.caseConfig)
        : defaults.caseConfig,
      partyData: overrides?.partyData
        ? deepMerge(defaults.partyData, overrides.partyData)
        : defaults.partyData,
      defendantData: overrides?.defendantData
        ? deepMerge(defaults.defendantData, overrides.defendantData)
        : defaults.defendantData,
      filingData: overrides?.filingData
        ? deepMerge(defaults.filingData, overrides.filingData)
        : defaults.filingData,
      documentData: overrides?.documentData
        ? deepMerge(defaults.documentData, overrides.documentData)
        : defaults.documentData,
    };
  }

  setJobId(jobId: string): void {
    this.jobId = jobId;
  }

  protected async executeFilingProcess(_request: FilingRequest): Promise<FilingResult> {
    if (!this.page) throw new Error('Page not initialized');

    const log = (msg: string) => console.log(msg);
    const screenshot = createScreenshotHelper(this.page, log);
    const updatePhase = (phase: number) => {
      if (this.jobId) jobStatusStore.updatePhase(this.jobId, phase);
    };

    const ctx: StepContext = {
      page: this.page,
      config: this.resolvedConfig,
      screenshot,
      updatePhase,
      log,
    };

    // Execute all 6 phases in sequence
    await authenticate(ctx);
    await fillCaseInformation(ctx);
    await fillParties(ctx);
    await fillFilings(ctx);
    await fillFees(ctx);
    const draftText = await extractSummary(ctx);

    // Mark job completed
    if (this.jobId) {
      jobStatusStore.completeJob(this.jobId, draftText || undefined);
    }

    return {
      success: true,
      courtId: this.courtId,
      confirmationNumber: draftText || 'FILING-COMPLETED',
      filingDate: new Date().toISOString(),
      logs: [
        'Authenticated and logged in',
        'Filled case information (court, category, type)',
        'Added plaintiff and defendant parties',
        'Filled filing details and uploaded document',
        'Configured fees and payment',
        `Summary extracted: ${draftText || 'N/A'}`,
      ],
    };
  }

  supportsCase(caseType: string): boolean {
    return caseType === 'small_claims';
  }
}

export type { CaliforniaEFileOverrides };
