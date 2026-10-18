import { TYPENAME_ZONE_LABELS } from '@/features/airspace/constants';

// 레이어는 feature.zoneType(한글 라벨)으로 필터링하고 스토어는 typename을 키로 쓰므로 여기서 변환한다.
export const getVisibleZoneTypes = (visibility: Record<string, boolean>): Set<string> =>
  new Set(
    Object.entries(visibility)
      .filter(([typename, isVisible]) => isVisible && typename in TYPENAME_ZONE_LABELS)
      .map(([typename]) => TYPENAME_ZONE_LABELS[typename]),
  );
