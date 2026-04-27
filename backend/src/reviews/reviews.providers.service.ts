import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { AppException } from "../common/exceptions/app-exception";
import { NaverNewsSearchTestRequestDto } from "./dto/naver-news-search-test.dto";
import { ReviewsNaverClient } from "./providers/reviews-naver.client";
import { ReviewsOpenAiClient } from "./providers/reviews-openai.client";
import { ReviewsTavilyClient } from "./providers/reviews-tavily.client";
import {
  ExtractedSource,
  QueryRefinementResult,
  RelevanceFilteringInput,
  SearchCandidate,
  SearchSourcesInput,
} from "./reviews.types";

@Injectable()
export class ReviewsProvidersService {
  constructor(
    private readonly configService: ConfigService,
    private readonly openAiClient: ReviewsOpenAiClient,
    private readonly tavilyClient: ReviewsTavilyClient,
    private readonly naverClient: ReviewsNaverClient,
  ) {}

  async refineQuery(rawClaim: string): Promise<QueryRefinementResult> {
    const apiKey = this.getRequiredOpenAiApiKey();
    return this.openAiClient.refineQuery(apiKey, rawClaim);
  }

  async searchSources(input: SearchSourcesInput): Promise<SearchCandidate[]> {
    const searchRoute = input.searchRoute ?? "korean_news";

    if (searchRoute === "korean_news") {
      const clientId = this.getRequiredNaverClientId();
      const clientSecret = this.getRequiredNaverClientSecret();
      const timeoutMs = this.getNaverSearchTimeoutMs();
      const queryResults = await Promise.all(
        input.queries.map((query) =>
          this.naverClient.searchNews({
            clientId,
            clientSecret,
            timeoutMs,
            query: query.text,
            queryId: query.id,
            queryPurpose: query.purpose,
            display: 5,
            start: 1,
            sort: "sim",
          }),
        ),
      );

      return queryResults.flat();
    }

    if (searchRoute === "global_news") {
      const apiKey = this.getRequiredTavilyApiKey();
      const timeoutMs = this.getTavilySearchTimeoutMs();

      return this.tavilyClient.searchSources({
        apiKey,
        timeoutMs,
        input,
        bucket: "verification",
      });
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
}
