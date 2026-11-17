import { describe, expect, it } from 'vitest';

import {
  formatZoneAddressSubline,
  formatZoneAddressTitle,
} from '@/features/airspace/utils/formatZoneAddress';

describe('formatZoneAddressTitle', () => {
  it('주소 상태가 없으면 기본 제목을 준다', () => {
    expect(formatZoneAddressTitle({ status: 'idle' })).toBe('공역 안내');
  });

  it('조회 중, 못 찾음, 실패는 각각 안내 문구를 준다', () => {
    expect(formatZoneAddressTitle({ status: 'loading' })).toBe('주소 조회 중…');
    expect(formatZoneAddressTitle({ status: 'notFound' })).toBe('주소를 찾지 못했습니다.');
    expect(formatZoneAddressTitle({ status: 'error' })).toBe('주소를 불러오지 못했습니다.');
  });

  it('성공하면 주 주소(도로명 우선)를 준다', () => {
    expect(
      formatZoneAddressTitle({
        status: 'success',
        address: { primary: '도로명', secondary: '지번' },
      }),
    ).toBe('도로명');
  });
});

describe('formatZoneAddressSubline', () => {
  it('지번이 있을 때만 보조 줄을 만든다', () => {
    expect(
      formatZoneAddressSubline({
        status: 'success',
        address: { primary: '도로명', secondary: '지번 주소' },
      }),
    ).toBe('지번 지번 주소');
    expect(
      formatZoneAddressSubline({ status: 'success', address: { primary: '지번만' } }),
    ).toBeNull();
    expect(formatZoneAddressSubline({ status: 'loading' })).toBeNull();
  });
});
