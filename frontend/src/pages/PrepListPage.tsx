import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Save,
  CheckCircle,
  FileSpreadsheet,
  Wheat,
  Plus,
  Minus
} from 'lucide-react';
import { api } from '../api/client';
import type { PrepListResponse, PrepItem } from '../types';

export const PrepListPage: React.FC = () => {
  const [prepList, setPrepList] = useState<PrepListResponse | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Local state for edits
  const [items, setItems] = useState<PrepItem[]>([]);

  useEffect(() => {
    loadPrepList();
  }, []);

  const loadPrepList = async () => {
    try {
      const data = await api.getLatestPrepList();
      if (data) {
        setPrepList(data);
        setItems(data.items);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleQuantityChange = (itemName: string, newQty: number) => {
    setSavedSuccess(false);
    const validQty = Math.max(0, Math.round(newQty));
    setItems((prev) =>
      prev.map((it) => {
        if (it.item === itemName) {
          const isOverridden = validQty !== it.suggested_prep;
          return {
            ...it,
            final_quantity: validQty,
            is_overridden: isOverridden,
          };
        }
        return it;
      })
    );
  };

  const handleNotesChange = (itemName: string, notes: string) => {
    setSavedSuccess(false);
    setItems((prev) =>
      prev.map((it) => (it.item === itemName ? { ...it, baker_notes: notes } : it))
    );
  };

  const handleResetToAI = (itemName: string) => {
    setSavedSuccess(false);
    setItems((prev) =>
      prev.map((it) => {
        if (it.item === itemName) {
          return {
            ...it,
            final_quantity: it.suggested_prep,
            is_overridden: false,
          };
        }
        return it;
      })
    );
  };

  const handleSave = async () => {
    if (!prepList) return;
    setSaving(true);
    try {
      const payload = items.map((it) => ({
        item: it.item,
        final_quantity: it.final_quantity,
        is_overridden: it.is_overridden,
        baker_notes: it.baker_notes,
      }));

      const res = await api.savePrepList(prepList.target_date, payload);
      setPrepList(res);
      setItems(res.items);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (e: any) {
      alert(e.message || 'Failed to save prep list');
    } finally {
      setSaving(false);
    }
  };

  const totalFinalUnits = items.reduce((sum, it) => sum + it.final_quantity, 0);
  const totalSuggestedUnits = items.reduce((sum, it) => sum + it.suggested_prep, 0);
  const overriddenCount = items.filter((it) => it.is_overridden).length;

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-terracotta-500" />
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-espresso-950">
              Baker's Preparation List
            </h1>
          </div>
          <p className="text-espresso-600 text-xs sm:text-sm mt-1">
            {prepList
              ? `Production sheet for ${prepList.target_date} · Review AI suggestions, adjust quantities, and print or export.`
              : 'Production sheet for tomorrow.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {prepList && (
            <a
              href={api.getPrepListExportUrl(prepList.target_date)}
              download
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-espresso-800 bg-cream-100 hover:bg-cream-200 border border-cream-300 rounded-xl shadow-warm-sm transition-all"
            >
              <FileSpreadsheet className="w-4 h-4 text-sage-600" />
              <span>Export CSV for Kitchen</span>
            </a>
          )}

          <button
            onClick={handleSave}
            disabled={saving || items.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-cream-50 bg-terracotta-500 hover:bg-terracotta-600 disabled:opacity-50 rounded-xl shadow-warm-sm transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Prep List'}</span>
          </button>
        </div>
      </div>

      {/* Save Success Alert */}
      {savedSuccess && (
        <div className="p-4 rounded-xl bg-sage-50 border border-sage-200 text-sage-800 flex items-center gap-3 animate-fade-in text-xs font-medium">
          <CheckCircle className="w-5 h-5 text-sage-600 shrink-0" />
          <span>Preparation list saved successfully to local SQLite storage.</span>
        </div>
      )}

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-cream-100 p-4 rounded-xl border border-cream-300 shadow-warm-sm">
          <span className="text-[11px] font-semibold text-espresso-500 uppercase tracking-wider block">
            Total Kitchen Units to Bake
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-serif font-bold text-espresso-950">
              {totalFinalUnits}
            </span>
            <span className="text-xs text-espresso-500">
              (AI suggested: {totalSuggestedUnits})
            </span>
          </div>
        </div>

        <div className="bg-cream-100 p-4 rounded-xl border border-cream-300 shadow-warm-sm">
          <span className="text-[11px] font-semibold text-espresso-500 uppercase tracking-wider block">
            Items Overridden by Baker
          </span>
          <div className="text-3xl font-serif font-bold text-terracotta-600 mt-1">
            {overriddenCount} <span className="text-sm font-sans font-normal text-espresso-500">of {items.length}</span>
          </div>
        </div>

        <div className="bg-cream-100 p-4 rounded-xl border border-cream-300 shadow-warm-sm">
          <span className="text-[11px] font-semibold text-espresso-500 uppercase tracking-wider block">
            Decision Integrity
          </span>
          <p className="text-xs text-espresso-700 mt-1 leading-snug">
            AI recommendations remain immutable; your overrides are recorded distinctly alongside kitchen notes.
          </p>
        </div>
      </div>

      {/* Main Table */}
      {items.length === 0 ? (
        <div className="bg-cream-100 rounded-2xl p-12 text-center border border-cream-300 space-y-3">
          <Wheat className="w-12 h-12 text-espresso-400 mx-auto" />
          <h3 className="font-serif font-bold text-base text-espresso-900">
            No active preparation list
          </h3>
          <p className="text-xs text-espresso-600">
            Please run tomorrow's forecast first or load the demo dataset.
          </p>
        </div>
      ) : (
        <div className="bg-cream-100 rounded-2xl border border-cream-300 shadow-warm-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-cream-200/80 text-espresso-700 font-semibold uppercase tracking-wider text-[11px] border-b border-cream-300">
                <tr>
                  <th className="px-5 py-3.5">Item</th>
                  <th className="px-4 py-3.5 text-center">Expected Demand</th>
                  <th className="px-4 py-3.5 text-center">AI Suggested Prep</th>
                  <th className="px-6 py-3.5 text-center">Final Baker Quantity</th>
                  <th className="px-4 py-3.5">Difference</th>
                  <th className="px-5 py-3.5">AI Reasoning</th>
                  <th className="px-5 py-3.5">Baker Kitchen Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {items.map((it) => {
                  const diff = it.final_quantity - it.suggested_prep;
                  return (
                    <tr
                      key={it.item}
                      className={`hover:bg-cream-200/30 transition-colors ${
                        it.is_overridden ? 'bg-terracotta-50/20' : ''
                      }`}
                    >
                      {/* Item Name */}
                      <td className="px-5 py-4 font-serif font-bold text-sm text-espresso-950">
                        {it.item}
                        {it.is_overridden && (
                          <span className="block text-[10px] font-sans font-medium text-terracotta-600 mt-0.5">
                            Modified by Baker
                          </span>
                        )}
                      </td>

                      {/* Expected Demand */}
                      <td className="px-4 py-4 text-center font-mono font-medium text-espresso-700 text-sm">
                        {it.forecast_point.toFixed(1)}
                      </td>

                      {/* AI Suggested Prep */}
                      <td className="px-4 py-4 text-center">
                        <span className="px-2.5 py-1 rounded-lg bg-cream-200 text-espresso-900 font-bold text-sm">
                          {it.suggested_prep}
                        </span>
                      </td>

                      {/* Final Baker Quantity with Stepper */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleQuantityChange(it.item, it.final_quantity - 1)}
                            className="w-7 h-7 rounded-lg bg-cream-200 hover:bg-cream-300 text-espresso-800 flex items-center justify-center transition-colors"
                            title="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>

                          <input
                            type="number"
                            min={0}
                            value={it.final_quantity}
                            onChange={(e) => handleQuantityChange(it.item, parseInt(e.target.value) || 0)}
                            className={`w-16 px-2 py-1 text-center rounded-lg font-bold text-sm border focus:outline-none focus:ring-2 focus:ring-terracotta-500 ${
                              it.is_overridden
                                ? 'bg-cream-50 border-terracotta-500 text-terracotta-700'
                                : 'bg-cream-50 border-cream-300 text-espresso-950'
                            }`}
                          />

                          <button
                            onClick={() => handleQuantityChange(it.item, it.final_quantity + 1)}
                            className="w-7 h-7 rounded-lg bg-cream-200 hover:bg-cream-300 text-espresso-800 flex items-center justify-center transition-colors"
                            title="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Difference Badge */}
                      <td className="px-4 py-4 text-center">
                        {diff === 0 ? (
                          <span className="text-[11px] text-espresso-400 font-mono">0</span>
                        ) : diff > 0 ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sage-50 text-sage-700 border border-sage-200">
                            +{diff}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            {diff}
                          </span>
                        )}
                        {it.is_overridden && (
                          <button
                            onClick={() => handleResetToAI(it.item)}
                            className="block mx-auto text-[10px] text-espresso-500 hover:text-espresso-800 underline mt-1"
                            title="Reset to AI suggestion"
                          >
                            Reset
                          </button>
                        )}
                      </td>

                      {/* AI Reasoning */}
                      <td className="px-5 py-4 text-espresso-700 max-w-xs leading-relaxed text-xs">
                        {it.reason || 'Standard weekday historical forecast.'}
                      </td>

                      {/* Baker Notes Input */}
                      <td className="px-5 py-4">
                        <input
                          type="text"
                          value={it.baker_notes}
                          onChange={(e) => handleNotesChange(it.item, e.target.value)}
                          placeholder="e.g. Extra for catering, batch sizing..."
                          className="w-full px-3 py-1.5 rounded-lg bg-cream-50 border border-cream-300 text-xs text-espresso-900 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
