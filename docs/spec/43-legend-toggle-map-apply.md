# 스펙: 범례 토글을 지도 레이어에 반영 (#25 서브태스크 02, #43)

## 배경/목적

#42에서 만든 토글 스토어(typename 키)를 지도에 반영한다. 꺼진 종류의 폴리곤, 구역번호 라벨,
선택 오버레이를 숨긴다. 숨김은 렌더링에서만 제외하며 쿼리/캐시는 건드리지 않는다(#37 staleTime 보존).

## 입력

- **스토어 visibility**: `Record<typename, boolean>`.
- **`visibleZoneTypes`**: `AirspacePolygonLayer`가 받는 선택적 prop(`ReadonlySet<string>`, `feature.zoneType` 라벨 집합). 미지정이면 전부 표시.
- **feature.zoneType**: `tagFeatureZoneType`이 주입한 한글 구역 종류 라벨.

## 기대 동작

- [ ] `getVisibleZoneTypes(visibility)`는 값이 true인 typename을 `TYPENAME_ZONE_LABELS` 라벨로 바꾼 집합을 반환한다.
- [ ] `visibleZoneTypes`에 없는 `zoneType`의 feature는 폴리곤과 구역번호 라벨을 렌더링하지 않는다.
- [ ] 같은 그룹(`config.level`)의 다른 종류는 영향받지 않는다.
- [ ] `visibleZoneTypes`를 넘기지 않으면 기존과 동일하게 전부 표시한다.
- [ ] 안내 오버레이가 열린 종류가 숨겨지면 오버레이를 닫고, 다시 켜도 자동으로 다시 열리지 않는다.
- [ ] 껐다 켤 때 네트워크 재요청이 없다(쿼리 불변).

## 엣지케이스

- [ ] 모든 typename이 꺼지면 빈 집합이고 아무 폴리곤도 렌더링하지 않는다.
- [ ] visibility에 라벨이 없는 키가 섞여 있어도 건너뛴다.

## 범위 밖

- "전체 해제" 버튼(#44), 색상/패턴 변경, 멀티폴리곤 토글, 쿼리 비활성화.

## 관련 이슈

#25, #43
