import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { AppException } from "../common/exceptions/app-exception";
import { NaverNewsSearchTestRequestDto } from "./dto/naver-news-search-test.dto";
import { AnswersNaverClient } from "./providers/answers-naver.client";
import { AnswersOpenAiClient } from "./providers/answers-openai.client";
import { AnswersTavilyClient } from "./providers/answers-tavily.client";
import {
  ExtractedSource,
  EvidenceSignal,
  EvidenceSignalClassificationInput,
  QueryRefinementResult,
  RelevanceSignalClassificationInput,
  RelevanceSignalClassificationResult,
  SearchCandidate,
  SearchSourcesInput,
} from "./answers.types";
import { selectDomainsForBucket } from "./answers.utils";

const NAVER_SEARCH_DISPLAY = 8;
const NAVER_SUFFICIENT_SOURCE_COUNT = 15;
const NAVER_SEARCH_TIMEOUT_CAP_MS = 8000;
const TAVILY_FALLBACK_SOFT_TIMEOUT_MS = 8000;

@Injectable()
export class AnswersProvidersService {
  private readonly logger = new Logger(AnswersProvidersService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly openAiClient: AnswersOpenAiClient,
    private readonly tavilyClient: AnswersTavilyClient,
    private readonly naverClient: AnswersNaverClient,
  ) {}

  async refineQuery(rawCheck: string): Promise<QueryRefinementResult> {
    const apiKey = this.getRequiredOpenAiApiKey();
    return this.openAiClient.refineQuery(apiKey, rawCheck);
  }

  async searchSources(input: SearchSourcesInput): Promise<SearchCandidate[]> {
    const searchRoute = input.searchRoute ?? "supported";

    if (searchRoute === "supported") {
      const clientId = this.getRequiredNaverClientId();
      const clientSecret = this.getRequiredNaverClientSecret();
      const timeoutMs = Math.min(this.getNaverSearchTimeoutMs(), NAVER_SEARCH_TIMEOUT_CAP_MS);
      const startedAt = Date.now();
      const naverSettledResults = await Promise.allSettled(
        input.queries.map((query) =>
          this.naverClient.searchNews({
            clientId,
            clientSecret,
            timeoutMs,
            query: query.text,
            queryId: query.id,
            queryPurpose: query.purpose,
            display: NAVER_SEARCH_DISPLAY,
            start: 1,
            sort: "sim",
          }),
        ),
      );
      const naverResults = naverSettledResults.flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      );
      const failedNaverQueryCount = naverSettledResults.filter(
        (result) => result.status === "rejected",
      ).length;

      if (failedNaverQueryCount > 0) {
        this.logger.warn(
          `answer source search naver partial failure; failedQueries=${failedNaverQueryCount}`,
        );
      }

      if (naverResults.length >= NAVER_SUFFICIENT_SOURCE_COUNT) {
        return naverResults;
      }

      const tavilyStartedAt = Date.now();
      const tavilyResults = await this.searchTavilyFallbackSources({
        apiKey: this.getRequiredTavilyApiKey(),
        timeoutMs: this.getTavilySearchTimeoutMs(),
        input,
      });

      this.logger.log(
        `answer source search tavily fallback completed in ${Date.now() - tavilyStartedAt}ms; candidates=${tavilyResults.length}`,
      );

      return [...naverResults, ...tavilyResults];
    }

    throw new AppException(
      APP_ERROR_CODES.INPUT_VALIDATION_ERROR,
      "unsupported route는 source search를 수행할 수 없습니다.",
      HttpStatus.BAD_REQUEST,
    );
  }

  async searchNaverNewsForTest(
    input: NaverNewsSearchTestRequestDto,
  ): Promise<SearchCandidate[]> {
    const clientId = this.getRequiredNaverClientId();
    const clientSecret = this.getRequiredNaverClientSecret();
    const timeoutMs = this.getNaverSearchTimeoutMs();

    return this.naverClient.searchNews({
      clientId,
      clientSecret,
      timeoutMs,
      query: input.query,
      display: input.display,
      start: input.start,
      sort: input.sort,
    });
  }

  async classifyEvidenceSignals(
    input: EvidenceSignalClassificationInput,
  ): Promise<EvidenceSignal[]> {
    const apiKey = this.getRequiredOpenAiApiKey();
    return this.openAiClient.classifyEvidenceSignals(apiKey, input);
  }

  async classifyRelevanceAndEvidenceSignals(
    input: RelevanceSignalClassificationInput,
  ): Promise<RelevanceSignalClassificationResult> {
    const apiKey = this.getRequiredOpenAiApiKey();
    return this.openAiClient.classifyRelevanceAndEvidenceSignals(apiKey, input);
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

  private getRequiredNaverClientId(): string {
    const clientId = this.configService.get<string | null>("naverClientId", null);

    if (!clientId) {
      throw new AppException(
        APP_ERROR_CODES.CONFIG_VALIDATION_ERROR,
        "Naver 뉴스 검색에는 NAVER_CLIENT_ID가 필요합니다.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return clientId;
  }

  private getRequiredNaverClientSecret(): string {
    const clientSecret = this.configService.get<string | null>(
      "naverClientSecret",
      null,
    );

    if (!clientSecret) {
      throw new AppException(
        APP_ERROR_CODES.CONFIG_VALIDATION_ERROR,
        "Naver 뉴스 검색에는 NAVER_CLIENT_SECRET이 필요합니다.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return clientSecret;
  }

  private getNaverSearchTimeoutMs(): number {
    return this.configService.get<number>("naverSearchTimeoutMs", 40000);
  }

  private getTavilySearchTimeoutMs(): number {
    return this.configService.get<number>("tavilySearchTimeoutMs", 40000);
  }

  private getTavilyExtractTimeoutMs(): number {
    return this.configService.get<number>("tavilyExtractTimeoutMs", 180000);
  }

  private buildKoreanTavilyIncludeDomains(input: SearchSourcesInput): string[] {
    return selectDomainsForBucket(input.domainRegistry, "familiar")
      .map((domain) => domain.replace(/^\*\./, ""))
      .filter((domain, index, domains) => domains.indexOf(domain) === index);
  }

  private async searchTavilyFallbackSources(params: {
    apiKey: string;
    timeoutMs: number;
    input: SearchSourcesInput;
  }): Promise<SearchCandidate[]> {
    try {
      const candidates = await this.tavilyClient.searchSources({
        apiKey: params.apiKey,
        timeoutMs: Math.min(params.timeoutMs, TAVILY_FALLBACK_SOFT_TIMEOUT_MS),
        input: params.input,
        bucket: "fallback",
        includeDomains: this.buildKoreanTavilyIncludeDomains(params.input),
      });

      return candidates;
    } catch (error) {
      this.logger.warn(
        `Tavily fallback source search skipped: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );

      return [];
    }
  }
}
