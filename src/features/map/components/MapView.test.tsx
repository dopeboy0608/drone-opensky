import { App as AntdApp } from 'antd';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MapView } from '@/features/map/components/MapView';
import { useCurrentCenter } from '@/features/map/hooks/useCurrentCenter';
import { installKakaoMapsMock, uninstallKakaoMapsMock } from '@/test/mocks/kakaoMaps';

import { DEFAULT_CENTER } from '@/features/map/constants';

const { panTo } = vi.hoisted(() => ({ panTo: vi.fn() }));

vi.mock('react-kakao-maps-sdk', () => ({
  useKakaoLoader: () => [false, undefined],
  Map: ({
    center,
    onCreate,
    children,
  }: {
    center: { lat: number; lng: number };
    onCreate?: (map: { panTo: typeof panTo }) => void;
    children?: React.ReactNode;
  }) => {
    // MapView가 넘기는 onCreate(setState)는 참조가 안정적이라 지도 인스턴스가 한 번만 전달된다.
    useEffect(() => {
      onCreate?.({ panTo });
    }, [onCreate]);
    return (
      <div data-testid="map" data-center={`${center.lat},${center.lng}`}>
        {children}
      </div>
    );
  },
  MapMarker: ({ position }: { position: { lat: number; lng: number } }) => (
    <div data-testid="map-marker" data-position={`${position.lat},${position.lng}`} />
  ),
}));

vi.mock('@/features/map/hooks/useCurrentCenter');
vi.mock('@/features/airspace/queries/useAirspaceZoneQueries', () => ({
  useAirspaceZoneQueries: () => ({ results: [], refreshStaleZones: vi.fn() }),
}));
vi.mock('@/features/airspace/components/AirspacePolygonLayer', () => ({
  AirspacePolygonLayer: () => null,
}));
vi.mock('@/features/airspace/components/AirspaceZoneOverlay', () => ({
  AirspaceZoneOverlay: () => null,
}));
vi.mock('@/features/airspace/components/AirspaceLegend', () => ({ AirspaceLegend: () => null }));
vi.mock('@/features/airspace/components/AirspaceFilterPanel', () => ({
  AirspaceFilterPanel: () => null,
}));
vi.mock('@/features/map/components/AddressSearch', () => ({
  AddressSearch: ({
    onSelectCandidate,
  }: {
    onSelectCandidate: (candidate: { id: string; label: string; lat: number; lng: number }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onSelectCandidate({ id: 'place:1', label: '검색지', lat: 35.1, lng: 129.0 })}
    >
      검색 후보 선택
    </button>
  ),
}));

const CURRENT = { lat: 37.3, lng: 127.1 };
const mockedUseCurrentCenter = vi.mocked(useCurrentCenter);
const refetchLocation = vi.fn();

const mockLocation = (overrides: Partial<ReturnType<typeof useCurrentCenter>> = {}) => {
  mockedUseCurrentCenter.mockReturnValue({
    position: CURRENT,
    hasLocation: true,
    hasResolvedInitial: true,
    refetchLocation,
    ...overrides,
  });
};

const renderMapView = () =>
  render(
    <AntdApp>
      <MapView />
    </AntdApp>,
  );

const markers = () => screen.queryAllByTestId('map-marker');

describe('MapView 마커와 지도 이동 연결', () => {
  beforeEach(() => {
    installKakaoMapsMock();
    panTo.mockReset();
    refetchLocation.mockReset();
  });

  afterEach(() => {
    cleanup();
    uninstallKakaoMapsMock();
  });

  it('초기에 내 위치를 알면 내 위치에 마커 하나를 표시한다', () => {
    mockLocation();

    renderMapView();

    expect(markers()).toHaveLength(1);
    expect(markers()[0]).toHaveAttribute('data-position', '37.3,127.1');
  });

  it('검색 후보를 선택하면 그 위치로 이동하고 내 위치 마커 대신 검색 마커 하나만 남긴다', () => {
    mockLocation();
    renderMapView();

    fireEvent.click(screen.getByText('검색 후보 선택'));

    expect(panTo).toHaveBeenCalledTimes(1);
    const target = panTo.mock.calls[0][0];
    expect([target.getLat(), target.getLng()]).toEqual([35.1, 129.0]);
    expect(markers()).toHaveLength(1);
    expect(markers()[0]).toHaveAttribute('data-position', '35.1,129');
  });

  it('내 위치 버튼이 성공하면 이동하고 검색 마커 대신 내 위치 마커 하나만 남긴다', () => {
    mockLocation();
    refetchLocation.mockImplementation((options) => options?.onSuccess?.(CURRENT));
    renderMapView();
    fireEvent.click(screen.getByText('검색 후보 선택'));
    panTo.mockReset();

    fireEvent.click(screen.getByLabelText('현재위치로 이동'));

    expect(panTo).toHaveBeenCalledTimes(1);
    expect(markers()).toHaveLength(1);
    expect(markers()[0]).toHaveAttribute('data-position', '37.3,127.1');
  });

  it('내 위치 버튼이 실패하면 이동하지 않고 검색 마커를 유지한다', () => {
    mockLocation();
    refetchLocation.mockImplementation((options) => options?.onError?.());
    renderMapView();
    fireEvent.click(screen.getByText('검색 후보 선택'));
    panTo.mockReset();

    fireEvent.click(screen.getByLabelText('현재위치로 이동'));

    expect(panTo).not.toHaveBeenCalled();
    expect(markers()).toHaveLength(1);
    expect(markers()[0]).toHaveAttribute('data-position', '35.1,129');
  });

  it('최초 위치 조회가 끝나기 전에 검색으로 이동했다면, 조회가 끝나도 지도 중심을 내 위치로 되돌리지 않는다', () => {
    mockLocation({ hasLocation: false, hasResolvedInitial: false });
    const { rerender } = renderMapView();
    fireEvent.click(screen.getByText('검색 후보 선택'));

    mockLocation({ hasLocation: true, hasResolvedInitial: true });
    rerender(
      <AntdApp>
        <MapView />
      </AntdApp>,
    );

    expect(screen.getByTestId('map')).toHaveAttribute(
      'data-center',
      `${DEFAULT_CENTER.lat},${DEFAULT_CENTER.lng}`,
    );
    expect(markers()[0]).toHaveAttribute('data-position', '35.1,129');
  });

  it('검색으로 이동하지 않았다면 최초 위치 조회가 끝날 때 지도 중심을 내 위치로 맞춘다', () => {
    mockLocation({ hasLocation: false, hasResolvedInitial: false });
    const { rerender } = renderMapView();

    mockLocation({ hasLocation: true, hasResolvedInitial: true });
    rerender(
      <AntdApp>
        <MapView />
      </AntdApp>,
    );

    expect(screen.getByTestId('map')).toHaveAttribute('data-center', '37.3,127.1');
  });
});
