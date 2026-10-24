import { App as AntdApp } from 'antd';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AddressSearch } from '@/features/map/components/AddressSearch';
import { useAddressSearch } from '@/features/map/hooks/useAddressSearch';

import type { SearchCandidate } from '@/features/map/types';

vi.mock('@/features/map/hooks/useAddressSearch');

const mockedUseAddressSearch = vi.mocked(useAddressSearch);

const cityHall: SearchCandidate = {
  id: 'place:1',
  label: '서울특별시청',
  subLabel: '서울 중구 세종대로 110',
  lat: 37.5663,
  lng: 126.9779,
};
const sameNameElsewhere: SearchCandidate = {
  id: 'place:2',
  label: '서울특별시청',
  subLabel: '다른 주소 1',
  lat: 35.1,
  lng: 129.0,
};

const mockCandidates = (candidates: SearchCandidate[]) => {
  mockedUseAddressSearch.mockReturnValue({
    candidates,
    isError: false,
    errorUpdatedAt: 0,
    isEmpty: false,
  });
};

const typeKeyword = (value: string) => {
  const input = screen.getByRole('combobox', { name: '주소 검색' });
  fireEvent.change(input, { target: { value } });
  return input;
};

// antd 드롭다운(rc-resize-observer)이 열릴 때 필요한데 jsdom에는 ResizeObserver가 없다.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('AddressSearch', () => {
  // vitest globals가 꺼져 있어 RTL의 자동 cleanup이 동작하지 않으므로 직접 정리한다.
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    mockedUseAddressSearch.mockReset();
    mockCandidates([]);
  });

  it('입력창이 플레이스홀더와 함께 렌더된다', () => {
    render(<AddressSearch onSelectCandidate={vi.fn()} />);

    // antd Select는 플레이스홀더를 input 속성이 아닌 별도 요소로 렌더한다.
    expect(screen.getByText('주소 또는 장소 검색')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '주소 검색' })).toBeInTheDocument();
  });

  it('입력값을 검색 훅에 전달한다', () => {
    render(<AddressSearch onSelectCandidate={vi.fn()} />);

    typeKeyword('세종');

    expect(mockedUseAddressSearch).toHaveBeenLastCalledWith('세종');
  });

  it('후보를 label과 subLabel로 보여준다', () => {
    mockCandidates([cityHall]);
    render(<AddressSearch onSelectCandidate={vi.fn()} />);

    typeKeyword('시청');

    expect(screen.getByText('서울특별시청')).toBeInTheDocument();
    expect(screen.getByText('서울 중구 세종대로 110')).toBeInTheDocument();
  });

  it('후보를 선택하면 입력창에 label을 보여주고 선택 콜백을 한 번 호출한다', () => {
    mockCandidates([cityHall]);
    const onSelectCandidate = vi.fn();
    render(<AddressSearch onSelectCandidate={onSelectCandidate} />);
    const input = typeKeyword('시청');

    fireEvent.click(screen.getByText('서울 중구 세종대로 110'));

    expect(onSelectCandidate).toHaveBeenCalledTimes(1);
    expect(onSelectCandidate).toHaveBeenCalledWith(cityHall);
    expect(input).toHaveValue('서울특별시청');
  });

  it('같은 label의 후보가 여러 개여도 선택한 후보를 전달한다', () => {
    mockCandidates([cityHall, sameNameElsewhere]);
    const onSelectCandidate = vi.fn();
    render(<AddressSearch onSelectCandidate={onSelectCandidate} />);
    typeKeyword('시청');

    fireEvent.click(screen.getByText('다른 주소 1'));

    expect(onSelectCandidate).toHaveBeenCalledWith(sameNameElsewhere);
  });

  it('선택 후 다시 입력하면 새 입력값으로 검색한다', () => {
    mockCandidates([cityHall]);
    render(<AddressSearch onSelectCandidate={vi.fn()} />);
    typeKeyword('시청');
    fireEvent.click(screen.getByText('서울 중구 세종대로 110'));

    typeKeyword('부산');

    expect(mockedUseAddressSearch).toHaveBeenLastCalledWith('부산');
  });

  describe('안내', () => {
    const errorToast = vi.fn();

    beforeEach(() => {
      errorToast.mockReset();
      // 토스트는 antd message.error 호출 여부로 검증한다(토스트 DOM은 테스트 간에 남아 개수를 셀 수 없다).
      vi.spyOn(AntdApp, 'useApp').mockReturnValue({
        message: { error: errorToast },
      } as unknown as ReturnType<typeof AntdApp.useApp>);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('결과가 없으면 "검색 결과가 없습니다."를 보여준다', () => {
      mockedUseAddressSearch.mockReturnValue({
        candidates: [],
        isError: false,
        errorUpdatedAt: 0,
        isEmpty: true,
      });
      render(<AddressSearch onSelectCandidate={vi.fn()} />);

      typeKeyword('없는곳');

      expect(screen.getByText('검색 결과가 없습니다.')).toBeInTheDocument();
    });

    it('결과 없음이 아니면 안내를 보여주지 않는다', () => {
      render(<AddressSearch onSelectCandidate={vi.fn()} />);

      typeKeyword('세종');

      expect(screen.queryByText('검색 결과가 없습니다.')).not.toBeInTheDocument();
    });

    const mockError = (errorUpdatedAt: number) => {
      mockedUseAddressSearch.mockReturnValue({
        candidates: [],
        isError: true,
        errorUpdatedAt,
        isEmpty: false,
      });
    };

    it('검색이 실패하면 에러 토스트를 한 번 보여준다', () => {
      mockError(100);
      const { rerender } = render(<AddressSearch onSelectCandidate={vi.fn()} />);

      rerender(<AddressSearch onSelectCandidate={vi.fn()} />);

      expect(errorToast).toHaveBeenCalledTimes(1);
      expect(errorToast).toHaveBeenCalledWith('주소 검색에 실패했습니다.');
    });

    it('새로운 에러(errorUpdatedAt이 새 값)가 생기면 토스트를 다시 보여준다', () => {
      mockError(100);
      const { rerender } = render(<AddressSearch onSelectCandidate={vi.fn()} />);

      mockError(200);
      rerender(<AddressSearch onSelectCandidate={vi.fn()} />);

      expect(errorToast).toHaveBeenCalledTimes(2);
    });

    it('이미 안내한 에러가 캐시된 채 다시 나타나도 토스트를 반복하지 않는다', () => {
      mockError(100);
      const { rerender } = render(<AddressSearch onSelectCandidate={vi.fn()} />);
      mockError(200);
      rerender(<AddressSearch onSelectCandidate={vi.fn()} />);

      // 이전 검색어(100)의 캐시된 에러로 돌아온 상황
      mockError(100);
      rerender(<AddressSearch onSelectCandidate={vi.fn()} />);

      expect(errorToast).toHaveBeenCalledTimes(2);
    });

    it('실패가 없으면 토스트를 보여주지 않는다', () => {
      render(<AddressSearch onSelectCandidate={vi.fn()} />);

      expect(errorToast).not.toHaveBeenCalled();
    });
  });
});
