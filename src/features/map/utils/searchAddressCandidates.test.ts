import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { searchAddressCandidates } from '@/features/map/utils/searchAddressCandidates';
import {
  installKakaoMapsMock,
  kakaoServicesMock,
  uninstallKakaoMapsMock,
} from '@/test/mocks/kakaoMaps';

const makePlace = (overrides: Record<string, string> = {}) => ({
  id: '1',
  place_name: '서울시청',
  address_name: '서울 중구 태평로1가 31',
  road_address_name: '서울 중구 세종대로 110',
  x: '126.9779',
  y: '37.5663',
  ...overrides,
});

const makeAddress = (overrides: Record<string, string> = {}) => ({
  address_name: '서울 중구 세종대로 110',
  address_type: 'ROAD_ADDR',
  x: '126.9779',
  y: '37.5663',
  ...overrides,
});

describe('searchAddressCandidates', () => {
  beforeEach(() => {
    installKakaoMapsMock();
  });

  afterEach(() => {
    uninstallKakaoMapsMock();
  });

  it('두 API를 같은 (trim한) 검색어로 호출한다', async () => {
    await searchAddressCandidates('  세종대로 110  ');

    expect(kakaoServicesMock.keywordSearchCalls).toEqual(['세종대로 110']);
    expect(kakaoServicesMock.addressSearchCalls).toEqual(['세종대로 110']);
  });

  it('주소 결과를 앞에, 장소 결과를 뒤에 합친다', async () => {
    kakaoServicesMock.placesResponse = { status: 'OK', result: [makePlace()] };
    kakaoServicesMock.addressResponse = {
      status: 'OK',
      result: [makeAddress({ address_name: '서울 종로구 세종로 1', x: '126.97', y: '37.57' })],
    };

    const candidates = await searchAddressCandidates('세종');

    expect(candidates.map((candidate) => candidate.label)).toEqual([
      '서울 종로구 세종로 1',
      '서울시청',
    ]);
  });

  it('장소 후보: 도로명 주소를 subLabel로, 경도(x)·위도(y)를 숫자로 매핑한다', async () => {
    kakaoServicesMock.placesResponse = { status: 'OK', result: [makePlace()] };

    const [candidate] = await searchAddressCandidates('시청');

    expect(candidate).toEqual({
      id: 'place:1',
      label: '서울시청',
      subLabel: '서울 중구 세종대로 110',
      lat: 37.5663,
      lng: 126.9779,
    });
  });

  it('장소의 도로명 주소가 비어 있으면 지번 주소를 subLabel로 쓴다', async () => {
    kakaoServicesMock.placesResponse = {
      status: 'OK',
      result: [makePlace({ road_address_name: '' })],
    };

    const [candidate] = await searchAddressCandidates('시청');

    expect(candidate.subLabel).toBe('서울 중구 태평로1가 31');
  });

  it('주소 후보: subLabel 없이 좌표 기반 id로 매핑한다', async () => {
    kakaoServicesMock.addressResponse = { status: 'OK', result: [makeAddress()] };

    const [candidate] = await searchAddressCandidates('세종대로 110');

    expect(candidate).toEqual({
      id: 'address:126.9779,37.5663',
      label: '서울 중구 세종대로 110',
      lat: 37.5663,
      lng: 126.9779,
    });
  });

  it('label과 좌표가 모두 같은 후보는 먼저 나온 것만 남긴다', async () => {
    kakaoServicesMock.placesResponse = {
      status: 'OK',
      result: [
        makePlace({ id: '1', place_name: '서울 중구 세종대로 110' }),
        makePlace({ id: '2' }),
      ],
    };
    kakaoServicesMock.addressResponse = { status: 'OK', result: [makeAddress()] };

    const candidates = await searchAddressCandidates('세종대로 110');

    expect(candidates.map((candidate) => candidate.id)).toEqual([
      'address:126.9779,37.5663',
      'place:2',
    ]);
  });

  it('최대 10개까지만 반환한다', async () => {
    kakaoServicesMock.placesResponse = {
      status: 'OK',
      result: Array.from({ length: 15 }, (_, index) =>
        makePlace({ id: String(index), place_name: `장소${index}`, x: String(127 + index) }),
      ),
    };

    expect(await searchAddressCandidates('장소')).toHaveLength(10);
  });

  it('좌표가 숫자로 변환되지 않는 후보는 제외한다', async () => {
    kakaoServicesMock.placesResponse = {
      status: 'OK',
      result: [makePlace({ id: '1', x: 'abc' }), makePlace({ id: '2', place_name: '정상' })],
    };

    const candidates = await searchAddressCandidates('시청');

    expect(candidates.map((candidate) => candidate.label)).toEqual(['정상']);
  });

  it.each(['', '   '])(
    '빈 검색어(%j)면 API를 호출하지 않고 빈 배열을 반환한다',
    async (keyword) => {
      expect(await searchAddressCandidates(keyword)).toEqual([]);
      expect(kakaoServicesMock.keywordSearchCalls).toHaveLength(0);
      expect(kakaoServicesMock.addressSearchCalls).toHaveLength(0);
    },
  );

  it('두 API 모두 ZERO_RESULT면 빈 배열을 반환한다', async () => {
    expect(await searchAddressCandidates('없는곳')).toEqual([]);
  });

  it('한쪽만 ERROR여도 다른 쪽 결과를 반환한다', async () => {
    kakaoServicesMock.placesResponse = { status: 'ERROR', result: [] };
    kakaoServicesMock.addressResponse = { status: 'OK', result: [makeAddress()] };

    const candidates = await searchAddressCandidates('세종대로 110');

    expect(candidates).toHaveLength(1);
  });

  it('두 API 모두 ERROR면 reject한다', async () => {
    kakaoServicesMock.placesResponse = { status: 'ERROR', result: [] };
    kakaoServicesMock.addressResponse = { status: 'ERROR', result: [] };

    await expect(searchAddressCandidates('시청')).rejects.toThrow();
  });
});
