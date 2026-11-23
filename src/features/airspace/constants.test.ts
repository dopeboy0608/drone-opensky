import { describe, expect, it } from 'vitest';

import {
  AIRSPACE_ZONE_CONFIGS,
  AIRSPACE_ZONE_LABELS,
  ALL_ZONE_TYPENAMES,
  KOREA_BBOX,
  LAYER_STACK_ORDER,
  STACK_Z_INDEX_BY_LABEL,
  TYPENAME_ZONE_LABELS,
  ZONE_LEVEL_BY_LABEL,
} from '@/features/airspace/constants';

// 특성 테스트(이슈 #51 P1): 구조를 바꾸는 리팩터링이 값과 순서를 그대로 보존하는지 고정한다.
// typename의 선언 순서는 "위험도 우선순위"라는 의미를 가진다(WMS 타일 쌓임 순서, 클릭 판정 우선순위).
describe('airspace constants', () => {
  it('KOREA_BBOX는 경도,위도 순서의 고정 값이다', () => {
    expect(KOREA_BBOX).toBe('124,33,132,43');
  });

  it('TYPENAME_ZONE_LABELS는 12종을 위험도 높은 순서로 가진다', () => {
    expect(Object.entries(TYPENAME_ZONE_LABELS)).toEqual([
      ['lt_c_aisprhc', '비행금지구역'],
      ['lt_c_aistemp', '임시비행금지구역'],
      ['lt_c_aisdngc', '위험구역'],
      ['lt_c_aisresc', '비행제한구역'],
      ['lt_c_aisctrc', '관제권'],
      ['lt_c_aismoac', '군작전구역'],
      ['lt_c_aisaltc', '경계구역'],
      ['lt_c_aisatzc', '비행장교통구역'],
      ['lt_c_aisfldc', '경량항공기 이착륙장'],
      ['lt_c_wgisnpgug', '국립자연공원'],
      ['lt_c_aisuac', '초경량비행장치공역(UA)'],
      ['lt_c_aisdronezone', '드론시범사업구역'],
    ]);
  });

  it('AIRSPACE_ZONE_CONFIGS는 3개 그룹의 스타일과 typename 배열을 가진다', () => {
    expect(AIRSPACE_ZONE_CONFIGS).toEqual([
      {
        level: 'prohibited',
        typenames: ['lt_c_aisprhc', 'lt_c_aistemp'],
        color: '#FF4D4F',
        fillOpacity: 0.35,
        zIndex: 3,
      },
      {
        level: 'restricted',
        typenames: [
          'lt_c_aisdngc',
          'lt_c_aisresc',
          'lt_c_aisctrc',
          'lt_c_aismoac',
          'lt_c_aisaltc',
          'lt_c_aisatzc',
          'lt_c_aisfldc',
          'lt_c_wgisnpgug',
        ],
        color: '#8C8C8C',
        fillOpacity: 0.3,
        zIndex: 2,
      },
      {
        level: 'available',
        typenames: ['lt_c_aisuac', 'lt_c_aisdronezone'],
        color: '#52C41A',
        fillOpacity: 0.2,
        zIndex: 1,
      },
    ]);
  });

  // 국토부는 위험지역을 비행금지구역과 구분해 표시한다(#105). 금지로 분류하면 안내가 '원칙적 비행 금지'로 과장된다.
  it('위험구역은 비행 금지가 아니라 비행 제한으로 분류한다', () => {
    expect(ZONE_LEVEL_BY_LABEL['위험구역']).toBe('restricted');
  });

  it('AIRSPACE_ZONE_LABELS는 그룹별 한글 라벨이다', () => {
    expect(AIRSPACE_ZONE_LABELS).toEqual({
      prohibited: '비행 금지',
      restricted: '비행 제한',
      available: '비행 가능',
    });
  });

  // 두 구조가 어긋나면 그룹 체크박스와 개별 체크박스, 클릭 판정이 서로 다른 12종을 보게 된다.
  it('그룹별 typename을 이어 붙인 순서가 TYPENAME_ZONE_LABELS의 키 순서와 같다', () => {
    const fromConfigs = AIRSPACE_ZONE_CONFIGS.flatMap((config) => config.typenames);

    expect(fromConfigs).toEqual(Object.keys(TYPENAME_ZONE_LABELS));
  });

  // 색 쌓임(국토부 순서)과 클릭 판정(위험도 순)은 의미가 달라 따로 둔다(#112). 한쪽을 바꿀 때 다른 쪽이 따라 바뀌지 않아야 한다.
  describe('LAYER_STACK_ORDER (국토부 쌓임 순서, 바닥 → 위)', () => {
    it('12종 typename을 한 번씩만 모두 포함한다', () => {
      expect([...LAYER_STACK_ORDER].sort()).toEqual([...ALL_ZONE_TYPENAMES].sort());
    });

    it('원스톱 순서를 따른다', () => {
      expect(LAYER_STACK_ORDER).toEqual([
        'lt_c_aisaltc',
        'lt_c_aisctrc',
        'lt_c_aisprhc',
        'lt_c_aisatzc',
        'lt_c_aisresc',
        'lt_c_aismoac',
        'lt_c_aisuac',
        'lt_c_aisfldc',
        'lt_c_aisdngc',
        'lt_c_aistemp',
        'lt_c_wgisnpgug',
        'lt_c_aisdronezone',
      ]);
    });

    it('비행금지는 비행제한·UA보다 아래에 깔린다(원스톱과 같은 동작)', () => {
      const rank = (typename: string) => LAYER_STACK_ORDER.indexOf(typename);

      expect(rank('lt_c_aisprhc')).toBeLessThan(rank('lt_c_aisresc'));
      expect(rank('lt_c_aisprhc')).toBeLessThan(rank('lt_c_aisuac'));
    });

    it('클릭 판정 순서(위험도 순)와는 다르다', () => {
      expect(ALL_ZONE_TYPENAMES[0]).toBe('lt_c_aisprhc');
      expect([...LAYER_STACK_ORDER].reverse()).not.toEqual(ALL_ZONE_TYPENAMES);
    });
  });

  // 폴리곤 모드의 색 쌓임용 zIndex. 레벨(금지/제한/가능)별 zIndex로는 같은 레벨 안의 순서와 위험구역처럼 레벨이 내려간 종류를 못 정한다(#113).
  describe('STACK_Z_INDEX_BY_LABEL (폴리곤 쌓임 zIndex)', () => {
    it('쌓임 순서(바닥 → 위)대로 1부터 12까지 커진다', () => {
      const zIndexes = LAYER_STACK_ORDER.map(
        (typename) => STACK_Z_INDEX_BY_LABEL[TYPENAME_ZONE_LABELS[typename]],
      );

      expect(zIndexes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it('비행금지구역은 비행제한구역보다 아래, 위험구역은 비행제한구역보다 위다', () => {
      expect(STACK_Z_INDEX_BY_LABEL['비행금지구역']).toBeLessThan(
        STACK_Z_INDEX_BY_LABEL['비행제한구역'],
      );
      expect(STACK_Z_INDEX_BY_LABEL['위험구역']).toBeGreaterThan(
        STACK_Z_INDEX_BY_LABEL['비행제한구역'],
      );
    });
  });
});
