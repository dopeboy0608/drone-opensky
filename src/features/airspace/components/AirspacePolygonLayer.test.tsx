import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode, type Ref, useImperativeHandle } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AirspacePolygonLayer } from '@/features/airspace/components/AirspacePolygonLayer';

import { AIRSPACE_ZONE_CONFIGS } from '@/features/airspace/constants';
import type { VWorldFeature, VWorldFeatureCollection } from '@/features/airspace/types';
import { installKakaoMapsMock, uninstallKakaoMapsMock } from '@/test/mocks/kakaoMaps';

// 실제 SDK는 jsdom에서 로딩되지 않아, 검증하기 쉬운 단순 컴포넌트로 대체한다.
// Polygon이 렌더될 때마다 받은 path 참조를 기록해, 불필요한 리렌더(= setPath 호출)를 검증한다.
const polygonRenders: unknown[] = [];
// 폴리곤 인스턴스별 setMap 호출 이력 (마운트 순서).
const polygonSetMapCalls: unknown[][] = [];
const MOCK_MAP = { mock: 'map' };

vi.mock('react-kakao-maps-sdk', () => ({
  useMap: () => MOCK_MAP,
  Polygon: ({
    onClick,
    fillColor,
    path,
    ref,
  }: {
    path: unknown;
    ref?: Ref<unknown>;
    onClick: (
      target: unknown,
      event: { latLng: { getLat: () => number; getLng: () => number } },
    ) => void;
    fillColor: string;
  }) => {
    polygonRenders.push(path);
    // 마운트 시 한 번만 인스턴스를 만들고, 이 인스턴스의 setMap 호출 이력을 남긴다.
    useImperativeHandle(ref, () => {
      const calls: unknown[] = [];
      polygonSetMapCalls.push(calls);
      return { setMap: (value: unknown) => calls.push(value) };
    }, []);
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
  beforeEach(() => {
    installKakaoMapsMock();
    polygonSetMapCalls.length = 0;
  });
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

  it('visibleZoneTypes에 없는 종류는 지도에서 떼고 구역번호 라벨도 렌더링하지 않는다', () => {
    render(
      <AirspacePolygonLayer
        config={config}
        data={makeData(makeFeature('관제권', 'R1'), makeFeature('군작전구역', 'R2'))}
        visibleZoneTypes={new Set(['관제권'])}
        onSelectZone={vi.fn()}
      />,
    );

    expect(polygonSetMapCalls[0][polygonSetMapCalls[0].length - 1]).toBe(MOCK_MAP);
    expect(polygonSetMapCalls[1][polygonSetMapCalls[1].length - 1]).toBeNull();
    expect(screen.getByText('R1')).toBeInTheDocument();
    expect(screen.queryByText('R2')).not.toBeInTheDocument();
  });

  it('빈 집합이면 모든 폴리곤을 지도에서 뗀다', () => {
    render(
      <AirspacePolygonLayer
        config={config}
        data={makeData(makeFeature('관제권'))}
        visibleZoneTypes={new Set()}
        onSelectZone={vi.fn()}
      />,
    );

    expect(polygonSetMapCalls[0][polygonSetMapCalls[0].length - 1]).toBeNull();
  });

  it('숨겼다가 다시 켜도 폴리곤을 새로 만들지 않고 지도에 다시 붙인다', () => {
    const data = makeData(makeFeature('관제권'));
    const onSelectZone = vi.fn();
    const { rerender } = render(
      <AirspacePolygonLayer
        config={config}
        data={data}
        visibleZoneTypes={new Set(['관제권'])}
        onSelectZone={onSelectZone}
      />,
    );

    rerender(
      <AirspacePolygonLayer
        config={config}
        data={data}
        visibleZoneTypes={new Set()}
        onSelectZone={onSelectZone}
      />,
    );
    rerender(
      <AirspacePolygonLayer
        config={config}
        data={data}
        visibleZoneTypes={new Set(['관제권'])}
        onSelectZone={onSelectZone}
      />,
    );

    expect(polygonSetMapCalls).toHaveLength(1);
    expect(polygonSetMapCalls[0]).toEqual([MOCK_MAP, null, MOCK_MAP]);
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
    polygonSetMapCalls.length = 0;
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

  it('필터가 바뀌어도 바뀌지 않은 폴리곤은 다시 렌더링하지 않고 path 참조를 유지한다', () => {
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

    // 숨겨진 폴리곤만 isVisible이 바뀌어 다시 렌더되고, 그대로인 폴리곤은 다시 렌더되지 않는다.
    expect(polygonRenders).toHaveLength(3);
    expect(polygonRenders[2]).toBe(polygonRenders[1]);
    expect(polygonRenders[0]).toBe(firstPath);
  });
});
