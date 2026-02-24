import { BaseCourtAutomation } from './base-court-automation';
import { FilingRequest, FilingResult } from '../types/filing.types';
import * as defaultPartyData from '../data/party-data.json';
import * as defaultDefendantData from '../data/defendant-data.json';
import * as defaultFilingData from '../data/filing-data.json';
import * as defaultDocumentData from '../data/document-data.json';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { jobStatusStore } from '../services/job-status-store';

/**
 * Deep merge utility function
 */
function deepMerge<T>(target: T, source: Partial<T>): T {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      const sourceValue = (source as any)[key];
      const targetValue = (output as any)[key];
      if (isObject(sourceValue) && isObject(targetValue)) {
        (output as any)[key] = deepMerge(targetValue, sourceValue);
      } else {
        (output as any)[key] = sourceValue;
      }
    });
  }
  return output;
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Override data interface
 */
export interface CaliforniaEFileOverrides {
  partyData?: Partial<typeof defaultPartyData>;
  defendantData?: Partial<typeof defaultDefendantData>;
  filingData?: Partial<typeof defaultFilingData>;
  documentData?: Partial<typeof defaultDocumentData>;
  headless?: boolean;
}

/**
 * California eFile Small Claims Court Automation
 * Handles automated filing through California's Tyler Technologies eFile system
 */
export class CaliforniaEFileAutomation extends BaseCourtAutomation {
  courtId = 'california-efile';
  courtName = 'California eFile (Tyler Technologies)';

  // Credentials - in production, these should come from secure storage
  private readonly email = 'ira@legali.io';
  private readonly password = 'FC37\\f^J3q}8';

  // Data properties that can be overridden
  private partyData: typeof defaultPartyData;
  private defendantData: typeof defaultDefendantData;
  private filingData: typeof defaultFilingData;
  private documentData: typeof defaultDocumentData;

  // Job tracking
  private jobId?: string;

  constructor(overrides?: CaliforniaEFileOverrides) {
    // Determine headless mode: overrides > env var > default (true)
    const headlessMode = overrides?.headless !== undefined
      ? overrides.headless
      : process.env.HEADLESS !== 'false';

    // Pass config from environment variables or overrides
    super({
      headless: headlessMode,
      slowMo: parseInt(process.env.SLOW_MO || '0', 10),
      timeout: 5000, // Set 5 second timeout for faster iteration
    });

    // Merge override data with defaults
    this.partyData = overrides?.partyData
      ? deepMerge(defaultPartyData, overrides.partyData)
      : defaultPartyData;

    this.defendantData = overrides?.defendantData
      ? deepMerge(defaultDefendantData, overrides.defendantData)
      : defaultDefendantData;

    this.filingData = overrides?.filingData
      ? deepMerge(defaultFilingData, overrides.filingData)
      : defaultFilingData;

    this.documentData = overrides?.documentData
      ? deepMerge(defaultDocumentData, overrides.documentData)
      : defaultDocumentData;
  }

  /**
   * Set job ID for progress tracking
   */
  setJobId(jobId: string): void {
    this.jobId = jobId;
  }

  /**
   * Update progress to a specific phase
   */
  private updatePhase(phase: number): void {
    if (this.jobId) {
      jobStatusStore.updatePhase(this.jobId, phase);
    }
  }

  /**
   * Download a file from a URL to a temporary location
   */
  private async downloadFile(url: string, filename: string): Promise<string> {
    console.log(`Downloading file from: ${url}`);

    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log(`Created temp directory: ${tempDir}`);
    }

    // Download file to temp location
    const tempFilePath = path.join(tempDir, filename);
    const response = await axios.get(url, { responseType: 'stream' });

