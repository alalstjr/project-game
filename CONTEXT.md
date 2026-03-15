# Project Game - CONTEXT

## 프로젝트 개요
포켓몬 1세대(151마리) 기반 가챠 카드 수집 웹 게임. 뽑기/수집/강화/전투 기능.

---

## 2026-03-12 | 프로젝트 초기 구축 (풀스택)

### 개요
빈 디렉토리에서 포켓몬 가챠 카드 수집 게임 전체를 구축. React+Vite 프론트엔드, Express+SQLite 백엔드 모노레포 구성.

### 기술 스택
- **Frontend:** React 18 + Vite + Framer Motion + Axios
- **Backend:** Express + better-sqlite3 + JWT(jsonwebtoken) + bcryptjs
- **Monorepo:** npm workspaces (`shared`, `server`, `client`)
- **실행:** `npm run dev` → concurrently로 서버(3001)+클라이언트(5173) 동시 기동

### 생성된 파일

#### 루트
- `package.json` — 워크스페이스 설정, dev/build/start 스크립트
- `tsconfig.base.json` — 공유 TypeScript 설정 (ES2022, bundler)
- `.gitignore` — node_modules, dist, *.db, .env
- `.env` — JWT_SECRET, PORT=3001

#### shared/
- `src/types.ts` — Grade, Pokemon, UserCard, User, PullResult, BattleRecord, Opponent 타입
- `src/constants.ts` — 등급확률, 스탯범위, 레벨업 공식, 게임 상수
- 주의: 서버에서 shared를 직접 import하면 tsx에서 ERR_MODULE_NOT_FOUND 발생 → **서버는 `server/src/constants.ts`에 상수를 복사해서 사용**

#### server/src/
- `index.ts` — Express 앱 부트스트랩, 라우트 등록, PokeAPI 시딩
- `database.ts` — SQLite 초기화 (users, pokemon, user_cards, pull_history, battles 테이블), PokeAPI에서 151마리 최초 시딩
- `constants.ts` — 서버용 게임 상수 복사본 (shared 직접 임포트 불가 우회)
- `middleware/auth.ts` — JWT 검증 미들웨어 (AuthRequest 확장)
- `utils/jwt.ts` — JWT sign/verify 헬퍼
- `utils/password.ts` — bcrypt hash/compare
- `routes/auth.ts` — POST /register, /login
- `routes/gacha.ts` — GET /status, POST /pull, POST /pull/multi
- `routes/collection.ts` — GET /cards, /pokedex, /cards/:id, POST /cards/:id/enhance
- `routes/battle.ts` — GET /opponents, /history, POST /challenge
- `routes/user.ts` — GET /me
- `services/ticketService.ts` — 뽑기권 재생성(10분/1개), 차감, 추가
- `services/gachaService.ts` — 등급 롤, 스탯 생성, 중복 처리/레벨업
- `services/battleService.ts` — 상대 목록, 전투 실행(스코어 계산), 전투 기록

#### client/src/
- `main.tsx` — React 엔트리
- `App.tsx` — BrowserRouter + AuthProvider + 라우팅 (/, /collection, /card/:id, /battle, /login, /register)
- `api/client.ts` — Axios 인스턴스 (JWT 인터셉터, 401 자동 로그아웃)
- `contexts/AuthContext.tsx` — 로그인/회원가입/로그아웃/티켓 업데이트
- `components/layout/Header.tsx` — 고정 헤더 (네비게이션, 티켓 카운터+타이머, 로그아웃)
- `components/card/PokemonCard.tsx` — 핵심 카드 컴포넌트 (3D 틸트, 홀로그램 오버레이, 등급별 스타일링, 스파클 효과)
- `pages/LoginPage.tsx` — 로그인 폼
- `pages/RegisterPage.tsx` — 회원가입 폼
- `pages/GachaPage.tsx` — 가챠 메인 (드래그 모션 뽑기, 1연/10연, 파티클+화면플래시 연출, A등급 이상 화려한 효과)
- `pages/MyPage.tsx` — 컬렉션 (포켓덱스 151그리드 - 미수집 실루엣, 카드 목록 뷰)
- `pages/CardDetailPage.tsx` — 카드 상세 (능력치바, 강화 시스템)
- `pages/BattlePage.tsx` — 전투 (상대 목록, 카드 선택, VS 애니메이션, 승패 연출, 전투 기록)
- `styles/global.css` — 다크 테마, 등급별 색상 변수, 공통 스타일
- `styles/animations.css` — 카드 리빌, 파티클, 화면 플래시, 그레이드 글로우, 배틀 키프레임
- `styles/hologram.css` — S등급 이상 홀로그램 오버레이, 레인보우 그라디언트, 쉬머

