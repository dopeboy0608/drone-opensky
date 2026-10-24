# 스펙: 주소·장소 검색 서비스 계층 (#60, 상위 #26)

## 배경/목적

주소 검색창의 서제스트 후보를 만들기 위해 카카오 JS SDK `services`를 앱 공용 형태로 감싼다. 코멘트의 `map.kakao.com` suggest 엔드포인트는 CORS 헤더가 없고 비공식이라 쓰지 않는다(docs/TROUBLE_SHOOTING.md). 도로명 주소가 `Places.keywordSearch`만으로 잡히는지는 확인하지 못해 `Geocoder.addressSearch`를 함께 호출한다. debounce·캐시·UI는 이 스펙의 범위가 아니다(#61, #62).

## 입력

- `keyword: string` — 사용자가 입력한 검색어 (앞뒤 공백 포함 가능)
- 전역 `kakao.maps.services` (`useKakaoLoader`에 `libraries: ['services']` 지정 시 로드됨)

## 기대 동작

반환 타입 `Promise<SearchCandidate[]>`, `SearchCandidate = { id: string; label: string; subLabel?: string; lat: number; lng: number }`.

- [ ] `Places.keywordSearch`와 `Geocoder.addressSearch`를 병렬로 호출한다 (검색어는 trim한 값).
- [ ] 결과는 주소 결과를 앞에, 장소 결과를 뒤에 합친다.
- [ ] 장소 후보: `id`=`place:<place id>`, `label`=`place_name`, `subLabel`=`road_address_name`이 있으면 그것, 없으면 `address_name`.
- [ ] 주소 후보: `id`=`address:<x>,<y>`, `label`=`address_name`, `subLabel` 없음.
- [ ] 좌표는 `x`=경도(`lng`), `y`=위도(`lat`)로 숫자 변환해 매핑한다.
- [ ] `label`과 좌표(`x`,`y`)가 모두 같은 후보는 먼저 나온 것만 남긴다.
- [ ] 최대 10개까지만 반환한다.
- [ ] `ZERO_RESULT`는 빈 결과로 취급한다.

## 엣지케이스

- [ ] 빈 검색어/공백만: 어느 API도 호출하지 않고 `[]`
- [ ] 두 API 모두 `ZERO_RESULT`: `[]`
- [ ] 한쪽만 `ERROR`, 다른 쪽은 `OK`/`ZERO_RESULT`: 가능한 쪽의 결과를 반환한다 (서제스트는 부분 결과가 빈 화면보다 낫다)
- [ ] 두 API 모두 `ERROR`: reject
- [ ] 좌표 문자열이 숫자로 변환되지 않으면(NaN) 해당 후보는 제외한다

## 범위 밖

- debounce, 캐시, 오래된 응답 무시 (#61)
- UI, `panTo` (#62)
- 안내 문구·토스트 (#63)

## 관련 이슈

#26, #60
