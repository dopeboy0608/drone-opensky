import { Tag } from 'antd';

import { formatZoneAddressSubline } from '@/features/airspace/utils/formatZoneAddress';
import { formatZoneOverlapStatus } from '@/features/airspace/utils/formatZoneOverlapStatus';
import {
  type GuidanceTone,
  resolveFlightGuidance,
} from '@/features/airspace/utils/resolveFlightGuidance';

import type { SelectedZone } from '@/features/airspace/types';
import type { AddressState } from '@/types/address';

interface ZoneGuidanceBodyProps {
  zoneType: string | null;
  address: AddressState;
  isHidden?: boolean;
  overlap?: SelectedZone['overlap'];
}

// 레벨 안내 띠 색. antd 태그 색과 같은 계열(빨강·주황·초록·회색)로 맞춰 태그와 띠가 한 묶음으로 읽히게 한다.
const STRIP_CLASS_BY_TONE: Record<GuidanceTone, string> = {
  error: 'border-red-200 bg-red-50 text-red-700',
  warning: 'border-orange-200 bg-orange-50 text-orange-700',
  success: 'border-green-200 bg-green-50 text-green-700',
  default: 'border-gray-200 bg-gray-50 text-gray-600',
};

// antd Tag의 'default'는 색이 아니라 기본 모양이라, 레벨을 모르는 구역은 color를 비워 기본 태그로 그린다.
const toTagColor = (tone: GuidanceTone) => (tone === 'default' ? undefined : tone);

export const ZoneGuidanceBody = ({
  zoneType,
  address,
  isHidden = false,
  overlap,
}: ZoneGuidanceBodyProps) => {
  const guidance = resolveFlightGuidance(zoneType);
  const addressSubline = formatZoneAddressSubline(address);
  const overlapStatus = formatZoneOverlapStatus(overlap);
  const overlapZoneTypes = overlap?.zoneTypes ?? [];
  const hasAddressSubline = address.status === 'loading' || addressSubline !== null;

  return (
    // 카드는 한 줄 폭(whitespace-nowrap)으로 펴지므로, 안내 문구만 최대 폭을 두어 줄바꿈한다.
    <div className="flex max-w-[240px] flex-col gap-2 text-xs whitespace-normal">
      {/* 클릭한 구역과 겹친 구역을 한 줄에 이어 붙인다. 높이(22px)를 확인 전에도 확보해 결과가 도착해도 카드가 움직이지 않는다. */}
      {zoneType !== null && (
        <div className="flex min-h-[22px] flex-wrap items-center gap-1">
          <Tag variant="solid" color={toTagColor(guidance.tone)} className="m-0">
            {zoneType}
          </Tag>
          {isHidden && <span className="text-gray-500">(범례에서 숨김)</span>}
          {overlapZoneTypes.map((overlappedZoneType) => (
            <Tag
              key={overlappedZoneType}
              color={toTagColor(resolveFlightGuidance(overlappedZoneType).tone)}
              className="m-0"
            >
              {overlappedZoneType}
            </Tag>
          ))}
          {overlapStatus && <span className="text-gray-500">{overlapStatus}</span>}
        </div>
      )}
      <div className={`rounded border px-2 py-1 ${STRIP_CLASS_BY_TONE[guidance.tone]}`}>
        {zoneType !== null && <div className="font-medium">{guidance.headline}</div>}
        <div>{zoneType === null ? guidance.headline : guidance.detail}</div>
        {zoneType === null && <div className="text-gray-500">{guidance.detail}</div>}
      </div>
      {/* 지번이 늦게 도착해도 높이가 변하지 않도록 조회 중에도 한 줄을 확보한다. */}
      {hasAddressSubline && <div className="min-h-4 text-gray-500">{addressSubline}</div>}
    </div>
  );
};