### 핵심 포인트

1. **등급 확률:** E(35%) D(25%) C(18%) B(12%) A(6%) S(2.5%) SS(1%) SSS(0.5%)
2. **스탯 범위:** S등급부터 큰 점프 (A: 70-90 → S: 130-160 → SSS: 250-300)
3. **강화 시스템:** 같은 포켓몬+같은 등급의 중복 카드로 레벨업. DUPES_TO_NEXT_LEVEL = [1,1,2,2,3,3,4,5,7,10]. 레벨 배율 = 1 + (level-1)*0.05
4. **전투 공식:** score = ATK*1.2 + DEF*0.8 + HP*1.0 + random(0,50). 높은 점수 승리, 동점시 수비측 승리
5. **뽑기권:** 가입시 10개, 10분마다 1개 자동 생성 (최대 99개). 전투 조건: 상대 5개 이상
6. **DB 유니크 제약:** user_cards는 (user_id, pokemon_id, grade) 유니크 — 같은 포켓몬을 다른 등급으로 보유 가능
7. **PokeAPI 시딩:** 서버 최초 부트시 151마리 fetch → pokemon 테이블 캐싱. 이후 로컬 DB만 사용
8. **shared 모듈 이슈:** tsx(dev mode)에서 npm workspace의 shared 패키지를 직접 import하면 모듈 해석 실패 → 서버에 constants.ts 복사본 사용
9. **Vite Proxy:** 클라이언트 5173 → 서버 3001로 `/api` 프록시 설정
10. **카드 효과:** S등급 이상 = 홀로그램 shimmer + mouse 기반 각도 변화 + drop-shadow glow. SSS = 추가 sparkle 파티클. 모든 카드 = perspective 3D tilt on hover

---

## 2026-03-12 | 배틀 시스템 개선 (테스트 대전 + 등급별 이펙트 + 안내 UX)

### 개요
배틀 화면에서 (1) 동작하지 않을 때 원인 안내 메시지 부재 해결, (2) NPC 테스트 대전 모드 추가, (3) 등급별 전투 이펙트 차등 시스템 구현.

### 변경된 파일

#### server/src/index.ts
- `POST /api/admin/tickets` 관리자 엔드포인트 추가 (개발용 뽑기권 직접 지급)

#### server/src/services/battleService.ts
- `executeTestBattle()` 함수 추가 — 랜덤 등급 NPC 트레이너 생성, 전투 계산만 수행 (뽑기권 변동 없음, 기록 저장 안 함)
- NPC 카드는 랜덤 포켓몬 + 랜덤 등급 (가중치 적용) + 랜덤 스탯으로 매번 새로 생성

#### server/src/routes/battle.ts
- `POST /battle/test-challenge` 라우트 추가 — executeTestBattle 호출, 뽑기권 변동 없는 테스트 대전

