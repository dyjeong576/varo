import {
  Review,
  MockApiResponse,
  CommunityPost,
  SessionResponse,
  UpdateProfilePayload,
  UserMeResponse,
} from "./types";
import { apiRequest } from "./http";

let MOCK_REVIEWS: Review[] = [
  {
    id: "r-1",
    claim: "서울시 대중교통 무제한 이용권, 정말 세계 최초인가요?",
    verdict: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: "r-2",
    claim: "전기차 지하 주차장 출입 전면 금지 조례안 사실 여부",
    verdict: "Unclear",
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: "r-3",
    claim: "모바일 신분증 도입 후 기존 실물 신분증 효력 상실?",
    verdict: "Likely False",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

const MOCK_POSTS: CommunityPost[] = [
  {
    id: "p-1",
    title: "최근 발표된 주택 정책에 대해 어떻게 생각하시나요?",
    category: "Policy",
    content: "정부에서 발표한 이번 주택 공급 대책이 실제로 실효성이 있을지 의문입니다. 특히 30대 무주택자들에게 얼마나 혜택이 돌아갈지가 핵심인 것 같아요. 여러분의 의견이 궁금합니다.",
    author: { name: "김철수", gender: "Male", ageGroup: "30s" },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    likeCount: 12,
    commentCount: 4,
    comments: [
      {
        id: "c-1",
        author: { name: "이영희", gender: "Female", ageGroup: "30s" },
        content: "현장의 목소리가 충분히 반영되지 않은 느낌이에요. 대출 규제 완화가 병행되어야 하지 않을까요?",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
      },
      {
        id: "c-2",
        author: { name: "박지민", gender: "Male", ageGroup: "20s" },
        content: "20대 입장에서는 여전히 진입장벽이 너무 높게 느껴집니다.",
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      },
    ],
  },
  {
    id: "p-2",
    title: "가짜 뉴스 판별을 위한 VARO 활용 팁",
    category: "FactCheck",
    content: "요즘 자극적인 헤드라인이 너무 많은데, VARO에서 근거 스니펫을 먼저 확인하는 습관을 들이니 판단하기가 훨씬 수월해졌습니다. 다들 어떻게 활용하고 계신가요?",
    author: { name: "최민수", gender: "Male", ageGroup: "40s" },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    likeCount: 25,
    commentCount: 2,
  },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const api = {
  reviews: {
    getRecent: async (): Promise<MockApiResponse<Review[]>> => {
      await delay(600); // 네트워크 대기시간 모의
      return { data: MOCK_REVIEWS, status: 200 };
    },
    create: async (claim: string): Promise<MockApiResponse<{ id: string }>> => {
      await delay(1200); // 1.2초 대기
      const newReview: Review = {
        id: `r-${Date.now()}`,
        claim,
        verdict: null,
        createdAt: new Date().toISOString(),
      };
      // 목록 맨 첫번째로 삽입
      MOCK_REVIEWS = [newReview, ...MOCK_REVIEWS];
      return { data: { id: newReview.id }, status: 201 };
    },
  },
  community: {
    getPosts: async (): Promise<MockApiResponse<CommunityPost[]>> => {
      await delay(800);
      return { data: MOCK_POSTS, status: 200 };
    },
    getPostDetail: async (postId: string): Promise<MockApiResponse<CommunityPost | null>> => {
      await delay(500);
      const post = MOCK_POSTS.find((p) => p.id === postId);
      return { data: post || null, status: post ? 200 : 404 };
    },
  },
  auth: {
    getSession: async (): Promise<SessionResponse> =>
      apiRequest<SessionResponse>("/api/v1/auth/session"),
    logout: async (): Promise<void> =>
      apiRequest<void>("/api/v1/auth/logout", { method: "POST", skipJson: true }),
  },
  users: {
    getMe: async (): Promise<UserMeResponse> =>
      apiRequest<UserMeResponse>("/api/v1/users/me"),
    updateMyProfile: async (payload: UpdateProfilePayload): Promise<UserMeResponse> =>
      apiRequest<UserMeResponse>("/api/v1/users/me/profile", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
  },
};
