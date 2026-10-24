import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Layers,
  Sliders,
  RefreshCw,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import { api } from '../api/client';
import type { ForecastResponse } from '../types';
import { ConfidenceIntervalBar } from '../components/ConfidenceIntervalBar';

interface ForecastPageProps {
  onNavigateToPrep: () => void;
}

export const ForecastPage: React.FC<ForecastPageProps> = ({ onNavigateToPrep }) => {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [itemHistory, setItemHistory] = useState<any[]>([]);

  // Forecast settings
  const [modelName, setModelName] = useState<string>('auto');
  const [serviceLevel, setServiceLevel] = useState<number>(0.85);

  useEffect(() => {
    fetchLatestForecast();
  }, []);

  useEffect(() => {
    if (selectedItem) {
      loadItemHistory(selectedItem);
    }
  }, [selectedItem]);

  const fetchLatestForecast = async () => {
    setLoading(true);
    try {
      const fc = await api.getLatestForecast();
      if (fc && fc.items.length > 0) {
        setForecast(fc);
        setSelectedItem(fc.items[0].item);
      } else {
        // If no latest run, generate automatically
        await handleRunForecast();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRunForecast = async () => {
    setLoading(true);
    try {
      const res = await api.generateForecast(modelName, serviceLevel);
      setForecast(res);
      if (res.items.length > 0 && !selectedItem) {
        setSelectedItem(res.items[0].item);
      }
    } catch (err: any) {
      alert(err.message || 'Forecast generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const loadItemHistory = async (itemName: string) => {
    try {
      const res = await fetch(`/api/sales/records?item=${encodeURIComponent(itemName)}&limit=30`);
      if (res.ok) {
        const data = await res.json();
        // Sort ascending for chart
        const sorted = data.reverse();
        setItemHistory(sorted);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const activeItemObj = forecast?.items.find((it) => it.item === selectedItem);

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      {/* Top Controls Bar */}
      <div className="bg-cream-100 rounded-2xl p-6 border border-cream-300 shadow-warm-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-terracotta-500" />
              <h1 className="text-xl sm:text-2xl font-serif font-bold text-espresso-950">
                Tomorrow's Demand Forecast
              </h1>
            </div>
            <p className="text-espresso-600 text-xs sm:text-sm mt-0.5">
              {forecast
                ? `Forecast for ${forecast.target_weekday}, ${forecast.target_date} · Model: ${forecast.model_name}`
                : 'Select options and compute AI preparation recommendations.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Model Selector */}
            <div className="flex items-center gap-2 bg-cream-50 px-3 py-1.5 rounded-xl border border-cream-300 text-xs">
              <Layers className="w-3.5 h-3.5 text-espresso-500" />
              <label className="font-semibold text-espresso-700">Model:</label>
              <select
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="bg-transparent font-medium text-espresso-950 focus:outline-none cursor-pointer"
              >
                <option value="auto">Auto (Best Model Selection)</option>
                <option value="ml_rf">Machine Learning (Random Forest)</option>
                <option value="moving_average">4-Week Same-Weekday Average</option>
                <option value="seasonal_naive">Seasonal Naive (t - 7)</option>
                <option value="tabpfn">TabPFN (Foundation Model)</option>
              </select>
            </div>

            {/* Service Level Buffer Slider */}
            <div className="flex items-center gap-2 bg-cream-50 px-3 py-1.5 rounded-xl border border-cream-300 text-xs">
              <Sliders className="w-3.5 h-3.5 text-espresso-500" />
              <label className="font-semibold text-espresso-700">Service Level:</label>
              <select
                value={serviceLevel}
                onChange={(e) => setServiceLevel(parseFloat(e.target.value))}
                className="bg-transparent font-medium text-espresso-950 focus:outline-none cursor-pointer"
              >
                <option value={0.70}>70% (Lean Prep, Minimal Waste)</option>
                <option value={0.85}>85% (Balanced Bakery Standard)</option>
                <option value={0.95}>95% (High Availability / Zero Stockout)</option>
              </select>
            </div>

            {/* Run Button */}
            <button
              onClick={handleRunForecast}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 disabled:opacity-50 text-cream-50 text-xs font-semibold rounded-xl shadow-warm-sm transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Calculating...' : 'Recalculate'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Forecast Items Table/Cards & Interactive Detail Panel */}
      {forecast && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (7 cols): Items List with Confidence Interval Bars */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-cream-100 rounded-2xl p-5 border border-cream-300 shadow-warm-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-cream-300">
                <span className="text-xs font-semibold text-espresso-600 uppercase tracking-wider">
                  Menu Item Forecasts ({forecast.items.length})
                </span>
                <span className="text-xs text-espresso-500">
                  Click an item to view historical sales chart
                </span>
              </div>

              <div className="space-y-3">
                {forecast.items.map((it) => {
                  const isSelected = it.item === selectedItem;
                  return (
                    <div
                      key={it.item}
                      onClick={() => setSelectedItem(it.item)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-cream-50 border-terracotta-500 ring-1 ring-terracotta-500 shadow-warm-sm'
                          : 'bg-cream-50/70 border-cream-300/80 hover:bg-cream-50 hover:border-cream-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className="font-serif font-bold text-sm sm:text-base text-espresso-950">
                            {it.item}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                              it.data_sufficiency === 'robust'
                                ? 'bg-sage-50 text-sage-700 border-sage-200'
                                : it.data_sufficiency === 'moderate'
                                ? 'bg-cream-200 text-espresso-700 border-cream-300'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {it.data_sufficiency} data
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-[10px] text-espresso-500 block uppercase tracking-wider">
                              Suggested Prep
                            </span>
                            <span className="font-serif font-bold text-lg text-sage-700">
                              {it.recommended_prep}
                            </span>
                          </div>
                          <ChevronRight
                            className={`w-4 h-4 text-espresso-400 transition-transform ${
                              isSelected ? 'rotate-90 text-terracotta-600' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {/* Uncertainty Range Bar */}
                      <ConfidenceIntervalBar
                        lower={it.lower_bound}
                        point={it.point_forecast}
                        upper={it.upper_bound}
                        prep={it.recommended_prep}
                      />

                      {/* AI Short Explanation */}
                      <p className="text-xs text-espresso-600 mt-2.5 pt-2 border-t border-cream-200/80 leading-relaxed italic">
                        "{it.short_explanation}"
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Quick-Action to Prep List */}
              <div className="pt-3 flex justify-end">
                <button
                  onClick={onNavigateToPrep}
                  className="px-5 py-2.5 bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 text-xs font-semibold rounded-xl shadow-warm-sm transition-all flex items-center gap-2"
                >
                  <span>Review & Customize Prep List</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Historical Chart & Censored Demand Inspection */}
          <div className="lg:col-span-5 space-y-5">
            {activeItemObj && (
              <div className="bg-cream-100 rounded-2xl p-5 border border-cream-300 shadow-warm-sm space-y-4 sticky top-20">
                <div className="flex items-center justify-between pb-3 border-b border-cream-300">
                  <div>
                    <h3 className="font-serif font-bold text-base text-espresso-950">
                      {activeItemObj.item}
                    </h3>
                    <span className="text-xs text-espresso-500 block">
                      30-Day Sales & Stockout Demand History
                    </span>
                  </div>
                  <div className="px-3 py-1 bg-sage-50 text-sage-700 border border-sage-200 rounded-lg text-xs font-bold">
                    Prep {activeItemObj.recommended_prep} units
                  </div>
                </div>

                {/* Recharts Historical Timeline Chart */}
                <div className="h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={itemHistory} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d) => d.slice(5)} // MM-DD
                        tick={{ fill: '#8E7060', fontSize: 10 }}
                        interval={4}
                      />
                      <YAxis tick={{ fill: '#8E7060', fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#FAF6ED',
                          borderColor: '#E5DBC7',
                          borderRadius: '8px',
                          fontSize: '11px',
                          color: '#2D1C15',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar
                        dataKey="quantity_sold"
                        name="Observed Sales"
                        fill="#5C7A63"
                        radius={[3, 3, 0, 0]}
                      />
                      <Line
                        type="monotone"
                        dataKey="estimated_demand"
                        name="Censored Latent Demand"
                        stroke="#C86D51"
                        strokeWidth={2}
                        dot={{ r: 2.5, fill: '#C86D51' }}
                      />
                      <ReferenceLine
                        y={activeItemObj.point_forecast}
                        stroke="#2D1C15"
                        strokeDasharray="3 3"
                        label={{
                          value: `Tomorrow: ${activeItemObj.point_forecast}`,
                          fill: '#2D1C15',
                          fontSize: 10,
                          position: 'top',
                        }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Evidence Stats Card */}
                <div className="p-3.5 rounded-xl bg-cream-50 border border-cream-200 space-y-2 text-xs">
                  <span className="font-semibold text-espresso-800 uppercase tracking-wider text-[10px] block">
                    Forecasting Evidence & Parameters
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-espresso-700">
                    <div>
                      <span className="text-espresso-500 block">Method:</span>
                      <strong className="text-espresso-900 font-semibold">{activeItemObj.forecast_method}</strong>
                    </div>
                    <div>
                      <span className="text-espresso-500 block">Same-Weekday Avg:</span>
                      <strong className="text-espresso-900 font-semibold">
                        {activeItemObj.stats.same_dow_avg ? `${activeItemObj.stats.same_dow_avg} units` : 'N/A'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-espresso-500 block">Recent Stockouts:</span>
                      <strong className="text-amber-700 font-semibold">
                        {activeItemObj.stats.stockout_count || 0} days
                      </strong>
                    </div>
                    <div>
                      <span className="text-espresso-500 block">Recent 7-Day Trend:</span>
                      <strong className="text-espresso-900 font-semibold capitalize">
                        {activeItemObj.stats.trend_direction || 'Steady'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Statistically Honest Baker Callout */}
                <div className="p-3 rounded-xl bg-cream-200/50 border border-cream-300 text-[11px] text-espresso-700 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-terracotta-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>The baker makes the final decision.</strong> Recommended prep incorporates an 85% availability buffer to prevent high-margin morning stockouts.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
