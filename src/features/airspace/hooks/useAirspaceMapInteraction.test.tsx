import { act, renderHook } from '@testing-library/react';
import { App as AntdApp } from 'antd';
import { delay, http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { useAirspaceMapInteraction } from '@/features/airspace/hooks/useAirspaceMapInteraction';
import { server } from '@/test/mocks/server';

import { createInitialVisibility } from '@/features/airspace/store/airspaceFilterStore';
import type { AirspaceRenderMode } from '@/features/airspace/store/airspaceRenderModeStore';

const WFS_URL = 'https://server-eosin-five-92.vercel.app/api/vworld-api/wfs';

const wrapper = ({ children }: { children: ReactNode }) => <AntdApp>{children}</AntdApp>;
const setup = (renderMode: AirspaceRenderMode, visibility = createInitialVisibility()) =>
  renderHook(
    (props: { renderMode: AirspaceRenderMode; visibility: Record<string, boolean> }) =>
      useAirspaceMapInteraction(props),
    { initialProps: { renderMode, visibility }, wrapper },
  );

describe('useAirspaceMapInteraction', () => {
  it('폴리곤 모드에서는 범례에서 켜진 구역 종류(한글 라벨)를 보여 준다', () => {
    const visibility = { ...createInitialVisibility() };
    for (const typename of Object.keys(visibility)) {
      visibility[typename] = typename === 'lt_c_aisprhc' || typename === 'lt_c_aisctrc';
    }

    const { result } = setup('polygon', visibility);

    expect(result.current.visibleZoneTypes).toEqual(new Set(['비행금지구역', '관제권']));
  });

  // 폴리곤을 언마운트하지 않고 가시성 전환으로 숨겨 복귀 비용을 피한다(#47).
  it('WMS 모드에서는 보이는 폴리곤이 없고, 렌더가 바뀌어도 같은 빈 Set 참조를 돌려준다', () => {
    const { result, rerender } = setup('wms');
    const first = result.current.visibleZoneTypes;

    rerender({ renderMode: 'wms', visibility: createInitialVisibility() });

    expect(first.size).toBe(0);
    expect(result.current.visibleZoneTypes).toBe(first);
  });

  const square = [
    [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
    ],
  ];
  const useHit = (onRequest?: (typename: string | null) => void) =>
    server.use(
      http.get(WFS_URL, ({ request }) => {
        onRequest?.(new URL(request.url).searchParams.get('TYPENAME'));
        return HttpResponse.json({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: { type: 'MultiPolygon', coordinates: square },
            },
          ],
        });
      }),
    );

  it('모드를 바꾸면 열려 있던 안내를 닫는다', async () => {
    useHit();
    const { result, rerender } = setup('polygon');
    await act(() => result.current.handlePointClick({ lat: 5, lng: 5 }));
    expect(result.current.selectedZone).not.toBeNull();

    rerender({ renderMode: 'wms', visibility: createInitialVisibility() });

    expect(result.current.selectedZone).toBeNull();
  });

  it('범례에서 해당 종류를 꺼도 안내는 닫히지 않고, 숨김 상태로 표시된다 (#27)', async () => {
    useHit();
    const { result, rerender } = setup('wms');
    await act(() => result.current.handlePointClick({ lat: 5, lng: 5 }));
    expect(result.current.selectedZone?.zoneType).toBe('비행금지구역');
    expect(result.current.isSelectedZoneHidden).toBe(false);

    rerender({
      renderMode: 'wms',
      visibility: { ...createInitialVisibility(), lt_c_aisprhc: false },
    });

    expect(result.current.selectedZone?.zoneType).toBe('비행금지구역');
    expect(result.current.isSelectedZoneHidden).toBe(true);
  });

  it('구역이 없는 곳이면 숨김 상태가 아니다', async () => {
    server.use(
      http.get(WFS_URL, () => HttpResponse.json({ type: 'FeatureCollection', features: [] })),
    );
    const { result } = setup('wms');

    await act(() => result.current.handlePointClick({ lat: 5, lng: 5 }));

    expect(result.current.selectedZone?.zoneType).toBeNull();
    expect(result.current.isSelectedZoneHidden).toBe(false);
  });

  it.each(['polygon', 'wms'] as const)(
    '%s 모드에서도 범례 필터와 무관하게 12개 구역 전부를 조회한다',
    async (mode) => {
      const typenames = new Set<string>();
      server.use(
        http.get(WFS_URL, ({ request }) => {
          typenames.add(new URL(request.url).searchParams.get('TYPENAME') ?? '');
          return HttpResponse.json({ type: 'FeatureCollection', features: [] });
        }),
      );
      const allOff = Object.fromEntries(
        Object.keys(createInitialVisibility()).map((typename) => [typename, false]),
      );
      const { result } = setup(mode, allOff);

      await act(() => result.current.handlePointClick({ lat: 5, lng: 5 }));

      expect(typenames.size).toBe(12);
    },
  );

  // 이슈 #94: WMS 클릭 직후(응답 전) 폴리곤 모드로 바꾸면 뒤늦게 도착한 결과가 안내 박스를 열던 문제.
  it('WMS 클릭 조회 중에 폴리곤 모드로 바꾸면 뒤늦게 도착한 결과로 안내를 열지 않는다', async () => {
    const square = [
      [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
      ],
    ];
    server.use(
      http.get(WFS_URL, async () => {
        await delay(60);
        return HttpResponse.json({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: { type: 'MultiPolygon', coordinates: square },
            },
          ],
        });
      }),
    );
    const { result, rerender } = setup('wms');
    let click: Promise<void> = Promise.resolve();
    act(() => {
      click = result.current.handlePointClick({ lat: 5, lng: 5 });
    });

    rerender({ renderMode: 'polygon', visibility: createInitialVisibility() });
    await act(() => click);

    expect(result.current.selectedZone).toBeNull();
  });

  // 이슈 #114: 조회가 끝나기 전에도 클릭 지점에 대기 카드를 즉시 열고, 확정되면 구역 카드로 바꾼다.
  it('클릭하면 응답 전에 대기 카드를 열고, 확정되면 구역 카드로 바꾼다', async () => {
    const square = [
      [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
      ],
    ];
    server.use(
      http.get(WFS_URL, async () => {
        await delay(60);
        return HttpResponse.json({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: { type: 'MultiPolygon', coordinates: square },
            },
          ],
        });
      }),
    );
    const { result } = setup('wms');
    let click: Promise<void> = Promise.resolve();
    act(() => {
      click = result.current.handlePointClick({ lat: 5, lng: 5 });
    });

    expect(result.current.selectedZone).toMatchObject({
      position: { lat: 5, lng: 5 },
      zoneType: null,
      isPending: true,
    });

    await act(() => click);

    expect(result.current.selectedZone?.isPending).toBeFalsy();
    expect(result.current.selectedZone?.zoneType).not.toBeNull();
  });

  it('대기 카드를 닫으면 조회를 끊고 카드가 다시 열리지 않는다', async () => {
    server.use(
      http.get(WFS_URL, async () => {
        await delay(60);
        return HttpResponse.json({ type: 'FeatureCollection', features: [] });
      }),
    );
    const { result } = setup('wms');
    let click: Promise<void> = Promise.resolve();
    act(() => {
      click = result.current.handlePointClick({ lat: 5, lng: 5 });
    });
    expect(result.current.selectedZone?.isPending).toBe(true);

    act(() => result.current.clearZone());
    await act(() => click);

    expect(result.current.selectedZone).toBeNull();
  });

  it('조회가 실패하면 대기 카드를 닫는다', async () => {
    server.use(http.get(WFS_URL, () => HttpResponse.error()));
    const { result } = setup('wms');
    let click: Promise<void> = Promise.resolve();
    act(() => {
      click = result.current.handlePointClick({ lat: 5, lng: 5 });
    });
    expect(result.current.selectedZone?.isPending).toBe(true);

    await act(() => click);

    expect(result.current.selectedZone).toBeNull();
  });
});
