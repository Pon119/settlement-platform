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

Member { id: number; name: string; phone: string; account: string; color: string; isProxy?: boolean }
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

## 7. 스타일 컨벤션 (Y2K / Neo-Brutalism)

- **디자인 테마**: Y2K + 네오 브루탈리즘 — 픽셀 폰트, 두꺼운 검정 테두리, 오프셋 그림자, 크림 배경
- **전역 배경**: `var(--y2k-cream): #FAF9F0` + `.y2k-noise` (SVG fractalNoise 그레인)
- **폰트**: `font-pixel` = Galmuri11, `font-pixelSm` = Galmuri9 (한국어 픽셀 비트맵)
- **Y2K CSS 토큰** (`globals.css :root`):
  - 배경: `--y2k-cream`, `--y2k-card`, `--y2k-black`, `--y2k-muted`
  - 강조색: `--y2k-yellow: #FFE234`, `--y2k-pink: #FF3C8E`, `--y2k-lime: #AAFF00`, `--y2k-blue: #4FC3F7`
  - 파생: `--y2k-pink-l/b`, `--y2k-lime-l`, `--y2k-blue-l`, `--y2k-yellow2`
  - 텍스트: `--y2k-t1/t2/t3`
  - 특수: `--chrome` (메탈릭 그라디언트), `--win95` (Win95 타이틀바 파란 그라디언트)
- **카드**: `.y2k-card` (이중 테두리+오프셋 그림자), `.y2k-card-cream` (크림+대시), `.y2k-card-pink`
- **버튼**: `.y2k-btn` (노란 젤리+3D 그림자), `.y2k-btn-out` (흰색 아웃라인)
- **입력**: `.y2k-input` (크림 bg, 검정 border 2px, 오프셋 그림자, 포커스 시 핑크)
- **Win95 모달**: `.y2k-win95` + `.y2k-win95-bar` (파란 그라디언트 타이틀바) + `.y2k-win95-btn`
- **마키**: `.y2k-marquee` + `.y2k-marquee-inner` (검정 띠 + CSS animation, 텍스트 2배 복사로 seamless)
- **네온 글로우**: `.y2k-glow-pink`, `.y2k-glow-lime` (text-shadow)
- **아이콘 박스**: `.y2k-icon-box` (28×28 rounded-9px, 컬러 그라디언트 배경)
- **레거시 호환**: `.glass-effect`, `.pink-gradient`, `.text-warm-dark/gray/soft-brown` 유지
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
| 2026-05-10 | design: 전체 UI 리디자인 — 모던 정산 앱 스타일 적용 | globals.css에 CSS 커스텀 프로퍼티(`--color-primary: #D4537E` 등) 추가; 배경 경량화; 모든 페이지 카드 white+border+shadow로 교체; 탭 언더라인 스타일; 입력 필드 clean border; 버튼 `#D4537E` 계열 통일 |
| 2026-05-10 | design: Y2K 네오 브루탈리즘 전면 리디자인 | Galmuri 픽셀폰트, Win95 카드, 마키 띠, 네온글로우, 젤리 버튼 적용 — 전체 4개 페이지(landing/create/[id]/invite) + globals.css 완전 교체; lib/* 로직 무변경 |
| 2026-05-10 | feat: 임시 멤버 추가 기능 + 초대 시 프록시 클레임 플로우 구현 | isProxy?: boolean 필드 추가; 그룹 대시보드에서 "+ 참여자 추가" → Win95 모달로 isProxy:true 멤버 저장; 초대 페이지 방문 시 proxyMembers가 있으면 "목록에 계신가요?" 화면 → 선택 → 확인 모달 → isProxy:false로 업데이트 후 입장 |
| 2026-05-10 | fix: Next.js 15.4.5 → 16.2.6 업데이트 | 보안 취약점 패치; next.config.ts에서 Next.js 16에서 제거된 `eslint` 키 삭제 |
| 2026-05-10 | fix: groups/[id] 버그 3개 수정 | ① 멤버선택모달 inline style로 position:fixed 강제(.y2k-noise>* 규칙 충돌 해소) ② 엑셀·삭제 버튼을 지출탭 최하단으로 이동(폼→지출내역→안내→구분선→버튼) ③ font-pixel 전체 크기 2~3px 상향(9→11, 10→12, 11→13, 12→14, 14/13→16px) + globals.css font-smoothing 추가 |

---

## 11. 현재 상태

- **배포**: https://jeongsanheabar.vercel.app (정상 운영 중)
- **배포 방식**: Vercel — main 브랜치 push → 자동 배포
- **인증**: 없음 (localStorage 세션)
- **알려진 이슈**: 없음 (기술부채 해소 완료)
