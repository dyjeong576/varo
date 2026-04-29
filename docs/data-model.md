# VARO Data Model

## 1. 문서 목적
이 문서는 VARO 서비스 전체의 저장 모델을 정의한다.  
대상은 인증, 사용자, review, 커뮤니티, 인기, 알림, 히스토리, 공통 로그를 포함한 서비스 전반의 데이터 구조다.

## 2. 데이터 모델 원칙
- 서비스 전반은 하나의 사용자 계정 체계를 공유한다.
- review 도메인은 `claim`, `evidence`, `interpretation`, `uncertainty`를 분리 저장한다.
- source와 evidence snippet까지 추적 가능해야 한다.
- 커뮤니티와 알림은 사용자 행위와 review 결과를 연결하는 보조 도메인이다.
- 인기와 히스토리는 읽기 최적화된 모델을 포함할 수 있다.

## 3. 환경 기준
- `dev`, `prod`는 동일 스키마 구조를 사용한다.
- 실제 데이터 저장소는 환경별로 분리한다.
- 운영 데이터는 개발 환경에서 읽거나 쓰지 않는다.
- migration은 환경별로 독립 실행한다.

## 4. 도메인별 엔티티

### 4.1 Identity & Profile
- `users`
- `user_profiles`
- `sessions`

### 4.2 Review & Evidence
- `claims`
- `review_jobs`
- `sources`
- `evidence_snippets`
- `review_results`
- `external_request_logs`

### 4.3 Community
- `community_posts`
- `community_comments`
- `community_reactions`

### 4.4 Notifications
- `notifications`
- `notification_reads`

### 4.5 Popular / History
- `popular_topics`
- `user_history`

### 4.6 Client-side Persisted State
- `review_task_records`

## 5. 공통 상태값 / enum

### 5.1 review 상태값
- `queued`
- `searching`
- `extracting`
- `analyzing`
- `completed`
- `partial`
- `out_of_scope`
- `failed`

현재 query-processing preview 생성 경로에서 주로 쓰는 terminal 상태는 `partial`, `out_of_scope`, `failed`다. `queued`, `extracting`, `analyzing`, `completed`는 장기 pipeline 확장용 상태로 남아 있다.

### 5.2 source 타입
- `news`
- `official`
- `social`
- `analysis`
- `repost`
- `other`

### 5.3 source fetch 상태
- `pending`
- `fetched`
- `failed`
- `timeout`

### 5.4 evidence stance
- `support`
- `conflict`
- `context`
- `unknown`
- `neutral` (legacy/fallback)

### 5.5 verdict
- `Likely True`
- `Mixed Evidence`
- `Unclear`
- `Likely False`

### 5.6 notification 타입
- `review_completed`
- `community_comment`
- `community_reaction`

## 6. 핵심 테이블 정의

### 6.1 `users`
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid / text id | 사용자 식별자 |
| `email` | varchar(255) | 로그인 이메일 |
| `display_name` | varchar(255) | 서비스 표시 이름 |
| `auth_provider` | varchar(64) | 현재는 `google` |
| `created_at` | timestamptz | 생성 시각 |

### 6.2 `user_profiles`
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `user_id` | fk unique | `users.id` 참조 |
| `real_name` | varchar(255) | 공개 이름 |
| `gender` | varchar(32) | 공개 성별 |
| `age_range` | varchar(32) | 공개 나이대 |
| `country` | varchar(128) | 수정 가능 |
| `city` | varchar(128) | 수정 가능 |
| `updated_at` | timestamptz | 갱신 시각 |

### 6.3 `sessions`
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid / text id | 세션 식별자 |
| `user_id` | fk | `users.id` 참조 |
| `provider_subject` | varchar(255) | auth provider 사용자 식별값 |
| `expires_at` | timestamptz | 만료 시각 |
| `created_at` | timestamptz | 생성 시각 |

### 6.4 `claims`
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid / text id | claim 식별자 |
| `raw_text` | text | 사용자가 입력한 원문 |
| `normalized_text` | text | 정규화 텍스트 |
| `created_at` | timestamptz | 생성 시각 |

### 6.5 `review_jobs`
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid / text id | review 식별자 |
| `user_id` | fk | 요청 사용자 |
| `claim_id` | fk | `claims.id` 참조 |
| `status` | varchar(32) | pipeline 상태 |
| `current_stage` | varchar(32) | 현재 단계 |
| `searched_source_count` | integer | 검색된 source 수 |
| `processed_source_count` | integer | 처리 완료 source 수 |
| `retry_count` | integer | 재시도 횟수 |
| `last_error_code` | varchar(64) | 마지막 실패 코드 |
| `query_refinement` | jsonb nullable | claim understanding, search plan, provider route audit |
| `handoff_payload` | jsonb nullable | interpretation handoff 및 evidence signal trace |
| `created_at` | timestamptz | 생성 시각 |
| `updated_at` | timestamptz | 갱신 시각 |