#### client/src/pages/BattlePage.tsx (대규모 개편)
- **배틀 불가 안내 메시지:** 카드 없음 / 뽑기권 부족 / 둘 다 없음 상황별 안내 표시, 도전 버튼에도 비활성 사유 표시 ("카드 없음", "뽑기권 부족")
- **테스트 대전 UI:** 점선 테두리 섹션으로 NPC 연습 대전 버튼 추가, 무한 도전 가능
- **등급별 전투 이펙트 시스템:** `getBattleEffects()` 함수로 양쪽 카드 중 최고 등급 기준 5단계 이펙트:
  - **E~B (tier 0):** 기본 어둠 배경, 파티클 12개, 흰색 플래시, 스파크 16개
  - **A (tier 1):** 붉은 기운 배경, 파티클 20개, 붉은 플래시, 스파크 24개, 카드 오라 발광
  - **S (tier 2):** 금빛 배경, 파티클 30개+글로우, 황금 플래시, 에너지파 링 3겹, 불꽃 파티클 8개, VS 금색
  - **SS (tier 3):** 오렌지 화염 배경, 파티클 40개, 오렌지 폭발, 스피드라인 16줄, 불꽃 14개, 오라 맥동, 강한 흔들림
  - **SSS (tier 4):** 보라 우주 배경, 파티클 50개+레인보우, 다색 플래시, 맥동 링 3겹, 불꽃 22개, VS 글로우 애니메이션
- 결과 화면에 테스트 대전 표시 ("테스트 대전 — 뽑기권 변동 없음"), A+ 대전 시 등급 표시
- `runBattleAnimation()` 공통 함수로 일반/테스트 대전 애니메이션 로직 통합

#### client/src/styles/animations.css
- `@keyframes battleShake` 추가 (충돌 시 화면 흔들림)
- `@keyframes auraPulse` 추가 (SS+ 카드 오라 맥동)

### 핵심 포인트
1. **테스트 대전은 완전 독립:** DB 기록 없음, 뽑기권 변동 없음, 횟수 제한 없음 — 전투 연출 체험 전용
2. **이펙트 설계:** `getBattleEffects()` 함수가 tier(0~4)별로 모든 이펙트 파라미터(배경색, 파티클수, 스파크수, 글로우 강도 등)를 계산 → 컴포넌트는 fx 객체만 참조
3. **NPC 등급 가중치:** E~B 각 20%/15%, A 10%, S 8%, SS 5%, SSS 2% — 다양한 등급 상대와 싸울 수 있도록
4. **화면 흔들림 강도:** tier에 비례하여 duration 짧아지고 반복 횟수 증가 (고등급일수록 격렬)
5. **관리자 API:** `POST /api/admin/tickets` — 인증 없이 username/tickets로 직접 지급 (개발 전용, 프로덕션에서는 제거 필요)

---

## 2026-03-12 | 전투 규칙 개편 + 랭킹 시스템 + 포켓몬 고정등급 + 가챠 리뉴얼

### 개요
전투 뽑기권 조건 강화, 랭킹 점수 시스템 도입, 포켓몬별 고정 등급 매핑, 가챠 UI를 카드팩 뜯기 방식으로 전면 교체.

### 변경된 파일

#### server/src/constants.ts
- `BATTLE_MIN_TICKETS` 제거 → `CHALLENGER_MIN_TICKETS = 10`, `DEFENDER_MIN_TICKETS = 5` 분리
- `RANKING_WIN_POINTS = 10` 추가
- `INITIAL_FREE_PULLS = 10 → 1000` (신규 가입자 뽑기권 1000개)

#### server/src/database.ts
- `users` 테이블에 `ranking_score INTEGER DEFAULT 0` 컬럼 추가
- `pull_tickets DEFAULT 10 → 1000` 변경
- 기존 DB 호환 마이그레이션: `ALTER TABLE users ADD COLUMN ranking_score`

#### server/src/pokemonGrades.ts (신규)
- **151마리 포켓몬 → 고정 등급 매핑** (희귀도/강력함 기준)
  - SSS(1): 뮤츠
  - SS(4): 프리져, 썬더, 파이어, 뮤
  - S(8): 윈디, 후딘, 팬텀, 갸라도스, 라프라스, 프테라, 잠만보, 망나뇽
  - A(20): 리자몽, 거북왕, 이상해꽃, 괴력몬, 나인테일 등
  - B(30): 라이츄, 스라크, 에레브 등
  - C(25): 버터플, 닥트리오, 메타몽 등
  - D(30): 피카츄, 파이리, 꼬부기, 이브이 등
  - E(33): 꼬렛, 잉어킹, 구구, 주뱃 등
