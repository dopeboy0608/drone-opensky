# GitHub Pages 배포 설정

## 완료된 작업 (코드/설정)

1. **`rsbuild.config.ts`**
   - `GH_PAGES_BASE_PATH` 환경변수로 서브경로(`/drone-opensky/`) 배포 대응
     - `output.assetPrefix`: 정적 에셋 URL 접두사
     - `server.base`: 서버 base path
   - 클라이언트 코드에서 쓸 수 있도록 `import.meta.env.VITE_BASE_PATH`로 define 주입

2. **`src/routes/router.tsx`**
   - TanStack Router에 `basepath: import.meta.env.VITE_BASE_PATH` 추가
   - 서브경로 배포 시에도 라우팅이 `/drone-opensky/map` 기준으로 동작

3. **`src/env.d.ts`**
   - `VITE_BASE_PATH` 타입 선언 추가

4. **`.github/workflows/deploy.yml`**
   - `master` 브랜치 push 시 자동 실행
   - pnpm install → `pnpm build` (base path, API 키는 secrets로 주입) → `dist/index.html`을 `dist/404.html`로 복사(SPA 새로고침 대응) → `actions/deploy-pages`로 배포

## 로컬 빌드 테스트 결과

- 로컬 Node를 `nvm use 24` (v24.21.0)로 전환 후 아래 명령으로 빌드 확인 완료:
  ```bash
  GH_PAGES_BASE_PATH=/drone-opensky/ pnpm build
  ```
- 빌드 성공, `dist/index.html`의 모든 asset 경로가 `/drone-opensky/...`로 정상 생성됨을 확인.

## 사용자가 직접 해야 할 일 (GitHub 웹 설정)

1. **리포지토리 Settings → Pages → Source를 "GitHub Actions"로 변경**
2. **Settings → Secrets and variables → Actions**에 다음 리포지토리 시크릿 등록
   - `VITE_KAKAO_MAP_API_KEY`
   - `VITE_VWORLD_API_KEY`
3. **Kakao Developers 콘솔**에서 사용 중인 JS 키의 플랫폼 도메인에 `https://dopeboy0608.github.io` 등록
   - 등록하지 않으면 배포된 페이지에서 카카오맵이 로드되지 않음
4. 위 설정 후 `master`에 push하면 Actions 탭에서 배포 진행 상황 확인 가능. 완료되면
   `https://dopeboy0608.github.io/drone-opensky/` 에서 접속 확인

## 참고

- 로컬 개발(`pnpm dev`)은 base path 영향 없이 기존과 동일하게 동작 (`GH_PAGES_BASE_PATH` 미설정 시 기본값 `/`)
- `.nvmrc` 기준 Node 24 이상 필요 (Rspack 요구사항)
