import { describe, expect, it } from 'vitest';

import { getVisibleZoneTypes } from '@/features/airspace/utils/getVisibleZoneTypes';

describe('getVisibleZoneTypes', () => {
  it('켜진 typename만 한글 구역 종류 라벨 집합으로 변환한다', () => {
    const visible = getVisibleZoneTypes({
      lt_c_aisprhc: true,
      lt_c_aisctrc: false,
      lt_c_aisuac: true,
    });

    expect(visible).toEqual(new Set(['비행금지구역', '초경량비행장치공역(UA)']));
  });

  it('모두 꺼져 있으면 빈 집합을 반환한다', () => {
    expect(getVisibleZoneTypes({ lt_c_aisprhc: false })).toEqual(new Set());
  });

  it('라벨이 없는 키는 건너뛴다', () => {
    expect(getVisibleZoneTypes({ unknown: true, lt_c_aisprhc: true })).toEqual(
      new Set(['비행금지구역']),
    );
  });
});