- `getPokemonIdsByGrade(grade)` 헬퍼 함수

#### server/src/services/gachaService.ts
- 뽑기 로직 변경: **등급 확률 롤 → 해당 등급 포켓몬 풀에서 랜덤 선택**
- 기존: 랜덤 포켓몬 + 랜덤 등급 → 변경: 등급 먼저 결정 → 해당 등급 포켓몬 중 선택
- 같은 포켓몬은 항상 같은 등급 (꼬렛=E, 뮤츠=SSS)

#### server/src/services/battleService.ts
- 도전자 뽑기권 검증: `CHALLENGER_MIN_TICKETS(10)` 이상 필요
- 방어자 필터링: `DEFENDER_MIN_TICKETS(5)` 이상
- **랭킹 점수 시스템:** 승리 시 승자 `ranking_score += 10` (도전 승리 & 방어 성공 모두)
- `getRanking()` 함수 추가 — Top 10 랭킹 조회

#### server/src/routes/battle.ts
- `GET /battle/ranking` 엔드포인트 추가

#### server/src/routes/auth.ts
- 회원가입 응답 pullTickets: 10 → 1000

#### client/src/App.tsx
- `RankingSidebar` 컴포넌트 추가, 메인 컨텐츠 영역 `marginLeft: 184px`

#### client/src/components/layout/RankingSidebar.tsx (신규)
- 왼쪽 고정 사이드바, Top 3 메달(🥇🥈🥉) 표시
- 30초마다 자동 갱신, 내가 3위 밖이면 구분선 아래에 내 순위 표시
- 본인 항목 보라색 하이라이트

#### client/src/pages/GachaPage.tsx (전면 리뉴얼)
- **카드팩 뜯기 모션:** 봉지 디자인(포켓볼 로고+패턴), 드래그로 윗부분 찢기, 빛 새어나오는 효과, 뜯긴 후 날아감
- **결과 모달:** 전체화면 모달, 카드 뒷면→터치→앞면 뒤집기 애니메이션
- **10연 뽑기:** 카드 하나씩 터치하여 공개 또는 "전체 공개" 버튼
- **S등급 이상 빛 효과:** 맥동 글로우 + 빛 줄기(rays) + 반짝 파티클
  - S: 금색 글로우, 빛줄기 6개, 파티클 8개
  - SS: 오렌지 확대, 빛줄기 8개, 파티클 14개
  - SSS: 보라 대형, 빛줄기 12개, 파티클 20개

#### client/src/pages/BattlePage.tsx
- 도전 조건 뽑기권 1개 → 10개로 변경
- 안내 메시지: "뽑기권 10개 이상 필요" 표시
- 결과 메시지: "뽑기권 +1, 랭킹 +10점!" / "상대 방어 성공, 상대 랭킹 +10점"
- 상대 목록에 랭킹 점수 표시

### 핵심 포인트
1. **전투 경제:** 도전자 10개 이상, 방어자 5개 이상 필요. 승리 시 뽑기권 1개 이동 + 승자 랭킹 10점
2. **포켓몬 고정 등급:** `pokemonGrades.ts`에서 151마리 전체 매핑. 가챠 시 등급 확률은 기존과 동일하나, 나오는 포켓몬이 등급에 맞게 고정
3. **가챠 UX 흐름:** 카드팩 드래그 → 봉지 뜯기 → 모달 → 카드 뒤집기 → 결과 확인
4. **랭킹 사이드바:** 모든 페이지에서 항상 왼쪽에 표시, Top 3까지 + 내 순위

---

