import type { AirspaceZoneLevel, VWorldFeatureCollection } from '@/features/airspace/types';

export const AIRSPACE_CACHE_DB_NAME = 'drone-opensky-airspace';
export const AIRSPACE_CACHE_STORE_NAME = 'zoneGroups';
// 저장 값의 형태나 구역 구성(typenames, 태깅 규칙)이 바뀌면 올려서 옛 캐시를 버린다.
export const CACHE_SCHEMA_VERSION = 1;

const DB_VERSION = 1;

export interface ZoneCacheEntry {
  savedAt: number;
  data: VWorldFeatureCollection;
}

interface StoredZoneCache extends ZoneCacheEntry {
  version: number;
}

const getCacheKey = (level: AirspaceZoneLevel) => `airspaceZones:${level}`;

const isStoredZoneCache = (value: unknown): value is StoredZoneCache => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const { version, savedAt, data } = value as Partial<StoredZoneCache>;

  return (
    version === CACHE_SCHEMA_VERSION &&
    typeof savedAt === 'number' &&
    Number.isFinite(savedAt) &&
    typeof data === 'object' &&
    data !== null &&
    data.type === 'FeatureCollection' &&
    Array.isArray(data.features)
  );
};

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    // 시크릿 모드 등에서 indexedDB가 없거나 open이 동기적으로 던질 수 있어 Promise 안에서 처리한다.
    const request = globalThis.indexedDB.open(AIRSPACE_CACHE_DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(AIRSPACE_CACHE_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transactionDone = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

// 연결을 모듈 수준에서 캐싱하지 않고 호출마다 열고 닫는다. 읽기/쓰기는 앱 시작과 그룹 조회 성공 시
// 그룹당 한 번뿐이라 open 비용이 무시할 만하고, 닫지 않은 연결이 탭 재로드/버전 업그레이드를
// 막는(blocked) 상황을 피할 수 있다.
const withStore = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, transaction: IDBTransaction) => Promise<T>,
): Promise<T> => {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(AIRSPACE_CACHE_STORE_NAME, mode);
    const store = transaction.objectStore(AIRSPACE_CACHE_STORE_NAME);
    return await run(store, transaction);
  } finally {
    database.close();
  }
};

// 캐시는 어디까지나 재다운로드 절감용 최적화라, 저장소 문제가 지도 표시를 막으면 안 된다.
// 모든 실패는 경고만 남기고 "캐시 없음"으로 취급한다.
const warn = (action: string, error: unknown) => {
  console.warn(`[airspace] IndexedDB 캐시 ${action} 실패 (무시하고 계속 진행)`, error);
};

export const readZoneCache = async (level: AirspaceZoneLevel): Promise<ZoneCacheEntry | null> => {
  const key = getCacheKey(level);

  try {
    const stored = await withStore('readonly', (store) => requestToPromise(store.get(key)));

    if (stored === undefined) {
      return null;
    }

    if (isStoredZoneCache(stored)) {
      return { savedAt: stored.savedAt, data: stored.data };
    }
  } catch (error) {
    warn('읽기', error);
    return null;
  }

  // 버전 불일치나 손상된 값은 다음 쓰기 전까지 계속 파싱 비용만 들므로 지운다.
  try {
    await withStore('readwrite', (store, transaction) => {
      store.delete(key);
      return transactionDone(transaction);
    });
  } catch (error) {
    warn('손상 항목 삭제', error);
  }

  return null;
};

export const writeZoneCache = async (
  level: AirspaceZoneLevel,
  data: VWorldFeatureCollection,
  savedAt: number = Date.now(),
): Promise<void> => {
  const value: StoredZoneCache = { version: CACHE_SCHEMA_VERSION, savedAt, data };

  try {
    await withStore('readwrite', (store, transaction) => {
      store.put(value, getCacheKey(level));
      return transactionDone(transaction);
    });
  } catch (error) {
    warn('쓰기', error);
  }
};
