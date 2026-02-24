import { StepContext } from '../../../types/california-efile.types';
import { SELECTORS } from '../selectors';
import { clickWithFallback } from '../helpers/click';

/**
 * Phase 5: Select payment account, party responsible, calculate fees, navigate to Summary.
 */
export async function fillFees(ctx: StepContext): Promise<void> {
  const { page, config, screenshot, log } = ctx;
  const { caseConfig, partyData } = config;

  // Select Payment Account (autocomplete)
  log('Selecting Payment Account...');
  await page.waitForTimeout(2000);

  try {
    const input = page.locator(SELECTORS.fees.paymentAccountInput).first();
    await input.click({ timeout: 5000 });
    log('Payment Account field clicked');
    await page.waitForTimeout(500);

    await input.fill(caseConfig.paymentAccount, { timeout: 5000 });
    log(`Typed "${caseConfig.paymentAccount}" into Payment Account`);
    await page.waitForTimeout(1500);

    await page.click(`text=${caseConfig.paymentAccount} Payment Account`, { timeout: 5000 });
    log('Payment Account selected from autocomplete');
  } catch (_) {
    try {
      await page.locator(`forge-option:has-text("${caseConfig.paymentAccount} Payment Account")`).click({ timeout: 5000 });
      log('Payment Account selected (forge-option)');
    } catch (_2) {
      const input = page.locator(SELECTORS.fees.paymentAccountInput).first();
      await input.fill(`${caseConfig.paymentAccount} Payment Account`, { timeout: 5000 });
      await input.press('Enter');
      log('Payment Account selected (Enter key)');
    }
  }

  await page.waitForTimeout(2000);
  await screenshot('after-payment-account');

  // Select Party Responsible for Fees
  log('Selecting Party Responsible for Fees...');
  await page.waitForTimeout(2000);

  const fullName = [partyData.firstName, partyData.middleName, partyData.lastName]
    .filter(Boolean).join(' ');
  log(`Party name: ${fullName}`);

  try {
    const select = page.locator(SELECTORS.fees.partyResponsibleSelect);
    await select.click({ force: true, timeout: 5000 });
    log('Party Responsible dropdown clicked');
    await page.waitForTimeout(1000);

    await page.keyboard.type(partyData.firstName, { delay: 100 });
    log(`Typed first name: ${partyData.firstName}`);
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    log(`Selected party: ${fullName}`);
  } catch (_) {
    try {
      await page.locator('forge-select').click({ force: true, timeout: 5000 });
      await page.waitForTimeout(1000);
      await page.keyboard.type(partyData.firstName, { delay: 100 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      log(`Selected party: ${fullName} (forge-select tag)`);
    } catch (_2) {
      await page.locator(`forge-option:has-text("${fullName}")`).click({ force: true, timeout: 5000 });
      log(`Selected party: ${fullName} (forge-option)`);
    }
  }

  await page.waitForTimeout(2000);
  await screenshot('after-party-responsible');

  // Calculate Fees
  log('Clicking Calculate Fees...');
  await page.waitForTimeout(2000);
  await clickWithFallback(page, [
    { selector: 'forge-button:has-text("Calculate Fees")', method: 'locator', label: 'Calculate Fees' },
    { selector: 'text=Calculate Fees', method: 'click', label: 'Calculate Fees' },
  ], log);

  await page.waitForTimeout(3000);
  await screenshot('after-calculate-fees');

  // Navigate to Summary
  ctx.updatePhase(6);
  log('Clicking Summary...');
  await page.waitForTimeout(2000);

  try {
    await page.locator(SELECTORS.fees.feesNextButton).click({ timeout: 5000 });
    log('Summary clicked (forge-button#fees-next)');
  } catch (_) {
    try {
      await page.locator('forge-button:has-text("Summary")').click({ timeout: 5000 });
      log('Summary clicked (forge-button with text)');
    } catch (_2) {
      await page.getByRole('button', { name: /Summary/i }).click({ timeout: 5000 });
      log('Summary clicked (getByRole)');
    }
  }

  await page.waitForTimeout(3000);
}
