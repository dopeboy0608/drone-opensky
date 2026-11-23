import { LAYER_STACK_ORDER, TYPENAME_ZONE_LABELS } from '@/features/airspace/constants';

// WMS LAYERS용 typename 목록이다. 라벨이 정의된 12종만 허용해, 필터 상태에 섞인 알 수 없는 키가
// 외부 API 요청 파라미터로 그대로 나가지 않게 한다.
// 순서는 필터 상태가 아니라 쌓임 순서(바닥 → 위)다. VWorld WMS는 LAYERS의 앞 레이어를 아래에 그리고(2026-11-23 실측),
// 이 목록을 4개씩 나눈 슬롯도 앞 슬롯이 아래에 오기 때문이다(#113).
export const getVisibleTypenames = (visibility: Record<string, boolean>): string[] =>
  LAYER_STACK_ORDER.filter((typename) => visibility[typename] && typename in TYPENAME_ZONE_LABELS);
