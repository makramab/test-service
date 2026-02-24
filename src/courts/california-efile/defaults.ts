import { CaliforniaEFileConfig } from '../../types/california-efile.types';
import * as defaultPartyData from '../../data/party-data.json';
import * as defaultDefendantData from '../../data/defendant-data.json';
import * as defaultFilingData from '../../data/filing-data.json';
import * as defaultDocumentData from '../../data/document-data.json';

export function getDefaultConfig(): CaliforniaEFileConfig {
  return {
    credentials: {
      email: process.env.EFILE_EMAIL || '',
      password: process.env.EFILE_PASSWORD || '',
    },
    caseConfig: {
      landingUrl: 'https://california.tylertech.cloud/OfsEfsp/ui/landing',
      courtLocation: 'Santa Clara',
      courtLocationFull: 'Santa Clara - Civil',
      caseCategory: 'Small Claims',
      caseType: '5000',
      paymentAccount: 'Waiver',
    },
    partyData: defaultPartyData as CaliforniaEFileConfig['partyData'],
    defendantData: defaultDefendantData as CaliforniaEFileConfig['defendantData'],
    filingData: defaultFilingData as CaliforniaEFileConfig['filingData'],
    documentData: defaultDocumentData as CaliforniaEFileConfig['documentData'],
  };
}