`handoff_payload.evidenceSignals[]`에는 source별 `sourceId`, 선택적 `snippetId`, `stanceToClaim`, `temporalRole`, `updateType`, `currentAnswerImpact`, `reason`을 저장한다. 현재 preview 생성 경로는 본문 추출을 호출하지 않으므로 `snippetId`는 보통 `null`이다. 요약 문장은 저장하지 않으며, 생성 응답과 `/reviews/:reviewId` 조회 시 저장된 source와 evidence signal을 기반으로 `consensusLevel`, `sourceStances`, `analysisSummary`를 계산한다.

### 6.6 `sources`
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid / text id | source 식별자 |
| `review_job_id` | fk | `review_jobs.id` 참조 |
| `source_provider` | varchar(64) nullable | 수집 API/provider. `naver-search`, `tavily-search` 등 |
| `source_type` | varchar(32) | 출처 유형 |
| `publisher_name` | varchar(255) | 매체명 또는 기관명 |
| `published_at` | timestamptz nullable | 발행 시각 |
| `canonical_url` | text | 정규화 URL |
| `original_url` | text | 수집 당시 URL |
| `raw_title` | text | 원문 제목 |
| `normalized_hash` | varchar(128) | 중복 감지용 해시 |
| `fetch_status` | varchar(32) | fetch 상태. 현재 preview 생성 경로에서는 보통 `pending` |
| `content_text` | text nullable | 정제된 본문. 현재 preview 생성 경로에서는 보통 `null` |
| `is_duplicate` | boolean | 중복 여부 |
| `duplicate_group_key` | varchar(128) nullable | 중복 묶음 키 |
| `origin_query_ids` | jsonb nullable | source를 찾은 query id 목록과 query purpose 추적 정보 |
| `relevance_tier` | varchar(32) nullable | `primary / reference / discard` |
| `relevance_reason` | text nullable | relevance 판정 이유 |
| `retrieval_bucket` | varchar(32) nullable | 검색 route/provider와 함께 해석되는 수집 bucket |

`search_route`는 query refinement artifact에서, `source_provider`는 source row에서 직접 추적한다. **한국 정치·경제 뉴스**는 기본적으로 `naver-search` source를 기록하고, Naver 후보가 부족해 Tavily fallback이 실행된 경우 `tavily-search` source를 함께 기록한다. search planning artifact에는 사용자-facing `generated_queries`, claim 이해 기반 `normalized_claim`, `claim_type`, 목적별 `search_plan`을 함께 보존한다.

### 6.7 `evidence_snippets`
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid / text id | snippet 식별자 |
| `review_job_id` | fk | `review_jobs.id` 참조 |
| `source_id` | fk | `sources.id` 참조 |
| `snippet_text` | text | 근거 텍스트 |
| `stance` | varchar(32) | 근거 방향 |
| `start_offset` | integer nullable | 본문 내 시작 위치 |
| `end_offset` | integer nullable | 본문 내 종료 위치 |

`EvidenceSnippet.stance`는 API 호환과 빠른 UI 표시를 위한 값이다. signal classification 이후에는 `support`, `conflict`, `context`, `unknown` 값을 우선 사용할 수 있고, 기존 review에는 `neutral` 등 과거 값이 남을 수 있다. 현재 preview 생성 경로는 `evidence_snippets` row를 생성하지 않을 수 있으므로, 상세 판단 사유와 source stance는 `handoff_payload.evidenceSignals[]`에서 우선 추적한다.

### 6.8 `review_results`

현재 query-processing preview 경로는 `review_results` row를 저장하지 않고, `review_jobs.query_refinement`, `review_jobs.handoff_payload`, `sources`를 기반으로 `rule_based_preview` 결과를 생성 응답과 조회 응답에서 파생한다. 아래 테이블은 final interpretation 저장 단계 확장용 모델이다.
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid / text id | result 식별자 |
| `review_job_id` | fk unique | `review_jobs.id` 참조 |
| `verdict` | varchar(32) | verdict |
| `interpretation_summary` | text | 해석 요약 |
| `interpretation_reasoning` | jsonb | 해석 근거 리스트 |
| `uncertainty_summary` | text | 불확실성 요약 |
| `uncertainty_items` | jsonb | 불확실성 리스트 |
| `agreement_count` | integer | 일치 근거 수 |
| `conflict_count` | integer | 충돌 근거 수 |
| `source_count` | integer | 사용 source 수 |
| `result_version` | integer | 결과 버전 |

### 6.9 `external_request_logs`
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid / text id | 로그 식별자 |
| `review_job_id` | fk nullable | 관련 review |
| `provider` | varchar(64) | `naver-search`, `tavily-search`, `tavily-extract`, `source-fetch`, `openai` 등 |
| `request_type` | varchar(64) | 요청 종류 |
| `status` | varchar(32) | `success`, `timeout`, `error` |
| `status_code` | integer nullable | 외부 응답 코드 |
| `duration_ms` | integer | 소요 시간 |
| `trace_id` | varchar(128) | 추적 id |

