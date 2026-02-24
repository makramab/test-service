/**
 * Example script demonstrating how to use the filing service programmatically
 * This can be run directly without starting the Express server
 */

import { filingService } from '../services/filing-service';
import { FilingRequest } from '../types/filing.types';

async function runExampleFiling() {
  console.log('=== Legali Filing Service Example ===\n');

  // Example filing request - Using California eFile
  const filingRequest: FilingRequest = {
    courtId: 'california-efile',
    courtName: 'California eFile (Tyler Technologies)',
    caseData: {
      plaintiff: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '555-0100',
        address: {
          street: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94102',
        },
      },
      defendant: {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        address: {
          street: '456 Oak Ave',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94103',
        },
      },
      caseType: 'small_claims',
      claimAmount: 5000,
      description: 'Breach of contract for unpaid consulting services',
      incidentDate: '2024-09-15',
    },
    documents: [
      {
        filename: 'contract.pdf',
        filepath: './sample-documents/contract.pdf',
        documentType: 'contract',
      },
      {
        filename: 'invoice.pdf',
        filepath: './sample-documents/invoice.pdf',
        documentType: 'invoice',
      },
    ],
    metadata: {
      generatedBy: 'legali-rag',
      timestamp: new Date().toISOString(),
    },
  };

  console.log('📋 Available courts:', filingService.getAvailableCourts());
  console.log('📋 Courts supporting small claims:', filingService.getCourtsByCaseType('small_claims'));
  console.log('\n🚀 Executing filing...\n');

  try {
    const result = await filingService.executeFiling(filingRequest);

    console.log('\n=== Filing Result ===');
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n✅ Filing successful!');
      console.log(`Case Number: ${result.caseNumber}`);
      console.log(`Confirmation: ${result.confirmationNumber}`);
    } else {
      console.log('\n❌ Filing failed:', result.error);
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

// Run the example
runExampleFiling();
