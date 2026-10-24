import { MAX_SEARCH_CANDIDATES } from '@/features/map/constants';
import type { SearchCandidate } from '@/features/map/types';

interface AddressSearchItem {
  address_name: string;
  x: string;
  y: string;
}

// SDK는 x=경도, y=위도를 문자열로 준다. 숫자가 아니면 지도 이동에 쓸 수 없어 후보에서 제외한다.
const parseCoordinates = (x: string, y: string) => {
  const lng = Number(x);
  const lat = Number(y);

  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

const toPlaceCandidate = (
  item: kakao.maps.services.PlacesSearchResultItem,
): SearchCandidate | null => {
  const coordinates = parseCoordinates(item.x, item.y);

  if (coordinates === null) {
    return null;
  }

  return {
    id: `place:${item.id}`,
    label: item.place_name,
    subLabel: item.road_address_name || item.address_name,
    ...coordinates,
  };
};

const toAddressCandidate = (item: AddressSearchItem): SearchCandidate | null => {
  const coordinates = parseCoordinates(item.x, item.y);

  if (coordinates === null) {
    return null;
  }

  return {
    id: `address:${item.x},${item.y}`,
    label: item.address_name,
    ...coordinates,
  };
};

const isCandidate = (candidate: SearchCandidate | null): candidate is SearchCandidate =>
  candidate !== null;

const searchPlaces = (keyword: string) =>
  new Promise<SearchCandidate[]>((resolve, reject) => {
    new kakao.maps.services.Places().keywordSearch(keyword, (result, status) => {
      if (status === kakao.maps.services.Status.OK) {
        resolve(result.map(toPlaceCandidate).filter(isCandidate));
      } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
        resolve([]);
      } else {
        reject(new Error('[map] 장소 검색 실패'));
      }
    });
  });

const searchAddresses = (keyword: string) =>
  new Promise<SearchCandidate[]>((resolve, reject) => {
    new kakao.maps.services.Geocoder().addressSearch(keyword, (result, status) => {
      if (status === kakao.maps.services.Status.OK) {
        resolve(result.map(toAddressCandidate).filter(isCandidate));
      } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
        resolve([]);
      } else {
        reject(new Error('[map] 주소 검색 실패'));
      }
    });
  });

const dedupe = (candidates: SearchCandidate[]) => {
  const seen = new Set<string>();

  return candidates.filter(({ label, lat, lng }) => {
    const key = `${label}|${lat}|${lng}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

// 도로명 주소가 keywordSearch만으로 잡히는지 확인하지 못해 addressSearch를 함께 호출한다.
// 한쪽만 실패하면 가능한 쪽의 결과를 돌려준다: 서제스트에서는 부분 결과가 빈 화면보다 낫다.
export const searchAddressCandidates = async (keyword: string): Promise<SearchCandidate[]> => {
  const trimmedKeyword = keyword.trim();

  if (trimmedKeyword === '') {
    return [];
  }

  const [addressResult, placeResult] = await Promise.allSettled([
    searchAddresses(trimmedKeyword),
    searchPlaces(trimmedKeyword),
  ]);

  if (addressResult.status === 'rejected' && placeResult.status === 'rejected') {
    throw placeResult.reason;
  }

  const addresses = addressResult.status === 'fulfilled' ? addressResult.value : [];
  const places = placeResult.status === 'fulfilled' ? placeResult.value : [];

  return dedupe([...addresses, ...places]).slice(0, MAX_SEARCH_CANDIDATES);
};
