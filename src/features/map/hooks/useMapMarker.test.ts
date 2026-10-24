import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useMapMarker } from '@/features/map/hooks/useMapMarker';

const current = { lat: 37.5, lng: 127.0 };
const searched = { lat: 35.1, lng: 129.0 };
const searchedAgain = { lat: 33.5, lng: 126.5 };

const renderUseMapMarker = (initial: { currentPosition: typeof current; hasLocation: boolean }) =>
  renderHook((props) => useMapMarker(props.currentPosition, props.hasLocation), {
    initialProps: initial,
  });

describe('useMapMarker', () => {
  it('초기에 내 위치를 알면 내 위치에 마커를 표시한다', () => {
    const { result } = renderUseMapMarker({ currentPosition: current, hasLocation: true });

    expect(result.current.markerPosition).toEqual(current);
  });

  it('초기에 내 위치를 모르면 마커가 없다', () => {
    const { result } = renderUseMapMarker({ currentPosition: current, hasLocation: false });

    expect(result.current.markerPosition).toBeNull();
  });

  it('검색 위치를 표시하면 내 위치 마커 대신 검색 위치 마커 하나만 남는다', () => {
    const { result } = renderUseMapMarker({ currentPosition: current, hasLocation: true });

    act(() => result.current.showSearchMarker(searched));

    expect(result.current.markerPosition).toEqual(searched);
  });

  it('다른 검색 위치를 다시 표시하면 마커가 새 위치로 옮겨진다', () => {
    const { result } = renderUseMapMarker({ currentPosition: current, hasLocation: true });

    act(() => result.current.showSearchMarker(searched));
    act(() => result.current.showSearchMarker(searchedAgain));

    expect(result.current.markerPosition).toEqual(searchedAgain);
  });

  it('내 위치로 되돌리면 검색 마커가 사라지고 내 위치 마커가 표시된다', () => {
    const { result } = renderUseMapMarker({ currentPosition: current, hasLocation: true });
    act(() => result.current.showSearchMarker(searched));

    act(() => result.current.showCurrentMarker());

    expect(result.current.markerPosition).toEqual(current);
  });

  it('검색 마커가 표시된 동안 내 위치가 갱신되어도 검색 마커를 유지한다', () => {
    const { result, rerender } = renderUseMapMarker({
      currentPosition: current,
      hasLocation: true,
    });
    act(() => result.current.showSearchMarker(searched));

    rerender({ currentPosition: { lat: 36, lng: 128 }, hasLocation: true });

    expect(result.current.markerPosition).toEqual(searched);
  });

  it('검색 마커가 표시된 동안 내 위치 조회가 실패(hasLocation=false)해도 검색 마커를 유지한다', () => {
    const { result, rerender } = renderUseMapMarker({
      currentPosition: current,
      hasLocation: true,
    });
    act(() => result.current.showSearchMarker(searched));

    rerender({ currentPosition: current, hasLocation: false });

    expect(result.current.markerPosition).toEqual(searched);
  });

  it('내 위치를 모르는 상태에서도 검색하면 검색 마커가 표시된다', () => {
    const { result } = renderUseMapMarker({ currentPosition: current, hasLocation: false });

    act(() => result.current.showSearchMarker(searched));

    expect(result.current.markerPosition).toEqual(searched);
  });

  it('내 위치 모드에서 내 위치 조회가 실패하면 마커가 사라진다', () => {
    const { result, rerender } = renderUseMapMarker({
      currentPosition: current,
      hasLocation: true,
    });

    rerender({ currentPosition: current, hasLocation: false });

    expect(result.current.markerPosition).toBeNull();
  });

  it('내 위치로 되돌렸지만 아직 내 위치를 모르면 마커가 없다', () => {
    const { result } = renderUseMapMarker({ currentPosition: current, hasLocation: false });
    act(() => result.current.showSearchMarker(searched));

    act(() => result.current.showCurrentMarker());

    expect(result.current.markerPosition).toBeNull();
  });
});
