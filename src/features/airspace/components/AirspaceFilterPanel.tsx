import { UnorderedListOutlined } from '@ant-design/icons';
import { Button, Card, Checkbox, ConfigProvider } from 'antd';
import { useState } from 'react';

import { useAirspaceFilterStore } from '@/features/airspace/store/airspaceFilterStore';

import {
  AIRSPACE_ZONE_CONFIGS,
  AIRSPACE_ZONE_LABELS,
  TYPENAME_ZONE_LABELS,
} from '@/features/airspace/constants';

const PANEL_FONT_SIZE = 13;

export const AirspaceFilterPanel = () => {
  const visibility = useAirspaceFilterStore((state) => state.visibility);
  const toggleZone = useAirspaceFilterStore((state) => state.toggleZone);
  const setAllZones = useAirspaceFilterStore((state) => state.setAllZones);

  const [isOpen, setIsOpen] = useState(false);

  // 모두 꺼진 상태에서는 같은 버튼이 복구 역할(전체 선택)을 하도록 한다.
  const isAnyZoneVisible = Object.values(visibility).some(Boolean);

  return (
    // bottom을 띄운 이유: 좌측 하단은 카카오 지도 로고가 표시되는 영역이라 겹치지 않게 하기 위함.
    // antd 컴포넌트(Card 제목/Checkbox/Button) 글자 크기는 내부에서 fontSize 토큰으로 고정되므로, Tailwind 대신 theme token으로 맞춘다.
    <ConfigProvider theme={{ token: { fontSize: PANEL_FONT_SIZE } }}>
      <div className="absolute bottom-10 left-4 z-10 flex flex-col items-start gap-2">
        {isOpen && (
          <Card
            size="small"
            title="공역 필터"
            extra={
              <Button type="link" size="small" onClick={() => setAllZones(!isAnyZoneVisible)}>
                {isAnyZoneVisible ? '전체 해제' : '전체 선택'}
              </Button>
            }
            className="max-h-[60dvh] overflow-y-auto shadow"
          >
            {AIRSPACE_ZONE_CONFIGS.map((config) => (
              <div key={config.level} className="py-1">
                <div className="flex items-center gap-2 text-[13px] font-medium">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{ backgroundColor: config.color }}
                  />
                  <span>{AIRSPACE_ZONE_LABELS[config.level]}</span>
                </div>
                <div className="flex flex-col pl-5">
                  {config.typenames.map((typename) => (
                    <Checkbox
                      key={typename}
                      checked={visibility[typename]}
                      onChange={() => toggleZone(typename)}
                    >
                      {TYPENAME_ZONE_LABELS[typename]}
                    </Checkbox>
                  ))}
                </div>
              </div>
            ))}
          </Card>
        )}
        <Button icon={<UnorderedListOutlined />} onClick={() => setIsOpen((open) => !open)}>
          범례
        </Button>
      </div>
    </ConfigProvider>
  );
};
