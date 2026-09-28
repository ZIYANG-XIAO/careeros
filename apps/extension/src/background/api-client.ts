import type {
  AnswerResolution,
  AnswerResolutionRequestData,
  ApplicationPageContext,
  AuthStatus,
  ClipJobRequestData,
  ClippedJob,
  ResumeFilePayload,
  ReusableAnswerInput,
  SavedReusableAnswers,
  PrepareApplicationRequestData,
  RecordApplicationRequestData,
  TrackedApplication,
} from "../shared/messages";
import { resolveAnswers } from "./api-client-answers";
import { getAuthStatus } from "./api-client-auth";
import {
  clipJob,
  downloadResumeVersion,
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
