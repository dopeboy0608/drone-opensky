# Drone-OpenSky

드론 비행 가능/제한/불가 구역을 실시간 지도 기반으로 제공하는 서비스

## 배포 주소

https://dopeboy0608.github.io/drone-opensky/

## 실행 방법

```bash
pnpm install
pnpm dev
```

### 환경 변수

`.env.example`을 복사해 `.env`를 만들고 키를 채웁니다.

```bash
cp .env.example .env
```

```
VITE_KAKAO_MAP_API_KEY=your_api_key
VITE_VWORLD_API_KEY=your_api_key
```

## 문서

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 구조, 기술 스택, 데이터 흐름
- [docs/ROADMAP.md](./docs/ROADMAP.md) — 현재 구현 범위 및 단계별 계획
- [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) — 공공 API 연동 상세
- [CLAUDE.md](./CLAUDE.md) — AI 에이전트 작업 가이드
- [docs/draft/01.project-overview.md](./docs/draft/01.project-overview.md) — 초기 장기 비전 초안
