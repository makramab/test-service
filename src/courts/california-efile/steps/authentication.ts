import { StepContext } from '../../../types/california-efile.types';
import { SELECTORS } from '../selectors';
import { findFrameWithInputs } from '../helpers/iframe';

/**
 * Phase 1: Navigate to eFile portal, open login modal, enter credentials, wait for dashboard.
 */
export async function authenticate(ctx: StepContext): Promise<void> {
  const { page, config, screenshot, log } = ctx;
  const { credentials, caseConfig } = config;

  // Navigate to landing page
  log('Navigating to California eFile...');
  await page.goto(caseConfig.landingUrl, { waitUntil: 'networkidle', timeout: 60000 });
  log('Landing page loaded');

  // Click "Sign in to your account"
  log('Clicking sign-in button...');
  try {
    await page.locator(SELECTORS.auth.signInButton).click({ timeout: 5000 });
    log('Sign-in button clicked (ID selector)');
  } catch (_) {
    await page.getByRole('button', { name: /sign in to your account/i }).click({ timeout: 5000 });
    log('Sign-in button clicked (role fallback)');
  }

  // Wait for login modal
  log('Waiting for login modal...');
  let modalAppeared = false;
  for (const selector of SELECTORS.auth.modal) {
    try {
      await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
      log(`Modal appeared (${selector})`);
      modalAppeared = true;
      break;
    } catch (_) { /* try next */ }
  }
  if (!modalAppeared) {
    log('No modal detected, waiting 3s...');
    await page.waitForTimeout(3000);
  }

  // Wait for modal content to load
  await page.waitForTimeout(3000);
  await screenshot('after-sign-in-click');

  // Find frame containing login inputs
  const targetFrame = await findFrameWithInputs(page, SELECTORS.auth.usernameInput, log);

  // Fill credentials
  log(`Filling email: ${credentials.email}`);
  await targetFrame.waitForSelector(SELECTORS.auth.usernameInput, { timeout: 10000, state: 'visible' });
  await targetFrame.fill(SELECTORS.auth.usernameInput, credentials.email);

  log('Filling password...');
  await targetFrame.waitForSelector(SELECTORS.auth.passwordInput, { timeout: 5000, state: 'visible' });
  await targetFrame.fill(SELECTORS.auth.passwordInput, credentials.password);

  await screenshot('before-login');

  // Submit
  log('Clicking Sign In submit button...');
  await targetFrame.click(SELECTORS.auth.signInSubmit, { timeout: 5000 });

  // Wait for dashboard
  log('Waiting for dashboard...');
  await page.waitForSelector(SELECTORS.auth.startFilingText, { timeout: 15000, state: 'visible' });

  await screenshot('after-login');
  log('Login completed successfully');
}
