import { AIRSPACE_ZONE_CONFIGS, AIRSPACE_ZONE_LABELS } from '@/features/airspace/constants';

export const AirspaceLegend = () => (
  <div className="absolute right-4 bottom-4 z-10 rounded-md bg-white/90 px-3 py-2 text-[13px] shadow">
    {AIRSPACE_ZONE_CONFIGS.map((config) => (
      <div key={config.level} className="flex items-center gap-2 py-0.5">
        <span
          className="inline-block h-3 w-3 rounded-sm"
          style={{ backgroundColor: config.color }}
        />
        <span>{AIRSPACE_ZONE_LABELS[config.level]}</span>
      </div>
    ))}
  </div>
);
