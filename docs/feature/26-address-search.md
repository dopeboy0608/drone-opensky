# #26 주소검색으로 지도 이동

- 이슈: [#26](https://github.com/dopeboy0608/drone-opensky/issues/26) (요구사항·FR은 이슈 본문이 기준)
- 브랜치: `feature/26-address-search` (master에서 분기, 이슈 브랜치 하나에 서브태스크를 커밋 단위로 쌓는다)
- 범위: 주소·장소 검색 서제스트 + 선택 시 지도 이동. 지도 클릭 시 주소 표시, 최근 검색 기록은 범위 밖

## 로드맵 / 키 매핑

| #   | 이슈 | 제목                   | 비고                                                                     |
| --- | ---- | ---------------------- | ------------------------------------------------------------------------ |
| 01  | #60  | 검색 서비스 계층       | `libraries: ['services']`, 두 API 병합·매핑, 모킹 추가. UI 없음. TDD     |
| 02  | #61  | 검색 훅                | debounce 300ms, `useQuery`, `useDeferredValue`, 빈 입력·오래된 응답·에러 |
| 03  | #62  | 검색 바 UI와 지도 이동 | antd `AutoComplete`, `panTo`, 좌측 상단 배치·모바일 레이아웃 (요약만)    |
| 04  | #63  | 빈 결과·에러 UX 정리   | 안내 문구·토스트·엣지 (요약만)                                           |
| 05  | #64  | 모바일 실기기 확인     | 배포 후 확인과 기록 (요약만)                                             |

API 계약 의존 없음(카카오 JS SDK `services`, 공식 API). 상위 스토리 #26, 서브태스크는 sub-issue로 연결.

## 워크플로우

1. 서브태스크 착수 → 구현 → **커밋 전 정지** → 사람이 확인
2. 확인 후에만 커밋 (프로젝트 규칙: 사용자가 명시적으로 요청할 때만 커밋)
3. 다음 서브태스크 본문에 이전 결과 반영
4. 첫 서브태스크 커밋 후 Draft PR 여부를 먼저 묻는다
5. 진행 로그를 이 문서에 추가한다
6. 새 코드에만 `/code-organizer` 적용, 기존 파일 diff는 최소화
7. 순수 함수는 스펙(`docs/spec/26-*.md`) → 테스트 → 구현 순서(TDD)

## 결정 로그

| 결정             | 선택                                                                         | 근거                                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 검색 데이터 소스 | 카카오 JS SDK `services` (`Places.keywordSearch` + `Geocoder.addressSearch`) | 코멘트의 `map.kakao.com/api/dapi/suggest/hub`는 비공식이고 `Access-Control-Allow-Origin` 헤더가 없어 CORS로 막힘 (TROUBLE_SHOOTING 2026-10-24) |
| 두 API 병합      | 병렬 호출, 주소 결과 우선, 같은 이름·좌표 중복 제거, 최대 10개               | 도로명 주소가 `keywordSearch`만으로 잡히는지 미확인이라 둘 다 사용                                                                             |
| 호출 방식        | TanStack Query `useQuery` (키: debounce한 검색어)                            | 오래된 응답 무시·캐시. 프로젝트에 이미 있는 의존성                                                                                             |
| 성능             | debounce 300ms(호출 횟수) + `useDeferredValue`(목록 렌더링)                  | 둘은 역할이 다르다                                                                                                                             |
| 이동             | `panTo`만, 줌 유지·마커 없음                                                 | 추천안                                                                                                                                         |
| 레이아웃         | 좌측 상단 검색 바, 우측 컨트롤 자리 비움, 스피너는 검색 바 아래              | 상단 중앙은 스피너, 우측 상단은 컨트롤이 점유                                                                                                  |

## 코드 대조 결과 (Phase B 게이트, ③ 스펙 vs 코드)

1. 스토리의 "SDK 로딩 전 입력 비활성": `MapView`가 `loading`일 때 일찍 반환하므로 검색 UI는 로딩 이후에만 렌더됨 → 정책 행 삭제, `libraries: ['services']`만 로더에 추가
2. "상단 검색 바": 상단 중앙은 로딩 스피너(`MapView.tsx:80`), 우측 상단은 `MapControls`(`MapControls.tsx:10`)가 점유 → 배치 결정(위 레이아웃)
3. 테스트 모킹: `src/test/mocks/kakaoMaps.ts`에 `LatLng`만 있고 `services` 없음 → 01에서 필요한 만큼만 추가

디자인 대조: 해당 없음(디자인 파일 없음). ①/② 불일치 없음.

미검증이었던 항목 "도로명 주소가 `keywordSearch`만으로 잡히는지"는 01에서 실측해 해소(도로명은 `addressSearch`만 도로 자체를 반환).

## 서브태스크 본문

01·02는 각 이슈 본문([#60](https://github.com/dopeboy0608/drone-opensky/issues/60), [#61](https://github.com/dopeboy0608/drone-opensky/issues/61)) 참고. 03~05는 착수 직전에 보강한다.

## 진행 로그

- 2026-10-24: Phase A 본문 반영, Phase B 코드 대조, 서브이슈 #60~#64 생성. 구현 시작 전.

### 01 구현 완료 (커밋 전, 사용자 확인 대기)

- 구현: `src/features/map/utils/searchAddressCandidates.ts` — `Places.keywordSearch`와 `Geocoder.addressSearch`를 Promise로 감싸 병렬 호출(`allSettled`)하고, 주소 결과를 앞에 합쳐 `label`+좌표 기준 중복 제거 후 최대 10개(`MAX_SEARCH_CANDIDATES`)를 반환. 한쪽만 실패하면 다른 쪽 결과를 반환하고 둘 다 실패하면 reject. 빈/공백 검색어는 API 호출 없이 `[]`. 좌표가 숫자가 아닌 항목은 제외. 타입 `SearchCandidate`는 `features/map/types.ts`.
- 로더: `MapView`의 `useKakaoLoader`에 `libraries: ['services']` 추가(한 줄 + 주석).
- 모킹: `src/test/mocks/kakaoMaps.ts`에 `services`(Places/Geocoder/Status)와 테스트가 응답을 지정하는 `kakaoServicesMock`을 추가(`uninstall` 시 초기화).
- 스펙: `docs/spec/26-address-search-service.md`. 테스트 먼저 작성 후 구현.
- 테스트: 13개 추가, 전체 75개 통과, `tsc`/lint 통과.
- 실제 SDK 확인(dev 서버, 3000번, Chrome): `libraries: ['services']`로 `kakao.maps.services`가 로드됨. 검색어별 결과 — "봉화산로56길": `keywordSearch` OK 15건(첫 항목은 해당 도로의 상점, 도로 자체는 아님) / `addressSearch` OK 1건("서울 중랑구 봉화산로56길"); "서울시청": `keywordSearch` OK 15건 / `addressSearch` ZERO_RESULT; "세종대로 110": 둘 다 OK. 도로명은 `addressSearch`만 도로 자체를 돌려주고 장소명은 `keywordSearch`만 잡으므로 두 API를 함께 쓰는 설계가 필요함이 확인됨. (이전의 "미검증" 항목 해소)
- 참고: `keywordSearch`는 최대 15건을 돌려주므로 병합 후 상한 10개에서 주소 결과를 앞에 두는 순서가 중요하다.
- 이월: 02에서 `searchAddressCandidates`를 `useQuery`로 감싸고 debounce 적용.

### 02 구현 완료 (커밋 전, 사용자 확인 대기)

- 구현: `useAddressSearch(input)` — 입력 trim → `useDebouncedValue`(300ms, `SEARCH_DEBOUNCE_MS`) → `useQuery`(키 `['addressSearch', 검색어]`, `enabled`는 빈 검색어 제외, `staleTime` 5분, `placeholderData: keepPreviousData`) → 후보는 `useDeferredValue`로 지연. 입력을 지우면 debounce를 기다리지 않고 후보를 즉시 비운다. 반환: `{ candidates, isLoading, isError }`. `useDebouncedValue`는 `features/map/hooks`에 분리.
- 판단: 오래된 응답 무시는 별도 로직 없이 쿼리 키(검색어)로 해결 — 늦게 온 응답은 다른 캐시 항목에 쌓인다. `retry`는 훅에서 건드리지 않고 기본값을 쓴다(실패 시 UX는 04에서 점검).
- 테스트: 훅 테스트 11개 추가(debounce 전 미호출, 후 호출, 연속 입력은 마지막 값만, trim, 빈 입력, 입력 삭제 즉시 비움, 캐시, 늦은 응답 무시, `isLoading`, `isError`). 전체 86개 통과, `tsc`/lint 통과. 반복 실행에서 "debounce 전 미호출" 경계 테스트가 간헐 실패(`shouldAdvanceTime`이 실제 경과 시간을 더해 299ms 경계를 넘김)해 그 테스트만 시간을 고정한 가짜 타이머로 바꿨고, 훅 테스트 25회 반복에서 실패 0회.
- 이월: 03에서 이 훅을 antd `AutoComplete`에 연결하고 `panTo`를 붙인다. 훅은 모킹 테스트로만 검증했고 실제 SDK 연동은 03 화면에서 확인한다.

### 03 구현 완료 (커밋 전, 사용자 확인 대기)

- 구현: `AddressSearch`(antd `AutoComplete`, `size="large"`, `allowClear`, `filterOption={false}`, `virtual={false}`)가 `useAddressSearch`의 후보를 label+subLabel 옵션으로 보여주고, 선택 시 `onSelectCandidate`를 호출. `MapView`는 `kakaoMapInstance.panTo()`만 수행(줌·마커 변경 없음), 로딩 스피너는 `top-16`으로 내림. 이슈 #62 본문 보강.
- 판단: 입력창 표시값(`inputValue`)과 검색어(`searchKeyword`)를 분리 — 후보 선택 시 입력창이 label로 바뀌어도 그 label로 재검색하지 않는다. 옵션 value는 같은 이름 장소 충돌을 피해 id로 두고 `onChange`에서 label로 바꿔 보여준다. `filterOption={false}`가 없으면 antd가 id와 입력값을 비교해 후보를 모두 숨긴다.
- 테스트: 컴포넌트 테스트 6개 추가(플레이스홀더·combobox, 입력 전달, label/subLabel 표시, 선택 시 label 표시와 콜백 1회, 같은 label 후보 구분, 선택 후 재입력). jsdom에 `ResizeObserver`가 없어 테스트 파일 안에서 스텁 처리, RTL 자동 cleanup이 꺼져 있어 직접 정리. 전체 92개 통과, `tsc`/lint 통과.
- 브라우저 확인(dev 3000번, Chrome): 데스크톱 — "봉화산로56길" 입력 시 후보 10개 표시(주소 "서울 중랑구 봉화산로56길"이 맨 앞, 이어서 장소와 도로명 주소), 첫 후보 선택 시 입력창에 label 표시, 지도가 중랑구로 이동하고 줌 레벨 유지, 콘솔 오류 없음. 모바일 375px — 검색 바 [16, 16, 295, 56]과 컨트롤 버튼 [327, 16, 359, 48]이 겹치지 않음.
- 미확인: 로딩 스피너와 검색 바가 동시에 표시되는 순간의 겹침, 실제 모바일 기기의 키보드·터치 동작(05에서 확인).
- 이월: 04에서 결과 없음 안내와 검색 실패 토스트.
