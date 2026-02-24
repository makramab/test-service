import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { StepContext } from '../../../types/california-efile.types';
import { SELECTORS } from '../selectors';

/**
 * Phase 6: Extract draft number from the Summary page.
 * Returns the draft text (or null if extraction fails).
 */
export async function extractSummary(ctx: StepContext): Promise<string | null> {
  const { page, screenshot, log } = ctx;

  log('Extracting draft number from Summary page...');

  let draftText: string | null = null;

  try {
    const draftElement = page.locator(SELECTORS.summary.draftNumber).first();
    await draftElement.waitFor({ timeout: 5000 });
    draftText = await draftElement.textContent();
    log(`Draft number found: ${draftText}`);

    // Save to file
    const filename = `draft-${Date.now()}-${randomUUID()}.txt`;
    const draftFilePath = path.join(__dirname, '../../../../logs', filename);
    fs.writeFileSync(draftFilePath, draftText || '');
    log(`Draft number saved to: ${draftFilePath}`);
  } catch (error) {
    log(`Failed to extract draft number: ${error}`);
  }

  await screenshot('summary-page');
  log('Filing automation completed successfully');

  return draftText?.trim() || null;
}
