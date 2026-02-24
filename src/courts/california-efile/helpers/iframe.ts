import { Page, Frame } from '@playwright/test';
import { PageOrFrame } from '../../../types/california-efile.types';

/**
 * Find the frame (or main page) that contains visible input elements.
 * Tyler's Forge components sometimes render forms inside iframes.
 */
export async function findFrameWithInputs(
  page: Page,
  targetSelector: string,
  log: (msg: string) => void,
): Promise<PageOrFrame> {
  // Check main page first
  const countInMain = await page.locator(targetSelector).count();
  if (countInMain > 0) {
    log(`Inputs found in main page (${targetSelector})`);
    return page;
  }

  // Check iframes
  log('Inputs not found in main page, checking iframes...');
  const frames = page.frames();
  for (let i = 0; i < frames.length; i++) {
    const count = await frames[i].locator(targetSelector).count();
    if (count > 0) {
      log(`Found inputs in frame ${i}`);
      return frames[i];
    }
  }

  log('No frames with inputs found, defaulting to main page');
  return page;
}
