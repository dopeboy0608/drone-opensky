import { describe, expect, it } from 'vitest';

import {
  formatZoneAddressFull,
  formatZoneAddressSubline,
  formatZoneAddressTitle,
  stripRegionPrefix,
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

  it('성공하면 시·도와 시·군·구를 뺀 상세 주소를 준다', () => {
    expect(
      formatZoneAddressTitle({
        status: 'success',
        address: { primary: '서울특별시 관악구 보라매로5길 15', secondary: '지번' },
      }),
    ).toBe('보라매로5길 15');
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

describe('stripRegionPrefix', () => {
  it('시·도 약칭과 시·군·구를 제거한다', () => {
    expect(stripRegionPrefix('서울 관악구 보라매로5길 15')).toBe('보라매로5길 15');
    expect(stripRegionPrefix('경기 의정부시 호원동 산 92-15')).toBe('호원동 산 92-15');
  });

  it('시·도 정식 명칭(특별시, 광역시, 특별자치도 등)을 제거한다', () => {
    expect(stripRegionPrefix('서울특별시 동작구 보라매로5가길 23')).toBe('보라매로5가길 23');
    expect(stripRegionPrefix('강원특별자치도 춘천시 중앙로 1')).toBe('중앙로 1');
    expect(stripRegionPrefix('세종특별자치시 한누리대로 2130')).toBe('한누리대로 2130');
    expect(stripRegionPrefix('충청북도 청주시 상당구 상당로 155')).toBe('상당로 155');
  });

  it('시 아래에 구가 이어지면 둘 다 제거한다', () => {
    expect(stripRegionPrefix('경기 수원시 영통구 광교로 107')).toBe('광교로 107');
  });

  it('지번 주소는 동과 번지가 남는다', () => {
    expect(stripRegionPrefix('서울 관악구 신림동 1452-29')).toBe('신림동 1452-29');
  });

  it('행정구역만 있는 주소는 마지막 동이 남는다', () => {
    expect(stripRegionPrefix('서울특별시 종로구 청운효자동')).toBe('청운효자동');
  });

  it('제거하면 아무것도 남지 않으면 원문을 그대로 쓴다', () => {
    expect(stripRegionPrefix('서울특별시')).toBe('서울특별시');
    expect(stripRegionPrefix('서울특별시 종로구')).toBe('서울특별시 종로구');
  });

  it('시·도로 시작하지 않으면 바꾸지 않는다', () => {
    expect(stripRegionPrefix('보라매로5길 15')).toBe('보라매로5길 15');
  });
});

describe('formatZoneAddressFull', () => {
  it('성공하면 전체 주소를 준다', () => {
    expect(
      formatZoneAddressFull({
        status: 'success',
        address: { primary: '서울특별시 관악구 보라매로5길 15' },
      }),
    ).toBe('서울특별시 관악구 보라매로5길 15');
  });

  it('성공이 아니면 null이다', () => {
    expect(formatZoneAddressFull({ status: 'loading' })).toBeNull();
    expect(formatZoneAddressFull({ status: 'notFound' })).toBeNull();
  });
});
