import { chromium, Browser, BrowserContext, Page } from '@playwright/test';
import { ICourtAutomation, AutomationConfig } from '../types/court-automation.interface';
import { FilingRequest, FilingResult } from '../types/filing.types';

/**
 * Base class for court automation with common functionality
 */
export abstract class BaseCourtAutomation implements ICourtAutomation {
  abstract courtId: string;
  abstract courtName: string;

  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;
  protected page: Page | null = null;
  protected config: AutomationConfig;

  constructor(config?: Partial<AutomationConfig>) {
    this.config = {
      headless: config?.headless ?? true,
      slowMo: config?.slowMo ?? 0,
      screenshotOnError: config?.screenshotOnError ?? true,
      saveTrace: config?.saveTrace ?? true,
      timeout: config?.timeout ?? 60000,
    };
  }

  /**
   * Initialize browser, context, and page
   */
  protected async initBrowser(): Promise<Page> {
    this.browser = await chromium.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo,
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: this.config.saveTrace ? { dir: './logs/videos' } : undefined,
    });

    if (this.config.saveTrace) {
      await this.context.tracing.start({ screenshots: true, snapshots: true });
    }

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.config.timeout!);

    return this.page;
  }

  /**
   * Clean up browser resources
   */
  protected async closeBrowser(): Promise<void> {
    if (this.config.saveTrace && this.context) {
      await this.context.tracing.stop({ path: `./logs/trace-${Date.now()}.zip` });
    }

    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
  }

  /**
   * Take screenshot on error
   */
  protected async captureErrorState(error: Error): Promise<string[]> {
    const screenshots: string[] = [];

    if (this.config.screenshotOnError && this.page) {
      try {
        const screenshotPath = `./logs/error-${Date.now()}.png`;
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        screenshots.push(screenshotPath);
      } catch (screenshotError) {
        console.error('Failed to capture screenshot:', screenshotError);
      }
    }

    return screenshots;
  }

  /**
   * Main file method - template pattern
   */
  async file(request: FilingRequest): Promise<FilingResult> {
    const startTime = Date.now();
    const logs: string[] = [];

    try {
      logs.push(`[${new Date().toISOString()}] Starting filing for court: ${this.courtName}`);

      // Initialize browser
      await this.initBrowser();
      logs.push('Browser initialized');

      // Execute court-specific filing logic
      const result = await this.executeFilingProcess(request);

      logs.push(`Filing completed in ${Date.now() - startTime}ms`);

      return {
        ...result,
        logs,
      };
    } catch (error) {
      logs.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      const screenshots = await this.captureErrorState(error as Error);

      return {
        success: false,
        courtId: this.courtId,
        error: error instanceof Error ? error.message : 'Unknown error',
        screenshots,
        logs,
      };
    } finally {
      await this.closeBrowser();
    }
  }

  /**
   * Court-specific filing logic - must be implemented by subclasses
   */
  protected abstract executeFilingProcess(request: FilingRequest): Promise<FilingResult>;

  /**
   * Default implementation - can be overridden
   */
  supportsCase(caseType: string): boolean {
    return caseType === 'small_claims';
  }
}
