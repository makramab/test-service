/**
 * Job Status Store - In-memory storage for filing job progress
 */

export interface JobStatus {
  jobId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  currentPhase: number;
  totalPhases: number;
  progress: number; // 0-100
  phaseTitle: string;
  phaseDescription: string;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  draftNumber: string | null;
  error: string | null;
}

export interface PhaseInfo {
  phase: number;
  title: string;
  description: string;
  progressStart: number;
  progressEnd: number;
}

// Define the 6 phases
export const PHASES: PhaseInfo[] = [
  {
    phase: 1,
    title: 'Authentication & Setup',
    description: 'Logging in to California eFile...',
    progressStart: 0,
    progressEnd: 16,
  },
  {
    phase: 2,
    title: 'Case Information',
    description: 'Configuring case details...',
    progressStart: 17,
    progressEnd: 33,
  },
  {
    phase: 3,
    title: 'Parties Information',
    description: 'Filing plaintiff and defendant information...',
    progressStart: 34,
    progressEnd: 50,
  },
  {
    phase: 4,
    title: 'Filings & Documents',
    description: 'Preparing and uploading filing documents...',
    progressStart: 51,
    progressEnd: 67,
  },
  {
    phase: 5,
    title: 'Fees & Payment',
    description: 'Calculating and processing fee information...',
    progressStart: 68,
    progressEnd: 83,
  },
  {
    phase: 6,
    title: 'Summary & Completion',
    description: 'Finalizing submission...',
    progressStart: 84,
    progressEnd: 100,
  },
];

class JobStatusStore {
  private jobs: Map<string, JobStatus> = new Map();

  /**
   * Initialize a new job
   */
  createJob(jobId: string): JobStatus {
    const now = new Date().toISOString();
    const job: JobStatus = {
      jobId,
      status: 'pending',
      currentPhase: 1,
      totalPhases: 6,
      progress: 0,
      phaseTitle: PHASES[0].title,
      phaseDescription: PHASES[0].description,
      startedAt: now,
      updatedAt: now,
      completedAt: null,
      draftNumber: null,
      error: null,
    };

    this.jobs.set(jobId, job);
    return job;
  }

  /**
   * Update job progress to a specific phase
   */
  updatePhase(jobId: string, phase: number): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const phaseInfo = PHASES[phase - 1];
    if (!phaseInfo) return;

    job.currentPhase = phase;
    job.progress = phaseInfo.progressStart;
    job.phaseTitle = phaseInfo.title;
    job.phaseDescription = phaseInfo.description;
    job.status = 'in_progress';
    job.updatedAt = new Date().toISOString();

    this.jobs.set(jobId, job);
  }

  /**
   * Update job progress within a phase
   */
  updateProgress(jobId: string, progress: number): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.progress = Math.min(100, Math.max(0, progress));
    job.updatedAt = new Date().toISOString();

    this.jobs.set(jobId, job);
  }

  /**
   * Mark job as completed
   */
  completeJob(jobId: string, draftNumber?: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'completed';
    job.currentPhase = 6;
    job.progress = 100;
    job.phaseTitle = 'Summary & Completion';
    job.phaseDescription = draftNumber
      ? `Filing complete! ${draftNumber} created`
      : 'Filing complete!';
    job.completedAt = new Date().toISOString();
    job.updatedAt = new Date().toISOString();
    job.draftNumber = draftNumber || null;

    this.jobs.set(jobId, job);
  }

  /**
   * Mark job as failed
   */
  failJob(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'error';
    job.error = error;
    job.completedAt = new Date().toISOString();
    job.updatedAt = new Date().toISOString();

    this.jobs.set(jobId, job);
  }

  /**
   * Get job status
   */
  getJob(jobId: string): JobStatus | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Delete old completed jobs (cleanup)
   */
  cleanup(olderThanMinutes: number = 60): void {
    const cutoffTime = Date.now() - olderThanMinutes * 60 * 1000;

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.completedAt) {
        const completedTime = new Date(job.completedAt).getTime();
        if (completedTime < cutoffTime) {
          this.jobs.delete(jobId);
        }
      }
    }
  }
}

// Export singleton instance
export const jobStatusStore = new JobStatusStore();