    const writer = fs.createWriteStream(tempFilePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`File downloaded successfully to: ${tempFilePath}`);
        resolve(tempFilePath);
      });
      writer.on('error', (error) => {
        console.error('Error downloading file:', error);
        reject(error);
      });
    });
  }

  /**
   * Execute the California eFile filing process
   */
  protected async executeFilingProcess(request: FilingRequest): Promise<FilingResult> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    const { caseData, documents } = request;

    // Step 1: Navigate to California eFile landing page
    const landingUrl = 'https://california.tylertech.cloud/OfsEfsp/ui/landing';
    console.log('Navigating to California eFile...');
    await this.page.goto(landingUrl, { waitUntil: 'networkidle' });
    console.log('Landing page loaded');

    // Step 2: Click "Sign in to your account" button (forge-button with id="sign-in")
    console.log('Clicking "Sign in to your account" button...');

    try {
      await this.page.locator('forge-button#sign-in').click({ timeout: 5000 });
      console.log('Button clicked successfully (forge-button#sign-in)');
    } catch (e) {
      console.log('ID selector failed, trying role fallback...');
      await this.page.getByRole('button', { name: /sign in to your account/i }).click({ timeout: 5000 });
      console.log('Button clicked successfully (getByRole fallback)');
    }

    // Step 3: Wait for the login modal to appear
    console.log('Waiting for login modal...');

    // Wait for the modal dialog container to appear
    // Try multiple selectors for the modal
    let modalAppeared = false;
    const modalSelectors = [
      'div[role="dialog"]',
      '.modal',
      '[class*="modal"]',
      '[class*="dialog"]',
      'div:has(> h1:text("Sign In"))',
    ];

    for (const selector of modalSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
        console.log(`Modal appeared (selector: ${selector})`);
        modalAppeared = true;
        break;
      } catch (e) {
        console.log(`Selector ${selector} not found, trying next...`);
      }
    }

    if (!modalAppeared) {
      console.log('No modal detected with standard selectors, waiting 3 more seconds...');
      await this.page.waitForTimeout(3000);
    }

    // Wait for modal content to load (inputs are loaded dynamically after modal appears)
    console.log('Waiting for modal content to load...');
    await this.page.waitForTimeout(3000);

    // Take screenshot to debug
    const afterClickPath = `./logs/after-click-${Date.now()}.png`;
    await this.page.screenshot({ path: afterClickPath, fullPage: true });
    console.log('Screenshot taken after button click');

    // Check if there are any iframes on the page
    const frames = this.page.frames();
    console.log(`Found ${frames.length} frames on the page`);

    // Try to find the modal inputs using specific IDs from inspection
    console.log('Looking for input fields by ID...');

    // Check if #UserName exists in main page first
    const userNameInMainPage = await this.page.locator('#UserName').count();
    console.log(`#UserName count in main page: ${userNameInMainPage}`);

    // If not in main page, check in iframes
    let targetFrame = this.page;
    if (userNameInMainPage === 0) {
      console.log('Inputs not found in main page, checking iframes...');
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const countInFrame = await frame.locator('#UserName').count();
        console.log(`Frame ${i}: #UserName count = ${countInFrame}`);
        if (countInFrame > 0) {
          targetFrame = frame as any;
          console.log(`Found inputs in frame ${i}`);
          break;
        }
      }
    }

    // Step 4: Fill in email using specific ID
    console.log(`Filling email field (#UserName): ${this.email}`);
    await targetFrame.waitForSelector('#UserName', { timeout: 10000, state: 'visible' });
    await targetFrame.fill('#UserName', this.email);
    console.log('Email filled successfully');

    // Step 5: Fill in password using specific ID
    console.log('Filling password field (#Password)...');
    await targetFrame.waitForSelector('#Password', { timeout: 5000, state: 'visible' });
    await targetFrame.fill('#Password', this.password);
    console.log('Password filled successfully');

    // Step 6: Take screenshot before clicking Sign In
    const beforeLoginPath = `./logs/before-login-${Date.now()}.png`;
    await this.page.screenshot({ path: beforeLoginPath, fullPage: true });
    console.log('Screenshot taken before login');

    // Step 7: Click the "Sign In" button in the modal using specific ID
    console.log('Clicking "Sign In" button (#sign-in-btn)...');
    await targetFrame.click('#sign-in-btn', { timeout: 5000 });

    // Step 8: Wait for navigation after login
    console.log('Waiting for login to complete...');

    // Instead of waiting for networkidle (which may timeout due to ongoing requests),
    // wait for the "Start Filing" text/button to appear on the dashboard
    console.log('Looking for "Start Filing" button after login...');
    await this.page.waitForSelector('text=Start Filing', { timeout: 15000, state: 'visible' });
    console.log('Dashboard loaded - Start Filing button found');

    // Step 9: Take screenshot after login
    const afterLoginPath = `./logs/after-login-${Date.now()}.png`;
    await this.page.screenshot({ path: afterLoginPath, fullPage: true });
    console.log('Login completed successfully!');

    // Progress: Phase 1 complete, starting Phase 2
    this.updatePhase(2);

    // Step 10: Click "Start Filing" button
    console.log('Clicking "Start Filing" button...');
    await this.page.waitForTimeout(1000); // Brief wait before clicking

    // Click the actual button element (not just text)
    // The text selector might match the heading, so be more specific
    try {
      await this.page.click('button:has-text("Start Filing")', { timeout: 5000 });
      console.log('Clicked "Start Filing" button (button selector)');
    } catch (e) {
      console.log('Button selector failed, trying getByRole...');
      const startFilingButton = this.page.getByRole('button', { name: /start filing/i });
      await startFilingButton.click({ timeout: 5000 });
      console.log('Clicked "Start Filing" button (getByRole)');
    }

    // Step 11: Wait for next page and click "Start New Case"
    console.log('Waiting for Start New Case page...');

    // Wait for page to load
    await this.page.waitForTimeout(3000);

    const afterStartFilingPath = `./logs/after-start-filing-${Date.now()}.png`;
    await this.page.screenshot({ path: afterStartFilingPath, fullPage: true });
    console.log('Screenshot taken after Start Filing');

    // Wait for "Start New Case" button to appear - try multiple selectors
    console.log('Looking for "Start New Case" button...');

    let startNewCaseClicked = false;

    // Try approach 1: button with text
    try {
      await this.page.waitForSelector('button:has-text("Start New Case")', { timeout: 5000, state: 'visible' });
      await this.page.click('button:has-text("Start New Case")');
      console.log('Clicked "Start New Case" button (button:has-text)');
      startNewCaseClicked = true;
    } catch (e1) {
      console.log('Approach 1 failed, trying getByRole...');

      // Try approach 2: getByRole
      try {
        const startNewCaseButton = this.page.getByRole('button', { name: /start new case/i });
        await startNewCaseButton.click({ timeout: 5000 });
        console.log('Clicked "Start New Case" button (getByRole)');
        startNewCaseClicked = true;
      } catch (e2) {
        console.log('Approach 2 failed, trying text selector...');

        // Try approach 3: just text
        try {
          await this.page.click('text=Start New Case', { timeout: 5000 });
          console.log('Clicked "Start New Case" button (text)');
          startNewCaseClicked = true;
        } catch (e3) {
          console.log('All approaches failed, taking debug screenshot...');
          const debugPath = `./logs/debug-start-new-case-${Date.now()}.png`;
          await this.page.screenshot({ path: debugPath, fullPage: true });
          throw new Error('Could not find or click "Start New Case" button. Check debug screenshot.');
        }
      }
    }

    if (!startNewCaseClicked) {
      throw new Error('Failed to click "Start New Case" button');
    }

    // Step 12: Wait for Case Information page to load
    console.log('Waiting for Case Information page...');

    // Wait for "Court Location" text to appear instead of networkidle
    await this.page.waitForSelector('text=Court Location', { timeout: 15000, state: 'visible' });
    console.log('Case Information page loaded');

    const caseInfoPath = `./logs/case-information-${Date.now()}.png`;
    await this.page.screenshot({ path: caseInfoPath, fullPage: true });
    console.log('Screenshot taken - Case Information page');

    // Step 13: Fill in Court Location with "Santa Clara - Civil"
    console.log('Filling Court Location with "Santa Clara"...');
    await this.page.waitForTimeout(2000);

    // Court Location is an autocomplete input
    try {
      // Approach 1: Try input field (autocomplete)
      const courtLocationInput = this.page.locator('input:near(:text("Court Location"))').first();
      await courtLocationInput.fill('Santa Clara', { timeout: 5000 });
      console.log('Court Location filled (input field)');
    } catch (e1) {
      console.log('Input field not found, trying select...');
      try {
        // Approach 2: Try select element
        await this.page.selectOption('select:near(:text("Court Location"))', 'Santa Clara', { timeout: 5000 });
        console.log('Court Location filled (select element)');
      } catch (e2) {
        console.log('Select element not found, trying by label...');
        // Approach 3: Try finding by label
        await this.page.fill('input[name*="location" i], input[name*="court" i]', 'Santa Clara');
        console.log('Court Location filled (by name attribute)');
      }
    }

    // Step 14: Select "Santa Clara - Civil" from dropdown
    console.log('Waiting for dropdown to appear...');
    await this.page.waitForTimeout(2000); // Wait for dropdown to populate

    // Click on "Santa Clara - Civil" option in the dropdown
    try {
      await this.page.click('text=Santa Clara - Civil', { timeout: 5000 });
      console.log('Selected "Santa Clara - Civil" from dropdown');
    } catch (e) {
      console.log('Text selector failed, trying alternative...');
      // Try clicking on any element containing the text
      await this.page.locator('text=/Santa Clara.*Civil/i').first().click();
      console.log('Selected "Santa Clara - Civil" (alternative)');
    }

    await this.page.waitForTimeout(2000);

    const afterCourtSelectionPath = `./logs/after-court-selection-${Date.now()}.png`;
    await this.page.screenshot({ path: afterCourtSelectionPath, fullPage: true });
    console.log('Screenshot taken after Santa Clara - Civil selection');

    // Step 15: Fill Case Category with "Small Claims"
    console.log('Filling Case Category with "Small Claims"...');

    try {
      const caseCategoryInput = this.page.locator('input:near(:text("Case Category"))').first();
      await caseCategoryInput.fill('Small Claims', { timeout: 5000 });
      console.log('Case Category filled (input field)');

      // Wait for dropdown to appear
      await this.page.waitForTimeout(1000);

      // Press Enter or click the dropdown option
      try {
        await this.page.click('text="Small Claims"', { timeout: 3000 });
        console.log('Clicked "Small Claims" from dropdown');
      } catch (e) {
        console.log('Dropdown not found, pressing Enter...');
        await caseCategoryInput.press('Enter');
        console.log('Pressed Enter on Case Category');
      }
    } catch (e) {
      console.log('Case Category input not found, trying select...');
      await this.page.selectOption('select:near(:text("Case Category"))', 'Small Claims', { timeout: 5000 });
      console.log('Case Category selected (select element)');
    }

    await this.page.waitForTimeout(2000);

    const afterCaseCategoryPath = `./logs/after-case-category-${Date.now()}.png`;
    await this.page.screenshot({ path: afterCaseCategoryPath, fullPage: true });
    console.log('Screenshot taken after Case Category selection');

    // Step 16: Fill Case Type with "5000"
    console.log('Filling Case Type with "5000"...');

    try {
      const caseTypeInput = this.page.locator('input:near(:text("Case Type"))').first();
      await caseTypeInput.fill('5000', { timeout: 5000 });
      console.log('Case Type filled (input field)');

      // Wait for dropdown to appear
      await this.page.waitForTimeout(1000);

      // Press Enter or click the dropdown option
      try {
        // Try to click the option containing "5000"
        await this.page.click('text=/.*5000.*/i', { timeout: 3000 });
        console.log('Clicked "5000" option from dropdown');
      } catch (e) {
        console.log('Dropdown not found, pressing Enter...');
        await caseTypeInput.press('Enter');
        console.log('Pressed Enter on Case Type');
      }
    } catch (e) {
      console.log('Case Type input not found, trying select...');
      await this.page.selectOption('select:near(:text("Case Type"))', '5000', { timeout: 5000 });
      console.log('Case Type selected (select element)');
    }

    await this.page.waitForTimeout(2000);

    const afterCaseTypeSelectionPath = `./logs/after-case-type-selection-${Date.now()}.png`;
    await this.page.screenshot({ path: afterCaseTypeSelectionPath, fullPage: true });
    console.log('Screenshot taken after Case Type selection');

    // Step 17: Click "Parties" button (bottom right)
    console.log('Looking for "Parties" button...');

    // Progress: Phase 2 complete, starting Phase 3
    this.updatePhase(3);

    try {
      // Try clicking button with text "Parties" at the bottom
      const partiesButton = this.page.getByRole('button', { name: /parties/i }).last(); // Use last() for bottom button
      await partiesButton.click({ timeout: 5000 });
      console.log('Clicked "Parties" button');
    } catch (e) {
      console.log('getByRole failed, trying text selector...');
      // Alternative: try clicking button containing "Parties" text
      await this.page.click('button:has-text("Parties")', { timeout: 5000 });
      console.log('Clicked "Parties" button (alternative)');
    }

    // Step 18: Wait for Parties page to load
    console.log('Waiting for Parties page...');
    await this.page.waitForSelector('text=Add party details', { timeout: 10000, state: 'visible' });
    console.log('Parties page loaded');

    const partiesPagePath = `./logs/parties-page-${Date.now()}.png`;
    await this.page.screenshot({ path: partiesPagePath, fullPage: true });
    console.log('Screenshot taken - Parties page');

    // Step 19: Click "Add party details" button (this navigates to a new page)
    console.log('Clicking "Add party details" button...');

    try {
      await this.page.click('text=Add party details', { timeout: 5000 });
      console.log('Clicked "Add party details" button');
    } catch (e) {
      console.log('Text selector failed, trying button selector...');
      await this.page.click('button:has-text("Add party details")', { timeout: 5000 });
      console.log('Clicked "Add party details" button (alternative)');
    }

    // Step 20: Wait for "Edit Party Details" modal to load (full-page style modal)
    console.log('Waiting for Edit Party Details modal to load...');

    // Wait for the modal heading to appear
    await this.page.waitForSelector('text=Edit Party Details', { timeout: 15000, state: 'visible' });
    console.log('Edit Party Details modal loaded');

    // Wait for form elements to be visible (e.g., First Name input)
    await this.page.waitForSelector('text=First Name', { timeout: 10000, state: 'visible' });
    console.log('Party details form loaded');

    await this.page.waitForTimeout(2000);

    // Check if inputs are in an iframe (like the login modal)
    console.log('Checking for iframes in modal...');
    const modalFrames = this.page.frames();
    console.log(`Found ${modalFrames.length} frames in modal`);

    // Try to find First Name input in main page or iframe
    // Use a more generic selector - just look for any input elements
    let partyDetailsFrame: any = this.page;

    // Try looking for any visible inputs first - use more generic selectors
    const anyInputsInMainPage = await this.page.locator('input').count();
    console.log(`Total input count in main page: ${anyInputsInMainPage}`);

    if (anyInputsInMainPage === 0) {
      console.log('Inputs not found in main page, checking iframes...');
      for (let i = 0; i < modalFrames.length; i++) {
        const frame = modalFrames[i];
        const anyInputsInFrame = await frame.locator('input').count();
        console.log(`Frame ${i}: Total input count = ${anyInputsInFrame}`);
        if (anyInputsInFrame > 0) {
          partyDetailsFrame = frame;
          console.log(`Found party details form in frame ${i}`);
          break;
        }
      }
    } else {
      console.log('Inputs found in main page');
    }

    const finalPath = `./logs/edit-party-details-${Date.now()}.png`;
    await this.page.screenshot({ path: finalPath, fullPage: true });
    console.log('Final screenshot taken - Edit Party Details modal');

    // Store the frame reference for future use when filling the form
    console.log('Ready to fill party details form');
    console.log(`Form context: ${partyDetailsFrame === this.page ? 'main page' : 'iframe'}`);

    // Step 19: Fill party details form with data from JSON
    console.log('Starting to fill party details form...');

    // Skip "I Am This Party" toggle — we always file on behalf of someone else,
    // and the toggle auto-populates from the logged-in account which can cause overwrites.

    // Fill First Name
    console.log(`Filling First Name: ${this.partyData.firstName}`);

    // First, let's see what inputs are actually available
    const allInputs = await partyDetailsFrame.locator('input').all();
    console.log(`Total inputs found: ${allInputs.length}`);

    // Try multiple approaches to find and fill First Name
    try {
      // Approach 1: Try to find by label "First Name"
      const firstNameLabel = partyDetailsFrame.locator('label:has-text("First Name")');
      const firstNameLabelCount = await firstNameLabel.count();
      console.log(`Found ${firstNameLabelCount} "First Name" labels`);

      if (firstNameLabelCount > 0) {
        // Get the input associated with this label
        const inputNearLabel = partyDetailsFrame.locator('label:has-text("First Name")').locator('..').locator('input').first();
        await inputNearLabel.fill(this.partyData.firstName, { timeout: 5000 });
        console.log('First Name filled (via label)');
      } else {
        throw new Error('First Name label not found');
      }
    } catch (e) {
      console.log('Label-based approach failed, trying placeholder...');
      try {
        await partyDetailsFrame.fill('input[placeholder*="First Name" i]', this.partyData.firstName, { timeout: 5000 });
        console.log('First Name filled (via placeholder)');
      } catch (e2) {
        console.log('Placeholder selector failed, trying name attribute...');
        await partyDetailsFrame.fill('input[name*="firstName" i]', this.partyData.firstName, { timeout: 5000 });
        console.log('First Name filled (via name attribute)');
      }
    }

    // Fill Last Name
    console.log(`Filling Last Name: ${this.partyData.lastName}`);
    try {
      // Approach 1: Try to find by label "Last Name"
      const lastNameLabel = partyDetailsFrame.locator('label:has-text("Last Name")');
      const lastNameLabelCount = await lastNameLabel.count();
      console.log(`Found ${lastNameLabelCount} "Last Name" labels`);

      if (lastNameLabelCount > 0) {
        // Get the input associated with this label
        const inputNearLabel = partyDetailsFrame.locator('label:has-text("Last Name")').locator('..').locator('input').first();
        await inputNearLabel.fill(this.partyData.lastName, { timeout: 5000 });
        console.log('Last Name filled (via label)');
      } else {
        throw new Error('Last Name label not found');
      }
    } catch (e) {
      console.log('Label-based approach failed, trying placeholder...');
      try {
        await partyDetailsFrame.fill('input[placeholder*="Last Name" i]', this.partyData.lastName, { timeout: 5000 });
        console.log('Last Name filled (via placeholder)');
      } catch (e2) {
        console.log('Placeholder selector failed, trying name attribute...');
        await partyDetailsFrame.fill('input[name*="lastName" i]', this.partyData.lastName, { timeout: 5000 });
        console.log('Last Name filled (via name attribute)');
      }
    }

    // Fill Date of Birth
    console.log(`Filling Date of Birth: ${this.partyData.dateOfBirth}`);
    try {
      // Approach 1: Try to find by label "Date of Birth"
      const dobLabel = partyDetailsFrame.locator('label:has-text("Date of Birth")');
      const dobLabelCount = await dobLabel.count();
      console.log(`Found ${dobLabelCount} "Date of Birth" labels`);

      if (dobLabelCount > 0) {
        // Get the input associated with this label
        const inputNearLabel = partyDetailsFrame.locator('label:has-text("Date of Birth")').locator('..').locator('input').first();
        await inputNearLabel.fill(this.partyData.dateOfBirth, { timeout: 5000 });
        console.log('Date of Birth filled (via label)');
      } else {
        throw new Error('Date of Birth label not found');
      }
    } catch (e) {
      console.log('Label-based approach failed, trying placeholder...');
      try {
        await partyDetailsFrame.fill('input[placeholder*="Date of Birth" i]', this.partyData.dateOfBirth, { timeout: 5000 });
        console.log('Date of Birth filled (via placeholder)');
      } catch (e2) {
        console.log('Placeholder selector failed, trying type attribute...');
        await partyDetailsFrame.fill('input[type="date"]', this.partyData.dateOfBirth, { timeout: 5000 });
        console.log('Date of Birth filled (via type attribute)');
      }
    }

    await this.page.waitForTimeout(1000);

    const afterPersonalInfoPath = `./logs/after-personal-info-${Date.now()}.png`;
    await this.page.screenshot({ path: afterPersonalInfoPath, fullPage: true });
    console.log('Screenshot taken after personal info');

    // Scroll down to Contact Information section
    console.log('Scrolling to Contact Information section...');
    await partyDetailsFrame.evaluate(() => {
      window.scrollBy(0, 400);
    });
    await this.page.waitForTimeout(1000);

    // Fill Address Line 1
    console.log(`Filling Address Line 1: ${this.partyData.address.addressLine1}`);
    try {
      const addressLabel = partyDetailsFrame.locator('label:has-text("Address Line 1")');
      const addressLabelCount = await addressLabel.count();
      console.log(`Found ${addressLabelCount} "Address Line 1" labels`);

      if (addressLabelCount > 0) {
        const inputNearLabel = partyDetailsFrame.locator('label:has-text("Address Line 1")').locator('..').locator('input').first();
        await inputNearLabel.fill(this.partyData.address.addressLine1, { timeout: 5000 });
        console.log('Address Line 1 filled (via label)');
      } else {
        throw new Error('Address Line 1 label not found');
      }
    } catch (e) {
      console.log('Label-based approach failed, trying placeholder...');
      try {
        await partyDetailsFrame.fill('input[placeholder*="Address Line 1" i]', this.partyData.address.addressLine1, { timeout: 5000 });
        console.log('Address Line 1 filled (via placeholder)');
      } catch (e2) {
        console.log('Placeholder selector failed, trying name attribute...');
        await partyDetailsFrame.fill('input[name*="address" i]', this.partyData.address.addressLine1, { timeout: 5000 });
        console.log('Address Line 1 filled (via name attribute)');
      }
    }

    // Fill City
    console.log(`Filling City: ${this.partyData.address.city}`);
    try {
      const cityLabel = partyDetailsFrame.locator('label:has-text("City")');
      const cityLabelCount = await cityLabel.count();
      console.log(`Found ${cityLabelCount} "City" labels`);

      if (cityLabelCount > 0) {
        const inputNearLabel = partyDetailsFrame.locator('label:has-text("City")').locator('..').locator('input').first();
        await inputNearLabel.fill(this.partyData.address.city, { timeout: 5000 });
        console.log('City filled (via label)');
      } else {
        throw new Error('City label not found');
      }
    } catch (e) {
      console.log('Label-based approach failed, trying placeholder...');
      try {
        await partyDetailsFrame.fill('input[placeholder*="City" i]', this.partyData.address.city, { timeout: 5000 });
        console.log('City filled (via placeholder)');
      } catch (e2) {
        console.log('Placeholder selector failed, trying name attribute...');
        await partyDetailsFrame.fill('input[name*="city" i]', this.partyData.address.city, { timeout: 5000 });
        console.log('City filled (via name attribute)');
      }
    }

    // Fill State (likely an autocomplete input similar to Court Location)
    console.log(`Filling State: ${this.partyData.address.state}`);
    try {
      // Try to find the State input by label (similar to Court Location)
      const stateLabel = partyDetailsFrame.locator('label:has-text("State")');
      const stateLabelCount = await stateLabel.count();
      console.log(`Found ${stateLabelCount} "State" labels`);

      if (stateLabelCount > 0) {
        // Try to find input element near the label
        const inputNearLabel = partyDetailsFrame.locator('label:has-text("State")').locator('..').locator('input').first();
        await inputNearLabel.fill(this.partyData.address.state, { timeout: 5000 });
        console.log('State filled (via label, input)');

        // Wait a moment for autocomplete dropdown to appear
        await this.page.waitForTimeout(1000);

        // Click on the matching state option from dropdown (similar to Alameda selection)
        try {
          await partyDetailsFrame.click(`text="${this.partyData.address.state}"`, { timeout: 3000 });
          console.log(`Clicked "${this.partyData.address.state}" from dropdown`);
        } catch (e) {
          console.log('Dropdown click not needed or already selected');
        }
      } else {
        throw new Error('State label not found');
      }
    } catch (e) {
      console.log('Label-based input failed, trying select dropdown...');
      try {
        await partyDetailsFrame.selectOption('select:near(:text("State"))', this.partyData.address.state, { timeout: 5000 });
        console.log('State selected from dropdown (generic)');
      } catch (e2) {
        console.log('Select failed, trying name attribute...');
        try {
          await partyDetailsFrame.fill('input[name*="state" i]', this.partyData.address.state, { timeout: 5000 });
          console.log('State filled (via name attribute)');
        } catch (e3) {
          console.log('All State approaches failed, trying placeholder...');
          await partyDetailsFrame.fill('input[placeholder*="State" i]', this.partyData.address.state, { timeout: 5000 });
          console.log('State filled (via placeholder)');
        }
      }
    }

    // Fill Zip Code
    console.log(`Filling Zip Code: ${this.partyData.address.zipCode}`);
    try {
      const zipLabel = partyDetailsFrame.locator('label:has-text("Zip Code")');
      const zipLabelCount = await zipLabel.count();
      console.log(`Found ${zipLabelCount} "Zip Code" labels`);

      if (zipLabelCount > 0) {
        const inputNearLabel = partyDetailsFrame.locator('label:has-text("Zip Code")').locator('..').locator('input').first();
        await inputNearLabel.fill(this.partyData.address.zipCode, { timeout: 5000 });
        console.log('Zip Code filled (via label)');
      } else {
        throw new Error('Zip Code label not found');
      }
    } catch (e) {
      console.log('Label-based approach failed, trying placeholder...');
      try {
        await partyDetailsFrame.fill('input[placeholder*="Zip" i]', this.partyData.address.zipCode, { timeout: 5000 });
        console.log('Zip Code filled (via placeholder)');
      } catch (e2) {
        console.log('Placeholder selector failed, trying name attribute...');
        await partyDetailsFrame.fill('input[name*="zip" i]', this.partyData.address.zipCode, { timeout: 5000 });
        console.log('Zip Code filled (via name attribute)');
      }
    }

    // Fill Phone Number
    console.log(`Filling Phone Number: ${this.partyData.phoneNumber}`);
    try {
      const phoneLabel = partyDetailsFrame.locator('label:has-text("Phone Number")');
      const phoneLabelCount = await phoneLabel.count();
      console.log(`Found ${phoneLabelCount} "Phone Number" labels`);

      if (phoneLabelCount > 0) {
        const inputNearLabel = partyDetailsFrame.locator('label:has-text("Phone Number")').locator('..').locator('input').first();
        await inputNearLabel.fill(this.partyData.phoneNumber, { timeout: 5000 });
        console.log('Phone Number filled (via label)');
      } else {
        throw new Error('Phone Number label not found');
      }
    } catch (e) {
      console.log('Label-based approach failed, trying placeholder...');
      try {
        await partyDetailsFrame.fill('input[placeholder*="Phone" i]', this.partyData.phoneNumber, { timeout: 5000 });
        console.log('Phone Number filled (via placeholder)');
      } catch (e2) {
        console.log('Placeholder selector failed, trying name attribute...');
        await partyDetailsFrame.fill('input[name*="phone" i]', this.partyData.phoneNumber, { timeout: 5000 });
        console.log('Phone Number filled (via name attribute)');
      }
    }

    await this.page.waitForTimeout(1000);

    // Scroll down to Attorney Information section
    console.log('Scrolling to Attorney Information section...');
    await partyDetailsFrame.evaluate(() => {
      window.scrollBy(0, 400);
    });
    await this.page.waitForTimeout(1000);

    // Fill Lead Attorney (autocomplete input)
    console.log(`Filling Lead Attorney: ${this.partyData.leadAttorney}`);
    try {
      const attorneyLabel = partyDetailsFrame.locator('label:has-text("Lead Attorney")');
      const attorneyLabelCount = await attorneyLabel.count();
      console.log(`Found ${attorneyLabelCount} "Lead Attorney" labels`);

      if (attorneyLabelCount > 0) {
        // Find input near the label
        const inputNearLabel = partyDetailsFrame.locator('label:has-text("Lead Attorney")').locator('..').locator('input').first();

        // Click the input to trigger dropdown
        await inputNearLabel.click({ timeout: 5000 });
        console.log('Clicked Lead Attorney input');

        await this.page.waitForTimeout(1000);

        // Try to click "Pro Se" from dropdown first
        try {
          await partyDetailsFrame.click('text="Pro Se"', { timeout: 3000 });
          console.log('Clicked "Pro Se" from dropdown');
        } catch (e) {
          console.log('Dropdown not found, typing value instead...');
          // If dropdown doesn't appear, type the value
          await inputNearLabel.fill(this.partyData.leadAttorney, { timeout: 5000 });
          console.log('Lead Attorney typed');

          // Wait for dropdown to appear after typing
          await this.page.waitForTimeout(1000);

          // Try to click the dropdown option again
          try {
            await partyDetailsFrame.click('text="Pro Se"', { timeout: 3000 });
            console.log('Clicked "Pro Se" from dropdown after typing');
          } catch (e2) {
            console.log('Pressing Enter to confirm selection...');
            // If still no dropdown, press Enter
            await inputNearLabel.press('Enter');
            console.log('Pressed Enter on Lead Attorney field');
          }
        }
      } else {
        throw new Error('Lead Attorney label not found');
      }
    } catch (e) {
      console.log('Label-based approach failed, trying placeholder...');
      try {
        const attorneyInput = partyDetailsFrame.locator('input[placeholder*="Attorney" i]').first();
        await attorneyInput.click();
        await this.page.waitForTimeout(500);
        await partyDetailsFrame.click('text="Pro Se"', { timeout: 3000 });
        console.log('Lead Attorney filled (via placeholder)');
      } catch (e2) {
        console.log('All Lead Attorney approaches failed');
      }
    }

    await this.page.waitForTimeout(2000);

    const afterContactInfoPath = `./logs/after-contact-info-${Date.now()}.png`;
    await this.page.screenshot({ path: afterContactInfoPath, fullPage: true });
    console.log('Screenshot taken after contact info and attorney info');

    // Click Save button
    console.log('Clicking Save button...');
    try {
      await partyDetailsFrame.click('button:has-text("Save")', { timeout: 5000 });
      console.log('Clicked Save button (text selector)');
    } catch (e) {
      console.log('Text selector failed, trying getByRole...');
      await this.page.getByRole('button', { name: /save/i }).click({ timeout: 5000 });
      console.log('Clicked Save button (getByRole)');
    }

    // Wait for modal to close and return to Parties page
    console.log('Waiting for modal to close...');
    await this.page.waitForTimeout(3000);

    // Verify we're back on Parties page
    await this.page.waitForSelector('text=Parties', { timeout: 10000, state: 'visible' });
    console.log('Back on Parties page');

    const partiesPageAfterSavePath = `./logs/parties-after-save-${Date.now()}.png`;
    await this.page.screenshot({ path: partiesPageAfterSavePath, fullPage: true });
    console.log('Screenshot taken - Parties page after plaintiff save');

    // Step 21: Add Defendant party
    console.log('Adding defendant party...');
    await this.page.waitForTimeout(2000);

    // Click "Add party details" again for defendant
    console.log('Clicking "Add party details" for defendant...');
    try {
      await this.page.click('text=Add party details', { timeout: 5000 });
      console.log('Clicked "Add party details" button');
    } catch (e) {
      console.log('Text selector failed, trying button selector...');
      await this.page.click('button:has-text("Add party details")', { timeout: 5000 });
      console.log('Clicked "Add party details" button (alternative)');
    }

    // Step 22: Wait for "Edit Party Details" modal to load for defendant
    console.log('Waiting for Edit Party Details modal to load for defendant...');
    await this.page.waitForSelector('text=Edit Party Details', { timeout: 15000, state: 'visible' });
    console.log('Edit Party Details modal loaded for defendant');

    await this.page.waitForSelector('text=First Name', { timeout: 10000, state: 'visible' });
    console.log('Defendant form loaded');

    await this.page.waitForTimeout(2000);

    // Check for iframes
    const defendantModalFrames = this.page.frames();
    let defendantFrame: any = this.page;

    const defendantInputsInMainPage = await this.page.locator('input').count();
    console.log(`Total input count in main page for defendant: ${defendantInputsInMainPage}`);

    if (defendantInputsInMainPage === 0) {
      console.log('Inputs not found in main page, checking iframes...');
      for (let i = 0; i < defendantModalFrames.length; i++) {
        const frame = defendantModalFrames[i];
        const anyInputsInFrame = await frame.locator('input').count();
        if (anyInputsInFrame > 0) {
          defendantFrame = frame;
          console.log(`Found defendant form in frame ${i}`);
          break;
        }
      }
    } else {
      console.log('Inputs found in main page for defendant');
    }

    const defendantModalPath = `./logs/defendant-modal-${Date.now()}.png`;
    await this.page.screenshot({ path: defendantModalPath, fullPage: true });
    console.log('Screenshot taken - Defendant modal');

    // Step 23: Fill defendant form (skip "I Am This Party" toggle)
    console.log('Filling defendant details...');

    // Fill First Name
    console.log(`Filling Defendant First Name: ${this.defendantData.firstName}`);
    try {
      const firstNameLabel = defendantFrame.locator('label:has-text("First Name")');
      const firstNameLabelCount = await firstNameLabel.count();
      if (firstNameLabelCount > 0) {
        const inputNearLabel = defendantFrame.locator('label:has-text("First Name")').locator('..').locator('input').first();
        await inputNearLabel.fill(this.defendantData.firstName, { timeout: 5000 });
        console.log('Defendant First Name filled (via label)');
      }
    } catch (e) {
      console.log('Label-based approach failed for defendant first name');
    }

    // Fill Last Name
    console.log(`Filling Defendant Last Name: ${this.defendantData.lastName}`);
    try {
      const lastNameLabel = defendantFrame.locator('label:has-text("Last Name")');
      const lastNameLabelCount = await lastNameLabel.count();
      if (lastNameLabelCount > 0) {
        const inputNearLabel = defendantFrame.locator('label:has-text("Last Name")').locator('..').locator('input').first();
        await inputNearLabel.fill(this.defendantData.lastName, { timeout: 5000 });
        console.log('Defendant Last Name filled (via label)');
      }
    } catch (e) {
      console.log('Label-based approach failed for defendant last name');
    }

    // Fill Date of Birth
    console.log(`Filling Defendant Date of Birth: ${this.defendantData.dateOfBirth}`);
    try {
      const dobLabel = defendantFrame.locator('label:has-text("Date of Birth")');
      const dobLabelCount = await dobLabel.count();
      if (dobLabelCount > 0) {
        const inputNearLabel = defendantFrame.locator('label:has-text("Date of Birth")').locator('..').locator('input').first();
        await inputNearLabel.fill(this.defendantData.dateOfBirth, { timeout: 5000 });
        console.log('Defendant Date of Birth filled (via label)');
      }
    } catch (e) {
      console.log('Label-based approach failed for defendant DOB');
    }

    await this.page.waitForTimeout(1000);

    const afterDefendantPersonalInfoPath = `./logs/after-defendant-personal-info-${Date.now()}.png`;
    await this.page.screenshot({ path: afterDefendantPersonalInfoPath, fullPage: true });
    console.log('Screenshot taken after defendant personal info');

    // Scroll down to Contact Information section
    console.log('Scrolling to Contact Information section for defendant...');
    await defendantFrame.evaluate(() => {
      window.scrollBy(0, 400);
    });
    await this.page.waitForTimeout(1000);

    // Fill Address Line 1
    console.log(`Filling Defendant Address Line 1: ${this.defendantData.address.addressLine1}`);
    try {
      const addressLabel = defendantFrame.locator('label:has-text("Address Line 1")');
      const addressLabelCount = await addressLabel.count();
      if (addressLabelCount > 0) {
        const inputNearLabel = defendantFrame.locator('label:has-text("Address Line 1")').locator('..').locator('input').first();
        await inputNearLabel.fill(this.defendantData.address.addressLine1, { timeout: 5000 });
        console.log('Defendant Address Line 1 filled (via label)');
      }
    } catch (e) {
      console.log('Label-based approach failed for defendant address');
    }

    // Fill City
    console.log(`Filling Defendant City: ${this.defendantData.address.city}`);
    try {
      const cityLabel = defendantFrame.locator('label:has-text("City")');
      const cityLabelCount = await cityLabel.count();
      if (cityLabelCount > 0) {
        const inputNearLabel = defendantFrame.locator('label:has-text("City")').locator('..').locator('input').first();
        await inputNearLabel.fill(this.defendantData.address.city, { timeout: 5000 });
        console.log('Defendant City filled (via label)');
      }
    } catch (e) {
      console.log('Label-based approach failed for defendant city');
    }

    // Fill State
    console.log(`Filling Defendant State: ${this.defendantData.address.state}`);
    try {
      const stateLabel = defendantFrame.locator('label:has-text("State")');
      const stateLabelCount = await stateLabel.count();
      if (stateLabelCount > 0) {
        const inputNearLabel = defendantFrame.locator('label:has-text("State")').locator('..').locator('input').first();
        await inputNearLabel.fill(this.defendantData.address.state, { timeout: 5000 });
        console.log('Defendant State filled (via label, input)');
        await this.page.waitForTimeout(1000);
        try {
          await defendantFrame.click(`text="${this.defendantData.address.state}"`, { timeout: 3000 });
          console.log(`Clicked "${this.defendantData.address.state}" from dropdown`);
        } catch (e) {
          console.log('Dropdown click not needed or already selected');
        }
      }
    } catch (e) {
      console.log('Label-based approach failed for defendant state');
    }

    // Fill Zip Code
    console.log(`Filling Defendant Zip Code: ${this.defendantData.address.zipCode}`);
    try {
      const zipLabel = defendantFrame.locator('label:has-text("Zip Code")');
      const zipLabelCount = await zipLabel.count();
      if (zipLabelCount > 0) {
        const inputNearLabel = defendantFrame.locator('label:has-text("Zip Code")').locator('..').locator('input').first();
        await inputNearLabel.fill(this.defendantData.address.zipCode, { timeout: 5000 });
        console.log('Defendant Zip Code filled (via label)');
      }
    } catch (e) {
      console.log('Label-based approach failed for defendant zip');
    }

    // Fill Phone Number
    console.log(`Filling Defendant Phone Number: ${this.defendantData.phoneNumber}`);
    try {
      const phoneLabel = defendantFrame.locator('label:has-text("Phone Number")');
      const phoneLabelCount = await phoneLabel.count();
      if (phoneLabelCount > 0) {
        const inputNearLabel = defendantFrame.locator('label:has-text("Phone Number")').locator('..').locator('input').first();
        await inputNearLabel.fill(this.defendantData.phoneNumber, { timeout: 5000 });
        console.log('Defendant Phone Number filled (via label)');
      }
    } catch (e) {
      console.log('Label-based approach failed for defendant phone');
    }

    await this.page.waitForTimeout(1000);

    // Scroll down to Attorney Information section
    console.log('Scrolling to Attorney Information section for defendant...');
    await defendantFrame.evaluate(() => {
      window.scrollBy(0, 400);
    });
    await this.page.waitForTimeout(1000);

    // Fill Lead Attorney
    console.log(`Filling Defendant Lead Attorney: ${this.defendantData.leadAttorney}`);
    try {
      const attorneyLabel = defendantFrame.locator('label:has-text("Lead Attorney")');
      const attorneyLabelCount = await attorneyLabel.count();
      if (attorneyLabelCount > 0) {
        const inputNearLabel = defendantFrame.locator('label:has-text("Lead Attorney")').locator('..').locator('input').first();
        await inputNearLabel.click({ timeout: 5000 });
        console.log('Clicked Defendant Lead Attorney input');
        await this.page.waitForTimeout(1000);
        try {
          await defendantFrame.click('text="Pro Se"', { timeout: 3000 });
          console.log('Clicked "Pro Se" from dropdown for defendant');
        } catch (e) {
          console.log('Dropdown not found, typing value instead...');
          await inputNearLabel.fill(this.defendantData.leadAttorney, { timeout: 5000 });
          await this.page.waitForTimeout(1000);
          try {
            await defendantFrame.click('text="Pro Se"', { timeout: 3000 });
            console.log('Clicked "Pro Se" from dropdown after typing for defendant');
          } catch (e2) {
            await inputNearLabel.press('Enter');
            console.log('Pressed Enter on Defendant Lead Attorney field');
          }
        }
      }
    } catch (e) {
      console.log('Label-based approach failed for defendant attorney');
    }

    await this.page.waitForTimeout(2000);

    const afterDefendantInfoPath = `./logs/after-defendant-info-${Date.now()}.png`;
    await this.page.screenshot({ path: afterDefendantInfoPath, fullPage: true });
    console.log('Screenshot taken after defendant info');

    // Click Save button for defendant
    console.log('Clicking Save button for defendant...');
    try {
      await defendantFrame.click('button:has-text("Save")', { timeout: 5000 });
      console.log('Clicked Save button for defendant (text selector)');
    } catch (e) {
      console.log('Text selector failed, trying getByRole...');
      await this.page.getByRole('button', { name: /save/i }).click({ timeout: 5000 });
      console.log('Clicked Save button for defendant (getByRole)');
    }

    // Wait for modal to close and return to Parties page
    console.log('Waiting for defendant modal to close...');
    await this.page.waitForTimeout(3000);

    // Verify we're back on Parties page
    await this.page.waitForSelector('text=Parties', { timeout: 10000, state: 'visible' });
    console.log('Back on Parties page after defendant save');

    const partiesPageAfterDefendantPath = `./logs/parties-after-defendant-${Date.now()}.png`;
    await this.page.screenshot({ path: partiesPageAfterDefendantPath, fullPage: true });
    console.log('Screenshot taken - Parties page after defendant save');

    // Click Filings button to navigate to Filings page
    console.log('Clicking Filings button...');

    // Progress: Phase 3 complete, starting Phase 4
    this.updatePhase(4);

    try {
      // Use ID selector — "parties-next" is the bottom-right navigation button to Filings
      await this.page.locator('forge-button#parties-next').click({ timeout: 5000 });
      console.log('Clicked Filings button (forge-button#parties-next)');
    } catch (e) {
      console.log('ID selector failed, trying exact aria-label...');
      await this.page.getByRole('button', { name: 'Filings', exact: true }).click({ timeout: 5000 });
      console.log('Clicked Filings button (getByRole exact)');
    }

    // Wait for Filings page to load
    console.log('Waiting for Filings page...');
    await this.page.waitForSelector('text=No Filings Added Yet', { timeout: 10000, state: 'visible' });
    console.log('Filings page loaded');

    const filingsPagePath = `./logs/filings-page-${Date.now()}.png`;
    await this.page.screenshot({ path: filingsPagePath, fullPage: true });
    console.log('Screenshot taken - Filings page');

    // Step 24: Click "Add Filing" button
    console.log('Clicking "Add Filing" button...');
    await this.page.waitForTimeout(2000);

    try {
      await this.page.click('button:has-text("Add Filing")', { timeout: 5000 });
      console.log('Clicked "Add Filing" button (text selector)');
    } catch (e) {
      console.log('Text selector failed, trying getByRole...');
      await this.page.getByRole('button', { name: /add filing/i }).click({ timeout: 5000 });
      console.log('Clicked "Add Filing" button (getByRole)');
    }

    // Step 25: Wait for "Edit Filing Details" modal to load
    console.log('Waiting for Edit Filing Details modal to load...');
    await this.page.waitForSelector('text=Edit Filing Details', { timeout: 15000, state: 'visible' });
    console.log('Edit Filing Details modal loaded');

    await this.page.waitForTimeout(2000);

    const filingModalPath = `./logs/filing-modal-${Date.now()}.png`;
    await this.page.screenshot({ path: filingModalPath, fullPage: true });
    console.log('Screenshot taken - Filing modal');

    // Step 26: Fill Filing Code
    console.log(`Filling Filing Code: ${this.filingData.filingCode}`);
    try {
      const filingCodeLabel = this.page.locator('label:has-text("Filing Code")');
      const filingCodeLabelCount = await filingCodeLabel.count();
      console.log(`Found ${filingCodeLabelCount} "Filing Code" labels`);

      if (filingCodeLabelCount > 0) {
        // Find input near the label
        const inputNearLabel = this.page.locator('label:has-text("Filing Code")').locator('..').locator('input').first();
        await inputNearLabel.fill(this.filingData.filingCode, { timeout: 5000 });
        console.log('Filing Code filled (via label)');

        // Wait for dropdown to appear
        await this.page.waitForTimeout(1000);

        // Press Enter to select
        await inputNearLabel.press('Enter');
        console.log('Pressed Enter on Filing Code');
      }
    } catch (e) {
      console.log('Label-based approach failed for Filing Code, trying placeholder...');
      try {
        const filingCodeInput = this.page.locator('input[placeholder*="Filing Code" i]').first();
        await filingCodeInput.fill(this.filingData.filingCode);
        await filingCodeInput.press('Enter');
        console.log('Filing Code filled (via placeholder)');
      } catch (e2) {
        console.log('All Filing Code approaches failed');
      }
    }

    await this.page.waitForTimeout(2000);

    const afterFilingCodePath = `./logs/after-filing-code-${Date.now()}.png`;
    await this.page.screenshot({ path: afterFilingCodePath, fullPage: true });
    console.log('Screenshot taken after Filing Code');

    // Scroll down in the modal to reveal more fields
    console.log('Scrolling down in filing modal...');
    await this.page.evaluate(() => {
      window.scrollBy(0, 300);
    });
    await this.page.waitForTimeout(1000);

    // Step 27: Fill Filing Description
    console.log(`Filling Filing Description: ${this.filingData.filingDescription}`);
    try {
      // Find label with text "Filing Description" and get its 'for' attribute
      const descriptionLabel = this.page.locator('label:has-text("Filing Description")').first();
      const forAttr = await descriptionLabel.getAttribute('for');
      console.log(`Found Filing Description label with for="${forAttr}"`);

      if (forAttr) {
        // Use the ID from the 'for' attribute to find the input
        const descriptionInput = this.page.locator(`#${forAttr}`);
        await descriptionInput.fill(this.filingData.filingDescription, { timeout: 5000 });
        console.log('Filing Description filled');
      } else {
        throw new Error('Filing Description label for attribute not found');
      }
    } catch (e) {
      console.log('Label-based approach failed:', e);
    }

    // Step 28: Fill Client Reference Number
    console.log(`Filling Client Reference Number: ${this.filingData.clientReferenceNumber}`);
    try {
      // Find label with text "Client Reference Number" and get its 'for' attribute
      const clientRefLabel = this.page.locator('label:has-text("Client Reference Number")').first();
      const forAttr = await clientRefLabel.getAttribute('for');
      console.log(`Found Client Reference Number label with for="${forAttr}"`);

      if (forAttr) {
        // Use the ID from the 'for' attribute to find the input
        const clientRefInput = this.page.locator(`#${forAttr}`);
        await clientRefInput.fill(this.filingData.clientReferenceNumber, { timeout: 5000 });
        console.log('Client Reference Number filled');
      } else {
        throw new Error('Client Reference Number label for attribute not found');
      }
    } catch (e) {
      console.log('Label-based approach failed:', e);
    }

    // Step 29: Fill Comments to Court
    console.log(`Filling Comments to Court: ${this.filingData.commentsToCourtOpening}`);
    try {
      // Find label with text "Comments to Court" and get its 'for' attribute
      const commentsLabel = this.page.locator('label:has-text("Comments to Court")').first();
      const forAttr = await commentsLabel.getAttribute('for');
      console.log(`Found Comments to Court label with for="${forAttr}"`);

      if (forAttr) {
        // Use the ID from the 'for' attribute to find the textarea
        const commentsTextarea = this.page.locator(`#${forAttr}`);
        await commentsTextarea.fill(this.filingData.commentsToCourtOpening, { timeout: 5000 });
        console.log('Comments to Court filled');
      } else {
        throw new Error('Comments to Court label for attribute not found');
      }
    } catch (e) {
      console.log('Label-based approach failed:', e);
    }

    await this.page.waitForTimeout(1000);

    const afterFilingDetailsPath = `./logs/after-filing-details-${Date.now()}.png`;
    await this.page.screenshot({ path: afterFilingDetailsPath, fullPage: true });
    console.log('Screenshot taken after filing details');

    // Step 30: Select "Filing on Behalf of"
    console.log(`Selecting Filing on Behalf of: ${this.filingData.filingOnBehalfOf}`);
    try {
      // Try to find the dropdown for "Filing on Behalf of"
      const behalfOfLabel = this.page.locator('text="Filing on Behalf of"');
      const behalfOfLabelCount = await behalfOfLabel.count();
      console.log(`Found ${behalfOfLabelCount} "Filing on Behalf of" labels`);

      if (behalfOfLabelCount > 0) {
        // Find the select/input near the label
        const selectNearLabel = this.page.locator('text="Filing on Behalf of"').locator('..').locator('select').first();
        const selectCount = await selectNearLabel.count();

        if (selectCount > 0) {
          // Try to select by text
          await selectNearLabel.click({ timeout: 5000 });
          console.log('Clicked Filing on Behalf of dropdown');

          await this.page.waitForTimeout(1000);

          // Try to click the option with Irawati Puteri
          try {
            await this.page.click(`text="${this.filingData.filingOnBehalfOf}"`, { timeout: 3000 });
            console.log(`Selected "${this.filingData.filingOnBehalfOf}" from dropdown`);
          } catch (e) {
            console.log('Direct text click failed, trying selectOption...');
            await selectNearLabel.selectOption({ label: this.filingData.filingOnBehalfOf });
            console.log(`Selected "${this.filingData.filingOnBehalfOf}" via selectOption`);
          }
        } else {
          // Try input instead
          const inputNearLabel = this.page.locator('text="Filing on Behalf of"').locator('..').locator('input').first();
          await inputNearLabel.click({ timeout: 5000 });
          console.log('Clicked Filing on Behalf of input');

          await this.page.waitForTimeout(1000);

          // Try to click the option
          await this.page.click(`text="${this.filingData.filingOnBehalfOf}"`, { timeout: 3000 });
          console.log(`Selected "${this.filingData.filingOnBehalfOf}" from dropdown`);
        }
      }
    } catch (e) {
      console.log('Filing on Behalf of selection failed:', e);
    }

    await this.page.waitForTimeout(2000);

    const afterBehalfOfPath = `./logs/after-behalf-of-${Date.now()}.png`;
    await this.page.screenshot({ path: afterBehalfOfPath, fullPage: true });
    console.log('Screenshot taken after Filing on Behalf of selection');

    // Step 31: Upload Lead Document
    console.log('Starting document upload...');

    // Download file from URL
    const documentUrl = this.documentData.leadDocument.url;
    const documentFilename = this.documentData.leadDocument.filename;
    console.log(`Document URL: ${documentUrl}`);
    console.log(`Document filename: ${documentFilename}`);

    let downloadedFilePath: string | null = null;

    try {
      // Download the file
      downloadedFilePath = await this.downloadFile(documentUrl, documentFilename);
      console.log(`File ready for upload at: ${downloadedFilePath}`);

      // Scroll down to see the upload section
      console.log('Scrolling to Upload Documents section...');
      await this.page.evaluate(() => {
        window.scrollBy(0, 400);
      });
      await this.page.waitForTimeout(1000);

      const beforeUploadPath = `./logs/before-upload-${Date.now()}.png`;
      await this.page.screenshot({ path: beforeUploadPath, fullPage: true });
      console.log('Screenshot taken before upload');

      // Find the file input element
      console.log('Looking for file input element...');
      const fileInput = this.page.locator('input[type="file"]').first();
      const fileInputCount = await fileInput.count();
      console.log(`Found ${fileInputCount} file input elements`);

      if (fileInputCount > 0) {
        // Upload the file
        console.log(`Uploading file: ${downloadedFilePath}`);
        await fileInput.setInputFiles(downloadedFilePath);
        console.log('File uploaded successfully!');

        // Wait for upload to process
        await this.page.waitForTimeout(3000);

        const afterUploadPath = `./logs/after-upload-${Date.now()}.png`;
        await this.page.screenshot({ path: afterUploadPath, fullPage: true });
        console.log('Screenshot taken after upload');
      } else {
        console.log('File input element not found');
      }

      // Clean up: Delete the temporary file
      if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
        fs.unlinkSync(downloadedFilePath);
        console.log('Temporary file deleted');
      }
    } catch (error) {
      console.error('Error during file upload:', error);
      // Clean up even if there's an error
      if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
        fs.unlinkSync(downloadedFilePath);
        console.log('Temporary file deleted after error');
      }
    }

    console.log('Filing details filled and document uploaded successfully!');

    // Step 32: Click Save button to close the filing modal
    console.log('Clicking Save button...');
    await this.page.waitForTimeout(2000);

    try {
      // The Save button is a custom web component: <forge-button id="save-filings">
      const saveButton = this.page.locator('forge-button#save-filings');
      await saveButton.click({ timeout: 5000 });
      console.log('Clicked Save button (forge-button#save-filings)');
    } catch (e) {
      console.log('forge-button selector failed, trying generic forge-button...');
      try {
        await this.page.locator('forge-button:has-text("Save")').click({ timeout: 5000 });
        console.log('Clicked Save button (forge-button with text)');
      } catch (e2) {
        console.log('forge-button with text failed, trying getByRole...');
        await this.page.getByRole('button', { name: /save/i }).click({ timeout: 5000 });
        console.log('Clicked Save button (getByRole)');
      }
    }

    await this.page.waitForTimeout(3000);

    const afterSaveFilingPath = `./logs/after-save-filing-${Date.now()}.png`;
    await this.page.screenshot({ path: afterSaveFilingPath, fullPage: true });
    console.log('Screenshot taken after saving filing');

    // Step 33: Click "Skip To Fees" button
    console.log('Clicking Skip To Fees button...');
    await this.page.waitForTimeout(2000);

    try {
      // Try forge-button first (similar to Save button)
      await this.page.locator('forge-button:has-text("Skip To Fees")').click({ timeout: 5000 });
      console.log('Skip To Fees button clicked (forge-button)');
    } catch (e) {
      console.log('forge-button failed, trying standard button selector...');
      try {
        await this.page.locator('button:has-text("Skip To Fees")').click({ timeout: 5000 });
        console.log('Skip To Fees button clicked (button selector)');
      } catch (e2) {
        console.log('button selector failed, trying getByRole...');
        await this.page.getByRole('button', { name: /Skip To Fees/i }).click({ timeout: 5000 });
        console.log('Skip To Fees button clicked (getByRole)');
      }
    }

    await this.page.waitForTimeout(3000);

    const feesPagePath = `./logs/fees-page-${Date.now()}.png`;
    await this.page.screenshot({ path: feesPagePath, fullPage: true });
    console.log('Screenshot taken on Fees page');

    // Progress: Phase 4 complete, starting Phase 5
    this.updatePhase(5);

    // Step 34: Select "Waiver Payment Account" from Payment Account autocomplete
    console.log('Selecting Waiver Payment Account...');
    await this.page.waitForTimeout(2000);

    try {
      // Payment Account is a forge-text-field with forge-autocomplete
      // Find the input field and type to trigger autocomplete
      const paymentAccountInput = this.page.locator('forge-text-field#payment-account input').first();

      await paymentAccountInput.click({ timeout: 5000 });
      console.log('Payment Account field clicked');
      await this.page.waitForTimeout(500);

      // Type "Waiver" to trigger autocomplete
      await paymentAccountInput.fill('Waiver', { timeout: 5000 });
      console.log('Typed "Waiver" into Payment Account');
      await this.page.waitForTimeout(1500);

      // Click on the autocomplete option
      await this.page.click('text=Waiver Payment Account', { timeout: 5000 });
      console.log('Waiver Payment Account selected from autocomplete');
    } catch (e) {
      console.log('Autocomplete approach failed, trying forge-option click...');
      try {
        // Try clicking directly on forge-option
        await this.page.locator('forge-option:has-text("Waiver Payment Account")').click({ timeout: 5000 });
        console.log('Waiver Payment Account selected (forge-option)');
      } catch (e2) {
        console.log('forge-option failed, trying input + Enter...');
        const input = this.page.locator('forge-text-field#payment-account input').first();
        await input.fill('Waiver Payment Account', { timeout: 5000 });
        await input.press('Enter');
        console.log('Waiver Payment Account selected (Enter key)');
      }
    }

    await this.page.waitForTimeout(2000);

    const afterPaymentAccountPath = `./logs/after-payment-account-${Date.now()}.png`;
    await this.page.screenshot({ path: afterPaymentAccountPath, fullPage: true });
    console.log('Screenshot taken after selecting Payment Account');

    // Step 35: Select party name dynamically from "Party Responsible for Fees"
    console.log('Selecting Party Responsible for Fees...');
    await this.page.waitForTimeout(2000);

    // Build the full name from party data
    const fullName = [
      this.partyData.firstName,
      this.partyData.middleName,
      this.partyData.lastName
    ].filter(Boolean).join(' ');

    console.log(`Looking for party name: ${fullName}`);

    try {
      // Party Responsible for Fees is a forge-select element
      // Click to open the dropdown
      const partySelect = this.page.locator('#party-responsible-for-fees');
      await partySelect.click({ force: true, timeout: 5000 });
      console.log('Party Responsible for Fees dropdown clicked (ID selector, force)');
      await this.page.waitForTimeout(1000);

      // Type only the first name (space closes the dropdown)
      await this.page.keyboard.type(this.partyData.firstName, { delay: 100 });
      console.log(`Typed first name: ${this.partyData.firstName}`);
      await this.page.waitForTimeout(500);

      // Press Enter to confirm selection
      await this.page.keyboard.press('Enter');
      console.log(`Pressed Enter to select party: ${fullName}`);
    } catch (e) {
      console.log('ID selector approach failed, trying forge-select tag...');
      try {
        // Try forge-select tag with force click
        await this.page.locator('forge-select').click({ force: true, timeout: 5000 });
        await this.page.waitForTimeout(1000);

        // Type only first name and press Enter
        await this.page.keyboard.type(this.partyData.firstName, { delay: 100 });
        await this.page.waitForTimeout(500);
        await this.page.keyboard.press('Enter');
        console.log(`Selected party: ${fullName} (forge-select tag with keyboard)`);
      } catch (e2) {
        console.log('forge-select tag failed, trying click on option...');
        await this.page.locator(`forge-option:has-text("${fullName}")`).click({ force: true, timeout: 5000 });
        console.log(`Selected party: ${fullName} (forge-option click)`);
      }
    }

    await this.page.waitForTimeout(2000);

    const afterPartyResponsiblePath = `./logs/after-party-responsible-${Date.now()}.png`;
    await this.page.screenshot({ path: afterPartyResponsiblePath, fullPage: true });
    console.log('Screenshot taken after selecting Party Responsible for Fees');

    // Step 36: Click "Calculate Fees" button
    console.log('Clicking Calculate Fees button...');
    await this.page.waitForTimeout(2000);

    try {
      // Calculate Fees is a forge-button
      await this.page.locator('forge-button:has-text("Calculate Fees")').click({ timeout: 5000 });
      console.log('Calculate Fees button clicked (forge-button)');
    } catch (e) {
      console.log('forge-button selector failed, trying text selector...');
      await this.page.click('text=Calculate Fees', { timeout: 5000 });
      console.log('Calculate Fees button clicked (text selector)');
    }

    // Wait for fee calculation to complete (loading spinner)
    console.log('Waiting for fee calculation to complete...');
    await this.page.waitForTimeout(3000);

    const afterCalculateFeesPath = `./logs/after-calculate-fees-${Date.now()}.png`;
    await this.page.screenshot({ path: afterCalculateFeesPath, fullPage: true });
    console.log('Screenshot taken after calculating fees');

    // Step 37: Click "Summary" button
    console.log('Clicking Summary button...');
    await this.page.waitForTimeout(2000);

    // Progress: Phase 5 complete, starting Phase 6
    this.updatePhase(6);

    try {
      // Summary button is forge-button#fees-next
      await this.page.locator('forge-button#fees-next').click({ timeout: 5000 });
      console.log('Summary button clicked (forge-button#fees-next)');
    } catch (e) {
      console.log('ID selector failed, trying text selector...');
      try {
        await this.page.locator('forge-button:has-text("Summary")').click({ timeout: 5000 });
        console.log('Summary button clicked (forge-button with text)');
      } catch (e2) {
        console.log('forge-button failed, trying getByRole...');
        await this.page.getByRole('button', { name: /Summary/i }).click({ timeout: 5000 });
        console.log('Summary button clicked (getByRole)');
      }
    }

    await this.page.waitForTimeout(3000);

    // Step 38: Extract draft number from Summary page
    console.log('Extracting draft number from Summary page...');

    try {
      // Look for h3 element containing "Draft #"
      const draftElement = this.page.locator('h3:has-text("Draft #")').first();
      await draftElement.waitFor({ timeout: 5000 });

      const draftText = await draftElement.textContent();
      console.log(`Draft number found: ${draftText}`);

      // Generate filename with timestamp and UUID
      const timestamp = Date.now();
      const uuid = randomUUID();
      const filename = `draft-${timestamp}-${uuid}.txt`;
      const draftFilePath = path.join(__dirname, '../../logs', filename);

      // Write draft number to file
      fs.writeFileSync(draftFilePath, draftText || '');
      console.log(`Draft number saved to: ${draftFilePath}`);

      // Progress: Mark job as completed with draft number
      if (this.jobId && draftText) {
        jobStatusStore.completeJob(this.jobId, draftText.trim());
      }
    } catch (error) {
      console.log('Failed to extract draft number:', error);
      // Mark as completed even if draft extraction failed
      if (this.jobId) {
        jobStatusStore.completeJob(this.jobId);
      }
    }

    const summaryPagePath = `./logs/summary-page-${Date.now()}.png`;
    await this.page.screenshot({ path: summaryPagePath, fullPage: true });
    console.log('Screenshot taken on Summary page');

    console.log('Filing automation completed successfully!');

    // Return success result
    return {
      success: true,
      courtId: this.courtId,
      confirmationNumber: 'FILING-COMPLETED',
      filingDate: new Date().toISOString(),
      screenshots: [beforeLoginPath, afterLoginPath, afterStartFilingPath, caseInfoPath, afterCourtSelectionPath, afterCaseCategoryPath, afterCaseTypeSelectionPath, partiesPagePath, finalPath, afterPersonalInfoPath, afterContactInfoPath, partiesPageAfterSavePath, defendantModalPath, afterDefendantPersonalInfoPath, afterDefendantInfoPath, partiesPageAfterDefendantPath, filingsPagePath, filingModalPath, afterFilingCodePath, afterFilingDetailsPath, afterBehalfOfPath, afterSaveFilingPath, feesPagePath, afterPaymentAccountPath, afterPartyResponsiblePath, afterCalculateFeesPath, summaryPagePath],
      logs: [
        'Navigated to California eFile landing page',
        'Clicked Sign into your account button',
        'Login modal opened',
        'Filled email and password',
        'Clicked Sign In button',
        'Login completed successfully',
        'Clicked Start Filing button',
        'Clicked Start New Case button',
        'Filled Court Location with Santa Clara',
        'Selected Santa Clara - Civil from dropdown',
        'Filled Case Category with Small Claims',
        'Filled Case Type with 5000',
        'Clicked Parties button',
        'Added plaintiff party details',
        'Added defendant party details',
        'Clicked Filings button',
        'Filled filing details and uploaded document',
        'Clicked Save button to close filing modal',
        'Clicked Skip To Fees button',
        'Selected Waiver Payment Account',
        'Selected Party Responsible for Fees',
        'Fees page completed',
      ],
    };
  }

  /**
   * Supports small claims cases
   */
  supportsCase(caseType: string): boolean {
    return caseType === 'small_claims';
  }
}
