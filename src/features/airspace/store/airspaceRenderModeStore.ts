import { create } from 'zustand';

export type AirspaceRenderMode = 'polygon' | 'wms';

interface AirspaceRenderModeState {
  renderMode: AirspaceRenderMode;
  setRenderMode: (renderMode: AirspaceRenderMode) => void;
}

// 상태는 메모리에만 둔다(새로고침 시 폴리곤). 기본 모드는 #76에서 폴리곤 유지로 결정했다(WMS는 표기가 국토부에 더 가깝지만 클릭 응답이 느려 클릭 응답성을 우선).
export const useAirspaceRenderModeStore = create<AirspaceRenderModeState>((set) => ({
  renderMode: 'polygon',
  setRenderMode: (renderMode) => set({ renderMode }),
}));
