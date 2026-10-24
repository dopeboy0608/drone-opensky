// 카카오 축척 컨트롤 기준 1km에 해당하는 지도 레벨.
// 공식 문서에 level별 정확한 축척표가 없어 DevTalk 확인값(level 1~5: 20/30/50/100/250m)에서
// 250 → 500 → 1000m로 이어진다고 보고 채택 (docs/spec/34-map-ux-improvements.md 참고).
export const DEFAULT_ZOOM_LEVEL = 7;

// 위치 조회 실패/미허용 시 폴백 좌표 (서울시청).
export const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };

// 서제스트 목록이 길어지면 모바일에서 화면을 가리고 선택하기 어려워 상한을 둔다.
export const MAX_SEARCH_CANDIDATES = 10;

// 키 입력마다 검색하면 호출이 과해져서, 입력이 멈춘 뒤 이 시간이 지나야 검색한다.
// useDeferredValue는 렌더링 우선순위만 낮출 뿐 호출 횟수를 줄이지 못해 debounce가 따로 필요하다.
export const SEARCH_DEBOUNCE_MS = 300;

// 같은 검색어를 다시 입력했을 때(지웠다 다시 쓰기 등) 재호출하지 않도록 잠깐 신선하게 둔다.
export const SEARCH_STALE_TIME_MS = 5 * 60 * 1000;
