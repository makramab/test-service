import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { filingService } from './services/filing-service';
import { FilingRequest } from './types/filing.types';
import { CaliforniaEFileAutomation, CaliforniaEFileOverrides } from './courts/california-efile/automation';
import { randomUUID } from 'crypto';
import { jobStatusStore } from './services/job-status-store';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Allow all origins (development only)
app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'legali-filing-service' });
});

// Get available courts
app.get('/api/courts', (req: Request, res: Response) => {
  const courts = filingService.getAvailableCourts();
  res.json({ courts });
});

// Get courts by case type
app.get('/api/courts/case-type/:caseType', (req: Request, res: Response) => {
  const { caseType } = req.params;
  const courts = filingService.getCourtsByCaseType(caseType);
  res.json({ caseType, courts });
});

// Get California eFile job status (for polling)
app.get('/api/california-efile/status/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;

  const job = jobStatusStore.getJob(jobId);

  if (!job) {
    return res.status(404).json({
      error: 'Job not found',
      jobId,
    });
  }

  res.json(job);
});

// Execute California eFile automation with optional overrides (background processing)
app.post('/api/california-efile/file', (req: Request, res: Response) => {
  try {
    // Extract override data from request body
    const overrides: CaliforniaEFileOverrides = {
      credentials: req.body.credentials,
      caseConfig: req.body.caseConfig,
      partyData: req.body.partyData,
      defendantData: req.body.defendantData,
      filingData: req.body.filingData,
      documentData: req.body.documentData,
      headless: req.body.headless,
    };

    // Generate job ID
    const jobId = randomUUID();

    // Initialize job status
    jobStatusStore.createJob(jobId);

    // Log the request
    console.log(`[${jobId}] Received California eFile automation request`);
    if (overrides.credentials) console.log(`[${jobId}] Credential overrides provided`);
    if (overrides.caseConfig) console.log(`[${jobId}] Case config overrides provided`);
    if (overrides.partyData) console.log(`[${jobId}] Party data overrides provided`);
    if (overrides.defendantData) console.log(`[${jobId}] Defendant data overrides provided`);
    if (overrides.filingData) console.log(`[${jobId}] Filing data overrides provided`);
    if (overrides.documentData) console.log(`[${jobId}] Document data overrides provided`);
    if (overrides.headless !== undefined) console.log(`[${jobId}] Headless mode: ${overrides.headless}`);

    // Create automation instance with overrides
    const automation = new CaliforniaEFileAutomation(overrides);
    automation.setJobId(jobId);

    // Execute automation in background (fire-and-forget)
    automation.file({
      courtId: 'california-efile',
      courtName: 'California eFile',
      caseData: {} as any,
      documents: [],
    }).then((result) => {
      console.log(`[${jobId}] Automation completed successfully`);
      console.log(`[${jobId}] Result:`, JSON.stringify(result, null, 2));
    }).catch((error) => {
      console.error(`[${jobId}] Automation failed:`, error);
      // Mark job as failed
      jobStatusStore.failJob(jobId, error instanceof Error ? error.message : 'Unknown error');
    });

    // Immediately return success response
    res.status(200).json({
      success: true,
      message: 'California eFile automation started',
      jobId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error starting automation:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Execute filing
app.post('/api/file', async (req: Request, res: Response) => {
  try {
    const filingRequest: FilingRequest = req.body;

    console.log(`Received filing request for court: ${filingRequest.courtId}`);

    const result = await filingService.executeFiling(filingRequest);

    res.json(result);
  } catch (error) {
    console.error('Filing error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Legali Filing Service running on port ${PORT}`);
  console.log(`📋 Available courts: ${filingService.getAvailableCourts().join(', ')}`);
});

export default app;
