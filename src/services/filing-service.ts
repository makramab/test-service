import { FilingRequest, FilingResult, FilingStatus } from '../types/filing.types';
import { courtRegistry } from './court-registry';

/**
 * Main service for handling court filing requests
 */
export class FilingService {
  /**
   * Execute a filing request
   */
  async executeFiling(request: FilingRequest): Promise<FilingResult> {
    // Validate request
    this.validateRequest(request);

    // Get the appropriate court automation
    const court = courtRegistry.getCourt(request.courtId);

    if (!court) {
      return {
        success: false,
        courtId: request.courtId,
        error: `Court not found: ${request.courtId}. Available courts: ${this.getAvailableCourts().join(', ')}`,
      };
    }

    // Check if court supports the case type
    if (!court.supportsCase(request.caseData.caseType)) {
      return {
        success: false,
        courtId: request.courtId,
        error: `Court ${court.courtName} does not support case type: ${request.caseData.caseType}`,
      };
    }

    // Execute the filing
    console.log(`Executing filing for court: ${court.courtName}`);
    const result = await court.file(request);

    return result;
  }

  /**
   * Validate filing request
   */
  private validateRequest(request: FilingRequest): void {
    if (!request.courtId) {
      throw new Error('Court ID is required');
    }

    if (!request.caseData) {
      throw new Error('Case data is required');
    }

    if (!request.caseData.plaintiff) {
      throw new Error('Plaintiff information is required');
    }

    if (!request.caseData.defendant) {
      throw new Error('Defendant information is required');
    }
  }

  /**
   * Get list of available court IDs
   */
  getAvailableCourts(): string[] {
    return courtRegistry.getAllCourts().map(court => court.courtId);
  }

  /**
   * Get courts that support a specific case type
   */
  getCourtsByCaseType(caseType: string): string[] {
    return courtRegistry.getCourtsByCaseType(caseType).map(court => court.courtId);
  }
}

export const filingService = new FilingService();
