import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { AppException } from "../common/exceptions/app-exception";
import { ReviewsOpenAiClient } from "./providers/reviews-openai.client";
import { ReviewsTavilyClient } from "./providers/reviews-tavily.client";
import {
  ExtractedSource,
  QueryArtifact,
  QueryRefinementResult,
  RelevanceFilteringInput,
  SearchCandidate,
  SearchSourcesInput,
} from "./reviews.types";
import { selectDomainsForBucket } from "./reviews.utils";

@Injectable()
export class ReviewsProvidersService {
  constructor(
    private readonly configService: ConfigService,
    private readonly openAiClient: ReviewsOpenAiClient,
    private readonly tavilyClient: ReviewsTavilyClient,
  ) {}

  async refineQuery(rawClaim: string): Promise<QueryRefinementResult> {
    const apiKey = this.getRequiredOpenAiApiKey();
    return this.openAiClient.refineQuery(apiKey, rawClaim);
  }

  async searchSources(input: SearchSourcesInput): Promise<SearchCandidate[]> {
    const apiKey = this.getRequiredTavilyApiKey();
    const timeoutMs = this.getTavilySearchTimeoutMs();
    const verificationDomains = selectDomainsForBucket(
      input.domainRegistry,
      "verification",
      input.userCountryCode,
      input.topicCountryCode,
    );

    return this.tavilyClient.searchSources({
      apiKey,
      timeoutMs,
      input,
      bucket: "verification",
      includeDomains: verificationDomains,
    });
  }

  async searchFallbackSources(
    queries: QueryArtifact[],
    domainRegistry: SearchSourcesInput["domainRegistry"],
  ): Promise<SearchCandidate[]> {
    const apiKey = this.getRequiredTavilyApiKey();
    const timeoutMs = this.getTavilySearchTimeoutMs();

    return this.tavilyClient.searchSources({
      apiKey,
      timeoutMs,
      input: {
        queries,
        coreClaim: "",
        claimLanguageCode: "",
        userCountryCode: null,
        topicCountryCode: null,
        topicScope: "unknown",
        domainRegistry,
      },
      bucket: "fallback",
    });
  }

  async applyRelevanceFiltering(
    input: RelevanceFilteringInput,
  ): Promise<SearchCandidate[]> {
    const apiKey = this.getRequiredOpenAiApiKey();
    return this.openAiClient.applyRelevanceFiltering(apiKey, input);
  }

  async extractContent(
    candidates: SearchCandidate[],
  ): Promise<ExtractedSource[]> {
    const apiKey = this.getRequiredTavilyApiKey();
    const timeoutMs = this.getTavilyExtractTimeoutMs();

    return this.tavilyClient.extractContent({
      apiKey,
      timeoutMs,
      candidates,
    });
  }

  private getRequiredOpenAiApiKey(): string {
    const apiKey = this.configService.get<string | null>("openAiApiKey", null);

    if (!apiKey) {
      throw new AppException(
        APP_ERROR_CODES.CONFIG_VALIDATION_ERROR,
        "real provider mode에서는 OPENAI_API_KEY가 필요합니다.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return apiKey;
  }

  private getRequiredTavilyApiKey(): string {
    const apiKey = this.configService.get<string | null>("tavilyApiKey", null);

    if (!apiKey) {
      throw new AppException(
        APP_ERROR_CODES.CONFIG_VALIDATION_ERROR,
        "real provider mode에서는 TAVILY_API_KEY가 필요합니다.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return apiKey;
  }

  private getTavilySearchTimeoutMs(): number {
    return this.configService.get<number>("tavilySearchTimeoutMs", 40000);
  }

  private getTavilyExtractTimeoutMs(): number {
    return this.configService.get<number>("tavilyExtractTimeoutMs", 80000);
  }
}
