import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AirspacePolygonLayer } from '@/features/airspace/components/AirspacePolygonLayer';

import { AIRSPACE_ZONE_CONFIGS } from '@/features/airspace/constants';
import type { VWorldFeature, VWorldFeatureCollection } from '@/features/airspace/types';
import { installKakaoMapsMock, uninstallKakaoMapsMock } from '@/test/mocks/kakaoMaps';

// 실제 SDK는 jsdom에서 로딩되지 않아, 검증하기 쉬운 단순 컴포넌트로 대체한다.
vi.mock('react-kakao-maps-sdk', () => ({
  Polygon: ({
    onClick,
    fillColor,
  }: {
    onClick: (
      target: unknown,
      event: { latLng: { getLat: () => number; getLng: () => number } },
    ) => void;
    fillColor: string;
  }) => (
    <button
      type="button"
      data-testid="polygon"
      onClick={() => onClick(undefined, { latLng: { getLat: () => 37, getLng: () => 127 } })}
    >
      {fillColor}
    </button>
  ),
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
      />,
    );

    expect(screen.queryByTestId('polygon')).not.toBeInTheDocument();
  });

  it('열린 안내 오버레이의 종류가 숨겨지면 닫히고, 다시 켜도 다시 열리지 않는다', () => {
    const data = makeData(makeFeature('관제권'));
    const { rerender } = render(
      <AirspacePolygonLayer config={config} data={data} visibleZoneTypes={new Set(['관제권'])} />,
    );

    fireEvent.click(screen.getByTestId('polygon'));
    expect(screen.getByText('관제권')).toBeInTheDocument();

    rerender(<AirspacePolygonLayer config={config} data={data} visibleZoneTypes={new Set()} />);
    expect(screen.queryByText('관제권')).not.toBeInTheDocument();

    rerender(
      <AirspacePolygonLayer config={config} data={data} visibleZoneTypes={new Set(['관제권'])} />,
    );
    expect(screen.queryByText('관제권')).not.toBeInTheDocument();
  });
});
