import type { AddressState } from '@/types/address';

// 카드 제목에 쓰는 주소 문구. 사용자는 구역이 아니라 "위치"를 눌렀으므로 제목은 그 위치의 주소다(#101).
export const formatZoneAddressTitle = (address: AddressState): string => {
  switch (address.status) {
    case 'loading':
      return '주소 조회 중…';
    case 'success':
      return address.address.primary;
    case 'notFound':
      return '주소를 찾지 못했습니다.';
    case 'error':
      return '주소를 불러오지 못했습니다.';
    default:
      return '공역 안내';
  }
};

// 도로명이 제목일 때 함께 보여 주는 지번. 없으면 null.
export const formatZoneAddressSubline = (address: AddressState): string | null =>
  address.status === 'success' && address.address.secondary
    ? `지번 ${address.address.secondary}`
    : null;
