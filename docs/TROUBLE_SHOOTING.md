# 트러블슈팅 로그

디버깅, 원인 조사, 기술적 의사결정 과정을 기록한다. 포맷과 기록 기준은 [CLAUDE.md](../CLAUDE.md#트러블슈팅-로그) 참고.

## 2026-09-20 09:56 — TypeScript를 @typescript/native-preview(tsgo)로 완전 교체할 수 없는 이유

- 증상: TypeScript 7 네이티브 프리뷰(tsgo)를 체험 도입하면서, 기존 `typescript` devDependency를 `@typescript/native-preview`로 완전히 교체할 수 있는지 검토했다.
- 원인: `typescript-eslint`(및 그 위의 ESLint 파싱)는 `typescript` 패키지가 제공하는 JS 컴파일러 API(`createProgram` 등)를 직접 import해서 사용한다. `@typescript/native-preview`는 이 API를 제공하지 않는 별개의 Go 네이티브 바이너리(`tsgo` CLI)라, `typescript`를 이걸로 대체하면 eslint가 필요로 하는 모듈 자체가 사라져 깨진다.
- 해결/결론: 완전 교체는 시도하지 않고, 기존 `typescript(^6.0.3)`은 유지한 채 `@typescript/native-preview`를 devDependency로 병행 추가했다. `pnpm typecheck:tsgo` 스크립트(`tsgo --noEmit -p tsconfig.json`)로만 수동 체험하며, 빌드(`pnpm build`)·린트(`pnpm lint`)·에디터 설정은 건드리지 않는다. 참고로 현재 `pnpm build`는 rsbuild/SWC 기반이라 애초에 타입체크 단계가 없어, tsgo 도입 여부와 무관하게 빌드 속도에는 영향이 없다.
- 관련 이슈/PR: #17, #19
- **후속(#21/#22 참고)**: 이후 `typescript@latest`가 7.0.2로 정식 출시된 것을 확인. 정식 7.0 패키지 자체가 네이티브 Go 컴파일러이고 클래식 프로그래매틱 API가 아예 없음(7.1 예정)을 확인해, 위 결론(병행 유지)은 폐기하고 ESLint 스택을 완전히 제거 + Biome 도입 + `typescript@^7.0.2` 정식 전환으로 재결정했다. 아래 항목 참고.

## 2026-09-20 10:32 — TypeScript 7 정식(7.0.2)에 클래식 컴파일러 API가 없어 typescript-eslint를 근본적으로 못 씀

- 증상: `typescript@latest`가 7.0.2(정식)로 이미 출시된 것을 확인. ESLint를 Biome으로 교체하면 TS7을 "온전히" 쓸 수 있는지 검토하다가, 실제로 7.0.2 패키지 구조를 npm 레지스트리에서 직접 받아 뜯어봄.
- 원인: `typescript@7.0.2`의 `package.json` `exports` 맵에서 메인 엔트리가 `./lib/version.cjs`(버전 정보만)이고, `createProgram`/`SourceFile`/`SyntaxKind` 같은 클래식 컴파일러 API가 전혀 없다. 대신 `./unstable/sync`, `./unstable/async` 같은 새 RPC 스타일 API만 노출된다. TypeScript 공식 발표에서도 "프로그래매틱 API는 7.1에서 제공 예정"이라고 명시. `typescript-eslint`(`@typescript-eslint/typescript-estree`)는 이 클래식 API에 직접 의존하므로, peer 버전 범위(`<6.1.0`) 문제 이전에 애초에 API가 없어서 구조적으로 동작할 수 없다.
- 해결/결론: ESLint(+typescript-eslint) 전체 제거, Biome을 린트 전용으로 도입(포매터는 Prettier 유지 — Biome이 YAML 미지원이라 `.github/workflows/*.yml` 포맷 대상에서 빠지는 문제가 있었음). `typescript`를 `^7.0.2`로 정식 전환. `@typescript/native-preview`(위 항목의 병행 구성)는 정식 출시로 의미가 없어져 devDependency에서 제거. Biome 전환 과정에서 새로 걸린 두 건(`Map` 전역 shadowing → `KakaoMap` 별칭, 정적 GeoJSON 목록의 배열 인덱스 키 → `biome-ignore` 사유 명시)도 함께 정리.
- 관련 이슈/PR: #21, #22 (#17, #19 대체)

## 2026-09-20 11:17 — Cloudflare Worker에서 VWorld 호출 시 INCORRECT_KEY (Referer 헤더 부재)

- 증상: 이슈 #16 VWorld relay Worker(`worker/index.ts`)를 `wrangler dev`로 로컬 검증하던 중, 정상 발급된 개발용 키(`VITE_VWORLD_API_KEY`)로도 `INCORRECT_KEY` 에러(`ServiceExceptionReport`)가 계속 발생했다.
- 원인: `curl`로 직접 재현해보니, 같은 키로 `Referer` 헤더를 아예 안 보내면 `INCORRECT_KEY`, `-e <아무 값>`으로 Referer를 실어 보내면 (등록된 도메인과 값이 달라도) 정상 응답이었다. 즉 VWorld는 "등록 도메인과 Referer 일치"가 아니라 "Referer 헤더 존재 여부"만 검사한다. 브라우저는 Referer를 자동으로 붙이지만, Cloudflare Worker의 `fetch()`는 기본적으로 Referer를 보내지 않아 서버 사이드 relay에서만 이 문제가 드러났다.
- 해결/결론: `worker/index.ts`에서 VWorld로 보내는 요청에 고정 `Referer` 헤더(Worker 자체 도메인 문자열)를 직접 추가해 해결. 값 자체는 검증되지 않으므로 실제 도메인과 정확히 일치할 필요는 없지만, 가독성을 위해 Worker 도메인을 사용했다.
- 관련 이슈/PR: #16

## 2026-09-20 11:26 — (미해결) Cloudflare Worker에서 VWorld 호출 시 520 (해외/클라우드 IP 차단 추정)

- 증상: Worker 시크릿 등록 + `wrangler deploy` 완료 후 실제 배포된 엔드포인트로 relay를 호출하면 매번 `520`이 반환된다. 로컬 `wrangler dev`(내 네트워크로 실행)와 직접 `curl`(동일 네트워크, 동일 키)은 계속 정상 200이었다.
- 원인 조사:
  - `wrangler tail`로 확인한 결과 예외(Ok)는 없었고, Worker 코드 내부에서 `vworldResponse.status` 자체가 이미 `520`(body `"error code: 520"`, 16바이트)이었다 — 즉 Worker의 `fetch()`가 VWorld로 나가는 시점부터 이미 실패.
  - VWorld 응답 헤더를 그대로 복사하는 게 원인인가 의심해 헤더를 content-type만 남기게 줄여봤지만 동일하게 재현됨 — 헤더 문제 아님.
  - `[placement] mode = "smart"`(Worker 실행 위치를 origin 근처로 이동)로도 재현됨 — 단순 지리적 라우팅 문제도 아님.
  - `api.vworld.kr`은 Cloudflare가 아닌 국내 IP(`211.188.33.95`, APNIC KR)로 직접 서비스 중이라, 520은 VWorld 자체 CDN이 아니라 Cloudflare Workers의 `fetch()` 클라이언트가 origin 연결 실패를 표준 5xx 형식으로 감싸 반환한 것으로 보인다.
  - 정황상 VWorld(국내 공공기관 인프라 특성상 흔한 정책)가 Cloudflare 등 해외/클라우드 사업자 IP 대역 자체를 방화벽에서 차단하고 있을 가능성이 높다 (같은 시각 같은 키로 내 로컬 네트워크 curl은 계속 성공).
- 해결/결론: Vercel에 동일한 relay 로직을 서버리스 함수로 배포하고 `vercel.json`의 `functions.<path>.regions: ["icn1"]`(서울)로 실행 리전을 고정해봤더니 VWorld가 정상 응답했다 — Cloudflare(해외 엣지)만 막혔고, 실행 위치를 한국 리전으로 명시적으로 고정할 수 있는 플랫폼이면 우회 가능함을 확인. Cloudflare Workers는 표준 플랜에서 리전을 직접 고정하는 옵션이 없다(`[placement] mode = "smart"`는 트래픽 학습 기반 휴리스틱일 뿐 특정 리전 고정이 아니고, 진짜 리전 고정은 Enterprise 전용 Regional Services 기능). 최종적으로 VWorld relay는 Vercel(icn1) 서버리스 함수(`server/api/vworld-api/[...path].ts`)로, Cloudflare Worker는 정적 자산(프론트엔드 이중 배포) 전용으로 역할을 나눴다.
- 관련 이슈/PR: #16

## 2026-09-20 12:00 — Vercel 서버리스 함수 배포 시 겪은 부수 이슈 2건 (이슈 #16)

- 증상 1: 첫 `vercel --prod` 배포에서 함수가 `FUNCTION_INVOCATION_FAILED`(500)로 즉시 실패.
  - 원인: `@vercel/node`가 TypeScript를 ESM(`export default`)으로 트랜스파일하는데, `server/package.json`에 `"type": "module"`이 없어 Node가 결과물을 CJS로 로드하려다 `SyntaxError: Unexpected token 'export'` 발생.
  - 해결: `server/package.json`에 `"type": "module"` 추가.
- 증상 2: 로컬 `tsc --noEmit`은 통과하는데 Vercel 빌드에서만 `error TS2688: Cannot find type definition file for 'node'`.
  - 원인: `server/tsconfig.json`에 `"types": ["node"]`를 명시했는데, Vercel 빌드 샌드박스의 pnpm 설치 구조에서 `@types/node`의 엔트리포인트를 못 찾음(로컬 node_modules 구조와 미묘하게 달랐던 것으로 추정).
  - 해결: `"types"` 옵션 자체를 제거해 TS 기본 동작(설치된 `@types/*` 전부 자동 포함)에 맡김.
- 증상 3: 위 두 건을 고친 뒤에도 간헐적으로 `FUNCTION_INVOCATION_FAILED`(500)가 재현됨. `vercel logs`로 확인한 실제 에러는 `TypeError: invalid parameter format` at `res.status(...).send(...)` 호출부. 단일 요청으로 반복 테스트하면 재현이 안 되다가, 실제 프론트엔드처럼 여러 구역 typename을 **동시(병렬)에** 조회하면 재현됨 — GitHub Pages에서는 CORS 에러로, 마침 순차적으로 테스트한 Cloudflare Workers 프론트엔드에서는 우연히 성공으로 관측된 것으로 보임(사용자 리포트: "GitHub Pages는 CORS, Cloudflare는 성공" — 실제로는 동시성 문제로 인한 무작위 500이 GitHub Pages 쪽 테스트 타이밍에 더 걸린 것).
  - 원인 1차 추정(틀림): `res.status(code).send(body)` 메서드 체이닝 — 문장을 분리(`res.status(...); res.send(...);`)했더니 단일 요청 8회는 통과했지만, 이후 병렬 요청(5개 typename 동시 호출)에서 다시 재현되어 체이닝이 원인이 아니었음을 확인.
  - 원인: `@vercel/node`(v13)의 `res.status()`/`res.send()` 헬퍼 자체가 동일 함수 인스턴스에서 여러 요청을 동시 처리할 때 내부 상태가 꼬이는 것으로 추정(정확한 내부 메커니즘은 미확인).
  - 해결: Vercel 전용 헬퍼 대신 Node 표준 API로 교체 — `res.statusCode = ...; res.end(body);`. 이후 5개 typename을 동시(병렬)로 3라운드(총 15회) 요청해도 전부 정상.
- 관련 이슈/PR: #16

## 2026-09-20 12:39 — Vercel relay가 보내는 Referer 값을 실제 키 등록 도메인(GitHub Pages)과 일치시킴

- 증상/의문: `VWORLD_API_KEY`는 GitHub Pages 도메인으로 서비스 URL을 등록해 발급받은 키인데, `worker/api/vworld-api/[...path].ts`가 VWorld로 보내는 `Referer` 헤더 값은 Cloudflare Workers 도메인으로 하드코딩되어 있었다(초기 구현 당시 별 의미 없이 정한 값). 그런데도 GitHub Pages/Cloudflare Workers 어느 프론트엔드에서 호출하든 동일하게 정상 동작해 사용자가 의아해함.
- 원인: 브라우저의 실제 Origin(요청 헤더 쪽 CORS 판단에만 쓰임, `ALLOWED_ORIGINS` 화이트리스트)과, relay가 VWorld로 나가는 요청에 싣는 `Referer`(응답 헤더가 아니라 relay → VWorld 요청 헤더)는 서로 완전히 분리된 별개 로직이라 연동되지 않는다. 게다가 앞서 확인한 대로 VWorld는 Referer 값이 등록 도메인과 일치하는지 검증하지 않고 헤더 존재 여부만 본다 — 그래서 값이 무엇이든(심지어 등록 도메인과 달라도) 항상 통과했다.
- 해결/결론: VWorld가 값을 판단하지 않는다는 사실과 별개로, 코드상 의도를 명확히 하기 위해 `VWORLD_REFERER` 상수 값을 실제 키가 등록된 도메인(`https://dopeboy0608.github.io`)으로 맞췄다. 동작(관대한 VWorld 검증) 자체는 변경 전후로 동일함을 3개 typename 동시 요청으로 재확인. 요청 헤더(Referer, relay→VWorld 고정값)와 응답 헤더(Access-Control-Allow-Origin, 브라우저 Origin 기반 화이트리스트 반사)는 서로 다른 목적의 별개 로직임을 명시적으로 분리해 유지한다.
- 관련 이슈/PR: #16

## 2026-09-20 12:45 — (참고) VWorld 키 관리 페이지 안내와 실제 검증 로직의 불일치 가능성

- 관찰: VWorld 키 관리 페이지에는 "여러 도메인에서 쓰려면 도메인별로 API 키를 따로 발급받아 쓰라"는 안내가 있다. 그런데 위 항목들에서 확인했듯 실제 요청 검증은 Referer 헤더의 존재 여부만 확인하고 값이 등록 도메인과 일치하는지는 보지 않아, 키 하나로 어떤 값에서 호출하든 통과한다.
- 판단: 안내 문구(정책)와 실제 구현(검증 로직) 중 하나가 어긋난 것으로 보인다 — ① 안내가 실제보다 엄격하게 쓰여 있거나, ② 원래 "Referer-등록 도메인 일치"를 검증하려던 로직이 "헤더 존재 여부"만 보는 얕은 체크로 구현된 결함일 가능성. 정확한 원인은 VWorld 측 확인 없이는 알 수 없다.
- 결론: 지금 relay 구조(도메인별 키 분리 없이 키 하나 + relay 하나)는 이 느슨한 검증 덕에 동작하는 것이지, VWorld가 공식적으로 보장하는 동작은 아닐 수 있다. VWorld가 검증을 강화하면 깨질 수 있는 우연한 동작이라는 점을 유의하고, 그때는 도메인별 키 발급/분기를 다시 검토해야 한다.
- 관련 이슈/PR: #16

## 2026-09-23 12:38 — react-kakao-maps-sdk의 Map이 "현재위치로 이동" 버튼에 반응하지 않음

- 증상: 지도의 "현재위치로 이동" 버튼(`setMapCenter(currentPosition)`으로 `KakaoMap`의 `center` prop을 갱신하는 방식)을 눌러도 지도가 움직이지 않는 경우가 있었다. 과거에도 다른 프로젝트에서 겪은 문제로, `{lat: 0, lng: 0}`을 임시로 거쳐 갱신하는 워크어라운드로 우회했었다.
- 원인: 서브에이전트로 `node_modules/react-kakao-maps-sdk`(v1.2.2) 소스를 직접 읽어 확인. `Map` 컴포넌트는 다음과 같은 형태의 recenter `useEffect`를 갖는다.
  ```js
  useEffect(() => {
    // ... 현재 map center와 비교 후 setCenter/panTo 호출
  }, [mapInstance, center.lat, center.lng, center.x, center.y]);
  ```
  의존성 배열이 `center` **객체 참조**가 아니라 `lat`/`lng` **원시값**이다. 따라서 GPS 재조회 없이 이미 알고 있는 좌표를 그대로 `setMapCenter`에 넘기면(혹은 GPS로 다시 조회해도 우연히 같은 값이 나오면) `lat`/`lng` 값 자체가 이전과 동일해 effect가 재실행되지 않고, 지도는 움직이지 않는다. 과거 `{lat: 0, lng: 0}` 경유 워크어라운드가 통했던 이유도 이 값 비교 방식 때문 — 중간에 다른 값을 한 번 거치면 의존성이 확실히 바뀐다.
- 해결/결론: 선언적 `center` prop의 값 비교에 기대지 않고, `Map`의 `onCreate` 콜백(SDK 타입 주석이 `ref`보다 `onCreate` + `useState` 조합을 권장)으로 실제 `kakao.maps.Map` 인스턴스를 확보한 뒤, 이동이 필요한 시점에 `mapInstance.panTo(new kakao.maps.LatLng(lat, lng))`를 명령형으로 직접 호출하도록 변경. 값이 같든 다르든 항상 확실하게 동작한다. `center` prop 자체는 최초 위치 조회 시 지도를 한 번 맞추는 용도로만 남겨뒀다.
- 관련 이슈/PR: #36

## 2026-09-23 12:49 — 브라우저 네트워크 탭의 "disk cache"는 TanStack Query 캐시가 아니라 별개의 HTTP 캐시

- 증상/의문: 공역 데이터 재조회 관련 논의 중, 사용자가 브라우저 개발자도구 네트워크 탭에서 VWorld 요청이 "(disk cache)"로 표시되는 것을 보고 TanStack Query의 캐시가 디스크에 저장되는 방식이라고 오해함.
- 원인: 캐시가 두 개의 독립된 레이어로 존재한다는 점을 명확히 구분하지 못해 생긴 오해였다.
  1. TanStack Query 캐시 — JS 메모리(힙)에만 존재, `staleTime`/`gcTime`으로 앱 코드가 직접 제어, 탭 닫히거나 새로고침하면 소멸.
  2. 브라우저 HTTP 캐시 — `Cache-Control`/`ETag`/`Last-Modified` 등 HTTP 응답 헤더 기반으로 브라우저가 자체 판단, 디스크에 저장될 수 있음.
  - VWorld 릴레이 서버(`server/api/vworld-api/[...path].ts:40-43`)를 확인한 결과 VWorld 원본 응답의 `Content-Type`만 그대로 전달할 뿐 `Cache-Control`/`ETag`/`Last-Modified`는 전혀 설정하지 않는다. 즉 사용자가 본 "disk cache"는 relay가 의도한 캐싱이 아니라 크롬이 캐시 헤더 부재 시 자체적으로 적용하는 휴리스틱 캐싱일 뿐이며, 언제 히트할지 보장되지 않는다.
- 해결/결론: 오해를 정정하고, 두 캐시 레이어를 명확히 구분해 안내함. 릴레이 서버에 명시적 `Cache-Control` 헤더를 추가해 브라우저 HTTP 캐시도 안정적으로 동작하게 하는 방안을 제안했으나, 사용자가 지금은 범위에서 제외하고 #37을 TanStack Query 캐싱만으로 진행하기로 결정. 향후 모바일 데이터 절감을 더 강화하려면 이 relay 헤더 추가를 별도로 재검토할 수 있다.
- 관련 이슈/PR: #37 (구현 전, 설계 논의 단계)

## 2026-10-24 — 필터 토글/영역 클릭 시 렌더링 지연: 개선 전 측정 베이스라인

- 증상: 범례 필터 토글, 폴리곤 클릭·오버레이 닫기 시 지도 갱신이 늦다 (폴리곤 약 1,000개 로드 상태).
- 측정 조건: 개발 서버(`pnpm dev`, StrictMode 켜짐)에서 React `Profiler`(레이어 목록 감싸기)와 `kakao.maps.Polygon.prototype.setPath/setMap` 래핑으로 계측. 총 시간은 동작 직후부터 2프레임 그려질 때까지. 계측 코드는 임시이며 커밋하지 않음. 개발 모드(StrictMode) 수치는 프로덕션보다 크게 나올 수 있어 절대값보다 개선 전후 비교용으로 쓴다.
- 결과 (1회 측정 후 동일 동작 반복 시 ±10% 내):

  | 동작                       | 총 시간               | 렌더   | `setPath` | `setMap`           | 비고                                   |
  | -------------------------- | --------------------- | ------ | --------- | ------------------ | -------------------------------------- |
  | 비행금지구역 OFF (30개)    | ~600ms (첫 회 1010ms) | ~125ms | 485       | 15                 | 켜져 있는 나머지 폴리곤 전부 `setPath` |
  | 비행금지구역 ON            | ~530ms                | ~125ms | 515       | 45 (생성 30)       |                                        |
  | 비행제한구역 OFF (168개)   | ~600ms                | ~110ms | 416       | 84                 |                                        |
  | 비행제한구역 ON            | ~540ms                | ~120ms | 584       | 252 (생성 168)     |                                        |
  | 관제권 OFF (106개)         | ~600ms                | ~125ms | 447       | 53                 |                                        |
  | 관제권 ON                  | ~530ms                | ~134ms | 553       | 159 (생성 106)     |                                        |
  | 전체 해제                  | ~620ms                | 1ms    | 0         | 500                | 렌더는 가볍고 제거만 발생              |
  | 전체 선택                  | ~1,510ms              | ~330ms | 1,000     | 1,500 (생성 1,000) | 최악                                   |
  | 폴리곤 클릭(오버레이 열기) | -                     | ~7ms   | 50        | 0                  | 해당 레이어(50개) 전체 `setPath`       |

- 원인(측정으로 확인):
  1. 토글 하나로도 **유지되는 폴리곤 전부에 `setPath`가 다시 호출**된다 (OFF 시 남은 폴리곤 수와 거의 일치). 렌더마다 `path`를 새 배열로 만들어 넘기기 때문이며, 렌더 시간(~125ms)보다 `setPath`·지도 갱신이 총 시간의 대부분(약 4/5)을 차지한다.
  2. 오버레이 열기만으로도 그 레이어의 모든 폴리곤에 `setPath`가 호출된다 (`selectedZone`이 레이어 state).
  3. 전체 선택은 숨겼던 폴리곤을 전부 새로 만들어 가장 느리다 (언마운트/재마운트 비용).
- 해결/결론: 02에서 path 참조 안정화와 선택 오버레이 분리로 (1)(2)를 먼저 제거하고, 남는 비용은 03에서 가시성 전환 방식(생성/제거 대신 `setMap(null)`)으로 줄인다. 02 이후 같은 조건으로 재측정해 비교한다.
- 관련 이슈/PR: #47
