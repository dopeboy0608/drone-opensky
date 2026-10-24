import { memo, useMemo } from 'react';

import { AirspacePolygon } from '@/features/airspace/components/AirspacePolygon';
import { multiPolygonToKakaoPaths } from '@/features/airspace/utils/multiPolygonToKakaoPaths';
import { polygonCentroid } from '@/features/airspace/utils/polygonCentroid';
import type {
  AirspaceZoneConfig,
  SelectedZone,
  VWorldFeature,
  VWorldFeatureCollection,
} from '@/features/airspace/types';

interface AirspacePolygonLayerProps {
  config: AirspaceZoneConfig;
  data: VWorldFeatureCollection | undefined;
  /** 표시할 구역 종류(feature.zoneType) 집합. 지정하지 않으면 전부 표시한다. */
  visibleZoneTypes?: ReadonlySet<string>;
  /** 폴리곤 클릭 시 호출. 참조가 안정적이어야 폴리곤 memo가 유지된다. */
  onSelectZone: (zone: SelectedZone) => void;
}

interface PolygonItem {
  key: string;
  zoneType: string | undefined;
  path: { lat: number; lng: number }[][];
  labelPosition: { lat: number; lng: number };
  zoneNumberLabel: string | undefined;
}

const ZONE_NUMBER_PROPERTY_BY_LEVEL: Partial<Record<AirspaceZoneConfig['level'], string>> = {
  prohibited: 'prh_lbl_1',
  restricted: 'res_lbl_1',
};

const getZoneNumberLabel = (
  level: AirspaceZoneConfig['level'],
  properties: VWorldFeature['properties'],
): string | undefined => {
  const propertyKey = ZONE_NUMBER_PROPERTY_BY_LEVEL[level];
  if (!propertyKey) {
    return undefined;
  }
  const value = properties[propertyKey];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const buildPolygonItems = (
  level: AirspaceZoneConfig['level'],
  data: VWorldFeatureCollection,
): PolygonItem[] =>
  data.features.flatMap((feature, featureIndex) => {
    const zoneNumberLabel = getZoneNumberLabel(level, feature.properties);

    return multiPolygonToKakaoPaths(feature.geometry.coordinates).map((rings, polygonIndex) => ({
      key: `${level}-${featureIndex}-${polygonIndex}`,
      zoneType: feature.zoneType,
      // Polygon은 path 참조가 바뀌면 setPath를 호출하므로 데이터가 바뀔 때만 만들어 참조를 고정한다.
      path: rings.map((ring) =>
        ring.map((point) => ({ lat: point.getLat(), lng: point.getLng() })),
      ),
      labelPosition: polygonCentroid(rings[0]),
      zoneNumberLabel,
    }));
  });

export const AirspacePolygonLayer = memo(
  ({ config, data, visibleZoneTypes, onSelectZone }: AirspacePolygonLayerProps) => {
    // 필터(visibleZoneTypes)와 무관하게 data에만 의존시켜, 토글해도 path를 다시 만들지 않는다.
    const polygonItems = useMemo(
      () => (data ? buildPolygonItems(config.level, data) : []),
      [config.level, data],
    );

    return (
      <>
        {polygonItems.map((item) => {
          if (visibleZoneTypes && !visibleZoneTypes.has(item.zoneType ?? '')) {
            return null;
          }

          return (
            <AirspacePolygon
              key={item.key}
              config={config}
              path={item.path}
              zoneType={item.zoneType}
              labelPosition={item.labelPosition}
              zoneNumberLabel={item.zoneNumberLabel}
              onSelectZone={onSelectZone}
            />
          );
        })}
      </>
    );
  },
);
