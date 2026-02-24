import { ICourtAutomation } from '../types/court-automation.interface';
import { ExampleCourtAutomation } from '../courts/example-court.automation';
import { GoogleFormTestAutomation } from '../courts/google-form-test.automation';
import { CaliforniaEFileAutomation } from '../courts/california-efile.automation';

/**
 * Registry for managing all available court automations
 */
export class CourtRegistry {
  private courts: Map<string, ICourtAutomation>;

  constructor() {
    this.courts = new Map();
    this.registerCourts();
  }

  /**
   * Register all available court automations
   */
  private registerCourts(): void {
    // Register example court
    const exampleCourt = new ExampleCourtAutomation();
    this.courts.set(exampleCourt.courtId, exampleCourt);

    // Register Google Form test
    const googleFormTest = new GoogleFormTestAutomation();
    this.courts.set(googleFormTest.courtId, googleFormTest);

    // Register California eFile
    const californiaEFile = new CaliforniaEFileAutomation();
    this.courts.set(californiaEFile.courtId, californiaEFile);

    // Add more courts here as you implement them:
    // const sampleCourt = new SampleCourtAutomation();
    // this.courts.set(sampleCourt.courtId, sampleCourt);
  }

  /**
   * Get a court automation by court ID
   */
  getCourt(courtId: string): ICourtAutomation | undefined {
    return this.courts.get(courtId);
  }

  /**
   * Get all registered courts
   */
  getAllCourts(): ICourtAutomation[] {
    return Array.from(this.courts.values());
  }

  /**
   * Get courts that support a specific case type
   */
  getCourtsByCaseType(caseType: string): ICourtAutomation[] {
    return this.getAllCourts().filter(court => court.supportsCase(caseType));
  }

  /**
   * Check if a court is registered
   */
  hasCourt(courtId: string): boolean {
    return this.courts.has(courtId);
  }
}

// Export a singleton instance
export const courtRegistry = new CourtRegistry();
