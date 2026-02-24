import { Page } from '@playwright/test';

/**
 * Create a bound screenshot helper that saves to ./logs/ with timestamped filenames.
 */
export function createScreenshotHelper(
  page: Page,
  log: (msg: string) => void,
): (name: string) => Promise<string> {
  return async (name: string): Promise<string> => {
    const filepath = `./logs/${name}-${Date.now()}.png`;
    await page.screenshot({ path: filepath, fullPage: true });
    log(`Screenshot: ${name}`);
    return filepath;
  };
}
