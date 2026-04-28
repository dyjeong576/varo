# VARO ERD

## 1. 문서 목적
이 문서는 VARO 서비스 전체의 핵심 엔티티 관계와 데이터 흐름을 설명한다.  
컬럼 상세 정의는 [Data Model](./data-model.md)을 기준으로 본다.

## 2. 서비스 전체 ERD

```mermaid
erDiagram
    USERS ||--|| USER_PROFILES : has
    USERS ||--o{ SESSIONS : owns
    USERS ||--o{ REVIEW_JOBS : requests
    CLAIMS ||--o{ REVIEW_JOBS : starts
    REVIEW_JOBS ||--o{ SOURCES : collects
    REVIEW_JOBS ||--o{ EVIDENCE_SNIPPETS : generates
    SOURCES ||--o{ EVIDENCE_SNIPPETS : provides
    REVIEW_JOBS ||--o| REVIEW_RESULTS : may_produce
    REVIEW_JOBS ||--o{ EXTERNAL_REQUEST_LOGS : logs

    USERS ||--o{ COMMUNITY_POSTS : writes
    USERS ||--o{ COMMUNITY_COMMENTS : writes
    USERS ||--o{ COMMUNITY_REACTIONS : reacts
    COMMUNITY_POSTS ||--o{ COMMUNITY_COMMENTS : has
    COMMUNITY_POSTS ||--o{ COMMUNITY_REACTIONS : has
    COMMUNITY_COMMENTS ||--o{ COMMUNITY_REACTIONS : has
    REVIEW_JOBS ||--o{ COMMUNITY_POSTS : can_link

    USERS ||--o{ NOTIFICATIONS : receives
    NOTIFICATIONS ||--o{ NOTIFICATION_READS : tracks
    USERS ||--o{ NOTIFICATION_READS : reads

    USERS ||--o{ USER_HISTORY : owns
    REVIEW_JOBS ||--o{ USER_HISTORY : records

    CLAIMS ||--o{ POPULAR_TOPICS : aggregates

    USERS {
        string id
        string email
        string display_name
        string auth_provider
        timestamptz created_at
    }

    USER_PROFILES {
        string user_id
        string real_name
        string gender
        string age_range
        string country
        string city
        timestamptz updated_at
    }

    SESSIONS {
        string id
        string user_id
        string provider_subject
        timestamptz expires_at
        timestamptz created_at
    }

    CLAIMS {
        string id
        text raw_text
        text normalized_text
        timestamptz created_at
    }

    REVIEW_JOBS {
        string id
        string user_id
        string claim_id
        string status
        string current_stage
        int searched_source_count
        int processed_source_count
        timestamptz created_at
        timestamptz updated_at
    }

    SOURCES {
        string id
        string review_job_id
        string source_type
        string publisher_name
        timestamptz published_at
        text canonical_url
        string fetch_status
        boolean is_duplicate
    }

    EVIDENCE_SNIPPETS {
        string id
        string review_job_id
        string source_id
        text snippet_text
        string stance
    }

    REVIEW_RESULTS {
        string id
        string review_job_id
        string verdict
        text interpretation_summary
        text uncertainty_summary
        int source_count
        int result_version
    }

    EXTERNAL_REQUEST_LOGS {
        string id
        string review_job_id
        string provider
        string request_type
        string status
        int duration_ms
        string trace_id
    }

    COMMUNITY_POSTS {
        string id
        string author_user_id
        text title
        text body
        string linked_review_job_id
        timestamptz created_at
    }

    COMMUNITY_COMMENTS {
        string id
        string post_id
        string author_user_id
        text body
        timestamptz created_at
    }

    COMMUNITY_REACTIONS {
        string id
        string user_id
        string post_id
        string comment_id
        string reaction_type
        timestamptz created_at
    }

    NOTIFICATIONS {
        string id
        string user_id
        string notification_type
        string target_type
        string target_id
        timestamptz created_at
    }

    NOTIFICATION_READS {
        string notification_id
        string user_id
        timestamptz read_at
    }

    POPULAR_TOPICS {
        string id
        string claim_id
        text topic_text
        decimal ranking_score
        int review_count
        timestamptz snapshot_at
    }

    USER_HISTORY {
        string id
        string user_id
        string review_job_id
        string entry_type
        timestamptz created_at
    }
```

