import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSelectedZone } from '@/features/airspace/hooks/useSelectedZone';

import type { SelectedZone } from '@/features/airspace/types';

const zone: SelectedZone = { position: { lat: 37, lng: 127 }, zoneType: '관제권' };

describe('useSelectedZone', () => {
  it('구역을 선택하고 닫을 수 있다', () => {
    const { result } = renderHook(() => useSelectedZone());

    act(() => result.current.selectZone(zone));
    expect(result.current.selectedZone).toEqual(zone);

    act(() => result.current.clearZone());
    expect(result.current.selectedZone).toBeNull();
  });

  it('selectZone/clearZone은 리렌더 간 참조가 유지된다', () => {
    const { result, rerender } = renderHook(() => useSelectedZone());
    const { selectZone, clearZone } = result.current;

    act(() => result.current.selectZone(zone));
    rerender();

    expect(result.current.selectZone).toBe(selectZone);
    expect(result.current.clearZone).toBe(clearZone);
  });

  it('선택된 종류가 숨겨지면 닫히고, 다시 켜도 다시 열리지 않는다', () => {
    const { result, rerender } = renderHook(
      ({ visible }: { visible?: ReadonlySet<string> }) => useSelectedZone(visible),
      { initialProps: { visible: new Set(['관제권']) } },
    );

    act(() => result.current.selectZone(zone));
    expect(result.current.selectedZone).toEqual(zone);

    rerender({ visible: new Set() });
    expect(result.current.selectedZone).toBeNull();

    rerender({ visible: new Set(['관제권']) });
    expect(result.current.selectedZone).toBeNull();
  });
});
