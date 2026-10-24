import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SEARCH_DEBOUNCE_MS } from '@/features/map/constants';
import { useAddressSearch } from '@/features/map/hooks/useAddressSearch';
import type { SearchCandidate } from '@/features/map/types';
import { searchAddressCandidates } from '@/features/map/utils/searchAddressCandidates';

vi.mock('@/features/map/utils/searchAddressCandidates');

const mockedSearch = vi.mocked(searchAddressCandidates);

const makeCandidate = (label: string): SearchCandidate => ({
  id: `place:${label}`,
  label,
  lat: 37.5,
  lng: 127,
});

const renderUseAddressSearch = (initialInput: string) => {
  // retry 기본값을 그대로 둔다: 훅이 스스로 재시도를 끄는지(실패 안내가 늦어지지 않는지) 검증하기 위해서다.
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return renderHook(({ input }) => useAddressSearch(input), {
    initialProps: { input: initialInput },
    wrapper,
  });
};

const advanceDebounce = () => act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS));

describe('useAddressSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockedSearch.mockReset();
    mockedSearch.mockImplementation(async (keyword) => [makeCandidate(`${keyword} 결과`)]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('입력 후 debounce 시간이 지나기 전에는 검색하지 않는다', async () => {
    // shouldAdvanceTime이 켜져 있으면 실제 경과 시간이 더해져 경계(299ms)에서 간헐적으로 넘어가므로,
    // 경계를 검증하는 이 테스트만 시간을 완전히 고정한 가짜 타이머를 쓴다.
    vi.useRealTimers();
    vi.useFakeTimers();
    const { rerender } = renderUseAddressSearch('');

    rerender({ input: '세종' });
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 1));

    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it('debounce 시간이 지나면 검색하고 후보를 반환한다', async () => {
    const { result, rerender } = renderUseAddressSearch('');

    rerender({ input: '세종' });
    await advanceDebounce();

    await waitFor(() => expect(result.current.candidates).toEqual([makeCandidate('세종 결과')]));
    expect(mockedSearch).toHaveBeenCalledTimes(1);
    expect(mockedSearch).toHaveBeenCalledWith('세종');
  });

  it('연속 입력은 마지막 값으로만 검색한다', async () => {
    const { rerender } = renderUseAddressSearch('');

    rerender({ input: '세' });
    await act(() => vi.advanceTimersByTimeAsync(100));
    rerender({ input: '세종' });
    await act(() => vi.advanceTimersByTimeAsync(100));
    rerender({ input: '세종대로' });
    await advanceDebounce();

    await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(1));
    expect(mockedSearch).toHaveBeenCalledWith('세종대로');
  });

  it('앞뒤 공백은 제거하고 검색한다', async () => {
    const { rerender } = renderUseAddressSearch('');

    rerender({ input: '  세종  ' });
    await advanceDebounce();

    await waitFor(() => expect(mockedSearch).toHaveBeenCalledWith('세종'));
  });

  it.each(['', '   '])('빈 입력(%j)이면 검색하지 않고 후보가 비어 있다', async (input) => {
    const { result } = renderUseAddressSearch(input);

    await advanceDebounce();

    expect(mockedSearch).not.toHaveBeenCalled();
    expect(result.current.candidates).toEqual([]);
  });

  it('입력을 지우면 debounce를 기다리지 않고 바로 후보를 비운다', async () => {
    const { result, rerender } = renderUseAddressSearch('');
    rerender({ input: '세종' });
    await advanceDebounce();
    await waitFor(() => expect(result.current.candidates).toHaveLength(1));

    rerender({ input: '' });

    expect(result.current.candidates).toEqual([]);
  });

  it('같은 검색어를 다시 입력하면 캐시를 쓰고 다시 검색하지 않는다', async () => {
    const { result, rerender } = renderUseAddressSearch('');
    rerender({ input: '세종' });
    await advanceDebounce();
    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    rerender({ input: '세종대로' });
    await advanceDebounce();
    await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(2));

    rerender({ input: '세종' });
    await advanceDebounce();

    await waitFor(() => expect(result.current.candidates).toEqual([makeCandidate('세종 결과')]));
    expect(mockedSearch).toHaveBeenCalledTimes(2);
  });

  it('늦게 도착한 이전 검색어의 응답이 최신 결과를 덮어쓰지 않는다', async () => {
    let resolveSlow: (value: SearchCandidate[]) => void = () => {};
    mockedSearch.mockImplementation((keyword) =>
      keyword === '세종'
        ? new Promise<SearchCandidate[]>((resolve) => {
            resolveSlow = resolve;
          })
        : Promise.resolve([makeCandidate(`${keyword} 결과`)]),
    );
    const { result, rerender } = renderUseAddressSearch('');

    rerender({ input: '세종' });
    await advanceDebounce();
    rerender({ input: '세종대로' });
    await advanceDebounce();
    await waitFor(() =>
      expect(result.current.candidates).toEqual([makeCandidate('세종대로 결과')]),
    );

    await act(async () => resolveSlow([makeCandidate('늦은 세종 결과')]));

    expect(result.current.candidates).toEqual([makeCandidate('세종대로 결과')]);
  });

  it('검색 중에는 isLoading이 true이고 끝나면 false다', async () => {
    let resolveSearch: (value: SearchCandidate[]) => void = () => {};
    mockedSearch.mockImplementation(
      () =>
        new Promise<SearchCandidate[]>((resolve) => {
          resolveSearch = resolve;
        }),
    );
    const { result, rerender } = renderUseAddressSearch('');

    rerender({ input: '세종' });
    await advanceDebounce();
    await waitFor(() => expect(result.current.isLoading).toBe(true));

    await act(async () => resolveSearch([makeCandidate('세종')]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('검색이 실패하면 isError가 true이고 후보는 비어 있다', async () => {
    mockedSearch.mockRejectedValue(new Error('검색 실패'));
    const { result, rerender } = renderUseAddressSearch('');

    rerender({ input: '세종' });
    await advanceDebounce();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.candidates).toEqual([]);
  });

  describe('isEmpty', () => {
    it('debounce가 끝난 뒤 결과가 0건이면 true다', async () => {
      mockedSearch.mockResolvedValue([]);
      const { result, rerender } = renderUseAddressSearch('');

      rerender({ input: '없는곳' });
      await advanceDebounce();

      await waitFor(() => expect(result.current.isEmpty).toBe(true));
    });

    it('결과가 있으면 false다', async () => {
      const { result, rerender } = renderUseAddressSearch('');

      rerender({ input: '세종' });
      await advanceDebounce();

      await waitFor(() => expect(result.current.candidates).toHaveLength(1));
      expect(result.current.isEmpty).toBe(false);
    });

    it('빈 입력이면 false다', async () => {
      const { result } = renderUseAddressSearch('');

      await advanceDebounce();

      expect(result.current.isEmpty).toBe(false);
    });

    it('debounce를 기다리는 동안에는 이전 검색어가 0건이었어도 false다', async () => {
      mockedSearch.mockResolvedValue([]);
      const { result, rerender } = renderUseAddressSearch('');
      rerender({ input: '없는곳' });
      await advanceDebounce();
      await waitFor(() => expect(result.current.isEmpty).toBe(true));

      rerender({ input: '없는곳2' });

      expect(result.current.isEmpty).toBe(false);
    });

    it('새 검색어의 응답을 기다리는 동안에는 이전 0건 결과로 true가 되지 않는다', async () => {
      let resolveNext: (value: SearchCandidate[]) => void = () => {};
      mockedSearch.mockImplementation((keyword) =>
        keyword === '없는곳'
          ? Promise.resolve([])
          : new Promise<SearchCandidate[]>((resolve) => {
              resolveNext = resolve;
            }),
      );
      const { result, rerender } = renderUseAddressSearch('');
      rerender({ input: '없는곳' });
      await advanceDebounce();
      await waitFor(() => expect(result.current.isEmpty).toBe(true));

      rerender({ input: '세종' });
      await advanceDebounce();
      await waitFor(() => expect(result.current.isLoading).toBe(true));

      expect(result.current.isEmpty).toBe(false);

      await act(async () => resolveNext([makeCandidate('세종')]));
    });

    it('검색이 실패하면 false다', async () => {
      mockedSearch.mockRejectedValue(new Error('검색 실패'));
      const { result, rerender } = renderUseAddressSearch('');

      rerender({ input: '세종' });
      await advanceDebounce();

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.isEmpty).toBe(false);
    });
  });
});
