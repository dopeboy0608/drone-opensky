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