## 3. 관계 요약

### 3.1 계정 축
- `users 1 : 1 user_profiles`
- `users 1 : N sessions`
- `users 1 : N review_jobs`
- `users 1 : N notifications`
- `users 1 : N user_history`

### 3.2 review 축
- `claims 1 : N review_jobs`
- `review_jobs 1 : N sources`
- `review_jobs 1 : N evidence_snippets`
- `sources 1 : N evidence_snippets`
- `review_jobs 1 : 0..1 review_results`
- `review_jobs 1 : N external_request_logs`

### 3.3 community 축
- `users 1 : N community_posts`
- `users 1 : N community_comments`
- `users 1 : N community_reactions`
- `community_posts 1 : N community_comments`
- `community_posts 1 : N community_reactions`
- `community_comments 1 : N community_reactions`

### 3.4 notification / history / ranking 축
- `notifications 1 : N notification_reads`
- `review_jobs 1 : N user_history`
- `claims 1 : N popular_topics`

## 4. 서비스 데이터 흐름
1. 사용자가 로그인하면 `users`, `user_profiles`, `sessions`가 서비스 계정 축을 구성한다.
2. 사용자가 질문을 제출하면 `claims`와 `review_jobs`가 생성된다.
3. 분석 과정에서 `search_route=korean_news`이면 Naver provider가 먼저 호출되고, Naver 후보가 부족할 때만 Tavily fallback provider가 호출된다.
4. relevance/evidence signal 통합 분류 이후 `sources`와 `handoff_payload.evidenceSignals[]`가 저장된다. 현재 preview 생성 경로에서는 본문 추출을 호출하지 않으므로 `evidence_snippets`는 비어 있을 수 있다.
5. 현재 프론트는 `handoff_ready` 상태의 review preview detail과 `rule_based_preview` 파생 결과를 우선 소비한다.
6. preview가 준비되면 `user_history`와 `notifications`가 갱신된다. `review_results` 저장은 final interpretation 단계 확장용이다.
7. review 결과는 `popular_topics` 또는 `user_history` 기반 read model 집계의 입력이 될 수 있다.
8. 사용자는 `community_posts`, `community_comments`, `community_reactions`로 서비스 참여 활동을 남긴다.

## 5. 현재 프론트 보조 저장

현재 브라우저 프론트는 서버 ERD 외에 아래 local persisted state를 함께 사용한다.

- `varo.review-tasks`
  - pending draft
  - reviewId 승격
  - preview 상태 / stage
  - 오류 메시지
  - 로컬 완료 알림 생성 여부
- 알림 목록과 읽음 상태는 서버 `notifications`, `notification_reads`를 기준으로 관리한다.

클라이언트 보조 저장은 `varo.review-tasks`에 한정되고, 알림 자체는 서버 ERD가 source of truth다.

## 6. 설계 포인트
- `users`를 중심으로 review, history, notifications, community가 연결된다.
- review 도메인은 여전히 VARO의 핵심 차별화 축이며, source와 evidence를 별도 엔티티로 유지한다.
- review source audit은 `search_route`, `source_provider`, `retrieval_bucket`을 함께 추적한다. 현재 preview 경로는 `naver-search`, 필요 시 `tavily-search`, `openai` 호출을 사용하며 `tavily-extract`와 `source-fetch`는 후속 extraction 확장용이다.
- `notifications`, `popular_topics`, `user_history`는 서비스 경험을 연결하는 보조 도메인이다.
- community는 별도 도메인이지만 실명 기반 사용자 모델과 연결된다.
