# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 1. Commands

```bash
npm run dev       # Start dev server with Turbopack (http://localhost:3000)
npm run build     # Production build
npm run lint      # ESLint
```

No test framework is configured.

---

## 2. Environment Variables

Create `.env.local` with the following (all required for Firebase to work):
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
NEXT_PUBLIC_APP_URL=http://localhost:3000   # used to build invite links

---

## 3. 디렉터리 구조 및 파일 역할
jeongsanheabar/
│
├── src/
│   ├── app/
│   │   ├── page.tsx              # 랜딩 페이지 (사용법 안내 모달 포함)
│   │   ├── groups/
│   │   │   ├── create/page.tsx   # 그룹 생성 폼
│   │   │   └── [id]/page.tsx     # 그룹 대시보드 — 지출 입력, 정산 탭, 모든 모달
│   │   └── invite/
│   │       └── [code]/page.tsx   # 초대 링크로 그룹 참여
│   │
│   └── lib/
│       ├── firebase.ts           # db(Firestore), auth(현재 미사용) export
│       ├── invite.ts             # generateInviteCode, createInviteLink,
│       │                         # isValidInviteCode, addMemberToGroup
│       ├── settlement.ts         # ★ calculateSettlement canonical 버전, Settlement 타입
│       ├── session.ts            # getMemberSession, saveMemberSession, clearMemberSession,
│       │                         # MemberSession 타입, SESSION_KEY 상수
│       ├── excel.ts              # downloadGroupAsExcel (5시트 워크북)
│       │                         # calculateSettlement, Settlement은 settlement.ts에서 re-export
│       └── utils.ts              # cn() Tailwind 클래스 머저

---

## 4. 핵심 아키텍처

### Tech Stack
- **Next.js 15** App Router, all pages are `'use client'` components
- **Firebase Firestore** — sole data store, real-time sync via `onSnapshot`
- **Tailwind CSS** with custom warm-palette utilities (see `globals.css`)
- **xlsx + file-saver** — client-side Excel export

### Route Map

| Route | Purpose |
|---|---|
| `/` | Landing page with usage guide modal |
| `/groups/create` | Create group form |
| `/groups/[id]` | Group dashboard — expense input, settlement tab, all modals |
| `/invite/[code]` | Join group via invite link |

### Firestore Data Model

Single collection `groups`. Each document:
```ts
{
  name: string
  description: string
  members: Member[]       // ordered array; id = array index
  expenses: Expense[]     // ordered array; id = array index
  inviteCode: string      // 8-char A-Z0-9
  inviteLink: string      // full URL to /invite/[code]
  allowInvites: boolean
  maxMembers: number      // default 20
  createdAt: Timestamp
  lastUpdated: Timestamp
}

Member { id: number; name: string; phone: string; account: string; color: string }
Expense { id: number; title: string; amount: number; payerId: number; participants: number[]; date: string; perPersonAmount: number }
```

---

## 5. 세션 관리 (인증 없음)

Firebase Auth 로그인 없음. "내가 누구인지"는 `localStorage`의 `groupMemberships` 키에 저장:

```ts
{ [groupId: string]: { groupId, memberId, memberName, timestamp } }
```

세션 헬퍼 함수(`getMemberSession`, `saveMemberSession`, `clearMemberSession`)는 현재 `groups/[id]/page.tsx`와 `invite/[code]/page.tsx` 양쪽에 **동일하게 복붙**되어 있음.

> ⚠️ **기술부채**: 세션 헬퍼를 `src/lib/session.ts`로 분리하여 양쪽에서 import하도록 개선 예정

---

## 6. 알려진 기술부채 (우선순위 순)

| 우선순위 | 항목 | 현재 상태 | 목표 |
|------|------|------|------|
| 🟡 Medium | `react-hook-form` / `zod` 미사용 | 설치만 되어 있음 | 폼 검증 적용 시 활용 |

---

## 7. 스타일 컨벤션

