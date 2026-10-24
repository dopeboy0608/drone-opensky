# #48 폴리곤 조회 캐싱 전략 변경 (IndexedDB)

- 이슈: [#48](https://github.com/dopeboy0608/drone-opensky/issues/48) (요구사항·FR은 이슈 본문이 기준)
- 브랜치: `feature/48-polygon-cache-indexeddb` (마스터에서 분기, 이슈 브랜치 하나에 서브태스크를 커밋 단위로 쌓는다)
- 범위: 모바일 재로드 시 전국 공역 폴리곤(실측 ~14.6MB) 재다운로드 방지. UI 변경 없음, 데이터 계층만 변경

## 로드맵 / 키 매핑

| #   | 이슈 | 제목                       | 비고                                                                 |
| --- | ---- | -------------------------- | -------------------------------------------------------------------- |
| 01  | #53  | IndexedDB 캐시 저장소 모듈 | 읽기·쓰기·version·손상·실패 처리. TDD, `fake-indexeddb` 추가         |
| 02  | #54  | 사전 하이드레이션          | 첫 렌더 전 `setQueryData(updatedAt)`로 주입. 타임아웃 포함           |
| 03  | #55  | 조회 성공 시 저장 연동     | `queryFn` 성공 후 비동기 저장. 새로고침 재조회 성공 시 갱신 (요약만) |
| 04  | #56  | 실패 처리                  | 재조회 실패 시 기존 데이터 유지·토스트 확인, 저장 실패 경로 (요약만) |
| 05  | #57  | 모바일 검증·용량 확인      | 실기기 용량·재로드 확인, 문서화 (요약만)                             |

API 의존 없음. 상위 스토리는 #48, 서브태스크는 sub-issue로 연결.

## 워크플로우

1. 서브태스크 착수 → 구현 → **커밋 전 정지** → 사람이 확인
2. 확인 후에만 커밋 (프로젝트 규칙: 사용자가 명시적으로 요청할 때만 커밋)
3. 다음 서브태스크 본문에 이전 결과 반영
4. 첫 서브태스크 커밋 후 Draft PR 여부를 먼저 묻는다
5. 진행 로그를 이 문서에 추가한다
6. 새 코드에만 `/code-organizer` 적용, 기존 파일 diff는 최소화
7. 순수 함수는 스펙(`docs/spec/48-airspace-idb-cache.md`) → 테스트 → 구현 순서(TDD)

## 결정 로그

| 결정         | 선택                                                         | 근거                                                                                          |
| ------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| 저장소       | IndexedDB                                                    | localStorage 한도 ~5MB, 14.6MB는 UTF-16으로 ~29MB (TROUBLE_SHOOTING 2026-10-24)               |
| 연결 방식    | 직접 래퍼 (persist 플러그인 미도입)                          | 의존성 없음, 그룹별 TTL 제어 용이                                                             |
| 주입 방식    | 첫 렌더 전 `setQueryData(key, data, { updatedAt: savedAt })` | `queryFn` 안에서 읽으면 `dataUpdatedAt`이 "지금"이 되어 `isStale`·새로고침 버튼 기준이 어긋남 |
| 만료 처리    | 만료 항목도 하이드레이션, 재조회는 `staleTime`에 위임        | 별도 만료 판정 불필요, 재조회 실패 시 기존 데이터 유지(FR-02 변경, 이슈 본문 반영)            |
| 테스트       | `fake-indexeddb` devDependency 추가                          | jsdom에 IndexedDB 없음                                                                        |
| 만료 기간    | 24시간 (`STALE_TIME_MS` 공유)                                | 상수 한 곳에서 변경 가능                                                                      |
| 잠정(추천안) | `version` 필드 도입, 백그라운드 갱신 미적용                  | 서브태스크를 막지 않음                                                                        |

## 코드 대조 결과 (Phase B 게이트, ③ 스펙 vs 코드)

1. FR-03 초기 데이터: `useQueries`는 동기 `initialData`만 받고 IndexedDB 읽기는 비동기 → 사전 하이드레이션으로 해결 (`useAirspaceZoneQueries.ts:42-49`)
2. `refreshStaleZones`의 `isStale` 기준 (`useAirspaceZoneQueries.ts:79`) → `updatedAt: savedAt` 주입으로 유지
3. 테스트 인프라: `src/test/setup.ts`에 IndexedDB 없음 → `fake-indexeddb`

디자인 대조: 해당 없음(디자인 파일 없음). ①/② 불일치 없음, 스토리의 "50MB"는 실측(~14.6MB)으로 정정.

## 실측 (용량)

JSON 합계 ~14.6MB (금지 0.17 / 제한 14.3 / 가능 0.09MB, 국립자연공원 13.6MB), IndexedDB 사용량 증가분 ~6MB(Chrome 데스크톱). 모바일 실기기는 #57에서 확인.

## 서브태스크 본문

01·02는 각 이슈 본문([#53](https://github.com/dopeboy0608/drone-opensky/issues/53), [#54](https://github.com/dopeboy0608/drone-opensky/issues/54)) 참고. 03~05는 착수 직전에 보강한다.

## 진행 로그

- 2026-10-24: Phase A 본문 반영, Phase B 코드 대조·용량 실측, 서브이슈 #53~#57 생성. 구현 시작 전.

### 01 구현 완료 (커밋 전, 사용자 확인 대기)

- 구현: `src/features/airspace/cache/airspaceCacheStore.ts` — `readZoneCache(level)` / `writeZoneCache(level, data, savedAt?)`. DB `drone-opensky-airspace`, 스토어 `zoneGroups`, 키 `airspaceZones:<level>`, 값 `{ version, savedAt, data }`. `version` 불일치·손상 값은 `null` 반환 후 삭제, 모든 저장소 실패는 `console.warn` 후 "캐시 없음"으로 처리. 만료 판단은 하지 않는다(#54에서 `savedAt`을 `updatedAt`으로 주입).
- 판단: DB 연결은 모듈 수준 캐싱 없이 호출마다 열고 닫는다(호출이 앱 시작·그룹 조회 성공 시 그룹당 1회뿐이고, 닫히지 않은 연결이 버전 업그레이드를 막는 문제를 피함).
- 스펙: `docs/spec/48-airspace-idb-cache.md`. 테스트 먼저 작성(TDD) 후 구현.
- 테스트: `fake-indexeddb` devDependency 추가, `src/test/setup.ts`에 `import 'fake-indexeddb/auto'` 한 줄. 캐시 저장소 테스트 14개 추가, 전체 47개 통과, `tsc`/lint 통과.
- 이월: #54에서 `readZoneCache`를 호출해 `setQueryData(..., { updatedAt: savedAt })`로 주입. 쿼리 키 생성을 훅과 공유하도록 한곳으로 모을 것. 임시 `.claude/launch.json`은 미추적 상태(커밋 제외).

### 02 구현 완료 (커밋 전, 사용자 확인 대기)

- 구현: `hydrateAirspaceCache(queryClient, { timeoutMs, readCache })` — 3개 그룹을 읽어 `setQueryData(key, data, { updatedAt: savedAt })`로 주입. 만료 항목도 주입(재조회는 `staleTime`, 재조회 실패 시 기존 데이터 유지). 타임아웃 2초, 늦게 도착한 옛 캐시가 이미 받은 데이터를 덮어쓰지 않도록 `getQueryData`가 비어 있을 때만 주입.
- 연결: `src/index.tsx`에서 `hydrateAirspaceCache(queryClient).finally(render)`로 첫 렌더 전에 실행. 이를 위해 `QueryClient`를 `src/api/queryClient.ts`로 분리(App.tsx 변경은 import 2줄). 쿼리 키는 `getAirspaceZoneQueryKey`(`queries/airspaceZoneQueryKey.ts`) 한 곳으로 모아 훅과 하이드레이션이 공유.
- 판단: `readCache` 주입 옵션은 타임아웃 테스트를 위한 것(기본값은 실제 `readZoneCache`).
- 테스트: 하이드레이션 단위 테스트 8개(채움/`dataUpdatedAt`/fresh·stale 판정/만료 항목 주입/부분 저장/빈 저장소/IndexedDB 불가/타임아웃·늦은 응답 덮어쓰기 방지), 훅 통합 테스트 2개(신선한 캐시 → VWorld 요청 0건, 만료 캐시 → 먼저 표시 후 재조회). 전체 57개 통과, `tsc`/lint 통과.
- 미확인: 실제 브라우저 재로드 확인은 저장 연동(03) 이후 가능 — 지금은 저장하는 코드가 없어 IndexedDB가 항상 비어 있다.
- 이월: 03에서 `queryFn` 성공 후 `writeZoneCache` 호출.

### 03 구현 완료 (커밋 전, 사용자 확인 대기)

- 구현: `useAirspaceZoneQueries`의 `queryFn`이 `fetchZoneGroup` 성공 직후 `void writeZoneCache(config.level, data)` 호출. 저장은 기다리지 않으며, 조회 실패 시에는 저장 코드에 도달하지 않아 기존 캐시(만료 포함)가 그대로 남는다. 마운트 재조회와 새로고침 버튼 재조회가 같은 `queryFn`을 타므로 성공 시 `savedAt`이 갱신된다.
- 이슈 #55 본문을 전체 본문으로 보강.
- 테스트: 훅 테스트 4개 추가(성공 시 저장, 만료 캐시 재조회 시 `savedAt` 갱신, 조회 실패 시 기존 캐시 유지 + 기존 데이터 표시, IndexedDB 불가 시 정상 표시). 전체 61개 통과, `tsc`/lint 통과.
- 브라우저 확인(dev, Chrome): 첫 로드에 `wfs` 요청 12건 후 IndexedDB에 3개 그룹 저장(금지 50 / 제한 355 / 가능 56 features, version 1). 새로고침 후 `wfs` 요청 0건, 폴리곤 정상 렌더, DOMContentLoaded 약 54ms. (HMR WebSocket 오류는 dev 서버 환경 노이즈로 이번 변경과 무관.)
- 이월: 04에서 재조회 실패 시 토스트·표시 정책 점검. 05에서 모바일 실기기 확인.

### 04 구현 완료 (커밋 전, 사용자 확인 대기)

- 점검 결과: 소스 변경 없음. `MapView`는 `isError`와 무관하게 `data`를 렌더하고(`MapView.tsx:90`) 로딩 표시는 `isLoading`만 보므로(`:75`), 만료 캐시 재조회가 실패해도 지도는 저장된 데이터를 계속 보여준다. 에러 토스트는 기존 `toastedErrorAtRef`로 그룹당 한 번만 뜬다. 저장소 오류 경로(불가·읽기/쓰기 실패·손상 값)는 01~03 테스트에서 이미 커버.
- 테스트 추가: 만료 캐시 재조회 실패 시 토스트 표시, 중복 없음(로그 기준), 기존 데이터 유지·`isLoading` false. 전체 62개 통과, `tsc`/lint 통과.
- 판단: 토스트 중복 확인을 DOM 개수가 아닌 `console.error` 호출 수로 했다 — antd 토스트 DOM이 앞선 테스트 것까지 body에 남아 개수가 비결정적이었다.
- 미확인: 실제 브라우저에서 네트워크를 끊은 상태의 재로드는 확인하지 못했다(단위·통합 테스트로 대체).
- 이슈 #56 본문 보강.
