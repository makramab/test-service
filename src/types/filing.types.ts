/**
 * Core types for court filing automation
 */

export interface Party {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: Address;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface CaseData {
  plaintiff: Party;
  defendant: Party;
  caseType: 'small_claims' | 'civil' | 'family' | 'other';
  claimAmount?: number;
  description: string;
  incidentDate?: string;
}

export interface DocumentAttachment {
  filename: string;
  filepath: string;
  documentType: string;
}

export interface FilingRequest {
  courtId: string;
  courtName: string;
  caseData: CaseData;
  documents: DocumentAttachment[];
  metadata?: Record<string, any>;
}

export interface FilingResult {
  success: boolean;
  courtId: string;
  caseNumber?: string;
  confirmationNumber?: string;
  filingDate?: string;
  error?: string;
  screenshots?: string[];
  logs?: string[];
}

export enum FilingStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}
