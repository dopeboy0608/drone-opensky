import { memo, useCallback, useLayoutEffect, useRef } from 'react';
import { CustomOverlayMap, Polygon, useMap } from 'react-kakao-maps-sdk';

import type { AirspaceZoneConfig } from '@/features/airspace/types';

interface AirspacePolygonProps {
  config: AirspaceZoneConfig;
  path: { lat: number; lng: number }[][];
  isVisible: boolean;
  // 폴리곤의 쌓임 순서. 구역 종류별(국토부 순서)이라 레벨 zIndex(config.zIndex)와 따로 받는다.
  polygonZIndex: number;
  labelPosition: { lat: number; lng: number };
  zoneNumberLabel: string | undefined;
  onPointClick: (point: { lat: number; lng: number }) => void;
}

// memo + 안정된 props(path 참조, 안정된 onPointClick)여야 레이어가 리렌더되어도 Polygon이
// 다시 그려지지 않는다. Polygon은 path 참조가 바뀌면 setPath를 호출해 비용이 크다 (이슈 #47).
export const AirspacePolygon = memo(
  ({
    config,
    path,
    isVisible,
    polygonZIndex,
    labelPosition,
    zoneNumberLabel,
    onPointClick,
  }: AirspacePolygonProps) => {
    const map = useMap();

    const polygonRef = useRef<kakao.maps.Polygon>(null);

    const handleClick = useCallback(
      (_target: unknown, mouseEvent: kakao.maps.event.MouseEvent) => {
        // 구역 종류는 폴리곤이 아니라 클릭 좌표로 다시 조회해 정한다. 폴리곤 한 개의 종류는 겹친 구역의 우선순위를 모르기 때문이다(#27).
        onPointClick({ lat: mouseEvent.latLng.getLat(), lng: mouseEvent.latLng.getLng() });
      },
      [onPointClick],
    );

    // 숨길 때 언마운트하면 다시 켤 때 Kakao Polygon을 새로 만들고 path를 설정하는 비용이 한꺼번에
    // 발생한다. 마운트는 유지하고 지도에서만 떼었다 붙여 그 비용을 피한다 (이슈 #47).
    useLayoutEffect(() => {
      polygonRef.current?.setMap(isVisible ? map : null);
    }, [isVisible, map]);

    return (
      <>
        <Polygon
          ref={polygonRef}
          path={path}
          strokeWeight={1}
          strokeColor={config.color}
          strokeOpacity={0.8}
          fillColor={config.color}
          fillOpacity={config.fillOpacity}
          zIndex={polygonZIndex}
          onClick={handleClick}
        />
        {isVisible && zoneNumberLabel && (
          <CustomOverlayMap position={labelPosition} zIndex={config.zIndex}>
            <span className="rounded bg-white/80 px-1 text-[10px] whitespace-nowrap text-gray-800">
              {zoneNumberLabel}
            </span>
          </CustomOverlayMap>
        )}
      </>
    );
  },
);
