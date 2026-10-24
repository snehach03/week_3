import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  Package,
  ArrowRight,
  ShieldCheck,
  Wheat,
  ShoppingBag
} from 'lucide-react';
import { api } from '../api/client';
import type { SalesSummary, ForecastResponse, MenuItemSummary } from '../types';

interface OverviewPageProps {
  onNavigate: (tab: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate }) => {
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [latestForecast, setLatestForecast] = useState<ForecastResponse | null>(null);
  const [itemsList, setItemsList] = useState<MenuItemSummary[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [sum, fc, items] = await Promise.all([
        api.getSalesSummary().catch(() => null),
        api.getLatestForecast().catch(() => null),
        api.getItems().catch(() => [])
      ]);
      setSummary(sum);
      setLatestForecast(fc);
      setItemsList(items);
    } catch (e) {
      console.error(e);
    }
  };

  const hasData = summary && summary.total_records > 0;
  const highRiskItems = itemsList.filter((it) => it.stockout_pct >= 18);

  const totalPrepUnits = latestForecast
    ? latestForecast.items.reduce((acc, it) => acc + it.recommended_prep, 0)
    : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome & Hero Header */}
      <div className="bg-gradient-to-r from-cream-100 via-cream-200/50 to-cream-100 rounded-2xl p-6 sm:p-8 border border-cream-300 shadow-warm-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-terracotta-50 text-terracotta-700 text-xs font-semibold border border-terracotta-100">
              <Wheat className="w-3.5 h-3.5" />
              <span>Tomorrow's Tray · Bakery Intelligence</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-espresso-950 tracking-tight">
              Good morning, Baker. Let's plan tomorrow's bake.
            </h1>
            <p className="text-espresso-700 text-sm sm:text-base max-w-2xl leading-relaxed">
              Upload your POS exports, correct for hidden demand lost to early stockouts, and review recommended prep quantities with confidence intervals.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {!hasData ? (
              <button
                onClick={() => onNavigate('upload')}
                className="px-5 py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 text-sm font-semibold shadow-warm-sm transition-all flex items-center gap-2"
              >
                <span>Upload Sales CSV</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => onNavigate('forecast')}
                className="px-5 py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 text-sm font-semibold shadow-warm-sm transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>View Tomorrow's Forecast</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Next-Day Suggested Prep */}
        <div className="bg-cream-100/90 rounded-xl p-5 border border-cream-300 shadow-warm-sm space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-espresso-500 uppercase tracking-wider">
              Tomorrow's Suggested Prep
            </span>
            <div className="p-2 rounded-lg bg-sage-50 text-sage-600">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-serif font-bold text-espresso-950">
              {latestForecast ? `${totalPrepUnits} units` : hasData ? 'Ready to run' : '—'}
            </div>
            <p className="text-xs text-espresso-600 mt-1">
              {latestForecast
                ? `Across ${latestForecast.items.length} items for ${latestForecast.target_weekday}`
                : 'Generate your forecast for tomorrow'}
            </p>
          </div>
        </div>

        {/* Menu Items Tracked */}
        <div className="bg-cream-100/90 rounded-xl p-5 border border-cream-300 shadow-warm-sm space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-espresso-500 uppercase tracking-wider">
              Menu Items Tracked
            </span>
            <div className="p-2 rounded-lg bg-cream-200 text-espresso-700">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-serif font-bold text-espresso-950">
              {summary ? summary.unique_items : 0}
            </div>
            <p className="text-xs text-espresso-600 mt-1">
              {summary?.date_min && summary?.date_max
                ? `${summary.date_min} to ${summary.date_max}`
                : 'No dataset loaded yet'}
            </p>
          </div>
        </div>

        {/* Stockout Risk Rate */}
        <div className="bg-cream-100/90 rounded-xl p-5 border border-cream-300 shadow-warm-sm space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-espresso-500 uppercase tracking-wider">
              Historical Stockout Rate
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-serif font-bold text-espresso-950">
              {summary ? `${summary.stockout_rate_pct}%` : '0%'}
            </div>
            <p className="text-xs text-espresso-600 mt-1">
              {summary
                ? `${summary.stockout_count} sold-out days detected & corrected`
                : 'Awaiting sales data'}
            </p>
          </div>
        </div>

        {/* Estimated Latent Lost Demand */}
        <div className="bg-cream-100/90 rounded-xl p-5 border border-cream-300 shadow-warm-sm space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-espresso-500 uppercase tracking-wider">
              Estimated Uncaptured Demand
            </span>
            <div className="p-2 rounded-lg bg-terracotta-50 text-terracotta-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-serif font-bold text-terracotta-600">
              {summary ? `+${summary.estimated_lost_demand_units} units` : '0'}
            </div>
            <p className="text-xs text-espresso-600 mt-1">
              Latent demand from early stockouts before closing
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Sections: Stockout Risk Alerts & Next-day Prep Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Tomorrow's Forecast Snapshot */}
        <div className="lg:col-span-2 bg-cream-100 rounded-2xl p-6 border border-cream-300 shadow-warm-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-cream-300">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-terracotta-500" />
              <h2 className="font-serif font-bold text-lg text-espresso-950">
                {latestForecast
                  ? `Tomorrow's Tray: ${latestForecast.target_weekday} (${latestForecast.target_date})`
                  : "Tomorrow's Preparation Snapshot"}
              </h2>
            </div>
            {latestForecast && (
              <button
                onClick={() => onNavigate('prep')}
                className="text-xs font-semibold text-terracotta-600 hover:text-terracotta-700 flex items-center gap-1"
              >
                <span>Edit Prep List</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {!latestForecast ? (
            <div className="py-12 text-center space-y-3">
              <Wheat className="w-10 h-10 text-espresso-400 mx-auto" />
              <p className="text-espresso-700 font-medium text-sm">
                No forecast has been generated yet for tomorrow.
              </p>
              <button
                onClick={() => onNavigate('forecast')}
                className="px-4 py-2 bg-terracotta-500 text-cream-50 rounded-lg text-xs font-semibold shadow-warm-sm hover:bg-terracotta-600 transition-colors"
              >
                Generate Next-Day Forecast
              </button>
            </div>
          ) : (
            <div className="divide-y divide-cream-300/80">
              {latestForecast.items.slice(0, 5).map((it) => (
                <div key={it.item} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="font-medium text-sm text-espresso-900 block">
                      {it.item}
                    </span>
                    <p className="text-xs text-espresso-600 line-clamp-1">
                      {it.short_explanation}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-4 shrink-0">
                    <div className="text-xs text-espresso-500">
                      <span>Range: </span>
                      <strong className="text-espresso-800 font-medium">
                        {it.lower_bound}–{it.upper_bound}
                      </strong>
                    </div>
                    <div className="px-3 py-1 rounded-lg bg-sage-50 border border-sage-200 text-sage-700 font-bold text-sm">
                      Prep {it.recommended_prep}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Items with Stockout Vulnerability & Data Health */}
        <div className="space-y-6">
          {/* Stockout Risk items */}
          <div className="bg-cream-100 rounded-2xl p-6 border border-cream-300 shadow-warm-sm space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h3 className="font-serif font-bold text-base text-espresso-950">
                Stockout Risk Items
              </h3>
            </div>
            <p className="text-xs text-espresso-600">
              Items that frequently sell out hours before closing time, causing underestimated latent demand.
            </p>

            {highRiskItems.length === 0 ? (
              <div className="py-4 text-center text-xs text-espresso-500">
                No high-risk stockout items detected.
              </div>
            ) : (
              <div className="space-y-2.5">
                {highRiskItems.map((item) => (
                  <div
                    key={item.name}
                    className="p-3 rounded-xl bg-cream-50 border border-cream-300/90 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-xs font-semibold text-espresso-900 block">
                        {item.name}
                      </span>
                      <span className="text-[11px] text-espresso-500">
                        {item.stockout_count} recorded stockouts
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      {item.stockout_pct}% of days
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Censored Demand Statistical Note */}
          <div className="bg-cream-100 rounded-2xl p-5 border border-cream-300 shadow-warm-sm space-y-2.5">
            <div className="flex items-center gap-2 text-sage-700">
              <ShieldCheck className="w-4 h-4" />
              <span className="font-semibold text-xs uppercase tracking-wider">
                Censored Demand Correction Active
              </span>
            </div>
            <p className="text-xs text-espresso-700 leading-relaxed">
              When items sell out early, sales are treated as a statistical lower bound rather than true demand. Latent demand is estimated using Tobit conditional expectation and diurnal bakery footfall curves.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
