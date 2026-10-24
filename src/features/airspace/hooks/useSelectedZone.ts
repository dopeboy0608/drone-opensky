import { useCallback, useEffect, useState } from 'react';

import type { SelectedZone } from '@/features/airspace/types';

// 선택 상태를 폴리곤 레이어 밖에 두는 이유: 레이어 안에 있으면 오버레이를 열고 닫을 때마다
// 레이어의 모든 폴리곤이 리렌더되어 Polygon.setPath가 반복 호출된다 (이슈 #47).
export const useSelectedZone = (visibleZoneTypes?: ReadonlySet<string>) => {
  const [selectedZone, setSelectedZone] = useState<SelectedZone | null>(null);

  const clearZone = useCallback(() => setSelectedZone(null), []);

  const selectedZoneType = selectedZone?.zoneType;

  // 숨겨진 종류의 오버레이가 남아 있다가 다시 켤 때 저절로 되살아나지 않도록 상태를 비운다.
  useEffect(() => {
    if (selectedZoneType && visibleZoneTypes && !visibleZoneTypes.has(selectedZoneType)) {
      setSelectedZone(null);
    }
  }, [selectedZoneType, visibleZoneTypes]);

  return { selectedZone, selectZone: setSelectedZone, clearZone };
};
