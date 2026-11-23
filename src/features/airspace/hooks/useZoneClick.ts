import { App as AntdApp } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

import { findZonesAtPoint } from '@/features/airspace/api/findZonesAtPoint';
import { useLatestRequest } from '@/features/airspace/hooks/useLatestRequest';

import { ERROR_TOAST_DURATION_SECONDS } from '@/constants/toast';
import type { SelectedZone } from '@/features/airspace/types';

// 폴리곤 클릭과 지도 클릭이 한 번의 사용자 클릭에서 모두 올 수 있다(카카오가 폴리곤 위 클릭을 지도 클릭으로도 전달하는지는
// 브라우저에서 확인되지 않았다). 같은 지점의 연속 호출을 하나로 합치지 않으면 조회가 두 배로 나간다(12건 → 24건).
// 시간 창을 짧게 둔 이유: 사용자가 일부러 같은 곳을 다시 누른 것까지 막지 않으려는 것이다.
const DUPLICATE_CLICK_WINDOW_MS = 300;
// 같은 클릭이라도 두 이벤트의 좌표가 소수 아래에서 미세하게 다를 수 있어 허용 오차를 둔다(약 1m).
const DUPLICATE_CLICK_TOLERANCE_DEGREES = 1e-5;

interface UseZoneClickParams {
  enabled: boolean;
  // 값이 바뀌면 진행 중인 조회를 끊는다(표시 방식을 바꾸면 이전 방식에서 낸 클릭의 결과는 의미가 없다, #94).
  resetKey?: unknown;
  typenames: string[];
  selectZone: (zone: SelectedZone) => void;
  clearZone: () => void;
}

// 지도 클릭과 폴리곤 클릭이 같은 방식으로 구역을 정하게 한다: 클릭 지점만 WFS로 조회해 우선순위가 가장 높은 구역을 안내한다.
// 폴리곤 모드는 같은 레벨 안에서 맨 위에 그려진 폴리곤이 클릭을 받아 우선순위와 어긋났고, WMS 타일은 래스터라 클릭 대상이
// 없다. 둘을 같은 조회로 맞춘다 (이슈 #75, #27).
export const useZoneClick = ({
  enabled,
  resetKey,
  typenames,
  selectZone,
  clearZone,
}: UseZoneClickParams) => {
  const { message } = AntdApp.useApp();
  // 조회가 끝날 때까지 클릭 지점에 보여 줄 좌표. 응답을 기다리는 동안 화면이 멈춘 것처럼 보이지 않게 한다.
  const [pendingPosition, setPendingPosition] = useState<{ lat: number; lng: number } | null>(null);
  // 연속 클릭에서 늦게 도착한 이전 응답이 나중 클릭의 결과를 덮어쓰지 않도록 마지막 요청만 반영한다.
  const { begin: beginLatestRequest, cancel: cancelLatestRequest } = useLatestRequest();
  const lastClickRef = useRef<{ lat: number; lng: number; at: number } | null>(null);

  const onMapClick = useCallback(
    async (point: { lat: number; lng: number }) => {
      if (!enabled) {
        return;
      }

      const now = Date.now();
      const lastClick = lastClickRef.current;
      lastClickRef.current = { ...point, at: now };

      if (
        lastClick &&
        now - lastClick.at < DUPLICATE_CLICK_WINDOW_MS &&
        Math.abs(lastClick.lat - point.lat) < DUPLICATE_CLICK_TOLERANCE_DEGREES &&
        Math.abs(lastClick.lng - point.lng) < DUPLICATE_CLICK_TOLERANCE_DEGREES
      ) {
        return;
      }

      // 새 클릭이 오면 이전 조회는 결과를 쓰지 않으므로 요청 자체를 끊어 네트워크와 파싱을 아낀다.
      const { signal, isLatest } = beginLatestRequest();

      if (typenames.length === 0) {
        setPendingPosition(null);
        clearZone();
        return;
      }

      setPendingPosition(point);

      try {
        const { zones, hasFailure } = await findZonesAtPoint(point, typenames, {
          signal,
          // 최상위 구역이 확정되면 나머지 겹침 확인을 기다리지 않고 바로 안내를 열고, 겹친 구역은 도착하는 대로 덧붙인다.
          onProgress: (found) => {
            if (!isLatest()) {
              return;
            }

            setPendingPosition(null);
            selectZone({
              position: point,
              zoneType: found[0],
              overlap: { zoneTypes: found.slice(1), isComplete: false, hasFailure: false },
            });
          },
        });

        if (!isLatest()) {
          return;
        }

        // 구역이 없어도 안내를 연다. 닫기만 하면 "규제 없음"인지 클릭이 무시된 건지 알 수 없다(#27).
        selectZone({
          position: point,
          zoneType: zones[0] ?? null,
          overlap:
            zones.length > 0
              ? { zoneTypes: zones.slice(1), isComplete: true, hasFailure }
              : undefined,
        });
      } catch (error) {
        if (!isLatest()) {
          return;
        }

        console.error('[airspace] 클릭 지점 구역 조회 실패', error);
        message.error('구역 정보를 불러오지 못했습니다.', ERROR_TOAST_DURATION_SECONDS);
      } finally {
        // 마지막 클릭의 조회가 끝났을 때만 표시를 지운다(이전 클릭이 새 표시를 지우지 않게).
        if (isLatest()) {
          setPendingPosition(null);
        }
      }
    },
    [enabled, typenames, selectZone, clearZone, message, beginLatestRequest],
  );

  // 비활성(폴리곤 모드로 전환)이 되면 이미 나간 조회는 결과를 쓸 수 없으므로 끊고 조회 중 표시도 지운다.
  // 끊지 않으면 뒤늦게 도착한 결과가 폴리곤 모드에서 안내 박스를 연다(이슈 #94).
  // 끊긴 요청은 최신이 아니게 되어 finally가 표시를 지우지 않으므로, 여기서 직접 지운다.
  useEffect(() => {
    if (!enabled) {
      cancelLatestRequest();
      setPendingPosition(null);
    }
  }, [enabled, cancelLatestRequest]);

  // resetKey는 값이 아니라 "바뀐 시점"을 알리는 트리거로만 쓴다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey 변경 자체가 실행 조건이다.
  useEffect(() => {
    cancelLatestRequest();
    setPendingPosition(null);
  }, [resetKey, cancelLatestRequest]);

  // 조회 중인 카드를 사용자가 닫을 때 쓴다. 조회를 끊지 않으면 뒤늦게 도착한 결과가 닫은 카드를 다시 연다.
  const cancelPending = useCallback(() => {
    cancelLatestRequest();
    setPendingPosition(null);
  }, [cancelLatestRequest]);

  return { onMapClick, pendingPosition, cancelPending };
};
