import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AIRSPACE_CACHE_DB_NAME,
  AIRSPACE_CACHE_STORE_NAME,
  CACHE_SCHEMA_VERSION,
  readZoneCache,
  writeZoneCache,
} from '@/features/airspace/cache/airspaceCacheStore';
import type { VWorldFeatureCollection } from '@/features/airspace/types';

const makeCollection = (zoneType: string): VWorldFeatureCollection => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'MultiPolygon', coordinates: [[[[127, 37]]]] },
      properties: { id: 1 },
      zoneType,
    },
  ],
});

// 스토어 모듈을 거치지 않고 저장소에 직접 값을 넣어, 손상/구버전 데이터를 재현한다.
const putRawValue = (key: string, value: unknown) =>
  new Promise<void>((resolve, reject) => {
    const open = indexedDB.open(AIRSPACE_CACHE_DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(AIRSPACE_CACHE_STORE_NAME);
    open.onsuccess = () => {
      const tx = open.result.transaction(AIRSPACE_CACHE_STORE_NAME, 'readwrite');
      tx.objectStore(AIRSPACE_CACHE_STORE_NAME).put(value, key);
      tx.oncomplete = () => {
        open.result.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    open.onerror = () => reject(open.error);
  });

const getRawValue = (key: string) =>
  new Promise<unknown>((resolve, reject) => {
    const open = indexedDB.open(AIRSPACE_CACHE_DB_NAME, 1);
    open.onsuccess = () => {
      const request = open.result
        .transaction(AIRSPACE_CACHE_STORE_NAME)
        .objectStore(AIRSPACE_CACHE_STORE_NAME)
        .get(key);
      request.onsuccess = () => {
        open.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    };
    open.onerror = () => reject(open.error);
  });

describe('airspaceCacheStore', () => {
  beforeEach(() => {
    // 테스트 간 저장 내용이 새지 않도록 매번 새 IndexedDB를 쓴다.
    globalThis.indexedDB = new IDBFactory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('쓴 데이터와 savedAt을 그대로 읽는다', async () => {
    const data = makeCollection('비행금지구역');

    await writeZoneCache('prohibited', data, 1_000);

    expect(await readZoneCache('prohibited')).toEqual({ savedAt: 1_000, data });
  });

  it('savedAt을 생략하면 현재 시각으로 저장한다', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000);

    await writeZoneCache('available', makeCollection('드론시범사업구역'));

    expect((await readZoneCache('available'))?.savedAt).toBe(5_000);
  });

  it('저장된 값이 없으면 null을 반환한다', async () => {
    expect(await readZoneCache('restricted')).toBeNull();
  });

  it('만료 여부와 무관하게 오래된 savedAt도 그대로 돌려준다', async () => {
    const data = makeCollection('관제권');

    await writeZoneCache('restricted', data, 1);

    expect(await readZoneCache('restricted')).toEqual({ savedAt: 1, data });
  });

  it('같은 level에 다시 쓰면 덮어쓴다', async () => {
    await writeZoneCache('prohibited', makeCollection('옛날'), 1);
    const next = makeCollection('최신');

    await writeZoneCache('prohibited', next, 2);

    expect(await readZoneCache('prohibited')).toEqual({ savedAt: 2, data: next });
  });

  it('그룹끼리 서로 영향을 주지 않는다', async () => {
    const prohibited = makeCollection('비행금지구역');
    const available = makeCollection('드론시범사업구역');

    await writeZoneCache('prohibited', prohibited, 1);
    await writeZoneCache('available', available, 2);

    expect(await readZoneCache('prohibited')).toEqual({ savedAt: 1, data: prohibited });
    expect(await readZoneCache('available')).toEqual({ savedAt: 2, data: available });
    expect(await readZoneCache('restricted')).toBeNull();
  });

  it('version이 다르면 null을 반환하고 항목을 삭제한다', async () => {
    await putRawValue('airspaceZones:prohibited', {
      version: CACHE_SCHEMA_VERSION + 1,
      savedAt: 1,
      data: makeCollection('옛 스키마'),
    });

    expect(await readZoneCache('prohibited')).toBeNull();
    expect(await getRawValue('airspaceZones:prohibited')).toBeUndefined();
  });

  it.each([
    ['객체가 아닌 값', 'broken'],
    ['savedAt이 숫자가 아님', { version: CACHE_SCHEMA_VERSION, savedAt: 'x', data: {} }],
    [
      'data가 FeatureCollection이 아님',
      { version: CACHE_SCHEMA_VERSION, savedAt: 1, data: { features: [] } },
    ],
    [
      'features가 배열이 아님',
      { version: CACHE_SCHEMA_VERSION, savedAt: 1, data: { type: 'FeatureCollection' } },
    ],
  ])('손상된 값(%s)이면 null을 반환하고 항목을 삭제한다', async (_label, value) => {
    await putRawValue('airspaceZones:restricted', value);

    expect(await readZoneCache('restricted')).toBeNull();
    expect(await getRawValue('airspaceZones:restricted')).toBeUndefined();
  });

  describe('IndexedDB를 쓸 수 없을 때', () => {
    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('indexedDB가 없으면 읽기는 null, 쓰기는 조용히 무시한다', async () => {
      vi.stubGlobal('indexedDB', undefined);

      await expect(readZoneCache('prohibited')).resolves.toBeNull();
      await expect(writeZoneCache('prohibited', makeCollection('x'))).resolves.toBeUndefined();
      expect(console.warn).toHaveBeenCalled();
    });

    it('열기에 실패해도 예외를 던지지 않는다', async () => {
      vi.stubGlobal('indexedDB', {
        open: () => {
          throw new Error('SecurityError');
        },
      });

      await expect(readZoneCache('prohibited')).resolves.toBeNull();
      await expect(writeZoneCache('prohibited', makeCollection('x'))).resolves.toBeUndefined();
    });

    it('쓰기 트랜잭션이 실패해도 예외를 던지지 않는다', async () => {
      // 구조적 복제가 불가능한 값(함수)을 넣으면 put에서 DataCloneError가 난다.
      const uncloneable = { type: 'FeatureCollection', features: [], fn: () => {} };

      await expect(
        writeZoneCache('prohibited', uncloneable as unknown as VWorldFeatureCollection),
      ).resolves.toBeUndefined();
      expect(await readZoneCache('prohibited')).toBeNull();
    });
  });
});