## 2026-03-13 | 배틀 UI 현대화 + 포켓몬 농장 시스템 + 가챠 확률/강화 조정

### 개요
배틀 아레나 UI를 현대적 다크 게이밍 스타일로 전면 교체, 뽑기권 자동 재생 방식을 방치형 포켓몬 농장 시스템으로 전환, 가챠 등급 확률 및 강화 배율 조정.

### 변경된 파일

#### server/src/constants.ts
- **등급 확률 하향 조정:** E(40%) D(30%) C(15%) B(8%) A(3.5%) S(0.8%) SS(0.5%) SSS(0.2%)
- **강화 배율 상향:** `LEVEL_MULTIPLIER` 레벨당 5% → **15%** (Lv10 = 2.35x)
- `INITIAL_FREE_PULLS = 1000 → 500`
- `MAX_TICKETS = 99 → 9999`
- 농장 상수 추가: `FARM_MAX_SLOTS = 5`, `FARM_MAX_PER_SLOT = 10`
- `FARM_MINUTES_PER_TICKET`: E=120분, D=90분, C=60분, B=45분, A=30분, S=20분, SS=15분, SSS=10분

#### server/src/database.ts
- `pull_tickets DEFAULT 500`으로 변경
- `pokemon_farm` 테이블 추가 (user_id, slot, card_id, deployed_at)

#### server/src/routes/auth.ts
- 가입 응답 `pullTickets: 500`

#### server/src/services/farmService.ts (신규)
- `calcAccumulated()` — 서버 타임스탬프 기반 생산량 계산 (anti-cheat)
- `getFarmStatus()` — 5슬롯 전체 상태 조회
- `deployToFarm()` — 포켓몬 배치 (기존 슬롯 자동 수거)
- `collectFromSlot()` / `collectAll()` — 뽑기권 수거 (분수 진행도 보존)
- `removeFromFarm()` — 포켓몬 회수

#### server/src/routes/farm.ts (신규)
- `GET /farm/status`, `POST /farm/deploy`, `POST /farm/collect`, `POST /farm/collect-all`, `POST /farm/remove`

#### server/src/routes/gacha.ts
- multi pull 상한 10 → 20 (20회 뽑기 버튼은 이후 제거됨)
- `regenerateTickets` 호출 제거, `getTickets` 직접 사용

#### client/src/pages/BattlePage.tsx (전면 리뉴얼)
- 대각선 분할 배경, 에너지 충돌, 앰비언트 파티클
- 라운드 인트로: 세로 레이아웃 "ROUND" + 큰 숫자
- 충돌: 회전 에너지 링, 24개 스파크 파티클, 화면 흔들림
- 라운드 결과: 승자 카드 확대+글로우, 패자 축소+페이드
- 최종 결과: 시네마틱 레터박스, "승리"/"패배" 한국어, 골드 시머 애니메이션

#### client/src/pages/FarmPage.tsx (신규)
- 픽셀 아트 스타일 농장 씬 (PX=4 베이스 유닛)
- PixelSun, PixelCloud, PixelTree 서브 컴포넌트
- 포켓몬 AI 이동: requestAnimationFrame 루프, idle/walking/interacting 상태, 15% 상호작용 확률
- 슬롯 관리 패널: 배치/수거/회수 UI

#### client/src/pages/MyPage.tsx
- **강화 가능 표시:** `canEnhance()` 함수로 중복 카드 수 >= 필요 수 판별, 카드 상단에 주황색 "강화 가능" 배지 (펄스 애니메이션)

#### client/src/pages/GachaPage.tsx
- `doPull(count: number)` 인터페이스로 변경 (1회/10회)
- 20회 뽑기 버튼 추가 후 제거 (결과 표시 문제로 rollback)

#### client/src/components/layout/Header.tsx
- `/farm` 네비게이션 추가
- 카운트다운 타이머 제거, 30초 폴링만 유지

#### client/src/styles/animations.css
- `@keyframes enhancePulse` 추가

