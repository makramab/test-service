import { Page, Frame } from '@playwright/test';

export interface EFileCredentials {
  email: string;
  password: string;
}

export interface CaseConfig {
  landingUrl: string;
  /** County name extracted from litigation state (e.g. "San Mateo") */
  county: string;
  /** Court type from litigation state (e.g. "small_claims") */
  courtType: string;
  /** Claim amount used to select the correct Case Type tier */
  claimAmount: number;
  /** Payment account name (e.g. "Waiver") */
  paymentAccount: string;

  // Legacy fields — used as direct fallback when county is not in the court registry
  courtLocation: string;
  courtLocationFull: string;
  caseCategory: string;
  caseType: string;
}

export interface PartyAddress {
  country: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface PartyData {
  partyType: string;
  iAmThisParty?: boolean;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  phoneNumber: string;
  leadAttorney: string;
  address: PartyAddress;
}

export interface FilingData {
  filingCode: string;
  filingDescription: string;
  clientReferenceNumber: string;
  commentsToCourtOpening: string;
  filingOnBehalfOf: string;
}

export interface LeadDocument {
  url: string;
  filename: string;
  documentType: string;
}

export interface DocumentData {
  leadDocument: LeadDocument;
}

/** What the API accepts (all optional overrides) */
export interface CaliforniaEFileOverrides {
  credentials?: Partial<EFileCredentials>;
  caseConfig?: Partial<CaseConfig>;
  partyData?: Partial<PartyData>;
  defendantData?: Partial<PartyData>;
  filingData?: Partial<FilingData>;
  documentData?: Partial<DocumentData>;
  headless?: boolean;
}

/** Fully resolved config (no optionals) passed to steps */
export interface CaliforniaEFileConfig {
  credentials: EFileCredentials;
  caseConfig: CaseConfig;
  partyData: PartyData;
  defendantData: PartyData;
  filingData: FilingData;
  documentData: DocumentData;
}

/** Shared context passed to every step function */
export interface StepContext {
  page: Page;
  config: CaliforniaEFileConfig;
  screenshot: (name: string) => Promise<string>;
  updatePhase: (phase: number) => void;
  log: (msg: string) => void;
}

/** A page or frame — used where form inputs may be in an iframe */
export type PageOrFrame = Page | Frame;
