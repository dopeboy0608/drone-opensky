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
  zoneType: string;
}
