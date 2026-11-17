import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AirspaceZoneOverlay } from '@/features/airspace/components/AirspaceZoneOverlay';

const captured = vi.hoisted(() => ({ props: undefined as Record<string, unknown> | undefined }));

vi.mock('react-kakao-maps-sdk', () => ({
  CustomOverlayMap: ({ children, ...props }: { children: ReactNode }) => {
    captured.props = props;
    return <div data-testid="overlay-content">{children}</div>;
  },
}));

describe('AirspaceZoneOverlay 앵커', () => {
  afterEach(() => {
    cleanup();
    captured.props = undefined;
  });

  it('카카오의 크기 측정에 맡기지 않도록 가로·세로 앵커를 모두 0으로 둔다', () => {
    render(
      <AirspaceZoneOverlay position={{ lat: 37, lng: 127 }} zoneType="관제권" onClose={vi.fn()} />,
    );

    expect(captured.props).toMatchObject({
      position: { lat: 37, lng: 127 },
      xAnchor: 0,
      yAnchor: 0,
    });
  });

  it('카드를 누르거나 닫기를 눌러도 지도 클릭으로 전파되지 않도록 clickable로 연다', () => {
    render(
      <AirspaceZoneOverlay position={{ lat: 37, lng: 127 }} zoneType="관제권" onClose={vi.fn()} />,
    );

    expect(captured.props).toMatchObject({ clickable: true });
  });

  it('카카오가 측정하는 콘텐츠 크기를 0×0으로 둔다 (구역 이름 길이가 앵커 계산에 영향을 주지 않게)', () => {
    render(
      <AirspaceZoneOverlay position={{ lat: 37, lng: 127 }} zoneType="관제권" onClose={vi.fn()} />,
    );

    const measuredRoot = screen.getByTestId('overlay-content').firstElementChild;

    expect(measuredRoot?.className).toContain('h-0');
    expect(measuredRoot?.className).toContain('w-0');
  });

  it('카드는 0×0 루트 안에서 절대 위치로 두고 자기 크기 기준(CSS)으로 가운데·위로 옮긴다', () => {
    render(
      <AirspaceZoneOverlay position={{ lat: 37, lng: 127 }} zoneType="관제권" onClose={vi.fn()} />,
    );

    const card = screen.getByTestId('overlay-content').firstElementChild?.firstElementChild;

    expect(card?.className).toContain('absolute');
    expect(card?.className).toContain('bottom-0');
    expect(card?.className).toContain('left-0');
    // w-max: 0폭 컨테이너 안에서도 카드가 한 줄 폭으로 펴지게 한다.
    expect(card?.className).toContain('w-max');
    expect(card?.className).toContain('-translate-x-1/2');
  });

  it('구역 종류를 제목으로 보여 준다', () => {
    render(
      <AirspaceZoneOverlay position={{ lat: 37, lng: 127 }} zoneType="관제권" onClose={vi.fn()} />,
    );

    expect(screen.getByText('관제권')).toBeDefined();
  });

  it('열릴 때 꼬리 끝에서 자라나는 효과를 주고, 카드 폭을 고정해 글자 길이에 따라 튀지 않게 한다', () => {
    render(
      <AirspaceZoneOverlay position={{ lat: 37, lng: 127 }} zoneType="관제권" onClose={vi.fn()} />,
    );

    const wrapper = screen.getByTestId('overlay-content').firstElementChild?.firstElementChild;

    expect(wrapper?.className).toContain('zone-card-enter');
    expect(wrapper?.querySelector('.w-60')).not.toBeNull();
  });

  describe('비행 안내와 주소 (#27)', () => {
    const renderOverlay = (
      zoneType: string | null,
      address?: Parameters<typeof AirspaceZoneOverlay>[0]['address'],
    ) =>
      render(
        <AirspaceZoneOverlay
          position={{ lat: 37, lng: 127 }}
          zoneType={zoneType}
          address={address}
          onClose={vi.fn()}
        />,
      );

    it('구역 레벨에 맞는 안내를 보여 준다', () => {
      renderOverlay('비행금지구역');

      expect(screen.getByText('비행 금지 구역')).toBeDefined();
    });

    it('구역이 없으면 비행 가능이라고 단정하지 않고 참고용 안내를 보여 준다', () => {
      renderOverlay(null);

      expect(screen.getByText('조회된 규제 구역 없음')).toBeDefined();
      expect(screen.getByText(/공식 확인/)).toBeDefined();
      expect(screen.queryByText(/비행 가능/)).toBeNull();
    });

    it('주소는 도로명을 제목으로, 지번은 보조 줄로 보여 준다', () => {
      renderOverlay('관제권', {
        status: 'success',
        address: { primary: '서울 중구 세종대로 110', secondary: '서울 중구 태평로1가 31' },
      });

      expect(screen.getByText('서울 중구 세종대로 110')).toBeDefined();
      expect(screen.getByText('지번 서울 중구 태평로1가 31')).toBeDefined();
    });

    it('주소 조회 중과 실패 상태를 구역 안내와 함께 보여 준다', () => {
      const { rerender } = renderOverlay('관제권', { status: 'loading' });
      expect(screen.getByText('주소 조회 중…')).toBeDefined();

      rerender(
        <AirspaceZoneOverlay
          position={{ lat: 37, lng: 127 }}
          zoneType="관제권"
          address={{ status: 'error' }}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText('주소를 불러오지 못했습니다.')).toBeDefined();
      expect(screen.getByText('비행 제한 구역')).toBeDefined();
    });

    it('범례에서 숨긴 구역이면 그 사실을 카드에 알린다', () => {
      render(
        <AirspaceZoneOverlay
          position={{ lat: 37, lng: 127 }}
          zoneType="관제권"
          isHidden
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText('(범례에서 숨김)')).toBeDefined();
    });

    it('숨기지 않은 구역에는 숨김 안내를 쓰지 않는다', () => {
      renderOverlay('관제권');

      expect(screen.queryByText('(범례에서 숨김)')).toBeNull();
    });

    it('겹침 확인 중에는 없음으로 단정하지 않고, 끝나면 겹친 구역을 보여 준다', () => {
      const { rerender } = render(
        <AirspaceZoneOverlay
          position={{ lat: 37, lng: 127 }}
          zoneType="비행금지구역"
          overlap={{ zoneTypes: [], isComplete: false, hasFailure: false }}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByText('겹침 확인 중…')).toBeDefined();

      rerender(
        <AirspaceZoneOverlay
          position={{ lat: 37, lng: 127 }}
          zoneType="비행금지구역"
          overlap={{ zoneTypes: ['관제권', '경계구역'], isComplete: true, hasFailure: false }}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByText('관제권').className).toContain('ant-tag');
      expect(screen.getByText('경계구역').className).toContain('ant-tag');
    });

    it('클릭한 구역과 겹친 구역을 한 줄에 이어 붙인다 (클릭 구역은 진한 태그, 겹침은 연한 태그)', () => {
      render(
        <AirspaceZoneOverlay
          position={{ lat: 37, lng: 127 }}
          zoneType="비행금지구역"
          overlap={{ zoneTypes: ['관제권', '경계구역'], isComplete: true, hasFailure: false }}
          onClose={vi.fn()}
        />,
      );

      const clicked = screen.getByText('비행금지구역');
      const overlapping = screen.getByText('관제권');

      expect(clicked.parentElement).toBe(overlapping.parentElement);
      expect(clicked.className).toContain('ant-tag-solid');
      expect(overlapping.className).not.toContain('ant-tag-solid');
      expect(screen.queryByText('겹침')).toBeNull();
    });

    it('겹침 확인이 끝났고 없으면 태그는 하나이고 없음 문구를 붙인다', () => {
      render(
        <AirspaceZoneOverlay
          position={{ lat: 37, lng: 127 }}
          zoneType="관제권"
          overlap={{ zoneTypes: [], isComplete: true, hasFailure: false }}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText('겹치는 구역 없음')).toBeDefined();
    });

    it('카드 제목은 주소다 (주소 상태가 없으면 기본 제목)', () => {
      renderOverlay('관제권');

      expect(screen.getByText('공역 안내')).toBeDefined();
    });

    it('구역이 없는 안내에는 겹침 줄을 쓰지 않는다', () => {
      renderOverlay(null);

      expect(screen.queryByText(/겹침|겹치는|관제권/)).toBeNull();
    });

    it('주소 상태를 주지 않으면 주소 줄을 그리지 않는다', () => {
      renderOverlay('관제권');

      expect(screen.queryByText(/주소/)).toBeNull();
    });
  });
});
