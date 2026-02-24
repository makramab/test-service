import { Page } from '@playwright/test';

/**
 * Create a bound screenshot helper that saves to ./logs/ with timestamped filenames.
 */
export function createScreenshotHelper(
  page: Page,
  log: (msg: string) => void,
  enabled: boolean = true,
): (name: string) => Promise<string> {
  return async (name: string): Promise<string> => {
    if (!enabled) return '';
    const filepath = `./logs/${name}-${Date.now()}.png`;
    await page.screenshot({ path: filepath, fullPage: true });
    log(`Screenshot: ${name}`);
    return filepath;
  };
}
