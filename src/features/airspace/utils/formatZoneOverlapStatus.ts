import type { SelectedZone } from '@/features/airspace/types';

// 겹친 구역 이름은 태그로 그리므로, 여기서는 태그만으로 전달되지 않는 상태 문구만 만든다.
// 확인이 끝나기 전에는 "없음"으로 단정하지 않는다.
export const formatZoneOverlapStatus = (overlap: SelectedZone['overlap']): string | null => {
  if (overlap === undefined) {
    return null;
  }

  const hasZones = overlap.zoneTypes.length > 0;

  if (!overlap.isComplete) {
    return hasZones ? '확인 중…' : '겹침 확인 중…';
  }

  if (overlap.hasFailure) {
    return hasZones ? '(일부 조회 실패)' : '겹침 확인 중 일부 조회에 실패했습니다.';
  }

  // 겹침이 없으면 태그가 하나뿐인 것으로 충분히 전달되어 문구를 쓰지 않는다(#101).
  return null;
};
