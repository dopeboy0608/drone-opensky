import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDeferredValue } from 'react';

import { SEARCH_DEBOUNCE_MS, SEARCH_STALE_TIME_MS } from '@/features/map/constants';
import { useDebouncedValue } from '@/features/map/hooks/useDebouncedValue';
import type { SearchCandidate } from '@/features/map/types';
import { searchAddressCandidates } from '@/features/map/utils/searchAddressCandidates';

interface UseAddressSearchReturn {
  candidates: SearchCandidate[];
  isLoading: boolean;
  isError: boolean;
}

// useDeferredValue에 넘기는 값의 참조가 렌더마다 바뀌면 지연 값이 계속 갱신되므로 고정한다.
const NO_CANDIDATES: SearchCandidate[] = [];

export const useAddressSearch = (input: string): UseAddressSearchReturn => {
  const keyword = input.trim();
  const debouncedKeyword = useDebouncedValue(keyword, SEARCH_DEBOUNCE_MS);

  const { data, isFetching, isError } = useQuery({
    // 키가 검색어라 늦게 도착한 이전 검색어의 응답은 다른 캐시 항목에 쌓이고 현재 결과를 덮지 않는다.
    queryKey: ['addressSearch', debouncedKeyword],
    queryFn: () => searchAddressCandidates(debouncedKeyword),
    enabled: debouncedKeyword !== '',
    staleTime: SEARCH_STALE_TIME_MS,
    // 다음 검색어의 결과가 도착할 때까지 이전 후보를 유지해 목록이 깜빡이지 않게 한다.
    placeholderData: keepPreviousData,
  });

  // 입력을 지웠을 때는 debounce를 기다리지 않고 바로 비운다(이전 검색 결과가 남아 보이지 않도록).
  const isInputEmpty = keyword === '';
  const candidates = useDeferredValue(isInputEmpty ? NO_CANDIDATES : (data ?? NO_CANDIDATES));

  return {
    candidates,
    isLoading: !isInputEmpty && isFetching,
    isError: !isInputEmpty && isError,
  };
};
