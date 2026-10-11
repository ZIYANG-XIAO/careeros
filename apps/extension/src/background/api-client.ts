import type {
  AnswerResolution,
  AnswerResolutionRequestData,
  ApplicationPageContext,
  AuthStatus,
  ClipJobRequestData,
  ClippedJob,
  DraftAnswerRequestData,
  DraftedAnswer,
  ResumeFilePayload,
  ReusableAnswerInput,
  SavedReusableAnswers,
  PrepareApplicationRequestData,
  RecordApplicationRequestData,
  TrackedApplication,
} from "../shared/messages";
import { resolveAnswers } from "./api-client-answers";
import {
  analyzeJob,
  coverLetterFile,
  draftCoverLetter,
  getJobMatch,
  lookupPageJob,
} from "./api-client-insights";
import { getAuthStatus, reportPresence } from "./api-client-auth";
import {
  clipJob,
  downloadResumeVersion,
  draftAnswer,
  saveReusableAnswers,
} from "./api-client-jobs";
import {
  getApplicationContext,
  prepareApplication,
  recordApplication,
} from "./api-client-applications";

interface TokenProvider {
  getToken(): Promise<string | null>;
}

export class CareerOsApiClient {
  constructor(
    private readonly apiUrl: string,
    private readonly tokenProvider: TokenProvider,
    private readonly request: typeof fetch = (...args) => fetch(...args),
  ) {}

  async getAuthStatus(): Promise<AuthStatus> {
    return getAuthStatus(this.apiUrl, this.tokenProvider, this.request);
  }

  async reportPresence(buildVersion: string): Promise<void> {
    return reportPresence(
      this.apiUrl,
      this.tokenProvider,
      this.request,
      buildVersion,
    );
  }

  async resolveAnswers(
    input: AnswerResolutionRequestData,
  ): Promise<AnswerResolution | null> {
    return resolveAnswers(this.apiUrl, this.tokenProvider, this.request, input);
  }

  async getApplicationContext(
    pageUrl: string,
    pageTitle: string,
  ): Promise<ApplicationPageContext | null> {
    return getApplicationContext(
      this.apiUrl,
      this.tokenProvider,
      this.request,
      pageUrl,
      pageTitle,
    );
  }

  async recordApplication(
    input: RecordApplicationRequestData,
    pageUrl: string,
  ): Promise<TrackedApplication | null> {
    return recordApplication(
      this.apiUrl,
      this.tokenProvider,
      this.request,
      input,
      pageUrl,
    );
  }

  async prepareApplication(
    input: PrepareApplicationRequestData,
    pageUrl: string,
  ): Promise<TrackedApplication | null> {
    return prepareApplication(
      this.apiUrl,
      this.tokenProvider,
      this.request,
      input,
      pageUrl,
    );
  }

  async clipJob(
    input: ClipJobRequestData,
    pageUrl: string,
  ): Promise<ClippedJob | null> {
    return clipJob(
      this.apiUrl,
      this.tokenProvider,
      this.request,
      input,
      pageUrl,
    );
  }

  lookupPageJob(pageUrl: string) {
    return lookupPageJob(
      this.apiUrl,
      this.tokenProvider,
      this.request,
      pageUrl,
    );
  }

  getJobMatch(jobId: string) {
    return getJobMatch(this.apiUrl, this.tokenProvider, this.request, jobId);
  }

  analyzeJob(jobId: string, resumeVersionId: string) {
    return analyzeJob(
      this.apiUrl,
      this.tokenProvider,
      this.request,
      jobId,
      resumeVersionId,
    );
  }

  draftCoverLetter(jobId: string) {
    return draftCoverLetter(
      this.apiUrl,
      this.tokenProvider,
      this.request,
      jobId,
    );
  }

  coverLetterFile(letter: string, filenameHint: string) {
    return coverLetterFile(
      this.apiUrl,
      this.tokenProvider,
      this.request,
      letter,
      filenameHint,
    );
  }

  async draftAnswer(
    input: DraftAnswerRequestData,
  ): Promise<DraftedAnswer | null> {
    return draftAnswer(this.apiUrl, this.tokenProvider, this.request, input);
  }

  async saveReusableAnswers(
    answers: ReusableAnswerInput[],
  ): Promise<SavedReusableAnswers | null> {
    return saveReusableAnswers(
      this.apiUrl,
      this.tokenProvider,
      this.request,
      answers,
    );
  }

  async downloadResumeVersion(
    resumeVersionId: string,
  ): Promise<ResumeFilePayload | null> {
    return downloadResumeVersion(
      this.apiUrl,
      this.tokenProvider,
      this.request,
      resumeVersionId,
    );
  }
}