### 핵심 포인트
1. **농장 = 뽑기권 유일 생산 수단:** 자동 재생 완전 제거, 포켓몬 배치 → 시간 경과 → 수동 수거 방식
2. **서버 권위적 계산:** 모든 생산량은 서버 타임스탬프 기반, 클라이언트는 수거 요청만 전송
3. **분수 진행도 보존:** 수거 시 `deployed_at`을 소비된 시간만큼 전진 (now로 리셋 아님)
4. **S등급 이상 확률 대폭 하향:** S(0.8%), SS(0.5%), SSS(0.2%) — 체감 희귀도 강화
5. **강화 배율 3배 상향:** 레벨당 15% → 저등급 카드도 강화 시 능력치 변화 체감 가능
6. **초기 뽑기권 500개:** 가입 시 지급량 절반으로 축소

---

## 2026-03-13 | 배틀 규칙 개선 + 뱃지 시스템 + 프로필 + 컬렉션 UX 개선

### 개요
배틀 하루 1회 제한/뽑기권 5장 회수, 가입 시 뽑기권 100개로 축소, 컬렉션 UX 개선(뒤로가기 탭 기억, 정렬 기능), 포켓몬 뱃지 수집 시스템 추가, 프로필 꾸미기 기능 및 랭킹 프로필 표시.

### 변경된 파일

#### server/src/constants.ts
- 뱃지 상수 추가: `BADGE_DROP_RATE = 0.03` (3% 확률)
- `BADGES` 배열 — 관동 체육관 뱃지 8종 정의 (한글명, 영어명, 관장, 타입, 색상)
  - 회색뱃지(웅/바위), 블루뱃지(이슬/물), 번개뱃지(마티스/전기), 무지개뱃지(민화/풀), 핑크뱃지(독수/독), 골드뱃지(초련/에스퍼), 진홍뱃지(강연/불꽃), 초록뱃지(비주기/땅)

#### server/src/database.ts
- `pull_tickets DEFAULT 500 → 100`
- `user_badges` 테이블 추가 (user_id, badge_id, obtained_at / UNIQUE(user_id, badge_id))
- `users` 테이블에 `profile_type TEXT`, `profile_value INTEGER` 컬럼 추가

#### server/src/services/battleService.ts
- **하루 1회 도전 제한:** `executeBattle()` 시작 시 `battles` 테이블에서 오늘 같은 상대 기록 확인, 있으면 거부
- **뽑기권 5장 이동:** 승자 +5, 패자 -5 (기존 1장 → 5장)
- `getOpponents()` — `battled_today` 서브쿼리 추가, `canChallenge`에 오늘 도전 여부 반영
- `getRanking()` — `profile_type`, `profile_value` 조회 추가, `profileImage` resolve (pokemon→sprite_url, badge→`badge:id`)

#### server/src/services/farmService.ts
- `tryDropBadge()` 함수 추가 — 3% 확률로 미보유 뱃지 중 랜덤 드랍
- `collectFromSlot()`, `collectAll()` 반환값에 `badgeDrop` 추가

#### server/src/routes/badge.ts (신규)
- `GET /badge/list` — 전체 뱃지 목록 + 보유 여부
- `POST /badge/profile` — 프로필 설정 (type: 'pokemon'|'badge'|null, value: id)
- `GET /badge/profile` — 프로필 조회

#### server/src/routes/user.ts
- `/me` 응답에 `profileType`, `profileValue`, `profileImage` 추가

#### server/src/index.ts
- `/api/badge` 라우트 등록

#### start.sh
- `npm run start` → `npm run dev -w server`로 변경 (빌드 없이 dev 모드로 실행)

#### client/src/components/BadgeIcon.tsx (신규)
- 뱃지 아이콘 컴포넌트 — 8종 뱃지별 CSS clipPath 도형 + 이모지 + 색상, 미보유 시 그레이스케일

