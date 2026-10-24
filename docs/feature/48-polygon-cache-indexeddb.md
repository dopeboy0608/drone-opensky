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
