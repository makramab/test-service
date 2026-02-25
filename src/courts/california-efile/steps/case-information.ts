import { StepContext } from '../../../types/california-efile.types';
import { SELECTORS } from '../selectors';
import { clickWithFallback } from '../helpers/click';
import { lookupCourt, pickCaseTypeByAmount, CourtEntry } from '../court-registry';

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

  // Look up court entry from registry
  const courtEntry = lookupCourt(caseConfig.county);

  if (courtEntry) {
    log(`Court registry match for "${caseConfig.county}": ${courtEntry.dropdownMatch}`);
    await fillCourtFromRegistry(ctx, courtEntry);
  } else {
    log(`No registry entry for "${caseConfig.county}" — using legacy fallback`);
    await fillCourtLegacy(ctx);
  }

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

/**
 * Fill court/category/type using the court registry (dynamic path).
 */
async function fillCourtFromRegistry(ctx: StepContext, court: CourtEntry): Promise<void> {
  const { page, config, screenshot, log } = ctx;
  const { caseConfig } = config;

  // --- Court Location ---
  log(`Typing court search: "${court.searchTerm}"`);
  await page.waitForTimeout(2000);

  const courtInput = page.locator('input:near(:text("Court Location"))').first();
  await courtInput.fill(court.searchTerm, { timeout: 5000 });
  log('Court Location search typed');

  await page.waitForTimeout(2000);

  // Click the dropdown option (use includes-based matching)
  try {
    await page.locator(`text=${court.dropdownMatch}`).first().click({ timeout: 5000 });
    log(`Selected "${court.dropdownMatch}" from dropdown`);
  } catch (_) {
    // Regex fallback: match parts separated by anything
    const parts = court.dropdownMatch.split(' - ');
    const regex = parts.map(p => p.trim()).join('.*');
    await page.locator(`text=/${regex}/i`).first().click({ timeout: 5000 });
    log(`Selected "${court.dropdownMatch}" (regex fallback)`);
  }

  await page.waitForTimeout(2000);
  await screenshot('after-court-selection');

  // --- Case Category ---
  if (court.caseCategoryAutoFilled) {
    log('Case Category auto-filled by court selection — skipping');
  } else {
    log('Filling Case Category: Small Claims');
    try {
      const input = page.locator('input:near(:text("Case Category"))').first();
      await input.fill('Small Claims', { timeout: 5000 });
      await page.waitForTimeout(1000);
      try {
        await page.click('text="Small Claims"', { timeout: 3000 });
        log('Case Category selected from dropdown');
      } catch (_) {
        await input.press('Enter');
        log('Case Category confirmed with Enter');
      }
    } catch (_) {
      await page.selectOption('select:near(:text("Case Category"))', 'Small Claims', { timeout: 5000 });
      log('Case Category selected (select element)');
    }
  }
  await page.waitForTimeout(2000);
  await screenshot('after-case-category');

  // --- Case Type (select by claim amount) ---
  log(`Selecting Case Type for claim amount: $${caseConfig.claimAmount}`);

  // Open the Case Type dropdown and read all options
  const caseTypeInput = page.locator('input:near(:text("Case Type"))').first();
  await caseTypeInput.click({ timeout: 5000 });
  await page.waitForTimeout(1000);

  // Type the pattern to filter options
  await caseTypeInput.fill(court.caseTypePattern, { timeout: 5000 });
  await page.waitForTimeout(1500);

  // Read all visible dropdown options
  const optionElements = page.locator('[role="option"], forge-option, mat-option, .cdk-option, li[class*="option"]');
  const optionCount = await optionElements.count();

  if (optionCount > 0) {
    // Collect option texts
    const optionTexts: string[] = [];
    for (let i = 0; i < optionCount; i++) {
      const text = await optionElements.nth(i).textContent();
      if (text) optionTexts.push(text.trim());
    }
    log(`Found ${optionTexts.length} Case Type options: ${optionTexts.join(' | ')}`);

    // Pick the right tier by claim amount
    const selected = pickCaseTypeByAmount(optionTexts, court.caseTypePattern, caseConfig.claimAmount);

    if (selected) {
      log(`Matched Case Type: "${selected}"`);
      await page.locator(`text=${selected}`).first().click({ timeout: 5000 });
      log('Case Type selected');
    } else {
      // Fallback: click first matching option
      log('No amount match — clicking first option');
      await optionElements.first().click({ timeout: 5000 });
      log('Case Type selected (first option fallback)');
    }
  } else {
    // No structured options found — try typing + Enter
    log('No dropdown options detected — trying type + Enter');
    await caseTypeInput.clear();
    await caseTypeInput.fill(court.caseTypePattern, { timeout: 5000 });
    await page.waitForTimeout(1000);
    await caseTypeInput.press('Enter');
    log('Case Type confirmed with Enter');
  }

  await page.waitForTimeout(2000);
  await screenshot('after-case-type');
}

/**
 * Legacy fallback: fill court/category/type using hardcoded CaseConfig values.
 * Used when the county is not in the court registry.
 */
async function fillCourtLegacy(ctx: StepContext): Promise<void> {
  const { page, config, screenshot, log } = ctx;
  const { caseConfig } = config;

  // Court Location
  log(`[Legacy] Filling Court Location: "${caseConfig.courtLocation}"`);
  await page.waitForTimeout(2000);

  try {
    const courtInput = page.locator('input:near(:text("Court Location"))').first();
    await courtInput.fill(caseConfig.courtLocation, { timeout: 5000 });
    log('Court Location filled');
  } catch (_) {
    try {
      await page.selectOption('select:near(:text("Court Location"))', caseConfig.courtLocation, { timeout: 5000 });
      log('Court Location filled (select element)');
    } catch (_2) {
      await page.fill('input[name*="location" i], input[name*="court" i]', caseConfig.courtLocation);
      log('Court Location filled (by name attribute)');
    }
  }

  await page.waitForTimeout(2000);

  try {
    await page.click(`text=${caseConfig.courtLocationFull}`, { timeout: 5000 });
    log(`Selected "${caseConfig.courtLocationFull}" from dropdown`);
  } catch (_) {
    const parts = caseConfig.courtLocationFull.split(' - ');
    const regex = parts.map(p => p.trim()).join('.*');
    await page.locator(`text=/${regex}/i`).first().click();
    log(`Selected "${caseConfig.courtLocationFull}" (regex fallback)`);
  }

  await page.waitForTimeout(2000);
  await screenshot('after-court-selection');

  // Case Category
  log(`[Legacy] Filling Case Category: ${caseConfig.caseCategory}`);
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

  // Case Type
  log(`[Legacy] Filling Case Type: ${caseConfig.caseType}`);
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
}
