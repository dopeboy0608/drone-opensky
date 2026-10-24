# #47 필터 토글/영역 클릭 시 폴리곤 렌더링 지연 개선

- 이슈: [#47](https://github.com/dopeboy0608/drone-opensky/issues/47) (증상·원인 가설·완료 조건은 이슈 본문이 기준)
- 브랜치: `bug/47-polygon-render-perf` (이슈 브랜치 하나, 서브태스크는 범위·결정 추적용. 서브이슈는 만들지 않고 #47 본문 체크리스트로 관리)
- 범위: 기존 동작(필터/클릭/오버레이)은 바꾸지 않는 성능 개선

## 로드맵 / 키 매핑

| #   | 제목                           | 비고                                                                                       |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------ |
| 01  | 측정 베이스라인                | Profiler/Performance로 개선 전 수치 기록. 코드 변경 없음                                   |
| 02  | 리렌더·setPath 제거            | path 메모이제이션, `AirspacePolygon` memo 분리, 선택 오버레이를 레이어 밖으로 분리         |
| 03  | 토글·라벨 최적화 (요약만 작성) | 언마운트 대신 가시성 전환 검토, 라벨 오버레이 줌/선택 조건부 표시, `useDeferredValue` 검토 |

API 의존 없음. 02·03의 "눈에 띄는 지연 없음"은 01의 측정 수치와 비교해 판단한다.

## 워크플로우

1. 서브태스크 착수 → 구현 → **커밋 전 정지** → 사람이 확인
2. 확인 후에만 커밋 (프로젝트 규칙: 사용자가 명시적으로 요청할 때만 커밋)
3. 다음 서브태스크 본문에 이전 결과 반영
4. 첫 서브태스크 커밋 후 Draft PR 여부를 먼저 묻는다
5. 진행 로그를 이 문서에 추가한다
6. 새 코드에만 `/code-organizer` 적용, 기존 파일 diff는 최소화

## 서브태스크 본문

### 01. 측정 베이스라인

- 목표: 개선 전 병목을 수치로 남긴다.
- 범위(In): 공역 데이터를 많이 로드한 상태에서 (a) 범례 토글 ON/OFF, (b) 폴리곤 클릭·오버레이 닫기를 React Profiler/Performance 탭으로 측정. 폴리곤 수, 커밋 시간, Polygon 리렌더 횟수, `setPath` 호출 횟수를 기록.
- 범위 밖(Out): 최적화 코드 변경 → 02, 03. 측정용 임시 코드는 커밋하지 않는다.
- 참고: `src/features/airspace/components/AirspacePolygonLayer.tsx`, `src/features/map/components/MapView.tsx`
- 예상 변경 파일: `docs/TROUBLE_SHOOTING.md`(측정 결과 추가)
- 확인 시나리오: [ ] 개선 전 수치 표가 문서에 남아 있다 [ ] 가장 큰 병목 1~2개가 식별되어 02/03 우선순위에 반영됐다
- 커밋: `docs: 폴리곤 렌더링 성능 베이스라인 측정 기록 (#47)`

### 02. 리렌더·setPath 제거

- 목표: 오버레이 열기/닫기와 토글 시 불필요한 Polygon 리렌더와 `setPath` 호출을 없앤다.
- 선행: 01
- 범위(In):
  - `AirspacePolygon`(신규, `React.memo`) 분리
  - `multiPolygonToKakaoPaths` 결과와 `path` 변환을 `useMemo`로 캐싱해 참조 안정화 (`data`가 바뀔 때만 재계산)
  - 클릭 핸들러 안정화(폴리곤별 인라인 함수 제거)
  - `selectedZone`을 레이어 밖으로 분리 (위치: MapView state vs zustand store는 02 착수 때 결정)
- 범위 밖(Out): 가시성 전환 방식, 라벨 오버레이 조건부 표시 → 03. 레벨별 레이어가 각자 `selectedZone`을 가져 다른 구역 클릭 시 이전 오버레이가 안 닫힐 수 있는 동작 이슈 → 선택 상태를 한 곳으로 모으면 자연히 해소되지만, 동작이 바뀌므로 확인 후 반영.
- 참고: `AirspacePolygonLayer.tsx`, `AirspaceZoneOverlay.tsx`, `AirspacePolygonLayer.test.tsx`
- 예상 변경 파일: 신규 `AirspacePolygon.tsx`(+테스트), 수정 `AirspacePolygonLayer.tsx`, `MapView.tsx`(선택 상태 위치에 따라)
- 테스트: 기존 모킹 `Polygon`은 `path`를 받지 않음 → 렌더 횟수/prop 참조 안정성을 검증하도록 목 확장
- 확인 시나리오: [ ] `pnpm test` 통과 [ ] 오버레이 열기·닫기 시 Polygon 리렌더 0회 [ ] 필터·클릭·오버레이 기존 동작 동일 [ ] 01과 같은 조건 재측정, 수치 기록
- 코드 리뷰 포인트: 롤백 경로(레이어 내부 인라인 렌더 복원), memo 비교가 깨지는 props(객체 리터럴) 없는지
- 커밋: `perf: 폴리곤 path 메모이제이션 및 선택 오버레이 분리 (#47)`

### 03. 토글·라벨 최적화

> 상세 본문은 착수 직전에 보강 예정. 02 이후 측정값으로 필요 여부와 범위를 판단한다.
> 후보: 숨김을 언마운트 대신 `setMap(null)`/가시성 전환으로, 라벨 `CustomOverlayMap`을 줌 레벨 조건부 또는 선택 구역만 표시, `startTransition`/`useDeferredValue` 검토.

## 결정 로그

| 항목               | 결정                                              | 출처        |
| ------------------ | ------------------------------------------------- | ----------- |
| 진행 방식          | 서브태스크 3개, 서브이슈 없이 #47 체크리스트 관리 | 사용자 선택 |
| 브랜치 기준        | 최신 master(#25 머지 포함)에서 분기               | 사용자 확인 |
| 선택 오버레이 위치 | 02 착수 때 결정                                   | 권장안 채택 |

## 조사 결과 (Findings)

- 교차 검증 게이트: ①/② 없음(디자인·스펙 없는 성능 버그, 이슈 본문이 기준). 통과.
- 이슈 가설 확인(코드): `selectedZone`이 레이어 state, 렌더마다 `LatLng` 객체 재생성 및 `path` 새 배열, 인라인 `onClick`, 필터로 숨기면 `flatMap`에서 제외되어 언마운트/재마운트.
- 추가 발견: `visibleZoneTypes`가 바뀌면 모든 레이어가 `flatMap` 전체를 다시 계산한다. 레벨별 레이어가 각자 `selectedZone`을 가진다.
- 기존 `AirspacePolygonLayer.test.tsx`는 SDK 모킹으로 존재하나 `Polygon`의 `path`는 받지 않는다.
- #48(폴리곤 조회 캐싱)과는 조회 쪽 vs 렌더 쪽이라 파일은 대체로 다르다. `data` 참조 변경 시점이 path 메모 기준이므로 병행 시 확인.

## 진행 로그

### 01 구현 완료 (커밋 전, 사용자 확인 대기)

- 구현: 코드 변경 없음. 임시 계측(`src/perfProbe.tsx`, `MapView`의 `PerfProfiler` 래핑, `.claude/launch.json`)으로 측정 후 `docs/TROUBLE_SHOOTING.md`에 베이스라인 기록. 임시 파일은 커밋하지 않고, 02 재측정 후 되돌린다.
- 핵심 수치: 토글 1회 ~600ms(유지되는 폴리곤 전부 `setPath` 호출, 렌더 ~125ms는 일부), 전체 선택 ~1.5s, 오버레이 열기 시 해당 레이어 50개 `setPath`.
- 이월: 02에서 path 안정화·선택 오버레이 분리 후 같은 시나리오를 재측정. 수치는 개발 모드(StrictMode) 기준이라 비교용.

### 02 구현 완료 (커밋 전, 사용자 확인 대기)

- 구현: `AirspacePolygon`(memo), `AirspacePolygonLayer`(`memo` + path를 `data` 기준 `useMemo`, 필터는 렌더 시에만 적용), `useSelectedZone` 훅(선택 상태 + 숨김 시 닫기 effect, `MapView`가 소유), `SelectedZone` 타입을 `types.ts`로 이동. 선택 오버레이 위치는 MapView state(훅)로 결정 — 단일 소비처라 전역 store가 불필요.
- 동작 변경 1건: 선택 상태가 레이어별에서 하나로 합쳐져, 다른 구역을 클릭하면 이전 오버레이가 닫히고 하나만 열린다 (이전: 레벨이 다른 폴리곤을 클릭하면 오버레이가 2개 열릴 수 있었음).
- 테스트: 레이어 테스트에 onSelectZone 호출, 리렌더 시 Polygon 미재렌더(path 참조 동일) 검증 추가, `useSelectedZone` 훅 테스트 추가(오버레이 숨김 시 닫기는 훅 테스트로 이동). `pnpm test` 32개 통과, `tsc` 통과.
- 재측정: 토글 ~~600ms → 35~~65ms, 오버레이 열기·닫기 `setPath` 0회 (TROUBLE_SHOOTING.md 참고). 전체 선택은 ~630ms로 남음.
- 이월: 03에서 ON 시 폴리곤 재생성 비용(전체 선택 ~630ms)과 라벨 오버레이 최적화. 임시 계측(`perfProbe.tsx`)은 코드에서 제거했고 스크래치패드에 보관(03 재측정 때 MapView에 PerfProfiler로 다시 감싸 사용). `.claude/launch.json`은 미추적 임시 파일.

### 03 구현 완료 (커밋 전, 사용자 확인 대기)

- 구현: `AirspacePolygon`에 `isVisible` prop 추가 — `Polygon` ref로 `setMap(isVisible ? map : null)` (`useLayoutEffect`), 언마운트 없음. 라벨은 보일 때만 렌더. 레이어는 필터링 대신 `isVisible`만 계산해 넘긴다.
- 범위 판단: 측정상 모든 동작이 ~100ms 이하라 `useDeferredValue`/`startTransition`, 라벨 줌 조건부 표시는 보류(필요 시 별도 이슈).
- 테스트: 레이어 테스트를 `setMap` 호출 이력 기준으로 수정(숨김 시 `null`, 다시 켜도 인스턴스 재생성 없음, 바뀐 폴리곤만 리렌더). 33개 통과, `tsc`/lint 통과. 화면에서 오버레이가 숨김 시 닫히고 재표시 시 다시 열리지 않음 확인.
- 재측정: 전체 선택 ~1.5s → ~85ms, `setPath` 0회 (TROUBLE_SHOOTING.md).
- 남은 일: #47 완료 조건 확인 후 이슈 체크리스트 갱신/닫기(사용자 확인), 임시 `.claude/launch.json` 삭제.
