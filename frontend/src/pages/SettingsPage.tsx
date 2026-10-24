import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Bot,
  Cpu,
  Database,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { api } from '../api/client';
import type { OllamaStatus, TabPFNStatus, SalesSummary } from '../types';

interface SettingsPageProps {
  onDataReset: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onDataReset }) => {
  const [llmStatus, setLlmStatus] = useState<OllamaStatus | null>(null);
  const [tabpfnStatus, setTabpfnStatus] = useState<TabPFNStatus | null>(null);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [checking, setChecking] = useState<boolean>(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);

  useEffect(() => {
    refreshStatuses();
  }, []);

  const refreshStatuses = async () => {
    setChecking(true);
    try {
      const [llm, tp, sum] = await Promise.all([
        api.getLlmStatus().catch(() => null),
        api.getTabpfnStatus().catch(() => null),
        api.getSalesSummary().catch(() => null),
      ]);
      setLlmStatus(llm);
      setTabpfnStatus(tp);
      setSummary(sum);
    } catch (e) {
      console.error(e);
    } finally {
      setChecking(false);
    }
  };

  const handleResetData = async () => {
    setResetting(true);
    try {
      await api.resetData();
      setResetConfirmOpen(false);
      onDataReset();
      await refreshStatuses();
    } catch (e: any) {
      alert(e.message || 'Failed to reset data');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-terracotta-500" />
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-espresso-950">
              System Settings & Integrations
            </h1>
          </div>
          <p className="text-espresso-600 text-xs sm:text-sm mt-1">
            Check local machine learning engines, Ollama Gemma status, and manage persistent storage.
          </p>
        </div>

        <button
          onClick={refreshStatuses}
          disabled={checking}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-espresso-800 bg-cream-100 hover:bg-cream-200 border border-cream-300 rounded-xl shadow-warm-sm transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ollama / Gemma AI Explainer Status */}
        <div className="bg-cream-100 rounded-2xl p-6 border border-cream-300 shadow-warm-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-cream-200">
            <div className="flex items-center gap-2.5">
              <Bot className="w-5 h-5 text-terracotta-500" />
              <h3 className="font-serif font-bold text-base text-espresso-950">
                Gemma via Ollama
              </h3>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                llmStatus?.is_available
                  ? 'bg-sage-50 text-sage-700 border-sage-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {llmStatus?.is_available ? 'Connected' : 'Fallback Active'}
            </span>
          </div>

          <p className="text-xs text-espresso-600 leading-relaxed">
            {llmStatus?.status_message}
          </p>

          <div className="p-3.5 rounded-xl bg-cream-50 border border-cream-200 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-espresso-500">Service Endpoint:</span>
              <code className="font-mono text-espresso-900">{llmStatus?.base_url || 'http://localhost:11434'}</code>
            </div>
            <div className="flex justify-between">
              <span className="text-espresso-500">Gemma Model Found:</span>
              <strong className="text-espresso-900">{llmStatus?.has_gemma ? 'Yes' : 'No'}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-espresso-500">Active Explainer:</span>
              <strong className="text-espresso-900">
                {llmStatus?.is_available ? 'Local Gemma LLM' : 'Deterministic Statistical Template'}
              </strong>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-cream-200/50 border border-cream-300 text-[11px] text-espresso-700 space-y-1">
            <strong>Optional Local LLM Setup:</strong>
            <p>
              To run local Gemma, install Ollama and run:
              <code className="block bg-cream-100 p-1 rounded font-mono text-[10px] mt-1 text-espresso-900">
                ollama run gemma2:2b
              </code>
              No external API keys or paid cloud accounts are ever required.
            </p>
          </div>
        </div>

        {/* TabPFN / ML Forecaster Status */}
        <div className="bg-cream-100 rounded-2xl p-6 border border-cream-300 shadow-warm-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-cream-200">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-5 h-5 text-terracotta-500" />
              <h3 className="font-serif font-bold text-base text-espresso-950">
                TabPFN & Scikit-Learn Engines
              </h3>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                tabpfnStatus?.is_available
                  ? 'bg-sage-50 text-sage-700 border-sage-200'
                  : 'bg-sage-50 text-sage-700 border-sage-200'
              }`}
            >
              {tabpfnStatus?.is_available ? 'TabPFN Active' : 'Scikit-Learn Active'}
            </span>
          </div>

          <p className="text-xs text-espresso-600 leading-relaxed">
            {tabpfnStatus?.status_message}
          </p>

          <div className="p-3.5 rounded-xl bg-cream-50 border border-cream-200 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-espresso-500">Primary Model:</span>
              <strong className="text-espresso-900">Scikit-Learn Random Forest + Lags</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-espresso-500">Prediction Intervals:</span>
              <strong className="text-espresso-900">Calibrated Empirical Quantiles (P10–P90)</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-espresso-500">Censored Correction:</span>
              <strong className="text-espresso-900">Tobit Conditional Expectation + Diurnal Footfall</strong>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-cream-200/50 border border-cream-300 text-[11px] text-espresso-700 space-y-1">
            <strong>Foundation Model Integration:</strong>
            <p>
              Tomorrow's Tray uses modular model adapters. TabPFN is supported as an optional drop-in without breaking baseline reliability.
            </p>
          </div>
        </div>
      </div>

      {/* Database Storage & Reset Data Section */}
      <div className="bg-cream-100 rounded-2xl p-6 border border-cream-300 shadow-warm-sm space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-cream-200">
          <Database className="w-5 h-5 text-espresso-700" />
          <h3 className="font-serif font-bold text-base text-espresso-950">
            Local SQLite Persistent Storage
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-cream-50 border border-cream-200">
            <span className="text-espresso-500 block">Total Records:</span>
            <strong className="text-base font-serif font-bold text-espresso-900">
              {summary ? summary.total_records : 0}
            </strong>
          </div>

          <div className="p-3 rounded-xl bg-cream-50 border border-cream-200">
            <span className="text-espresso-500 block">Unique Items:</span>
            <strong className="text-base font-serif font-bold text-espresso-900">
              {summary ? summary.unique_items : 0}
            </strong>
          </div>

          <div className="p-3 rounded-xl bg-cream-50 border border-cream-200">
            <span className="text-espresso-500 block">Database Path:</span>
            <code className="text-[11px] text-espresso-800 font-mono block mt-0.5 truncate">
              data/tomorrows_tray.db
            </code>
          </div>
        </div>

        {/* Danger Zone: Reset Data */}
        <div className="pt-2 border-t border-cream-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="font-serif font-bold text-sm text-espresso-950">
              Reset Application Data
            </h4>
            <p className="text-xs text-espresso-600">
              Clears all stored POS sales, forecasts, and prep lists. Useful for testing new datasets.
            </p>
          </div>

          {!resetConfirmOpen ? (
            <button
              onClick={() => setResetConfirmOpen(true)}
              className="px-4 py-2 bg-cream-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-espresso-800 text-xs font-semibold rounded-xl border border-cream-300 transition-colors flex items-center gap-2 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset All Records...</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-red-700">Confirm wipe?</span>
              <button
                onClick={handleResetData}
                disabled={resetting}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-cream-50 text-xs font-bold rounded-lg shadow-warm-sm transition-colors"
              >
                {resetting ? 'Resetting...' : 'Yes, Wipe Everything'}
              </button>
              <button
                onClick={() => setResetConfirmOpen(false)}
                className="px-3 py-1.5 bg-cream-200 hover:bg-cream-300 text-espresso-800 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
