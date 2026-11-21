import type { AddressState } from '@/types/address';

// 카카오가 약칭(서울, 경기)과 정식 명칭(서울특별시, 경기도)을 섞어 돌려줘서 둘 다 받는다.
const SIDO_PATTERN =
  /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도)(특별시|광역시|특별자치시|특별자치도|도)?$/;

// 지도로 이미 알 수 있는 시·도와 시·군·구는 좁은 제목에서 빼고 상세 주소만 남긴다. 시·군·구는 `수원시 영통구`처럼
// 두 단계가 이어질 수 있어 연속된 토큰을 모두 뺀다. 시·도로 시작하지 않는 문자열은 이미 상세 주소로 보고 건드리지 않는다.
export const stripRegionPrefix = (address: string): string => {
  const tokens = address.trim().split(/\s+/);

  if (!SIDO_PATTERN.test(tokens[0] ?? '')) {
    return address;
  }

  let index = 1;
  while (index < tokens.length && /[시군구]$/.test(tokens[index])) {
    index += 1;
  }

  // 행정구역만 있어 뺄 것이 남지 않으면 빈 제목이 되므로 원문을 쓴다.
  return index >= tokens.length ? address : tokens.slice(index).join(' ');
};

// 카드 제목에 쓰는 주소 문구. 사용자는 구역이 아니라 "위치"를 눌렀으므로 제목은 그 위치의 주소다(#101).
export const formatZoneAddressTitle = (address: AddressState): string => {
  switch (address.status) {
    case 'loading':
      return '주소 조회 중…';
    case 'success':
      return stripRegionPrefix(address.address.primary);
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

// 제목에서 지역을 뺀 대신 카드 맨 아래에 보여 주는 전체 주소. 줄바꿈은 표시 쪽에서 처리한다.
export const formatZoneAddressFull = (address: AddressState): string | null =>
  address.status === 'success' ? address.address.primary : null;
