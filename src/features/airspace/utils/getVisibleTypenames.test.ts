import { describe, expect, it } from 'vitest';

import { LAYER_STACK_ORDER } from '@/features/airspace/constants';
import { getVisibleTypenames } from '@/features/airspace/utils/getVisibleTypenames';

describe('getVisibleTypenames', () => {
  it('켜진 typename만 반환한다', () => {
    expect(
      getVisibleTypenames({ lt_c_aisprhc: true, lt_c_aisctrc: false, lt_c_aisuac: true }),
    ).toEqual(['lt_c_aisprhc', 'lt_c_aisuac']);
  });

  // WMS는 LAYERS의 앞 레이어를 아래에 그린다(2026-11-23 VWorld 실측). 입력(필터 상태) 순서와 무관하게 쌓임 순서(바닥 → 위)여야 한다(#113).
  it('입력 순서와 무관하게 쌓임 순서(바닥 → 위)로 반환한다', () => {
    expect(
      getVisibleTypenames({ lt_c_aisuac: true, lt_c_aisresc: true, lt_c_aisprhc: true }),
    ).toEqual(['lt_c_aisprhc', 'lt_c_aisresc', 'lt_c_aisuac']);
  });

  it('전부 켜져 있으면 LAYER_STACK_ORDER와 같다', () => {
    const visibility = Object.fromEntries(
      [...LAYER_STACK_ORDER].reverse().map((typename) => [typename, true]),
    );

    expect(getVisibleTypenames(visibility)).toEqual([...LAYER_STACK_ORDER]);
  });

  it('모두 꺼져 있으면 빈 배열을 반환한다', () => {
    expect(getVisibleTypenames({ lt_c_aisprhc: false })).toEqual([]);
  });

  it('라벨이 없는 알 수 없는 키는 WMS LAYERS에 넣지 않는다', () => {
    expect(getVisibleTypenames({ unknown: true, lt_c_aisprhc: true })).toEqual(['lt_c_aisprhc']);
  });
});
