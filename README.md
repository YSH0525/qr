# 호텔 편의점 - QR 주문 시스템

호텔 객실에 비치된 QR 코드를 스캔하여 편의점 상품을 주문하고, 프런트에서 실시간으로 관리하는 시스템입니다.

## 기술 스택

- **프레임워크**: Next.js 16 (App Router)
- **언어**: TypeScript
- **DB**: SQLite + Drizzle ORM
- **UI**: Tailwind CSS + shadcn/ui
- **상태관리**: Zustand
- **결제**: 카카오페이 API
- **실시간**: Server-Sent Events (SSE)

## GitHub에서 클론 후 실행 방법

### 1. 저장소 클론

```bash
git clone https://github.com/YSH0525/qr.git
cd qr
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경변수 설정

`.env.example`을 복사하여 `.env.local` 파일을 생성합니다.

```bash
cp .env.example .env.local
```

`.env.local`을 열어 본인 환경에 맞게 수정합니다:

```env
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_HOTEL_NAME=호텔 이름
DATABASE_URL=sqlite.db
ADMIN_PASSWORD=your-admin-password
ADMIN_JWT_SECRET=your-random-jwt-secret-at-least-32-chars
KAKAOPAY_SECRET_KEY=DEV_YOUR_SECRET_KEY
KAKAOPAY_CID=TC0ONETIME
```

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_BASE_URL` | 서버 주소 (배포시 실제 도메인으로 변경) |
| `NEXT_PUBLIC_HOTEL_NAME` | QR 안내문 등에 표시될 호텔명 |
| `DATABASE_URL` | SQLite DB 파일 경로 |
| `ADMIN_PASSWORD` | 관리자 로그인 비밀번호 |
| `ADMIN_JWT_SECRET` | JWT 토큰 서명용 시크릿 (32자 이상 랜덤 문자열) |
| `KAKAOPAY_SECRET_KEY` | 카카오페이 시크릿 키 (카카오 개발자 콘솔에서 발급) |
| `KAKAOPAY_CID` | 카카오페이 가맹점 코드 (`TC0ONETIME`은 테스트용) |

### 4. DB 초기화 (마이그레이션 + 시드 데이터)

```bash
npm run db:seed
```

이 명령어로 아래 데이터가 자동 생성됩니다:
- 15개 객실 (101~305호, 3개 층)
- 4개 카테고리 (음료, 과자/스낵, 라면/즉석식품, 생활용품)
- 32개 메뉴 아이템

### 5. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 접속합니다.

## 사용 방법

### 관리자 (프런트 데스크)

1. http://localhost:3000/login 에서 로그인 (비밀번호는 `.env.local`의 `ADMIN_PASSWORD`)
2. **대시보드** - 실시간 주문 접수/처리 (신규 → 접수 → 완료)
3. **주문 내역** - 전체 주문 목록 조회
4. **메뉴 관리** - 메뉴 추가/수정/품절 처리, 이미지 업로드
5. **객실 관리** - 객실 추가, QR 코드 생성/다운로드, 안내문 인쇄
6. **후불 정산** - 후불결제 선택한 객실의 미정산 금액 일괄 정산

### 게스트 (투숙객)

1. 객실에 비치된 QR 코드를 스마트폰 카메라로 스캔
2. 메뉴에서 원하는 상품 선택 후 장바구니 담기
3. 결제 방식 선택 (카카오페이 / 후불결제)
4. 주문 완료 후 객실로 배달

## 주요 페이지 구조

```
/ ........................... 메인 (관리자 로그인 링크)
/login ...................... 관리자 로그인
/dashboard .................. 실시간 주문 대시보드 (SSE)
/orders ..................... 주문 내역
/menu ....................... 메뉴 관리
/rooms ...................... 객실 관리 + QR 코드
/rooms/[roomId]/guide ....... 객실 안내문 (인쇄용)
/payments ................... 후불결제 정산
/room/[roomId] .............. 게스트 메뉴 페이지 (QR 스캔 진입점)
/room/[roomId]/cart ......... 게스트 장바구니 + 결제
/room/[roomId]/order/[id] ... 주문 완료 확인
```

## npm 스크립트

```bash
npm run dev          # 개발 서버 실행
npm run build        # 프로덕션 빌드
npm run start        # 프로덕션 서버 실행
npm run db:generate  # Drizzle 마이그레이션 생성
npm run db:seed      # DB 마이그레이션 + 시드 데이터
npm run db:studio    # Drizzle Studio (DB 브라우저)
```

## 카카오페이 연동 참고

- 테스트 모드(`TC0ONETIME`)에서는 실제 결제가 이루어지지 않습니다
- 실제 운영 시 [카카오 개발자 콘솔](https://developers.kakao.com)에서 가맹점 등록 후 실제 CID와 시크릿 키를 발급받아 사용합니다
