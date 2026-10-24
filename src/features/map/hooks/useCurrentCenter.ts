import { useCallback, useEffect, useRef, useState } from 'react';

import { DEFAULT_CENTER } from '@/features/map/constants';
import type { MapPosition } from '@/features/map/types';

interface UseCurrentCenterReturn {
  position: MapPosition;
  hasLocation: boolean;
  /** 최초 자동 조회(마운트 시)가 성공/실패 여부와 무관하게 한 번 끝났는지 여부. */
  hasResolvedInitial: boolean;
  refetchLocation: (options?: {
    onSuccess?: (position: MapPosition) => void;
    onError?: () => void;
  }) => void;
}

export const useCurrentCenter = (): UseCurrentCenterReturn => {
  const [position, setPosition] = useState(DEFAULT_CENTER);
  const [hasLocation, setHasLocation] = useState(false);
  const [hasResolvedInitial, setHasResolvedInitial] = useState(false);

  // 마운트 시 자동 실행되는 최초 조회와, 버튼 클릭으로 실행되는 이후 재조회를 구분하기 위한 플래그.
  const isFirstFetchRef = useRef(true);

  const refetchLocation = useCallback(
    (options?: { onSuccess?: (position: MapPosition) => void; onError?: () => void }) => {
      const markResolved = () => {
        if (isFirstFetchRef.current) {
          isFirstFetchRef.current = false;
          setHasResolvedInitial(true);
        }
      };

      if (!navigator.geolocation) {
        options?.onError?.();
        markResolved();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (result) => {
          const nextPosition = {
            lat: result.coords.latitude,
            lng: result.coords.longitude,
          };
          setPosition(nextPosition);
          setHasLocation(true);
          markResolved();
          // 방금 조회한 좌표를 그대로 넘겨야 한다 — position state는 비동기라
          // 호출 직후 currentPosition을 참조하면 갱신 전 값을 읽는다 (이슈 #37).
          options?.onSuccess?.(nextPosition);
        },
        () => {
          // 실패 시 마커는 숨기되, 위치는 기존 값(최초에는 DEFAULT_CENTER) 그대로 유지한다.
          setHasLocation(false);
          options?.onError?.();
          markResolved();
        },
      );
    },
    [],
  );

  // 최초 마운트 시 한 번 자동으로 위치를 조회한다(이후 재조회는 버튼 클릭으로 refetchLocation 직접 호출).
  useEffect(() => {
    refetchLocation();
  }, [refetchLocation]);

  return { position, hasLocation, hasResolvedInitial, refetchLocation };
};
