import { Page } from '@playwright/test';
import { FilingRequest, FilingResult } from './filing.types';

/**
 * Base interface that all court-specific automation classes must implement
 */
export interface ICourtAutomation {
  /**
   * Unique identifier for the court
   */
  courtId: string;

  /**
   * Human-readable court name
   */
  courtName: string;

  /**
   * Main method to execute the filing process
   * @param request - The filing request data
   * @returns FilingResult with success status and details
   */
  file(request: FilingRequest): Promise<FilingResult>;

  /**
   * Validate if the court automation supports the given case type
   * @param caseType - The type of case to file
   * @returns boolean indicating if supported
   */
  supportsCase(caseType: string): boolean;
}

/**
 * Configuration options for browser automation
 */
export interface AutomationConfig {
  headless: boolean;
  slowMo?: number;
  screenshotOnError?: boolean;
  saveTrace?: boolean;
  timeout?: number;
}
