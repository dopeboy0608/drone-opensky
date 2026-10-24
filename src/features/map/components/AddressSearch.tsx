import { App as AntdApp, AutoComplete } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { useAddressSearch } from '@/features/map/hooks/useAddressSearch';
import type { SearchCandidate } from '@/features/map/types';

const SEARCH_ERROR_MESSAGE = '주소 검색에 실패했습니다.';
const NO_RESULT_MESSAGE = '검색 결과가 없습니다.';

interface AddressSearchProps {
  onSelectCandidate: (candidate: SearchCandidate) => void;
}

export const AddressSearch = ({ onSelectCandidate }: AddressSearchProps) => {
  const { message } = AntdApp.useApp();

  // 입력창에 보이는 값과 검색어를 분리한다. 후보를 선택하면 입력창은 label로 바뀌지만,
  // 그 label로 다시 검색하면 불필요한 호출이 한 번 더 나가므로 검색어는 직접 타이핑할 때만 바꾼다.
  const [inputValue, setInputValue] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const { candidates, isError, isEmpty } = useAddressSearch(searchKeyword);

  const options = useMemo(
    () =>
      candidates.map((candidate) => ({
        // 같은 이름의 장소가 여러 개일 수 있어 value는 label이 아닌 id로 둔다.
        value: candidate.id,
        label: (
          <div className="flex flex-col">
            <span>{candidate.label}</span>
            {candidate.subLabel && (
              <span className="text-xs text-gray-500">{candidate.subLabel}</span>
            )}
          </div>
        ),
      })),
    [candidates],
  );

  // 같은 검색어의 에러에 토스트가 반복되지 않도록 isError가 켜지는 시점에만 알린다.
  useEffect(() => {
    if (isError) {
      message.error(SEARCH_ERROR_MESSAGE);
    }
  }, [isError, message]);

  const handleChange = (nextValue: string) => {
    // 후보를 고르면 antd가 value(id)를 onChange로 넘기므로 입력창에는 id 대신 label을 보여준다.
    const selected = candidates.find((candidate) => candidate.id === nextValue);

    setInputValue(selected ? selected.label : nextValue);

    if (nextValue === '') {
      setSearchKeyword('');
    }
  };

  const handleSelect = (candidateId: string) => {
    const selected = candidates.find((candidate) => candidate.id === candidateId);

    if (selected) {
      onSelectCandidate(selected);
    }
  };

  return (
    // 우측 상단에는 컨트롤 버튼(MapControls)이 있어 right-20으로 자리를 비워 둔다.
    <div className="absolute top-4 right-20 left-4 z-10 max-w-md">
      <AutoComplete
        className="w-full"
        size="large"
        allowClear
        // 후보는 서버(SDK) 검색 결과라 antd의 클라이언트 필터를 끄지 않으면 id와 입력값을 비교해 모두 숨겨진다.
        filterOption={false}
        // 후보가 최대 10개라 가상 스크롤이 필요 없다.
        virtual={false}
        placeholder="주소 또는 장소 검색"
        aria-label="주소 검색"
        // 결과가 없을 때만 안내를 보여준다. null이면 후보가 없는 동안 드롭다운 자체가 열리지 않는다.
        notFoundContent={isEmpty ? NO_RESULT_MESSAGE : null}
        value={inputValue}
        options={options}
        onSearch={setSearchKeyword}
        onChange={handleChange}
        onSelect={handleSelect}
      />
    </div>
  );
};
