// 카카오 축척 컨트롤 기준 1km에 해당하는 지도 레벨.
// 공식 문서에 level별 정확한 축척표가 없어 DevTalk 확인값(level 1~5: 20/30/50/100/250m)에서
// 250 → 500 → 1000m로 이어진다고 보고 채택 (docs/spec/34-map-ux-improvements.md 참고).
export const DEFAULT_ZOOM_LEVEL = 7;

// 위치 조회 실패/미허용 시 폴백 좌표 (서울시청).
export const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };

// 서제스트 목록이 길어지면 모바일에서 화면을 가리고 선택하기 어려워 상한을 둔다.
export const MAX_SEARCH_CANDIDATES = 10;
