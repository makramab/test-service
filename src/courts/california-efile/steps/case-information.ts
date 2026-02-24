import { StepContext } from '../../../types/california-efile.types';
import { SELECTORS } from '../selectors';
import { clickWithFallback } from '../helpers/click';
/**
 * Phase 2: Click Start Filing → Start New Case → fill court, category, type → navigate to Parties.
 */
export async function fillCaseInformation(ctx: StepContext): Promise<void> {
  const { page, config, screenshot, log } = ctx;
  const { caseConfig } = config;

  ctx.updatePhase(2);
  await page.waitForTimeout(1000);

  // Click "Start Filing"
  await clickWithFallback(page, [
    { selector: SELECTORS.caseInfo.startFilingButton, method: 'click', label: 'Start Filing' },
    { selector: 'start filing', method: 'role', roleOptions: { name: /start filing/i }, label: 'Start Filing' },
  ], log);

  // Wait for Start New Case page
  await page.waitForTimeout(3000);
  await screenshot('after-start-filing');

  // Click "Start New Case"
  await clickWithFallback(page, [
    { selector: SELECTORS.caseInfo.startNewCaseButton, method: 'click', label: 'Start New Case' },
    { selector: 'start new case', method: 'role', roleOptions: { name: /start new case/i }, label: 'Start New Case' },
    { selector: 'text=Start New Case', method: 'click', label: 'Start New Case' },
  ], log);

  // Wait for Case Information page
  await page.waitForSelector(SELECTORS.caseInfo.courtLocationText, { timeout: 15000, state: 'visible' });
  log('Case Information page loaded');
  await screenshot('case-information');

  // Fill Court Location (autocomplete) — exact pattern from working original
  log(`Filling Court Location with "${caseConfig.courtLocation}"...`);
  await page.waitForTimeout(2000);

  try {
    const courtLocationInput = page.locator('input:near(:text("Court Location"))').first();
    await courtLocationInput.fill(caseConfig.courtLocation, { timeout: 5000 });
    log('Court Location filled (input field)');
  } catch (_) {
    try {
      await page.selectOption('select:near(:text("Court Location"))', caseConfig.courtLocation, { timeout: 5000 });
      log('Court Location filled (select element)');
    } catch (_2) {
      await page.fill('input[name*="location" i], input[name*="court" i]', caseConfig.courtLocation);
      log('Court Location filled (by name attribute)');
    }
  }

  // Wait for dropdown to populate, then select full option
  await page.waitForTimeout(2000);

  try {
    await page.click(`text=${caseConfig.courtLocationFull}`, { timeout: 5000 });
    log(`Selected "${caseConfig.courtLocationFull}" from dropdown`);
  } catch (_) {
    // Loose regex fallback: "Santa Clara" ... "Civil"
    const parts = caseConfig.courtLocationFull.split(' - ');
    const regex = parts.map(p => p.trim()).join('.*');
    await page.locator(`text=/${regex}/i`).first().click();
    log(`Selected "${caseConfig.courtLocationFull}" (regex fallback)`);
  }

  await page.waitForTimeout(2000);
  await screenshot('after-court-selection');

  // Fill Case Category (autocomplete)
  log(`Filling Case Category: ${caseConfig.caseCategory}`);
  try {
    const input = page.locator('input:near(:text("Case Category"))').first();
    await input.fill(caseConfig.caseCategory, { timeout: 5000 });
    await page.waitForTimeout(1000);
    try {
      await page.click(`text="${caseConfig.caseCategory}"`, { timeout: 3000 });
      log('Case Category selected from dropdown');
    } catch (_) {
      await input.press('Enter');
      log('Case Category confirmed with Enter');
    }
  } catch (_) {
    await page.selectOption('select:near(:text("Case Category"))', caseConfig.caseCategory, { timeout: 5000 });
    log('Case Category selected (select element)');
  }
  await page.waitForTimeout(2000);
  await screenshot('after-case-category');

  // Fill Case Type (autocomplete)
  log(`Filling Case Type: ${caseConfig.caseType}`);
  try {
    const input = page.locator('input:near(:text("Case Type"))').first();
    await input.fill(caseConfig.caseType, { timeout: 5000 });
    await page.waitForTimeout(1000);
    try {
      await page.click(`text=/.*${caseConfig.caseType}.*/i`, { timeout: 3000 });
      log('Case Type selected from dropdown');
    } catch (_) {
      await input.press('Enter');
      log('Case Type confirmed with Enter');
    }
  } catch (_) {
    await page.selectOption('select:near(:text("Case Type"))', caseConfig.caseType, { timeout: 5000 });
    log('Case Type selected (select element)');
  }
  await page.waitForTimeout(2000);
  await screenshot('after-case-type');

  // Navigate to Parties
  ctx.updatePhase(3);
  try {
    await page.getByRole('button', { name: /parties/i }).last().click({ timeout: 5000 });
    log('Clicked Parties button');
  } catch (_) {
    await page.click('button:has-text("Parties")', { timeout: 5000 });
    log('Clicked Parties button (fallback)');
  }
}
