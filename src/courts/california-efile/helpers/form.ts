import { PageOrFrame } from '../../../types/california-efile.types';

/**
 * Fill a form field using label → placeholder → name fallback chain.
 * Works for both standard inputs and text fields in Forge web components.
 */
export async function fillField(
  frame: PageOrFrame,
  label: string,
  value: string,
  log: (msg: string) => void,
): Promise<void> {
  log(`Filling "${label}": ${value}`);

  // Approach 1: Find by label text
  try {
    const labelLocator = frame.locator(`label:has-text("${label}")`);
    const count = await labelLocator.count();
    if (count > 0) {
      const input = labelLocator.locator('..').locator('input').first();
      await input.fill(value, { timeout: 5000 });
      log(`"${label}" filled (via label)`);
      return;
    }
  } catch (_) { /* fall through */ }

  // Approach 2: Find by placeholder
  try {
    await frame.fill(`input[placeholder*="${label}" i]`, value, { timeout: 5000 });
    log(`"${label}" filled (via placeholder)`);
    return;
  } catch (_) { /* fall through */ }

  // Approach 3: Find by name attribute (camelCase version)
  const nameAttr = label.replace(/\s+/g, '').replace(/^./, c => c.toLowerCase());
  await frame.fill(`input[name*="${nameAttr}" i]`, value, { timeout: 5000 });
  log(`"${label}" filled (via name attribute)`);
}

/**
 * Fill an autocomplete field: type a value, wait for dropdown, then click the matching option.
 */
export async function fillAutocomplete(
  frame: PageOrFrame,
  label: string,
  typeValue: string,
  selectText: string,
  log: (msg: string) => void,
): Promise<void> {
  log(`Filling autocomplete "${label}" with "${typeValue}"...`);

  // Type into the input
  try {
    const input = frame.locator(`input:near(:text("${label}"))`).first();
    await input.fill(typeValue, { timeout: 5000 });
    log(`"${label}" typed (input field)`);
  } catch (_) {
    try {
      await frame.selectOption(`select:near(:text("${label}"))`, typeValue, { timeout: 5000 });
      log(`"${label}" selected (select element)`);
      return;
    } catch (_2) {
      const nameAttr = label.toLowerCase().replace(/\s+/g, '');
      await frame.fill(`input[name*="${nameAttr}" i]`, typeValue);
      log(`"${label}" typed (name attribute)`);
    }
  }

  // Wait for dropdown to populate
  await frame.waitForTimeout(2000);

  // Click the matching option
  try {
    await frame.click(`text=${selectText}`, { timeout: 5000 });
    log(`Selected "${selectText}" from dropdown`);
  } catch (_) {
    await frame.locator(`text=/${selectText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i`).first().click();
    log(`Selected "${selectText}" (regex fallback)`);
  }
}

/**
 * Fill a field by finding its label's `for` attribute, then targeting the element by ID.
 * Used for Filing Description, Client Reference Number, Comments to Court.
 */
export async function fillFieldByForAttr(
  frame: PageOrFrame,
  label: string,
  value: string,
  log: (msg: string) => void,
): Promise<void> {
  log(`Filling "${label}" (via for-attr): ${value.slice(0, 60)}...`);

  const labelLocator = frame.locator(`label:has-text("${label}")`).first();
  const forAttr = await labelLocator.getAttribute('for');

  if (!forAttr) {
    throw new Error(`"${label}" label has no for attribute`);
  }

  const input = frame.locator(`#${forAttr}`);
  await input.fill(value, { timeout: 5000 });
  log(`"${label}" filled`);
}

/**
 * Fill Lead Attorney autocomplete: click input, try dropdown, then type + Enter fallback.
 */
export async function fillLeadAttorney(
  frame: PageOrFrame,
  page: PageOrFrame,
  value: string,
  log: (msg: string) => void,
): Promise<void> {
  log(`Filling Lead Attorney: ${value}`);

  try {
    const label = frame.locator('label:has-text("Lead Attorney")');
    const count = await label.count();
    if (count === 0) throw new Error('Lead Attorney label not found');

    const input = label.locator('..').locator('input').first();
    await input.click({ timeout: 5000 });
    log('Clicked Lead Attorney input');
    await page.waitForTimeout(1000);

    // Try clicking dropdown option directly
    try {
      await frame.click(`text="${value}"`, { timeout: 3000 });
      log(`Clicked "${value}" from dropdown`);
      return;
    } catch (_) { /* fall through */ }

    // Type and retry
    await input.fill(value, { timeout: 5000 });
    await page.waitForTimeout(1000);

    try {
      await frame.click(`text="${value}"`, { timeout: 3000 });
      log(`Clicked "${value}" from dropdown after typing`);
    } catch (_) {
      await input.press('Enter');
      log('Pressed Enter on Lead Attorney field');
    }
  } catch (_) {
    log('Label-based approach failed, trying placeholder...');
    const input = frame.locator('input[placeholder*="Attorney" i]').first();
    await input.click();
    await page.waitForTimeout(500);
    await frame.click(`text="${value}"`, { timeout: 3000 });
    log('Lead Attorney filled (via placeholder)');
  }
}
