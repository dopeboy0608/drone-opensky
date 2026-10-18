import { create } from 'zustand';

import { TYPENAME_ZONE_LABELS } from '@/features/airspace/constants';

interface AirspaceFilterState {
  visibility: Record<string, boolean>;
  toggleZone: (typename: string) => void;
  setAllZones: (isVisible: boolean) => void;
}

export const createInitialVisibility = (): Record<string, boolean> =>
  Object.fromEntries(Object.keys(TYPENAME_ZONE_LABELS).map((typename) => [typename, true]));

// 상태는 메모리에만 둔다(새로고침 시 전체 켜짐). 영속화는 이슈 #25 범위 밖.
export const useAirspaceFilterStore = create<AirspaceFilterState>((set) => ({
  visibility: createInitialVisibility(),
  toggleZone: (typename) =>
    set((state) => {
      // 알 수 없는 typename으로 키가 새로 생기면 이후 지도 필터가 의도치 않게 동작할 수 있어 무시한다.
      if (!(typename in state.visibility)) {
        return state;
      }
      return { visibility: { ...state.visibility, [typename]: !state.visibility[typename] } };
    }),
  setAllZones: (isVisible) =>
    set((state) => ({
      visibility: Object.fromEntries(
        Object.keys(state.visibility).map((typename) => [typename, isVisible]),
      ),
    })),
}));
