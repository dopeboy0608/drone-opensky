import type { AirspaceZoneConfig, AirspaceZoneLevel } from '@/features/airspace/types';

// 대한민국 전역을 덮는 고정 BBOX (minLng,minLat,maxLng,maxLat). API_REFERENCE.md 실증값.
export const KOREA_BBOX = '124,33,132,43';

// 구역 종류의 단일 출처. 배열 순서가 곧 위험도 우선순위다(앞이 높음).
// 이 순서가 WMS 타일 오버레이의 쌓임 순서(앞 슬롯이 위)와 클릭 지점의 겹침 판정 우선순위에 그대로 쓰이므로,
// typename 배열(AIRSPACE_ZONE_CONFIGS)과 라벨(TYPENAME_ZONE_LABELS)을 따로 선언하다 어긋나지 않도록 여기서 파생한다.
const ZONE_TYPES = [
  { typename: 'lt_c_aisprhc', label: '비행금지구역', level: 'prohibited' },
  { typename: 'lt_c_aistemp', label: '임시비행금지구역', level: 'prohibited' },
  // 국토부 범례는 위험지역을 비행금지구역과 별개 종류(민트색)로 표시한다. 금지로 분류하면 지도 색과 안내가 국토부보다 과장된다(#105).
  { typename: 'lt_c_aisdngc', label: '위험구역', level: 'restricted' },
  { typename: 'lt_c_aisresc', label: '비행제한구역', level: 'restricted' },
  { typename: 'lt_c_aisctrc', label: '관제권', level: 'restricted' },
  { typename: 'lt_c_aismoac', label: '군작전구역', level: 'restricted' },
  { typename: 'lt_c_aisaltc', label: '경계구역', level: 'restricted' },
  { typename: 'lt_c_aisatzc', label: '비행장교통구역', level: 'restricted' },
  { typename: 'lt_c_aisfldc', label: '경량항공기 이착륙장', level: 'restricted' },
  { typename: 'lt_c_wgisnpgug', label: '국립자연공원', level: 'restricted' },
  { typename: 'lt_c_aisuac', label: '초경량비행장치공역(UA)', level: 'available' },
  { typename: 'lt_c_aisdronezone', label: '드론시범사업구역', level: 'available' },
] as const satisfies readonly { typename: string; label: string; level: AirspaceZoneLevel }[];

const LEVEL_STYLES = [
  { level: 'prohibited', color: '#FF4D4F', fillOpacity: 0.35, zIndex: 3 },
  { level: 'restricted', color: '#8C8C8C', fillOpacity: 0.3, zIndex: 2 },
  { level: 'available', color: '#52C41A', fillOpacity: 0.2, zIndex: 1 },
] as const satisfies readonly Omit<AirspaceZoneConfig, 'typenames'>[];

export const AIRSPACE_ZONE_CONFIGS: AirspaceZoneConfig[] = LEVEL_STYLES.map((style) => ({
  ...style,
  typenames: ZONE_TYPES.filter((zone) => zone.level === style.level).map((zone) => zone.typename),
}));

export const AIRSPACE_ZONE_LABELS: Record<AirspaceZoneConfig['level'], string> = {
  prohibited: '비행 금지',
  restricted: '비행 제한',
  available: '비행 가능',
};

// typename → 한글 구역 종류 라벨. 같은 색상 그룹 안에서도 클릭 시 정확한 구역 종류를 구분하기 위함(#24 FR-007).
// 키 순서는 ZONE_TYPES의 우선순위 순서를 그대로 따른다.
export const TYPENAME_ZONE_LABELS: Record<string, string> = Object.fromEntries(
  ZONE_TYPES.map((zone) => [zone.typename, zone.label]),
);

// 한글 구역 라벨 → 레벨. 클릭 안내가 SelectedZone의 라벨만으로 금지/제한/가능 안내를 고르기 위한 것이다(#27).
export const ZONE_LEVEL_BY_LABEL: Record<string, AirspaceZoneLevel> = Object.fromEntries(
  ZONE_TYPES.map((zone) => [zone.label, zone.level]),
);

// 클릭 조회 대상. 범례 필터(표시 여부)와 무관하게 전부 조회한다. 숨긴 구역 위를 클릭했을 때 "규제 없음"으로 보이면
// 오해를 부르기 때문이다(#27). 순서는 우선순위(위험도 높은 순)다.
export const ALL_ZONE_TYPENAMES: string[] = Object.keys(TYPENAME_ZONE_LABELS);
