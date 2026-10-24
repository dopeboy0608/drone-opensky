# 스펙: 공역 IndexedDB 캐시 저장소 (#53, 상위 #48)

## 배경/목적

모바일 브라우저는 탭을 재로드하면 메모리 기반 React Query 캐시가 사라져 전국 공역 폴리곤(실측 ~14.6MB)을 매번 다시 받는다. localStorage는 한도(~5MB)가 작아 쓸 수 없으므로 IndexedDB에 구역 그룹별로 보관한다. 이 스펙은 읽기/쓰기만 담당하는 데이터 계층이며, React Query 연동은 #54(하이드레이션), #55(저장 연동)에서 다룬다.

## 입력

- `level`: `AirspaceZoneLevel` (`prohibited` | `restricted` | `available`)
- `data`: `VWorldFeatureCollection` (`zoneType`이 이미 주입된 그룹 단위 결과)
- `savedAt`(쓰기 시, 선택): 저장 시각(ms). 기본값은 `Date.now()`

## 기대 동작

- `writeZoneCache(level, data)`는 `{ version, savedAt, data }`를 키 `airspaceZones:<level>`로 저장한다.
- `readZoneCache(level)`는 저장된 `{ savedAt, data }`를 돌려준다. 값이 없으면 `null`.
- 만료 여부는 판단하지 않는다. 만료된 항목도 그대로 돌려주고, 재조회 시점은 React Query의 `staleTime`이 정한다(`savedAt`을 `updatedAt`으로 주입).
- 그룹(level)끼리 독립이다. 한 그룹을 쓰거나 지워도 다른 그룹은 그대로다.
- 같은 level에 다시 쓰면 덮어쓴다.

## 엣지케이스

- [ ] 저장된 값이 없으면 `null`
- [ ] `version`이 현재 버전과 다르면 `null`을 돌려주고 해당 항목을 삭제한다
- [ ] 형식이 손상된 값(객체가 아님, `savedAt`이 숫자가 아님, `data`가 FeatureCollection이 아님)이면 `null`을 돌려주고 해당 항목을 삭제한다
- [ ] IndexedDB를 쓸 수 없으면(`indexedDB` 미정의, 열기 실패) 읽기는 `null`, 쓰기는 조용히 무시한다. 예외를 던지지 않고 `console.warn`만 남긴다
- [ ] 읽기/쓰기 트랜잭션이 실패해도 같은 방식으로 처리한다
- [ ] 쓰기 실패(용량 초과 등)는 호출한 쪽 흐름을 막지 않는다

## 범위 밖

- React Query 하이드레이션 (#54), `queryFn` 성공 후 저장 호출 (#55)
- 재조회 실패 시 토스트·표시 정책 (#56)
- 모바일 실기기 용량 검증 (#57)

## 관련 이슈

#48, #53
