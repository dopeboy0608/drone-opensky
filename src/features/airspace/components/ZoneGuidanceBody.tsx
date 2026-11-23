import { Tag } from 'antd';

import { ZoneSkeletonBar } from '@/features/airspace/components/ZoneSkeletonBar';
import {
  formatZoneAddressFull,
  formatZoneAddressSubline,
} from '@/features/airspace/utils/formatZoneAddress';
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
  // 구역 조회 중이면 태그와 안내 띠를 스켈레톤으로 둔다(#114).
  isPending?: boolean;
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
  isPending = false,
}: ZoneGuidanceBodyProps) => {
  const guidance = resolveFlightGuidance(zoneType);
  const fullAddress = formatZoneAddressFull(address);
  const addressSubline = formatZoneAddressSubline(address);
  const overlapStatus = formatZoneOverlapStatus(overlap);
  const overlapZoneTypes = overlap?.zoneTypes ?? [];
  const isAddressLoading = address.status === 'loading';
  const hasAddressFooter = isAddressLoading || fullAddress !== null;

  return (
    // 카드는 한 줄 폭(whitespace-nowrap)으로 펴지므로, 안내 문구만 최대 폭을 두어 줄바꿈한다.
    // 구역 조회 중에는 status 역할로 "무엇을 기다리는지"를 스크린리더에 알린다(눈에는 스켈레톤이 그 역할을 한다).
    <div
      className="flex max-w-[240px] flex-col gap-2 text-xs whitespace-normal"
      {...(isPending ? { role: 'status', 'aria-label': '구역 조회 중' } : {})}
    >
      {/* 대기 중에는 태그 줄(22px)과 안내 띠(제목 1줄 + 설명 2줄 안팎)를 스켈레톤으로 채워 구역이 확정돼도 카드가 크게 움직이지 않게 한다. */}
      {isPending && (
        <>
          <div className="flex min-h-[22px] items-center gap-1">
            <ZoneSkeletonBar className="h-[22px] w-20" />
            <ZoneSkeletonBar className="h-[22px] w-14" />
          </div>
          <ZoneSkeletonBar className="h-[58px] w-full" />
        </>
      )}
      {/* 클릭한 구역과 겹친 구역을 한 줄에 이어 붙인다. 높이(22px)를 확인 전에도 확보해 결과가 도착해도 카드가 움직이지 않는다. */}
      {!isPending && zoneType !== null && (
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
      {!isPending && (
        <div className={`rounded border px-2 py-1 ${STRIP_CLASS_BY_TONE[guidance.tone]}`}>
          {zoneType !== null && <div className="font-medium">{guidance.headline}</div>}
          <div>{zoneType === null ? guidance.headline : guidance.detail}</div>
          {zoneType === null && <div className="text-gray-500">{guidance.detail}</div>}
        </div>
      )}
      {/* 제목은 지역을 뺀 상세 주소라 전체 주소를 맨 아래에 줄바꿈해 보여 준다(break-keep으로 단어 중간에서 끊기지 않게).
      주소가 늦게 도착해도 높이가 변하지 않도록 조회 중에는 스켈레톤으로 두 줄(전체 주소, 지번)을 확보한다. */}
      {hasAddressFooter &&
        (isAddressLoading ? (
          <div className="flex flex-col gap-1">
            <ZoneSkeletonBar className="h-3 w-full" />
            <ZoneSkeletonBar className="h-3 w-2/3" />
          </div>
        ) : (
          <div className="min-h-4 text-gray-500">
            <div className="break-keep">{fullAddress}</div>
            {addressSubline && <div className="break-keep">{addressSubline}</div>}
          </div>
        ))}
    </div>
  );
};
