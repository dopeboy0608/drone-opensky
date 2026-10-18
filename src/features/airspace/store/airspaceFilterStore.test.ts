import { beforeEach, describe, expect, it } from 'vitest';

import {
  createInitialVisibility,
  useAirspaceFilterStore,
} from '@/features/airspace/store/airspaceFilterStore';

import { TYPENAME_ZONE_LABELS } from '@/features/airspace/constants';

describe('airspaceFilterStore', () => {
  beforeEach(() => {
    useAirspaceFilterStore.setState({ visibility: createInitialVisibility() });
  });

  it('초기값은 TYPENAME_ZONE_LABELS의 모든 typename이 켜짐이다', () => {
    const { visibility } = useAirspaceFilterStore.getState();

    expect(Object.keys(visibility).sort()).toEqual(Object.keys(TYPENAME_ZONE_LABELS).sort());
    expect(Object.values(visibility).every(Boolean)).toBe(true);
  });

  it('toggleZone은 해당 typename만 반전한다', () => {
    useAirspaceFilterStore.getState().toggleZone('lt_c_aisctrc');

    const { visibility } = useAirspaceFilterStore.getState();
    expect(visibility.lt_c_aisctrc).toBe(false);
    expect(visibility.lt_c_aisprhc).toBe(true);
  });

  it('같은 typename을 두 번 토글하면 원래 값으로 돌아온다', () => {
    const { toggleZone } = useAirspaceFilterStore.getState();

    toggleZone('lt_c_aisuac');
    toggleZone('lt_c_aisuac');

    expect(useAirspaceFilterStore.getState().visibility.lt_c_aisuac).toBe(true);
  });

  it('알 수 없는 typename은 무시하고 새 키를 만들지 않는다', () => {
    useAirspaceFilterStore.getState().toggleZone('unknown');

    expect(useAirspaceFilterStore.getState().visibility).not.toHaveProperty('unknown');
  });

  it('setAllZones(false)는 모든 typename을 끄고 키 집합은 유지한다', () => {
    useAirspaceFilterStore.getState().toggleZone('lt_c_aisctrc');

    useAirspaceFilterStore.getState().setAllZones(false);

    const { visibility } = useAirspaceFilterStore.getState();
    expect(Object.keys(visibility).sort()).toEqual(Object.keys(TYPENAME_ZONE_LABELS).sort());
    expect(Object.values(visibility).every((isVisible) => !isVisible)).toBe(true);
  });

  it('setAllZones(true)는 모든 typename을 켠다', () => {
    useAirspaceFilterStore.getState().setAllZones(false);

    useAirspaceFilterStore.getState().setAllZones(true);

    expect(Object.values(useAirspaceFilterStore.getState().visibility).every(Boolean)).toBe(true);
  });
});
