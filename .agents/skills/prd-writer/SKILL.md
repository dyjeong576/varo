---
name: prd-writer
description: Verifi 제품 요구사항 문서(PRD)를 작성하거나 갱신할 때 사용하는 스킬
---

# PRD Writer Skill

## 목적
이 스킬은 Verifi의 PRD를 작성하거나 수정할 때 사용합니다.

Verifi는 뉴스/사실성 주장에 대해
관련 출처를 수집하고,
증거를 시각화하며,
수집된 출처만을 기반으로 AI가 검토 결과를 제공하는 웹 서비스입니다.

이 스킬의 목표는 추상적인 기획 문서가 아니라
바로 디자인, 프론트엔드, 백엔드 작업으로 연결 가능한 PRD를 만드는 것입니다.

---

## 반드시 지켜야 할 원칙

### 1. Verifi를 절대적 진실 판정기로 쓰지 말 것
항상 아래 관점을 유지합니다.
- Verifi는 "판단 보조 도구"입니다.
- 결과는 "수집된 출처 기반의 해석"입니다.
- 불확실하면 불확실하다고 써야 합니다.

### 2. 아래 4가지를 분리해서 작성할 것
PRD 내에서 반드시 구분합니다.
- 사용자 주장(claim)
- 수집된 증거(evidence)
- AI 해석(interpretation)
- 남는 불확실성(uncertainty)

### 3. MVP 중심으로 작성할 것
- 당장 만들 수 있는 범위에 집중합니다.
- 미래 확장은 roadmap에만 적습니다.
- MVP 문서에 과도한 이상형 설계를 넣지 않습니다.

### 4. 실무 문서처럼 쓸 것
- 실행 가능한 수준으로 씁니다.
- vague한 문장을 줄입니다.
- 기능, 범위, 제외 범위, 리스크를 분명히 씁니다.

---

## PRD에 반드시 포함할 항목
PRD 작성 시 아래 항목을 빠뜨리지 않습니다.

1. Executive Summary
2. Product Vision
3. Problem Statement
4. Target Users
5. User Pain Points
6. Core Value Proposition
7. MVP Scope
8. Out of Scope
9. Core User Flows
10. Functional Requirements
11. Non-Functional Requirements
12. Information Architecture
13. Main Screens / Pages
14. Verdict Model
15. Evidence Visualization Concept
16. Trust & Safety Considerations
17. KPIs / Metrics
18. Risks / Open Questions
19. Recommended MVP Decisions
20. Future Roadmap

---

## Verifi 전용 PRD 작성 규칙

### verdict 모델
기본 verdict 상태는 아래를 우선 사용합니다.
- Likely True
- Mixed Evidence
- Unclear
- Likely False

### evidence 관련
반드시 아래를 다룹니다.
- 기사 수집 기준
- 출처 메타데이터
- 발행 시각
- 매체명
- URL
- 핵심 스니펫
- 출처 간 일치/충돌
- 공식 발표/재인용/해설 기사 구분 필요성

### source reliability
MVP에서 완벽한 점수화는 하지 않더라도,
최소한 아래 문제를 문서에 반영합니다.
- 동일 오보 재인용 가능성
- 속보 vs 정정 기사 차이
- 공식 출처와 해설 기사 차이
- 기사 수가 많다고 사실성이 높아지는 것은 아니라는 점

### UX 관점
PRD에서도 아래 UX 원칙을 반영합니다.
- 근거가 먼저 보일 것
- 결론은 과장되지 않을 것
- 출처를 사용자가 직접 확인 가능해야 할 것
- 상충 증거가 숨겨지지 않을 것

---

## 출력 스타일
PRD 산출물은 아래 조건을 만족해야 합니다.

- markdown 형식
- 섹션 구조 명확
- 문장 간결
- 실행 가능한 수준
- 필요 시 표 사용 가능
- 추정이 있으면 명시

---

## 출력 템플릿
기본적으로 아래 구조를 사용합니다.

# Verifi PRD

## 1. Executive Summary
## 2. Product Vision
## 3. Problem
## 4. Target Users
## 5. User Pain Points
## 6. Value Proposition
## 7. MVP Scope
## 8. Out of Scope
## 9. User Stories
## 10. Core Features
## 11. Functional Requirements
## 12. Non-Functional Requirements
## 13. UX Principles
## 14. Information Architecture
## 15. Screen-by-Screen Spec
## 16. Verdict / Evidence Model
## 17. Trust & Safety
## 18. Metrics
## 19. Risks / Open Questions
## 20. Recommended MVP Decisions
## 21. Roadmap

---

## 이 스킬이 잘 맞는 요청 예시
- Verifi PRD 작성해줘
- MVP 요구사항 문서 만들어줘
- prd.md 초안 작성해줘
- out-of-scope 포함해서 정리해줘
- 기획 문서를 개발 가능한 수준으로 정리해줘

---

## 이 스킬 사용 후 기대 결과
결과물은 아래 작업으로 곧바로 이어질 수 있어야 합니다.
- Stitch MCP용 디자인 프롬프트 작성
- 프론트 화면 설계
- 백엔드 API/도메인 설계
- QA 시나리오 작성