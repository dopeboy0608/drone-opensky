import { describe, expect, it } from 'vitest';

import { formatZoneOverlapStatus } from '@/features/airspace/utils/formatZoneOverlapStatus';

describe('formatZoneOverlapStatus', () => {
  it('정보가 없으면 문구를 만들지 않는다', () => {
    expect(formatZoneOverlapStatus(undefined)).toBeNull();
  });

  it('확인 중에는 없음으로 단정하지 않는다', () => {
    expect(formatZoneOverlapStatus({ zoneTypes: [], isComplete: false, hasFailure: false })).toBe(
      '겹침 확인 중…',
    );
  });

  it('확인 중에 이미 찾은 겹침이 있으면 진행 중임만 덧붙인다', () => {
    expect(
      formatZoneOverlapStatus({ zoneTypes: ['관제권'], isComplete: false, hasFailure: false }),
    ).toBe('확인 중…');
  });

  it('끝났고 겹침이 없으면 태그 하나로 충분해 문구가 없다', () => {
    expect(
      formatZoneOverlapStatus({ zoneTypes: [], isComplete: true, hasFailure: false }),
    ).toBeNull();
  });

  it('겹친 구역이 있고 정상 종료면 태그만으로 충분해 문구가 없다', () => {
    expect(
      formatZoneOverlapStatus({ zoneTypes: ['관제권'], isComplete: true, hasFailure: false }),
    ).toBeNull();
  });

  it('일부 조회가 실패했으면 완전하지 않다고 밝힌다', () => {
    expect(formatZoneOverlapStatus({ zoneTypes: [], isComplete: true, hasFailure: true })).toBe(
      '겹침 확인 중 일부 조회에 실패했습니다.',
    );
    expect(
      formatZoneOverlapStatus({ zoneTypes: ['관제권'], isComplete: true, hasFailure: true }),
    ).toBe('(일부 조회 실패)');
  });
});
