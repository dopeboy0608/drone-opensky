import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AirspacePolygonLayer } from '@/features/airspace/components/AirspacePolygonLayer';

import { AIRSPACE_ZONE_CONFIGS } from '@/features/airspace/constants';
import type { VWorldFeature, VWorldFeatureCollection } from '@/features/airspace/types';
import { installKakaoMapsMock, uninstallKakaoMapsMock } from '@/test/mocks/kakaoMaps';

// 실제 SDK는 jsdom에서 로딩되지 않아, 검증하기 쉬운 단순 컴포넌트로 대체한다.
// Polygon이 렌더될 때마다 받은 path 참조를 기록해, 불필요한 리렌더(= setPath 호출)를 검증한다.
const polygonRenders: unknown[] = [];

vi.mock('react-kakao-maps-sdk', () => ({
  Polygon: ({
    onClick,
    fillColor,
    path,
  }: {
    path: unknown;
    onClick: (
      target: unknown,
      event: { latLng: { getLat: () => number; getLng: () => number } },
    ) => void;
    fillColor: string;
  }) => {
    polygonRenders.push(path);
    return (
      <button
        type="button"
        data-testid="polygon"
        onClick={() => onClick(undefined, { latLng: { getLat: () => 37, getLng: () => 127 } })}
      >
        {fillColor}
      </button>
    );
  },
  CustomOverlayMap: ({ children }: { children: ReactNode }) => (
    <div data-testid="overlay">{children}</div>
  ),
}));

const restrictedConfig = AIRSPACE_ZONE_CONFIGS.find((config) => config.level === 'restricted');

const ring = [
  [127, 37],
  [127.1, 37],
  [127.1, 37.1],
  [127, 37],
];

const makeFeature = (zoneType: string, label?: string): VWorldFeature => ({
  type: 'Feature',
  geometry: { type: 'MultiPolygon', coordinates: [[ring]] },
  properties: label ? { res_lbl_1: label } : {},
  zoneType,
});

const makeData = (...features: VWorldFeature[]): VWorldFeatureCollection => ({
  type: 'FeatureCollection',
  features,
});

describe('AirspacePolygonLayer 토글 필터', () => {
  beforeEach(installKakaoMapsMock);
  // vitest globals가 꺼져 있어 RTL 자동 cleanup이 동작하지 않으므로 직접 정리한다.
  afterEach(() => {
    cleanup();
    uninstallKakaoMapsMock();
  });

  if (!restrictedConfig) {
    throw new Error('restricted 설정이 없습니다');
  }
  const config = restrictedConfig;

  it('visibleZoneTypes를 넘기지 않으면 모든 feature를 표시한다', () => {
    render(
      <AirspacePolygonLayer
        config={config}
        data={makeData(makeFeature('관제권'), makeFeature('군작전구역'))}
        onSelectZone={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId('polygon')).toHaveLength(2);
  });

  it('visibleZoneTypes에 없는 종류의 폴리곤과 구역번호 라벨은 렌더링하지 않는다', () => {
    render(
      <AirspacePolygonLayer
        config={config}
        data={makeData(makeFeature('관제권', 'R1'), makeFeature('군작전구역', 'R2'))}
        visibleZoneTypes={new Set(['관제권'])}
        onSelectZone={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId('polygon')).toHaveLength(1);
    expect(screen.getByText('R1')).toBeInTheDocument();
    expect(screen.queryByText('R2')).not.toBeInTheDocument();
  });

  it('빈 집합이면 아무것도 렌더링하지 않는다', () => {
    render(
      <AirspacePolygonLayer
        config={config}
        data={makeData(makeFeature('관제권'))}
        visibleZoneTypes={new Set()}
        onSelectZone={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('polygon')).not.toBeInTheDocument();
  });

  it('폴리곤을 클릭하면 구역 종류와 클릭 위치로 onSelectZone을 호출한다', () => {
    const onSelectZone = vi.fn();
    render(
      <AirspacePolygonLayer
        config={config}
        data={makeData(makeFeature('관제권'))}
        onSelectZone={onSelectZone}
      />,
    );

    fireEvent.click(screen.getByTestId('polygon'));

    expect(onSelectZone).toHaveBeenCalledWith({
      position: { lat: 37, lng: 127 },
      zoneType: '관제권',
    });
  });

  it('구역 종류가 없는 폴리곤은 클릭해도 onSelectZone을 호출하지 않는다', () => {
    const onSelectZone = vi.fn();
    render(
      <AirspacePolygonLayer
        config={config}
        data={makeData({ ...makeFeature('관제권'), zoneType: undefined })}
        onSelectZone={onSelectZone}
      />,
    );

    fireEvent.click(screen.getByTestId('polygon'));

    expect(onSelectZone).not.toHaveBeenCalled();
  });
});

describe('AirspacePolygonLayer 렌더 비용', () => {
  beforeEach(() => {
    installKakaoMapsMock();
    polygonRenders.length = 0;
  });
  afterEach(() => {
    cleanup();
    uninstallKakaoMapsMock();
  });

  if (!restrictedConfig) {
    throw new Error('restricted 설정이 없습니다');
  }
  const config = restrictedConfig;

  it('데이터가 같으면 부모가 리렌더되어도 폴리곤을 다시 렌더링하지 않는다', () => {
    const data = makeData(makeFeature('관제권'), makeFeature('군작전구역'));
    const onSelectZone = vi.fn();
    const { rerender } = render(
      <AirspacePolygonLayer config={config} data={data} onSelectZone={onSelectZone} />,
    );
    expect(polygonRenders).toHaveLength(2);

    rerender(<AirspacePolygonLayer config={config} data={data} onSelectZone={onSelectZone} />);

    expect(polygonRenders).toHaveLength(2);
  });

  it('필터가 바뀌어도 남아 있는 폴리곤은 같은 path 참조로 다시 렌더링하지 않는다', () => {
    const data = makeData(makeFeature('관제권'), makeFeature('군작전구역'));
    const onSelectZone = vi.fn();
    const { rerender } = render(
      <AirspacePolygonLayer
        config={config}
        data={data}
        visibleZoneTypes={new Set(['관제권', '군작전구역'])}
        onSelectZone={onSelectZone}
      />,
    );
    const [firstPath] = polygonRenders;

    rerender(
      <AirspacePolygonLayer
        config={config}
        data={data}
        visibleZoneTypes={new Set(['관제권'])}
        onSelectZone={onSelectZone}
      />,
    );

    expect(polygonRenders).toHaveLength(2);
    expect(polygonRenders[0]).toBe(firstPath);
  });
});
