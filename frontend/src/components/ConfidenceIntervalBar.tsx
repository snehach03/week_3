import React from 'react';

interface ConfidenceIntervalBarProps {
  lower: number;
  point: number;
  upper: number;
  prep: number;
  minScale?: number;
  maxScale?: number;
}

export const ConfidenceIntervalBar: React.FC<ConfidenceIntervalBarProps> = ({
  lower,
  point,
  upper,
  prep,
  minScale = 0,
  maxScale,
}) => {
  // Compute display range with some breathing room
  const effMax = maxScale || Math.max(upper * 1.25, prep * 1.15, 10);
  const effMin = Math.max(0, minScale);
  const span = effMax - effMin;

  const toPct = (val: number) => {
    const clamped = Math.max(effMin, Math.min(effMax, val));
    return ((clamped - effMin) / span) * 100;
  };

  const leftPct = toPct(lower);
  const widthPct = Math.max(4, toPct(upper) - leftPct);
  const pointPct = toPct(point);
  const prepPct = toPct(prep);

  return (
    <div className="w-full select-none py-1.5">
      <div className="relative h-6 bg-cream-200 rounded-full overflow-visible border border-cream-300">
        {/* P10 - P90 Uncertainty Range */}
        <div
          className="absolute top-0 bottom-0 bg-terracotta-100 border-x-2 border-terracotta-500/40 rounded-sm transition-all duration-300"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          title={`P10–P90 Range: ${lower} to ${upper} units`}
        >
          <span className="sr-only">Range {lower} to {upper}</span>
        </div>

        {/* Expected Demand Point marker */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-espresso-800 -ml-0.5 rounded transition-all duration-300"
          style={{ left: `${pointPct}%` }}
          title={`Expected Demand: ${point} units`}
        />

        {/* Suggested Preparation Target pin */}
        <div
          className="absolute -top-1 bottom-0 flex flex-col items-center -ml-2 transition-all duration-300"
          style={{ left: `${prepPct}%` }}
          title={`Recommended Prep: ${prep} units`}
        >
          <div className="w-4 h-4 rounded-full bg-sage-500 text-cream-50 flex items-center justify-center text-[9px] font-bold shadow-warm-sm border border-cream-50">
            ✓
          </div>
        </div>
      </div>

      {/* Axis Labels */}
      <div className="flex justify-between items-center text-[11px] text-espresso-500 mt-1.5 font-medium px-0.5">
        <span className="flex items-center gap-1">
          <span className="text-espresso-700 font-semibold">{lower}</span>
          <span className="text-espresso-400">P10</span>
        </span>
        <span className="flex items-center gap-1 bg-cream-100 px-1.5 py-0.5 rounded border border-cream-300/80">
          <span className="text-espresso-500 text-[10px]">Expected:</span>
          <strong className="text-espresso-900 font-bold">{point}</strong>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-espresso-400">P90</span>
          <span className="text-espresso-700 font-semibold">{upper}</span>
        </span>
      </div>
    </div>
  );
};