- Global background: warm peach-salmon gradient, `body`에 `globals.css`로 적용
- Custom Tailwind utilities: `text-warm-dark`, `text-warm-gray`, `text-soft-brown`, `glass-effect`, `pink-gradient`
- Primary interactive color: `from-pink-400 to-pink-500`
- 새 색상·간격 추가 시 `globals.css`에 토큰으로 먼저 추가 후 참조

---

## 8. 멤버 ID 안정성 주의

Member / Expense의 `id` 필드는 **순차 배열 인덱스이며 안정적 UUID가 아님**.  
멤버 삭제 시 `proceedWithMemberDeletion`이 전체 멤버를 0부터 재인덱싱하고 모든 Expense의 `payerId` / `participants`를 재매핑함.  
멤버 삭제에 관련된 기능은 반드시 이 전체 재인덱싱 로직을 거쳐야 함.

---

## 9. 개발 규칙

### 9-A. 작업 완료 후 필수 절차

1. 작업 완료 후 **항상**: 이 파일(CLAUDE.md) 10번 이력 테이블에 `날짜 | 작업 내용 | 이슈/특이사항` 한 행 추가
2. CLAUDE.md 업데이트 → `git add` → `git commit` → `git push origin main`
3. 파일·컴포넌트 추가/삭제/이름 변경 시 **3번(디렉터리 구조) 해당 항목을 같은 커밋 안에서 함께 수정**
4. 기술부채 해소 시 **6번(기술부채 테이블)에서 해당 항목 제거**

### 9-B. 코드 작성 원칙

1. **중복 금지**: 함수·로직을 두 곳 이상에 복붙하지 않는다. 반드시 `lib/`으로 분리 후 import한다
2. **settlement 함수**: `src/lib/excel.ts` 버전이 canonical. 수정 시 이 파일만 수정
3. **세션 헬퍼**: 신규 작성 코드에서는 `src/lib/session.ts` 완성 후 해당 파일만 import
4. **TypeScript strict 준수**: 작업 후 타입 오류·import 누락·미사용 변수 없는지 확인 후 커밋

### 9-C. 토큰 효율·품질 지침

- **읽기 최소화**: 작업 전 필요한 파일만 선택적으로 읽는다. 관련 없는 파일은 열지 않는다
- **하드코딩 금지**: 색상·간격·문자열은 `globals.css` 커스텀 유틸리티로 관리
- **추상화 기준**: 동일 패턴이 3곳 이상 반복될 때만 공통 함수/컴포넌트로 추출. 과도한 선행 추상화 금지
- **버그 방지**: 동작하는 코드를 불필요하게 리팩터링하지 않는다. 수정 범위를 최소화한다

---

## 10. 개발 이력

| 날짜 | 작업 내용 | 이슈/특이사항 |
|------|------|------|
| 2025-xx-xx | 초기 프로젝트 생성 (Next.js 15 + Firebase) | — |
| 2026-05-09 | CLAUDE.md 전면 재작성 (포트폴리오 MD 구조 반영) | 기술부채 명시, 개발 규칙·이력 테이블 추가 |
| 2026-05-09 | 기술부채 해소: `lib/settlement.ts`, `lib/session.ts` 분리 | `calculateSettlement` 및 세션 헬퍼 중복 제거 완료; `clearMemberSession`에서 React 상태 의존성 제거하여 순수 lib 함수화 |
| 2026-05-10 | feat: 내 정산 요약 카드 및 항목 하이라이트 추가 | 정산 탭 상단에 로그인 사용자 기준 보낼 돈/받을 돈 요약 카드; 전체 목록에서 나 포함 항목 핑크 하이라이트 + 뱃지 |

---

## 11. 현재 상태

- **배포**: https://jeongsanheabar.vercel.app (정상 운영 중)
- **배포 방식**: Vercel — main 브랜치 push → 자동 배포
- **인증**: 없음 (localStorage 세션)
- **알려진 이슈**: `calculateSettlement` 및 세션 헬퍼 중복 (6번 기술부채 참고)
