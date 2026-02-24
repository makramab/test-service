export const SELECTORS = {
  auth: {
    signInButton: 'forge-button#sign-in',
    usernameInput: '#UserName',
    passwordInput: '#Password',
    signInSubmit: '#sign-in-btn',
    startFilingText: 'text=Start Filing',
    modal: [
      'div[role="dialog"]',
      '.modal',
      '[class*="modal"]',
      '[class*="dialog"]',
      'div:has(> h1:text("Sign In"))',
    ],
  },
  caseInfo: {
    startFilingButton: 'button:has-text("Start Filing")',
    startNewCaseButton: 'button:has-text("Start New Case")',
    courtLocationText: 'text=Court Location',
    caseCategoryText: 'text=Case Category',
    caseTypeText: 'text=Case Type',
  },
  parties: {
    addPartyDetails: 'text=Add party details',
    editPartyDetailsHeading: 'text=Edit Party Details',
    firstNameText: 'text=First Name',
    partiesText: 'text=Parties',
    partiesNextButton: 'forge-button#parties-next',
  },
  filings: {
    noFilingsText: 'text=No Filings Added Yet',
    addFilingButton: 'button:has-text("Add Filing")',
    editFilingHeading: 'text=Edit Filing Details',
    saveFilingsButton: 'forge-button#save-filings',
    skipToFeesButton: 'forge-button:has-text("Skip To Fees")',
    fileInput: 'input[type="file"]',
  },
  fees: {
    paymentAccountInput: 'forge-text-field#payment-account input',
    partyResponsibleSelect: '#party-responsible-for-fees',
    calculateFeesButton: 'forge-button:has-text("Calculate Fees")',
    feesNextButton: 'forge-button#fees-next',
  },
  summary: {
    draftNumber: 'h3:has-text("Draft #")',
  },
} as const;