#### client/src/components/ProfileAvatar.tsx (신규)
- 프로필 아바타 컴포넌트 — 뱃지/포켓몬/기본(첫글자) 3가지 모드 지원

#### client/src/pages/MyPage.tsx (대규모 개편)
- **뱃지 탭 추가:** 포켓덱스/내카드/뱃지 3탭 구성, 뱃지 카드 UI (아이콘+이름+관장+타입+보유상태)
- **프로필 설정 모달:** 아바타 클릭 → 보유 뱃지/포켓몬 중 선택, 초기화 기능
- **정렬 기능:** 내 카드 탭에 전투력순/등급순/레벨순/강화가능순 4종 정렬 버튼
- **탭 기억:** 카드 상세에서 돌아올 때 `?tab=mycards|pokedex|badges` 쿼리로 원래 탭 복원

#### client/src/pages/CardDetailPage.tsx
- `useSearchParams`로 `from` 쿼리 읽기, 돌아가기 시 원래 탭으로 이동

#### client/src/pages/FarmPage.tsx
- 뱃지 드랍 알림 UI 추가 — 수확 시 뱃지 획득 시 금색 모달 ("뱃지 획득! {name}")

#### client/src/pages/BattlePage.tsx
- `Opponent` 인터페이스에 `battledToday` 추가
- 도전 버튼 사유 표시: "오늘 도전 완료" 추가

#### client/src/components/layout/RankingSidebar.tsx
- `ProfileAvatar` 컴포넌트 import, 랭킹 항목에 프로필 아바타 표시
- `RankEntry`에 `profileImage` 필드 추가

#### client/src/components/layout/Header.tsx
- "포켓몬 가챠" 텍스트 로고 → `/pokemon-logo.png` 이미지로 교체

### 핵심 포인트
1. **배틀 하루 1회 제한:** challenger_id + defender_id + battle_date로 중복 체크, 상대 목록에도 canChallenge=false 반영
2. **뽑기권 5장 교환:** 승자 +5, 패자 -5 — 기존 1장에서 상향하여 배틀 리스크/리워드 강화
3. **뱃지 드랍:** 농장 수확 시 3% 확률, 미보유 뱃지 중 랜덤. 8종 모두 수집 후에는 드랍 안 됨
4. **프로필 시스템:** users.profile_type('pokemon'|'badge') + profile_value(id)로 저장. 랭킹과 컬렉션 양쪽에서 표시
5. **초기 뽑기권 100개:** 500 → 100으로 축소, 자원 희소성 강화

---

## 2026-03-13 | Fly.io 배포 + 모바일 최적화 + 한글화 + 기능 추가

### 개요
Fly.io에 프로덕션 배포 완료, 모바일 반응형 전면 적용, 포켓몬 이름 한글화, 일괄 강화/랭킹 페이지/배틀 보상 변경 등 추가 기능 구현.

### 변경된 파일

#### 배포 관련 (신규)
- `Dockerfile` — Multi-stage build (node:18-slim builder → production). shared/client/server 순차 빌드, 프로덕션 의존성만 설치
- `fly.toml` — App: `project-game-green-sunset-7150`, Region: sin(Singapore), Port: 8080, Volume mount: data→/data (SQLite 영속), auto_stop/start
- `.dockerignore` — node_modules, *.db, .env, dist, logs, .git 제외

#### server/src/index.ts
- 프로덕션 정적 파일 서빙 추가: `express.static(clientDist)` + SPA fallback (`*` → index.html)
- 서버 리슨 주소: `0.0.0.0` (컨테이너 배포 대응)

#### server/src/database.ts
- `DB_PATH` 환경변수 우선 사용 (`process.env.DB_PATH || 로컬경로`)

#### server/src/constants.ts
- `DEFENDER_MIN_TICKETS = 5 → 10` (도전자/방어자 모두 10개 필요)

#### server/src/services/battleService.ts
- **배틀 보상 변경:** 승자 +10, 패자 -10 뽑기권 (기존 ±5)

