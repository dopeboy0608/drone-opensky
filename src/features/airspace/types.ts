export type AirspaceZoneLevel = 'prohibited' | 'restricted' | 'available';

export interface AirspaceZoneConfig {
  level: AirspaceZoneLevel;
  typenames: string[];
  color: string;
  fillOpacity: number;
  zIndex: number;
}

export interface VWorldFeature {
  type: 'Feature';
  geometry: {
    type: 'MultiPolygon';
    coordinates: number[][][][];
  };
  properties: Record<string, unknown>;
  /** 클라이언트에서 typename 기준으로 주입하는 한글 구역 종류 라벨. VWorld 원본 응답에는 없음. */
  zoneType?: string;
}

export interface VWorldFeatureCollection {
  type: 'FeatureCollection';
  features: VWorldFeature[];
}

export interface SelectedZone {
  position: { lat: number; lng: number };
  // null이면 클릭 지점에 조회된 규제 구역이 없다는 뜻이다(#27).
  zoneType: string | null;
  // true면 구역 조회가 끝나기 전의 대기 카드다. 이때 zoneType은 아직 알 수 없어 null이다(#114).
  isPending?: boolean;
  // 같은 지점에 겹친 나머지 구역(우선순위 순). 최상위를 먼저 보여 준 뒤 도착하는 대로 채워지므로 완료 여부를 함께 둔다(#27).
  overlap?: {
    zoneTypes: string[];
    isComplete: boolean;
    // 일부 조회가 실패해 겹친 구역이 빠졌을 수 있다.
    hasFailure: boolean;
  };
}
