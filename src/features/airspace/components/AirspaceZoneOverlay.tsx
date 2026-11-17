import { CloseOutlined } from '@ant-design/icons';
import { Button, Card, ConfigProvider, theme } from 'antd';
import { CustomOverlayMap } from 'react-kakao-maps-sdk';

import { ZoneGuidanceBody } from '@/features/airspace/components/ZoneGuidanceBody';
import { formatZoneAddressTitle } from '@/features/airspace/utils/formatZoneAddress';

import type { SelectedZone } from '@/features/airspace/types';
import type { AddressState } from '@/types/address';

interface AirspaceZoneOverlayProps {
  position: { lat: number; lng: number };
  zoneType: string | null;
  address?: AddressState;
  // 범례에서 꺼서 지도에 보이지 않는 구역이면 true.
  isHidden?: boolean;
  overlap?: SelectedZone['overlap'];
  onClose: () => void;
}

// 닫기 버튼 호버 배경. antd token에 이보다 진한 단계가 없어 상수로 둔다.
const HOVER_FILL = 'rgba(0, 0, 0, 0.25)';

export const AirspaceZoneOverlay = ({
  position,
  zoneType,
  address = { status: 'idle' },
  isHidden = false,
  overlap,
  onClose,
}: AirspaceZoneOverlayProps) => {
  const { token } = theme.useToken();
  const addressTitle = formatZoneAddressTitle(address);

  return (
    // 카카오 앵커(xAnchor/yAnchor)는 오버레이를 붙일 때 잰 콘텐츠 크기로 오프셋을 계산하고, 안내 박스가 열린 채
    // 다른 구역을 클릭해 구역 이름(=카드 너비)만 바뀌면 처음 잰 값이 그대로 남는다. 그래서 처음 카드보다 이름이 길면
    // 오른쪽, 짧으면 왼쪽으로 꼬리가 밀렸다(경계구역 기준 -7~+50px를 모의 측정으로 확인, 이슈 #75).
    // 카카오가 측정하는 루트를 0×0으로 두면 어떤 앵커 값이든 오프셋이 0이라 이 계산이 무력화된다. 카드는 그 안에서
    // 절대 위치로 두고 CSS translate(자기 크기 기준)로 꼬리 끝을 클릭 좌표에 맞춘다. 카카오가 xAnchor 0을 기본값
    // 0.5로 바꿔 받더라도 0×0의 절반은 0이라 결과가 같다.
    <CustomOverlayMap position={position} xAnchor={0} yAnchor={0} zIndex={10} clickable>
      <div className="relative h-0 w-0">
        {/* Card의 box-shadow는 꼬리를 따라가지 못해 이음새에서 끊기므로, 카드와 꼬리를 한 덩어리로 감싼 래퍼에 drop-shadow를 준다(지도 색과 구분). */}
        <div
          // 위치가 바뀌면 새 안내가 열리는 것이므로 다시 자라나는 효과를 준다. 주소가 늦게 도착하는 갱신에서는 key가 같아 재생하지 않는다.
          key={`${position.lat},${position.lng}`}
          className="zone-card-enter absolute bottom-0 left-0 flex w-max -translate-x-1/2 flex-col items-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
        >
          <Card
            size="small"
            title={
              // 긴 주소는 말줄임하고 전체는 title 속성으로 보인다. min-w-0은 flex 자식이 내용 폭만큼 늘어나 말줄임이 안 되는 것을 막는다.
              <span className="block min-w-0 truncate" title={addressTitle}>
                {addressTitle}
              </span>
            }
            extra={
              // filled 기본 배경(colorFillTertiary, 약 4%)이 지도 위에서 거의 안 보여 한 단계씩 진하게 올린다.
              // 버튼에만 적용되도록 이 서브트리 토큰만 바꾼다.
              <ConfigProvider
                theme={{
                  token: { colorFillTertiary: token.colorFill, colorFillSecondary: HOVER_FILL },
                }}
              >
                <Button
                  // text 타입은 평소엔 X 아이콘만 보이다가 호버 때만 배경이 채워져 크기·간격이 달라 보인다.
                  // filled 원형은 평소에도 같은 크기의 배경이 보여 호버 전후 모양이 일정하다.
                  variant="filled"
                  color="default"
                  shape="circle"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={onClose}
                  aria-label="닫기"
                />
              </ConfigProvider>
            }
            // 폭을 고정하는 이유: 구역 이름·주소 길이에 따라 카드 폭이 바뀌면 가운데 정렬 기준이 좌우로 흔들려 열릴 때 튀어 보인다.
            className="w-60 whitespace-nowrap"
            styles={{
              header: { borderBottom: 'none' },
              // antd 헤더 래퍼는 이미 flex이고 제목이 flex:1이라 닫기 버튼이 우측 끝에 붙는다(space-between과 같은 배치).
              // 카드가 내용 폭에 맞춰 줄어들 때 제목과 버튼이 붙지 않도록, 간격을 카드 small 헤더 좌우 패딩(paddingSM=12)과 같게 둔다.
              title: { paddingInlineEnd: token.paddingSM },
              body: { paddingTop: 0 },
            }}
          >
            <ZoneGuidanceBody
              zoneType={zoneType}
              address={address}
              isHidden={isHidden}
              overlap={overlap}
            />
          </Card>
          {/* 테두리 삼각형으로 그려 끝점이 래퍼 바닥(클릭 좌표)에 정확히 놓이게 한다. 회전한 정사각형은 꼭짓점이 어긋난다.
          바깥(카드 테두리색)·안쪽(흰색) 삼각형을 겹쳐 꼬리에도 1px 테두리를 만들고, -mt-px로 카드 아랫변을 안쪽 삼각형이 덮어 이음새 선을 없앤다. */}
          <div className="relative -mt-px h-0 w-0 border-x-[8px] border-t-[9px] border-x-transparent border-t-[#f0f0f0]">
            <div className="absolute -top-[9px] -left-[7px] h-0 w-0 border-x-[7px] border-t-[8px] border-x-transparent border-t-white" />
          </div>
        </div>
      </div>
    </CustomOverlayMap>
  );
};