#### server/src/routes/collection.ts
- `POST /cards/enhance-all` 일괄 강화 API 추가 — 트랜잭션으로 모든 카드 연속 강화, 한 카드가 여러 레벨 올라갈 수 있으면 한번에 처리

#### client/src/constants/pokemonNames.ts (신규)
- 151마리 1세대 포켓몬 영어→한글 이름 매핑 (`POKEMON_KO` Record + `getKoreanName()` 헬퍼)

#### client/src/components/card/PokemonCard.tsx
- `getKoreanName()` 적용 — 카드 이름 표시 한글화
- `tiny` 사이즈 추가 (width:100, height:144) — 모바일 10연뽑용

#### client/src/components/card/CardPopover.tsx
- `getKoreanName()` 적용

#### client/src/pages/GachaPage.tsx
- **모바일 카드 플립 버그 수정:** 3D rotateY 플립 제거 → 조건부 렌더링(뒷면/앞면) + scale 애니메이션으로 교체 (모바일 Safari backfaceVisibility 미지원 대응)
- 10연뽑 모달: 전체공개 버튼 상단 배치, 카드 크기 모바일 축소(tiny), 스크롤 개선

#### client/src/pages/CardDetailPage.tsx, MyPage.tsx, BattlePage.tsx, FarmPage.tsx
- 모든 포켓몬 이름 표시에 `getKoreanName()` 적용
- `textTransform: 'capitalize'` 제거 (한글에 불필요)

#### client/src/pages/MyPage.tsx
- **일괄 강화 버튼** 추가 (내 카드 탭, 정렬 버튼 우측)
- 강화 가능한 카드 없으면 비활성화, 완료 시 카드 목록 새로고침

#### client/src/pages/RankingPage.tsx (신규)
- 모바일 전용 랭킹 페이지 — 메달/프로필아바타/점수/내 순위 표시

#### client/src/components/layout/Header.tsx
- 모바일 네비에 "랭킹" 탭 추가 (isMobile일 때만)

#### client/src/App.tsx
- `/ranking` 라우트 추가, RankingPage import

### 핵심 포인트
1. **배포 URL:** https://project-game-green-sunset-7150.fly.dev/
2. **Fly.io 무료 플랜:** shared-cpu-1x, 1GB RAM, 1GB volume, auto_stop으로 비용 없음
3. **SQLite 영속:** `/data` 볼륨 마운트로 재배포해도 데이터 유지
4. **PokeAPI 시딩:** 첫 부팅 시 151마리 fetch (~30초), 이후 DB 캐싱
5. **모바일 카드 리빌:** 3D flip 대신 조건부 렌더링 방식으로 전 브라우저 호환
6. **한글 이름:** 클라이언트 사이드 매핑 (`pokemonNames.ts`), 서버 DB는 영어 유지
7. **배틀 경제:** 도전자/방어자 모두 뽑기권 10개 필요, 승패 시 ±10개 이동

---

## 빌드 & 배포 가이드

### 로컬 개발
```bash
npm run dev          # 서버(3001) + 클라이언트(5173) 동시 실행
```

### 프로덕션 빌드
```bash
npm run build -w shared   # shared 타입/상수 빌드
npm run build -w client   # Vite 프로덕션 빌드
npm run build -w server   # TypeScript 컴파일
```

### Fly.io 배포
```bash
fly deploy               # Docker 이미지 빌드 + 배포 (자동)
fly logs                  # 서버 로그 확인
fly status                # 머신 상태 확인
fly ssh console           # 서버 SSH 접속
```

### Fly.io 앱 삭제
```bash
fly apps destroy project-game-green-sunset-7150   # 앱 + 머신 완전 삭제
# 또는
fly scale count 0         # 머신만 중지 (앱 유지)
fly volumes delete <vol_id>  # 볼륨 삭제 (데이터 영구 손실)
```

### Fly.io 계정
- 로그인: `fly auth login`
- 대시보드: https://fly.io/apps/project-game-green-sunset-7150
