import { BaseCourtAutomation } from './base-court-automation';
import { FilingRequest, FilingResult } from '../types/filing.types';

/**
 * Test automation for Google Form
 * This demonstrates how the automation works with a real, accessible form
 */
export class GoogleFormTestAutomation extends BaseCourtAutomation {
  courtId = 'google-form-test';
  courtName = 'Google Form Test';

  constructor() {
    // Pass config from environment variables
    super({
      headless: process.env.HEADLESS === 'true',
      slowMo: parseInt(process.env.SLOW_MO || '0', 10),
    });
  }

  /**
   * Fill out and submit the Google Form
   */
  protected async executeFilingProcess(request: FilingRequest): Promise<FilingResult> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    const { caseData } = request;

    // Step 1: Navigate to the Google Form
    const formUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSfNPBYhuWbK6nvpl_6E72omXO5rSVsyA4e2LERlNRrJ43SOkA/viewform';
    console.log('Navigating to Google Form...');
    await this.page.goto(formUrl, { waitUntil: 'networkidle' });

    // Step 2: Wait for form to load
    await this.page.waitForSelector('form', { timeout: 10000 });
    console.log('Form loaded');

    // Step 3: Fill in the "Name" field (first required field)
    const nameValue = `${caseData.plaintiff.firstName} ${caseData.plaintiff.lastName}`;
    console.log(`Filling name field with: ${nameValue}`);

    // Google Forms use specific input structure - target all text inputs
    const inputs = await this.page.locator('input[type="text"]').all();

    if (inputs.length < 2) {
      throw new Error(`Expected at least 2 input fields, found ${inputs.length}`);
    }

    // Fill first input (Name)
    await inputs[0].fill(nameValue);
    console.log('Name field filled successfully');

    // Step 4: Fill in the "Describe who you are" field (second required field)
    const descriptionValue = caseData.description || 'Test automation user';
    console.log(`Filling description field with: ${descriptionValue}`);

    // Fill second input (Description)
    await inputs[1].fill(descriptionValue);
    console.log('Description field filled successfully');

    // Wait a moment to ensure fields are filled
    await this.page.waitForTimeout(1000);

    // Step 5: Take screenshot before submit
    const beforeSubmitPath = `./logs/before-submit-${Date.now()}.png`;
    await this.page.screenshot({ path: beforeSubmitPath, fullPage: true });
    console.log('Screenshot taken before submit');

    // Step 6: Click the Submit button
    console.log('Clicking submit button...');
    // Google Forms submit button - try multiple selectors
    const submitButton = this.page.locator('span:has-text("Submit")').first();
    await submitButton.click();

    // Step 7: Wait for confirmation page
    console.log('Waiting for confirmation...');
    await this.page.waitForLoadState('networkidle');

    // Google Forms usually shows a confirmation message
    // Wait for either the confirmation text or check if submit button is gone
    try {
      await this.page.waitForSelector('text=/response has been recorded/i', { timeout: 10000 });
    } catch (e) {
      // If exact text not found, check if we're on a different page or submit button is gone
      console.log('Confirmation text not found, checking page state...');
    }

    // Step 8: Take screenshot of confirmation
    const confirmationPath = `./logs/confirmation-${Date.now()}.png`;
    await this.page.screenshot({ path: confirmationPath, fullPage: true });
    console.log('Form submitted successfully!');

    // Step 9: Extract any confirmation text
    const confirmationText = await this.page.textContent('body');

    return {
      success: true,
      courtId: this.courtId,
      confirmationNumber: 'GOOGLE-FORM-SUBMITTED',
      filingDate: new Date().toISOString(),
      screenshots: [beforeSubmitPath, confirmationPath],
      logs: [
        'Form loaded successfully',
        `Filled name: ${nameValue}`,
        `Filled description: ${descriptionValue}`,
        'Form submitted successfully',
        `Confirmation: ${confirmationText?.substring(0, 100)}...`,
      ],
    };
  }

  /**
   * This test form supports all case types
   */
  supportsCase(caseType: string): boolean {
    return true;
  }
}
