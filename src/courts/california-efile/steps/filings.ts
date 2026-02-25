import { StepContext } from '../../../types/california-efile.types';
import { SELECTORS } from '../selectors';
import { fillFieldByForAttr } from '../helpers/form';
import { downloadFile, cleanupTempFile } from '../helpers/file';
import { clickWithFallback } from '../helpers/click';

/**
 * Phase 4: Add filing details, upload document, save, skip to fees.
 */
export async function fillFilings(ctx: StepContext): Promise<void> {
  const { page, config, screenshot, log } = ctx;
  const { filingData, documentData } = config;

  // Wait for Filings page
  await page.waitForSelector(SELECTORS.filings.noFilingsText, { timeout: 10000, state: 'visible' });
  log('Filings page loaded');
  await screenshot('filings-page');

  // Click "Add Filing"
  await page.waitForTimeout(2000);
  await clickWithFallback(page, [
    { selector: SELECTORS.filings.addFilingButton, method: 'click', label: 'Add Filing' },
    { selector: 'add filing', method: 'role', roleOptions: { name: /add filing/i }, label: 'Add Filing' },
  ], log);

  // Wait for Edit Filing Details modal
  await page.waitForSelector(SELECTORS.filings.editFilingHeading, { timeout: 15000, state: 'visible' });
  await page.waitForTimeout(2000);
  await screenshot('filing-modal');

  // Fill Filing Code (autocomplete — exact match auto-registers on blur)
  log(`Filling Filing Code: ${filingData.filingCode}`);
  try {
    const label = page.locator('label:has-text("Filing Code")');
    const count = await label.count();
    if (count > 0) {
      const input = label.locator('..').locator('input').first();
      await input.fill(filingData.filingCode, { timeout: 5000 });
      log('Filing Code text entered');
      await page.waitForTimeout(2000);
      await input.press('Tab');
      log('Filing Code confirmed (Tab blur)');
    }
  } catch (_) {
    const input = page.locator('input[placeholder*="Filing Code" i]').first();
    await input.fill(filingData.filingCode);
    await page.waitForTimeout(2000);
    await input.press('Tab');
    log('Filing Code confirmed (placeholder fallback + Tab)');
  }

  await page.waitForTimeout(2000);
  await screenshot('after-filing-code');

  // Scroll down to reveal more fields
  await page.evaluate('window.scrollBy(0, 300)');
  await page.waitForTimeout(1000);

  // Fill description, reference number, comments (all use for-attr pattern)
  await fillFieldByForAttr(page, 'Filing Description', filingData.filingDescription, log);
  await fillFieldByForAttr(page, 'Client Reference Number', filingData.clientReferenceNumber, log);
  await fillFieldByForAttr(page, 'Comments to Court', filingData.commentsToCourtOpening, log);

  await page.waitForTimeout(1000);
  await screenshot('after-filing-details');

  // Select "Filing on Behalf of"
  log(`Selecting Filing on Behalf of: ${filingData.filingOnBehalfOf}`);
  try {
    const label = page.locator('text="Filing on Behalf of"');
    const count = await label.count();
    if (count > 0) {
      // Try select element first
      const select = label.locator('..').locator('select').first();
      const selectCount = await select.count();
      if (selectCount > 0) {
        await select.click({ timeout: 5000 });
        await page.waitForTimeout(1000);
        try {
          await page.click(`text="${filingData.filingOnBehalfOf}"`, { timeout: 3000 });
        } catch (_) {
          await select.selectOption({ label: filingData.filingOnBehalfOf });
        }
      } else {
        // Try input
        const input = label.locator('..').locator('input').first();
        await input.click({ timeout: 5000 });
        await page.waitForTimeout(1000);
        await page.click(`text="${filingData.filingOnBehalfOf}"`, { timeout: 3000 });
      }
      log(`Filing on Behalf of: ${filingData.filingOnBehalfOf}`);
    }
  } catch (e) {
    log(`Filing on Behalf of selection failed: ${e}`);
  }

  await page.waitForTimeout(2000);
  await screenshot('after-behalf-of');

  // Upload lead document
  log('Starting document upload...');
  let downloadedPath: string | null = null;
  try {
    downloadedPath = await downloadFile(documentData.leadDocument.url, documentData.leadDocument.filename, log);

    await page.evaluate('window.scrollBy(0, 400)');
    await page.waitForTimeout(1000);
    await screenshot('before-upload');

    const fileInput = page.locator(SELECTORS.filings.fileInput).first();
    const count = await fileInput.count();
    if (count > 0) {
      await fileInput.setInputFiles(downloadedPath);
      log('File uploaded successfully');
      await page.waitForTimeout(3000);
      await screenshot('after-upload');
    } else {
      log('File input element not found');
    }
  } catch (error) {
    log(`Error during file upload: ${error}`);
  } finally {
    cleanupTempFile(downloadedPath, log);
  }

  // Save filing
  log('Saving filing...');
  await page.waitForTimeout(2000);
  try {
    await page.locator(SELECTORS.filings.saveFilingsButton).click({ timeout: 5000 });
    log('Clicked Save (forge-button#save-filings)');
  } catch (_) {
    try {
      await page.locator('forge-button:has-text("Save")').click({ timeout: 5000 });
      log('Clicked Save (forge-button with text)');
    } catch (_2) {
      await page.getByRole('button', { name: /save/i }).click({ timeout: 5000 });
      log('Clicked Save (getByRole)');
    }
  }

  await page.waitForTimeout(3000);
  await screenshot('after-save-filing');

  // Skip to Fees
  log('Clicking Skip To Fees...');
  await page.waitForTimeout(2000);
  await clickWithFallback(page, [
    { selector: 'forge-button:has-text("Skip To Fees")', method: 'locator', label: 'Skip To Fees' },
    { selector: 'button:has-text("Skip To Fees")', method: 'locator', label: 'Skip To Fees' },
    { selector: 'skip to fees', method: 'role', roleOptions: { name: /Skip To Fees/i }, label: 'Skip To Fees' },
  ], log);

  await page.waitForTimeout(3000);
  await screenshot('fees-page');
  ctx.updatePhase(5);
}
