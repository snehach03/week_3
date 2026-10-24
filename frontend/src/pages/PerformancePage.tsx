import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  ShieldCheck,
  RefreshCw,
  Award,
  Calendar
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';
import { api } from '../api/client';
import type { BacktestResponse } from '../types';

export const PerformancePage: React.FC = () => {
  const [backtest, setBacktest] = useState<BacktestResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [windowDays, setWindowDays] = useState<number>(21);

  useEffect(() => {
    loadPerformance();
  }, []);

  const loadPerformance = async () => {
    setLoading(true);
    try {
      const data = await api.getModelPerformance();
      if (data) {
        setBacktest(data);
      } else {
        await handleRunBacktest(21);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRunBacktest = async (days: number = windowDays) => {
    setLoading(true);
    try {
      const data = await api.runBacktest(days);
      setBacktest(data);
    } catch (err: any) {
      alert(err.message || 'Backtest evaluation failed.');
    } finally {
      setLoading(false);
    }
  };

  // Metric Comparison Data for Recharts
  const getComparisonBarData = () => {
    if (!backtest) return [];
    const models = backtest.overall;
    return [
      {
        metric: 'MAE (Units)',
        'Seasonal Naive (t-7)': models.seasonal_naive?.mae || 0,
        '4-Week Moving Avg': models.four_week_ma?.mae || 0,
        "Tomorrow's Tray (ML)": models.ml_model?.mae || 0,
      },
      {
        metric: 'RMSE (Units)',
        'Seasonal Naive (t-7)': models.seasonal_naive?.rmse || 0,
        '4-Week Moving Avg': models.four_week_ma?.rmse || 0,
        "Tomorrow's Tray (ML)": models.ml_model?.rmse || 0,
      },
      {
        metric: 'WAPE (%)',
        'Seasonal Naive (t-7)': models.seasonal_naive?.wape || 0,
        '4-Week Moving Avg': models.four_week_ma?.wape || 0,
        "Tomorrow's Tray (ML)": models.ml_model?.wape || 0,
      },
    ];
  };

  // Find best model on MAE
  const getWinningModel = () => {
    if (!backtest || !backtest.overall) return null;
    const { seasonal_naive, four_week_ma, ml_model } = backtest.overall;
    const scores = [
      { name: "Tomorrow's Tray (ML)", mae: ml_model?.mae ?? 999 },
      { name: '4-Week Moving Average', mae: four_week_ma?.mae ?? 999 },
      { name: 'Seasonal Naive (t-7)', mae: seasonal_naive?.mae ?? 999 },
    ];
    scores.sort((a, b) => a.mae - b.mae);
    return scores[0];
  };

  const winner = getWinningModel();

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      {/* Page Header & Window Controller */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-terracotta-500" />
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-espresso-950">
              Model Performance & Rolling Backtest
            </h1>
          </div>
          <p className="text-espresso-600 text-xs sm:text-sm mt-1">
            Empirical historical validation using expanding-window backtesting without future data leakage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-cream-100 px-3 py-1.5 rounded-xl border border-cream-300 text-xs">
            <Calendar className="w-3.5 h-3.5 text-espresso-500" />
            <label className="font-semibold text-espresso-700">Backtest Window:</label>
            <select
              value={windowDays}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setWindowDays(val);
                handleRunBacktest(val);
              }}
              className="bg-transparent font-medium text-espresso-950 focus:outline-none cursor-pointer"
            >
              <option value={14}>Last 14 Days</option>
              <option value={21}>Last 21 Days (3 Weeks)</option>
              <option value={28}>Last 28 Days (4 Weeks)</option>
            </select>
          </div>

          <button
            onClick={() => handleRunBacktest(windowDays)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 text-xs font-semibold rounded-xl shadow-warm-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Evaluating...' : 'Re-run Evaluation'}</span>
          </button>
        </div>
      </div>

      {backtest && (
        <>
          {/* Honest Performance Callout */}
          <div className="bg-cream-100 rounded-2xl p-6 border border-cream-300 shadow-warm-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-sage-50 text-sage-600 border border-sage-200 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif font-bold text-base text-espresso-950">
                  Top Performing Model: {winner?.name}
                </h3>
                <p className="text-xs text-espresso-600 leading-relaxed max-w-2xl">
                  Evaluated across {backtest.window_days} test dates ({backtest.start_date} to {backtest.end_date}) on {backtest.overall.ml_model?.sample_size} total test observations.
                  {winner?.name === "Tomorrow's Tray (ML)"
                    ? " The ML model achieved the lowest Mean Absolute Error, leveraging day-of-week seasonality and stockout corrections."
                    : " The statistical baseline was competitive on this sample size. Tomorrow's Tray transparently reports this result."}
                </p>
              </div>
            </div>

            <div className="px-4 py-2 rounded-xl bg-cream-50 border border-cream-300 text-right shrink-0">
              <span className="text-[10px] font-semibold text-espresso-500 uppercase tracking-wider block">
                Lowest Test MAE
              </span>
              <span className="font-serif font-bold text-xl text-sage-700">
                {winner?.mae} units
              </span>
            </div>
          </div>

          {/* Three Model Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Baseline 1 */}
            <div className="bg-cream-100 rounded-2xl p-5 border border-cream-300 shadow-warm-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-serif font-bold text-sm text-espresso-900">
                  Seasonal Naive (t - 7)
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-cream-200 text-espresso-600">
                  Simple Baseline
                </span>
              </div>
              <p className="text-xs text-espresso-500">
                Uses exact sales from same weekday last week.
              </p>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-cream-200 text-center">
                <div>
                  <span className="text-[10px] text-espresso-500 block">MAE</span>
                  <strong className="text-sm font-bold text-espresso-900">
                    {backtest.overall.seasonal_naive?.mae}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-espresso-500 block">WAPE</span>
                  <strong className="text-sm font-bold text-espresso-900">
                    {backtest.overall.seasonal_naive?.wape}%
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-espresso-500 block">RMSE</span>
                  <strong className="text-sm font-bold text-espresso-900">
                    {backtest.overall.seasonal_naive?.rmse}
                  </strong>
                </div>
              </div>
            </div>

            {/* Baseline 2 */}
            <div className="bg-cream-100 rounded-2xl p-5 border border-cream-300 shadow-warm-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-serif font-bold text-sm text-espresso-900">
                  4-Week Moving Average
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-cream-200 text-espresso-600">
                  Rolling Baseline
                </span>
              </div>
              <p className="text-xs text-espresso-500">
                Averages the last 4 comparable same-weekdays.
              </p>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-cream-200 text-center">
                <div>
                  <span className="text-[10px] text-espresso-500 block">MAE</span>
                  <strong className="text-sm font-bold text-espresso-900">
                    {backtest.overall.four_week_ma?.mae}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-espresso-500 block">WAPE</span>
                  <strong className="text-sm font-bold text-espresso-900">
                    {backtest.overall.four_week_ma?.wape}%
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-espresso-500 block">RMSE</span>
                  <strong className="text-sm font-bold text-espresso-900">
                    {backtest.overall.four_week_ma?.rmse}
                  </strong>
                </div>
              </div>
            </div>

            {/* Tomorrow's Tray Model */}
            <div className="bg-cream-100 rounded-2xl p-5 border-2 border-terracotta-500/80 shadow-warm-sm space-y-3 bg-terracotta-50/10">
              <div className="flex items-center justify-between">
                <span className="font-serif font-bold text-sm text-espresso-950">
                  Tomorrow's Tray (ML)
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-terracotta-100 text-terracotta-700">
                  Active Model
                </span>
              </div>
              <p className="text-xs text-espresso-500">
                Random Forest + Lags + Censored Correction.
              </p>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-cream-200 text-center">
                <div>
                  <span className="text-[10px] text-espresso-500 block">MAE</span>
                  <strong className="text-sm font-bold text-terracotta-600">
                    {backtest.overall.ml_model?.mae}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-espresso-500 block">WAPE</span>
                  <strong className="text-sm font-bold text-terracotta-600">
                    {backtest.overall.ml_model?.wape}%
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-espresso-500 block">P10-90 Coverage</span>
                  <strong className="text-sm font-bold text-sage-700">
                    {backtest.overall.ml_model?.coverage_rate !== null ? `${backtest.overall.ml_model?.coverage_rate}%` : 'N/A'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Model Comparison Chart & Uncensored Ground Truth Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Chart (7 cols) */}
            <div className="lg:col-span-7 bg-cream-100 rounded-2xl p-6 border border-cream-300 shadow-warm-sm space-y-4">
              <h3 className="font-serif font-bold text-base text-espresso-950">
                Error Metrics Comparison Across Models
              </h3>
              <p className="text-xs text-espresso-500">
                Lower MAE, WAPE, and RMSE represent higher accuracy.
              </p>
              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getComparisonBarData()} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                    <XAxis dataKey="metric" tick={{ fill: '#8E7060', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#8E7060', fontSize: 11 }} />
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
                    <Bar dataKey="Seasonal Naive (t-7)" fill="#D9C8BE" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="4-Week Moving Avg" fill="#8E7060" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Tomorrow's Tray (ML)" fill="#C86D51" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Uncensored vs Censored Reporting (5 cols) */}
            <div className="lg:col-span-5 bg-cream-100 rounded-2xl p-6 border border-cream-300 shadow-warm-sm space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sage-600" />
                <h3 className="font-serif font-bold text-base text-espresso-950">
                  Uncensored Observation Testing
                </h3>
              </div>
              <p className="text-xs text-espresso-600 leading-relaxed">
                When evaluating forecasts against stockout days, observed sales are right-censored. Below is accuracy specifically on uncensored days where observed sales represent unconstrained ground truth:
              </p>

              <div className="p-4 rounded-xl bg-cream-50 border border-cream-200 space-y-3 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-cream-200">
                  <span className="text-espresso-600">Tomorrow's Tray (ML) Uncensored MAE:</span>
                  <strong className="text-espresso-900 font-bold text-sm">
                    {backtest.uncensored_comparison?.ml_model?.mae} units
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-cream-200">
                  <span className="text-espresso-600">4-Week Moving Avg Uncensored MAE:</span>
                  <strong className="text-espresso-900 font-bold text-sm">
                    {backtest.uncensored_comparison?.four_week_ma?.mae} units
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-espresso-600">Seasonal Naive Uncensored MAE:</span>
                  <strong className="text-espresso-900 font-bold text-sm">
                    {backtest.uncensored_comparison?.seasonal_naive?.mae} units
                  </strong>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-semibold text-espresso-500 uppercase tracking-wider block">
                  Methodology Limitations
                </span>
                <ul className="list-disc pl-4 text-[11px] text-espresso-600 space-y-1">
                  {backtest.limitations.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Per-Item Performance Table */}
          <div className="bg-cream-100 rounded-2xl p-6 border border-cream-300 shadow-warm-sm space-y-4">
            <h3 className="font-serif font-bold text-base text-espresso-950">
              Per-Item Performance Breakdown
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-cream-200/80 text-espresso-700 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Item</th>
                    <th className="px-3 py-3 text-center">Evaluated Days</th>
                    <th className="px-3 py-3 text-center">Stockout Days</th>
                    <th className="px-3 py-3 text-center">Seasonal Naive MAE</th>
                    <th className="px-3 py-3 text-center">4-Week MA MAE</th>
                    <th className="px-3 py-3 text-center">Tomorrow's Tray MAE</th>
                    <th className="px-3 py-3 text-center rounded-r-lg">P10–P90 Coverage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {backtest.per_item.map((it) => (
                    <tr key={it.item} className="hover:bg-cream-200/40">
                      <td className="px-4 py-3 font-serif font-bold text-espresso-950">
                        {it.item}
                      </td>
                      <td className="px-3 py-3 text-center text-espresso-700 font-mono">
                        {it.sample_size}
                      </td>
                      <td className="px-3 py-3 text-center font-mono">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          {it.stockout_sample_size}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-espresso-700">
                        {it.models.seasonal_naive?.mae}
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-espresso-700">
                        {it.models.four_week_ma?.mae}
                      </td>
                      <td className="px-3 py-3 text-center font-mono font-bold text-terracotta-600">
                        {it.models.ml_model?.mae}
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-sage-700 font-semibold">
                        {it.models.ml_model?.coverage_rate !== null ? `${it.models.ml_model?.coverage_rate}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
