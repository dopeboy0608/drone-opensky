# #26 주소검색으로 지도 이동

- 이슈: [#26](https://github.com/dopeboy0608/drone-opensky/issues/26) (요구사항·FR은 이슈 본문이 기준)
- 브랜치: `feature/26-address-search` (master에서 분기, 이슈 브랜치 하나에 서브태스크를 커밋 단위로 쌓는다)
- 범위: 주소·장소 검색 서제스트 + 선택 시 지도 이동. 지도 클릭 시 주소 표시, 최근 검색 기록은 범위 밖

## 로드맵 / 키 매핑

| #   | 이슈 | 제목                   | 비고                                                                     |
| --- | ---- | ---------------------- | ------------------------------------------------------------------------ |
| 01  | #60  | 검색 서비스 계층       | `libraries: ['services']`, 두 API 병합·매핑, 모킹 추가. UI 없음. TDD     |
| 02  | #61  | 검색 훅                | debounce 300ms, `useQuery`, `useDeferredValue`, 빈 입력·오래된 응답·에러 |
| 03  | #62  | 검색 바 UI와 지도 이동 | antd `AutoComplete`, `panTo`, 좌측 상단 배치·모바일 레이아웃 (완료)      |
| 04  | #66  | 마커 표시              | 단일 마커, 내 위치 ↔ 검색 위치 전환 (2026-10-24 요구사항 추가)           |
| 05  | #63  | 빈 결과·에러 UX 정리   | 안내 문구·토스트·엣지 (요약만)                                           |
| 06  | #64  | 모바일 실기기 확인     | 배포 후 확인과 기록 (요약만)                                             |

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

01·02는 각 이슈 본문([#60](https://github.com/dopeboy0608/drone-opensky/issues/60), [#61](https://github.com/dopeboy0608/drone-opensky/issues/61)), 04는 [#66](https://github.com/dopeboy0608/drone-opensky/issues/66) 참고. 05~06은 착수 직전에 보강한다.

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

### 04 마커 구현 완료 (커밋 전, 사용자 확인 대기)

- 요구사항 추가(2026-10-24): "지도 위치로 이동했을 때 마커를 찍고, 마커는 항상 1개. 내 위치 마커는 초기 1회, 주소 검색 이동 시 내 위치 마커 제거(검색 위치 마커 표시), 내 위치 버튼 이동 시 내 위치 마커로 복귀. 마커는 기본 마커로 통일." 기존 "마커 없음" 결정을 바꿔 #26 본문(FR-03 변경, FR-06 추가)과 서브이슈 #66을 추가하고, 기존 04·05(#63, #64)는 05·06으로 번호만 변경.
- 구현: `useMapMarker(currentPosition, hasLocation)` — 상태를 `'current' | 'search'(+좌표)` 하나로 두고 `markerPosition`을 파생해 마커가 두 개가 될 수 없는 구조. `MapView`는 후보 선택 시 `panTo` + `showSearchMarker`, 내 위치 버튼 성공 시 `panTo` + `showCurrentMarker`를 호출하고 `MapMarker` 하나만 렌더. 내 위치 조회가 실패하면 상태를 바꾸지 않는다(검색 마커 유지). 타입 `MapPosition`은 `features/map/types.ts`.
- 테스트: 훅 테스트 10개 추가(초기 내 위치/미확인, 검색 마커로 전환, 재검색 시 이동, 내 위치 복귀, 검색 중 내 위치 갱신·실패에도 유지, 위치 모르는 상태 검색, 내 위치 모드에서 실패 시 마커 없음). 전체 102개 통과, `tsc`/lint 통과.
- 브라우저 확인(dev 3000번, Chrome, 브라우저 패널의 위치 권한은 거부 상태라 내 위치는 `navigator.geolocation`을 스텁): 위치 권한 없이 시작 → 마커 없음. 서울시청 검색·선택 → 마커 1개. 내 위치 버튼(스텁 성공) → 지도 이동 후 마커 1개(검색 마커 제거). 부산시청 검색·선택 → 마커 1개(내 위치 마커 제거). 내 위치 버튼(스텁 실패) → 토스트 "현재 위치를 가져오지 못했습니다." 표시, 마커 1개 유지·지도 이동 없음.
- 미확인: 실제 GPS 권한이 있는 환경에서 "초기 로드 시 내 위치 마커 1개"(스텁 외에는 권한이 거부돼 초기 상태를 직접 못 봄)는 훅 단위 테스트로 검증했고 실기기에서는 06에서 확인한다.
- 관찰(범위 밖, 변경 안 함): 내 위치 버튼으로 이동한 뒤에도 검색 입력창에는 이전 검색어가 그대로 남는다. 필요하면 05(UX 정리)에서 다룰 후보.
- 이월: 05에서 결과 없음 안내·실패 토스트(+위 입력창 표시 정리 여부 결정).

### 05 구현 완료 (커밋 전, 사용자 확인 대기)

- 구현: `useAddressSearch`가 `isEmpty`를 반환(입력이 비어 있지 않고, 입력 == debounce한 검색어이며, placeholder가 아닌 현재 검색어의 성공 응답이 0건일 때만 true)하고 `retry: false`를 쓴다. `AddressSearch`는 `isEmpty`일 때 `notFoundContent`로 "검색 결과가 없습니다."를 보여주고(그 외에는 null이라 드롭다운이 열리지 않음), `isError`가 켜질 때 `message.error('주소 검색에 실패했습니다.')`를 한 번 띄운다. #63 본문 보강.
- 판단: `retry: false` — 기본 재시도(3회, 백오프)는 실패 안내를 수 초 늦추고, 서제스트는 사용자가 다시 입력하는 쪽이 자연스럽다. 기존 훅 테스트는 `QueryClient` 기본값을 쓰도록 바꿔(이전엔 retry를 꺼 둠) 훅이 스스로 재시도를 끄는지 검증한다.
- 테스트: 훅 `isEmpty` 6개(0건, 결과 있음, 빈 입력, debounce 대기 중, 새 검색어 로딩 중 이전 0건으로 true 되지 않음, 실패) + 컴포넌트 4개(결과 없음 안내, 안내 미표시, 실패 토스트 1회, 실패 없으면 토스트 없음) 추가. 토스트는 `AntdApp.useApp` 스파이로 검증(토스트 DOM이 테스트 간에 남아 개수를 못 셈). 전체 112개 통과, 훅·컴포넌트 테스트 15회 반복 실패 0, `tsc`/lint 통과.
- 브라우저 확인(dev 3000번): 결과가 없는 검색어 → 드롭다운에 "검색 결과가 없습니다." 표시. SDK를 실패(`ERROR`)로 스텁한 상태에서 새 검색어 → 토스트 "주소 검색에 실패했습니다." 1회, SDK 호출은 두 API 각 1회뿐(재시도 없음), 9초 뒤에도 호출·토스트 추가 없음. (스텁은 SDK 인스턴스가 메서드를 생성자에서 정의해 프로토타입이 아닌 생성자를 교체해야 적용됨.)
- 결정(2026-10-24): 내 위치 버튼으로 이동한 뒤에도 입력창에 이전 검색어를 그대로 둔다 — 사용자가 해당 주소로 이어서 검색할 수 있기 때문.
- 이월: 06 모바일 실기기 확인(초기 로드 시 내 위치 마커 1개, 키보드·터치, 스피너와 검색 바 겹침).

### 머지 전 코드 리뷰 반영 (커밋 전, 사용자 확인 대기)

`/code-review high`(9건)를 테스트 먼저 작성한 뒤 모두 수정했다.

- 초기 중심 이동 경합: 검색 후보를 선택하면 `hasSetInitialCenterRef`를 true로 둬, 위치 권한 팝업 등으로 최초 위치 조회가 늦어도 조회 완료 시 지도를 내 위치로 되돌리지 않는다(`MapView`).
- 재입력 시 이전 후보 노출: `debouncedKeyword === ''`인 동안에도 후보를 비운다(`useAddressSearch`).
- 주소 후보 id 중복: id에 이름을 포함해 `address:<이름>:<x>,<y>`로 바꿨다.
- 주소가 장소를 밀어냄: 주소는 앞쪽 5개만 먼저 두고 장소를 이어 붙인 뒤 남는 자리를 나머지 주소로 채운다(최대 10개).
- 에러 토스트 재발생: 훅이 `errorUpdatedAt`을 반환하고, 컴포넌트가 이미 안내한 발생 시각을 `Set`으로 기억해 캐시된 에러로 돌아와도 반복하지 않는다.
- 정리: 미사용 `isLoading` 제거, `useCurrentCenter`의 인라인 좌표 타입을 `MapPosition`으로 교체(타입만 변경).
- 테스트: `MapView` 연결 테스트 6개 신규(초기 마커, 검색 선택 시 이동·단일 마커, 내 위치 성공·실패, 초기 중심 경합 두 경우)와 훅·유틸·컴포넌트 테스트 보강. 전체 124개 통과, 전체 스위트 10회 반복 실패 0, `tsc`/lint 통과.
- `/code-organizer`(신규 파일만, 위치만 변경): import를 외부 → 앱 인프라 → 기능(컴포넌트·훅·유틸) → 상수·타입 순으로 정렬하고, `AddressSearch`의 `useEffect`를 핸들러 아래로 이동. `MapView.test`의 `@/test/mocks/kakaoMaps` import는 그룹이 모호해 기능 그룹 안에 두었다(제안: 별도 그룹 여부는 사용자 판단).

### 모바일 실기기 확인 결과 반영 (커밋 전, 사용자 확인 대기)

- 사용자 확인(2026-10-24, 배포된 모바일): 특이사항 없음. 단, 후보 목록이 열린 상태로 지도의 폴리곤을 누르면 오버레이는 뜨지만 후보 목록이 남는 문제가 있어 수정.
- 수정: `AddressSearch`가 `open`/`onOpenChange`로 열림 상태를 제어하고, 열린 동안 `document`의 캡처 단계 `pointerdown`으로 검색 영역 밖 누름을 감지해 닫는다. 드롭다운은 `getPopupContainer`로 검색 영역 안에 렌더(후보 누름이 바깥으로 판정되지 않게). 원인과 재현은 TROUBLE_SHOOTING.md 참고.
- 테스트: 컴포넌트 테스트 4개 추가(바깥 누름 시 닫힘, 전파를 막는 요소를 눌러도 닫힘, 후보 선택은 정상, 닫힌 뒤 재입력 시 다시 열림). 전체 128개 통과(8회 반복 실패 0), `tsc`/lint 통과.
- 브라우저 확인(dev 3000번): 열린 목록에서 마우스 이벤트 없이 폴리곤에 `pointerdown`만 보내면 닫히고, 다시 입력하면 목록이 열리며, 후보 선택 시 입력창 값·지도 이동·마커 1개가 정상. (실제 모바일 기기 재확인은 다음 배포 후 사용자 확인 필요.)