### 6.10 `community_posts`
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid / text id | 게시글 식별자 |
| `author_user_id` | fk | 작성자 |
| `title` | text | 제목 |
| `body` | text | 본문 |
| `linked_review_job_id` | fk nullable | 관련 review |
| `created_at` | timestamptz | 생성 시각 |
| `updated_at` | timestamptz | 갱신 시각 |

### 6.11 `community_comments`
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid / text id | 댓글 식별자 |
| `post_id` | fk | `community_posts.id` 참조 |
| `author_user_id` | fk | 작성자 |
| `body` | text | 본문 |
| `created_at` | timestamptz | 생성 시각 |

### 6.13 `community_reactions`
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid / text id | 반응 식별자 |
| `user_id` | fk | 반응 사용자 |
| `post_id` | fk nullable | 게시글 반응 대상 |
| `comment_id` | fk nullable | 댓글 반응 대상 |
| `reaction_type` | varchar(32) | 반응 유형 |
| `created_at` | timestamptz | 생성 시각 |

### 6.14 `notifications`
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid / text id | 알림 식별자 |
| `user_id` | fk | 수신 사용자 |
| `notification_type` | varchar(64) | 알림 종류 |
| `title` | text | 알림 제목 |
| `body` | text | 알림 본문 |
| `target_type` | varchar(64) | 이동 대상 종류 |
| `target_id` | varchar(128) | 이동 대상 식별자 |
| `created_at` | timestamptz | 생성 시각 |

현재 프론트는 `notifications`, `notification_reads`, `user_notification_preferences`를 직접 소비한다.

### 6.15 `notification_reads`
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `notification_id` | fk | `notifications.id` 참조 |
| `user_id` | fk | 읽은 사용자 |
| `read_at` | timestamptz | 읽은 시각 |

### 6.16 `user_notification_preferences`
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `user_id` | fk unique | 사용자 |
| `review_completed` | boolean | review 완료 알림 수신 여부 |
| `community_comment` | boolean | 댓글 알림 수신 여부 |
| `community_like` | boolean | 좋아요 알림 수신 여부 |
| `updated_at` | timestamptz | 마지막 수정 시각 |

### 6.17 `popular_topics`
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid / text id | planned snapshot 식별자 |
| `claim_id` | fk nullable | 대표 claim |
| `topic_text` | text | 인기 주제 텍스트 |
| `ranking_score` | numeric | 집계 점수 |
| `review_count` | integer | 관련 review 수 |
| `snapshot_at` | timestamptz | 집계 시각 |

### 6.18 `user_history`
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid / text id | history 식별자 |
| `user_id` | fk | 사용자 |
| `review_job_id` | fk | 관련 review |
| `entry_type` | varchar(32) | `submitted`, `viewed`, `reopened` 등 |
| `created_at` | timestamptz | 기록 시각 |

### 6.19 `review_task_records` (client-side)
| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `draftId` | string | pending draft 식별자 |
| `claim` | string | 사용자가 입력한 claim |
| `status` | string | `pending / submitting / succeeded / failed` |
| `previewStatus` | string | preview 응답 상태 |
| `currentStage` | string | 현재 단계 |
| `reviewId` | string nullable | 서버 review id |
| `reviewCreatedAt` | string nullable | 서버 review 생성 시각 |
| `selectedSourceCount` | number | 선별 근거 수 |
| `errorMessage` | string nullable | 사용자 노출 오류 |
| `notificationSent` | boolean | 최근 성공 전이 이후 알림 store refresh 시도 여부 |

저장 위치:

- browser localStorage `varo.review-tasks`

## 7. traceability 기준
- 어떤 review가 어떤 claim에서 시작했는지 연결되어야 한다.
- 어떤 result가 어떤 source와 evidence signal에 근거했는지 추적 가능해야 한다. snippet row가 있는 경우에는 snippet까지 연결한다.
- 어떤 알림이 어떤 review 또는 community 이벤트에서 생성되었는지 추적 가능해야 한다.
- history는 사용자와 review 연결을 보존해야 한다.

## 8. 데이터 모델 요약
- `users`는 서비스 전체의 계정 기준점이다.
- `review_jobs`는 review 도메인의 중심 엔티티이며, 현재 preview 결과 파생에 필요한 `query_refinement`와 `handoff_payload`를 보관한다.
- `community_posts`는 review 결과와 느슨하게 연결될 수 있다.
- `notifications`는 review와 community 도메인을 사용자 액션으로 연결한다.
- 현재 프론트는 `review_task_records`만 보조 상태 저장으로 사용한다.
- `popular_topics`와 `user_history`는 읽기 최적화 또는 분석 보조 모델로 운용할 수 있다.
