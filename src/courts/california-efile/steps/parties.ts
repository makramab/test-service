import { StepContext, PartyData, PageOrFrame } from '../../../types/california-efile.types';
import { SELECTORS } from '../selectors';
import { fillField, fillLeadAttorney } from '../helpers/form';
import { findFrameWithInputs } from '../helpers/iframe';

/**
 * Fill a single party form (plaintiff or defendant). Handles iframe detection,
 * personal info, address, attorney, and save.
 */
async function fillPartyForm(
  ctx: StepContext,
  party: PartyData,
  role: 'plaintiff' | 'defendant',
): Promise<void> {
  const { page, screenshot, log } = ctx;

  // Click "Add party details"
  log(`Clicking "Add party details" for ${role}...`);
  try {
    await page.click(SELECTORS.parties.addPartyDetails, { timeout: 5000 });
  } catch (_) {
    await page.click('button:has-text("Add party details")', { timeout: 5000 });
  }
  log(`Add party details clicked for ${role}`);

  // Wait for Edit Party Details modal
  await page.waitForSelector(SELECTORS.parties.editPartyDetailsHeading, { timeout: 15000, state: 'visible' });
  await page.waitForSelector(SELECTORS.parties.firstNameText, { timeout: 10000, state: 'visible' });
  await page.waitForTimeout(2000);

  // Detect if form is in an iframe
  const frame: PageOrFrame = await findFrameWithInputs(page, 'input', log);
  await screenshot(`${role}-modal`);

  // Personal info
  await fillField(frame, 'First Name', party.firstName, log);
  await fillField(frame, 'Last Name', party.lastName, log);
  await fillField(frame, 'Date of Birth', party.dateOfBirth, log);

  await page.waitForTimeout(1000);
  await screenshot(`${role}-personal-info`);

  // Scroll to contact info
  await frame.evaluate('window.scrollBy(0, 400)');
  await page.waitForTimeout(1000);

  // Address
  await fillField(frame, 'Address Line 1', party.address.addressLine1, log);
  await fillField(frame, 'City', party.address.city, log);

  // State (autocomplete)
  log(`Filling State: ${party.address.state}`);
  try {
    const stateLabel = frame.locator('label:has-text("State")');
    const count = await stateLabel.count();
    if (count > 0) {
      const input = stateLabel.locator('..').locator('input').first();
      await input.fill(party.address.state, { timeout: 5000 });
      log('State filled (via label)');
      await page.waitForTimeout(1000);
      try {
        await frame.click(`text="${party.address.state}"`, { timeout: 3000 });
        log(`Clicked "${party.address.state}" from dropdown`);
      } catch (_) {
        log('Dropdown click not needed or already selected');
      }
    } else {
      throw new Error('State label not found');
    }
  } catch (_) {
    try {
      await frame.selectOption('select:near(:text("State"))', party.address.state, { timeout: 5000 });
      log('State selected from dropdown');
    } catch (_2) {
      try {
        await frame.fill('input[name*="state" i]', party.address.state, { timeout: 5000 });
      } catch (_3) {
        await frame.fill('input[placeholder*="State" i]', party.address.state, { timeout: 5000 });
      }
      log('State filled (fallback)');
    }
  }

  await fillField(frame, 'Zip Code', party.address.zipCode, log);
  await fillField(frame, 'Phone Number', party.phoneNumber, log);

  await page.waitForTimeout(1000);

  // Scroll to Attorney section
  await frame.evaluate('window.scrollBy(0, 400)');
  await page.waitForTimeout(1000);

  // Lead Attorney
  await fillLeadAttorney(frame, page, party.leadAttorney, log);

  await page.waitForTimeout(2000);
  await screenshot(`${role}-complete`);

  // Save
  log(`Clicking Save for ${role}...`);
  try {
    await frame.click('button:has-text("Save")', { timeout: 5000 });
  } catch (_) {
    await page.getByRole('button', { name: /save/i }).click({ timeout: 5000 });
  }
  log(`${role} saved`);

  // Wait for modal to close
  await page.waitForTimeout(3000);
  await page.waitForSelector(SELECTORS.parties.partiesText, { timeout: 10000, state: 'visible' });
  log(`Back on Parties page after ${role}`);
  await screenshot(`parties-after-${role}`);
}

/**
 * Phase 3: Add plaintiff + defendant party details, then navigate to Filings.
 */
export async function fillParties(ctx: StepContext): Promise<void> {
  const { page, config, log } = ctx;

  // Wait for Parties page
  await page.waitForSelector(SELECTORS.parties.addPartyDetails, { timeout: 10000, state: 'visible' });
  log('Parties page loaded');

  // Fill plaintiff
  await fillPartyForm(ctx, config.partyData, 'plaintiff');

  await page.waitForTimeout(2000);

  // Fill defendant
  await fillPartyForm(ctx, config.defendantData, 'defendant');

  // Navigate to Filings
  ctx.updatePhase(4);
  log('Clicking Filings button...');
  try {
    await page.locator(SELECTORS.parties.partiesNextButton).click({ timeout: 5000 });
    log('Clicked Filings (forge-button#parties-next)');
  } catch (_) {
    await page.getByRole('button', { name: 'Filings', exact: true }).click({ timeout: 5000 });
    log('Clicked Filings (getByRole exact)');
  }
}
