import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Download,
  RefreshCw,
  Sliders,
  ArrowRight,
  Database
} from 'lucide-react';
import { api } from '../api/client';
import type { CSVValidationReport, ColumnMapping } from '../types';

interface UploadPageProps {
  onUploadSuccess: () => void;
}

export const UploadPage: React.FC<UploadPageProps> = ({ onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [loadingDemo, setLoadingDemo] = useState<boolean>(false);
  const [report, setReport] = useState<CSVValidationReport | null>(null);
  const [showMapping, setShowMapping] = useState<boolean>(false);

  // Column mapping states
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: 'date',
    item: 'item',
    quantity_sold: 'quantity_sold',
    sold_out_time: 'sold_out_time',
    closing_time: 'closing_time',
    unit_price: 'unit_price',
    notes: 'notes',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setReport(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setReport(null);
    }
  };

  const handleProcessUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const rep = await api.uploadCSV(selectedFile, showMapping ? mapping : undefined);
      setReport(rep);
      if (rep.is_valid) {
        onUploadSuccess();
      }
    } catch (err: any) {
      setReport({
        is_valid: false,
        total_raw_rows: 0,
        valid_aggregated_rows: 0,
        items_count: 0,
        items: [],
        stockouts_detected: 0,
        zero_sales_count: 0,
        missing_dates_count: 0,
        duplicates_aggregated: 0,
        errors: [err.message || 'Failed to upload CSV file.'],
        warnings: [],
        preview: [],
      });
    } finally {
      setUploading(false);
    }
  };

  const handleLoadDemo = async () => {
    setLoadingDemo(true);
    try {
      const rep = await api.loadDemoData(75);
      setReport(rep);
      if (rep.is_valid) {
        onUploadSuccess();
      }
    } catch (err: any) {
      alert(err.message || 'Demo data loading failed');
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-espresso-950">
            Upload Bakery Sales Data
          </h1>
          <p className="text-espresso-600 text-sm mt-1">
            Import POS export CSVs. Columns are automatically mapped or can be customized to match your system.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={api.getSampleCsvUrl()}
            download
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-espresso-800 bg-cream-100 hover:bg-cream-200 border border-cream-300 rounded-xl shadow-warm-sm transition-all"
          >
            <Download className="w-3.5 h-3.5 text-terracotta-600" />
            <span>Download Sample CSV</span>
          </a>

          <button
            onClick={handleLoadDemo}
            disabled={loadingDemo}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-cream-50 bg-terracotta-500 hover:bg-terracotta-600 rounded-xl shadow-warm-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDemo ? 'animate-spin' : ''}`} />
            <span>Load 75-Day Demo Data</span>
          </button>
        </div>
      </div>

      {/* Main Upload Box & Column Mapping Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              selectedFile
                ? 'border-terracotta-500 bg-terracotta-50/40'
                : 'border-cream-300 bg-cream-100/70 hover:bg-cream-200/50 hover:border-terracotta-400'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              className="hidden"
            />
            <div className="w-14 h-14 rounded-2xl bg-cream-200 text-terracotta-600 mx-auto flex items-center justify-center mb-4 shadow-warm-sm">
              <UploadCloud className="w-7 h-7" />
            </div>

            {selectedFile ? (
              <div className="space-y-1">
                <span className="font-semibold text-espresso-950 text-base block">
                  {selectedFile.name}
                </span>
                <span className="text-xs text-espresso-500 block">
                  {(selectedFile.size / 1024).toFixed(1)} KB · Click or drag another file to replace
                </span>
              </div>
            ) : (
              <div className="space-y-1">
                <span className="font-semibold text-espresso-950 text-base block">
                  Click to browse or drag and drop your POS CSV file here
                </span>
                <span className="text-xs text-espresso-500 block">
                  Accepts standard Square, Toast, Clover, Lightspeed or custom POS exports
                </span>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              onClick={() => setShowMapping(!showMapping)}
              className="flex items-center gap-1.5 text-xs font-semibold text-espresso-700 hover:text-espresso-900 bg-cream-100 border border-cream-300 px-3 py-1.5 rounded-lg shadow-warm-sm"
            >
              <Sliders className="w-3.5 h-3.5 text-terracotta-600" />
              <span>{showMapping ? 'Hide Column Mapping' : 'Customize Column Mapping'}</span>
            </button>

            <button
              onClick={handleProcessUpload}
              disabled={!selectedFile || uploading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 disabled:opacity-50 text-cream-50 font-semibold text-sm shadow-warm-sm transition-all"
            >
              <span>{uploading ? 'Processing Data...' : 'Validate & Import POS Data'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Column Mapping Panel */}
          {showMapping && (
            <div className="bg-cream-100 rounded-2xl p-5 border border-cream-300 shadow-warm-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-serif font-bold text-espresso-950 text-sm">
                  POS Column Mapping Settings
                </h3>
                <span className="text-xs text-espresso-500">
                  Matches your CSV headers to Tomorrow's Tray canonical schema
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-espresso-700 block mb-1">
                    Date Column <span className="text-terracotta-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={mapping.date}
                    onChange={(e) => setMapping({ ...mapping, date: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-cream-50 border border-cream-300 text-xs text-espresso-900 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
                    placeholder="e.g. date, sale_date"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-espresso-700 block mb-1">
                    Item Name Column <span className="text-terracotta-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={mapping.item}
                    onChange={(e) => setMapping({ ...mapping, item: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-cream-50 border border-cream-300 text-xs text-espresso-900 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
                    placeholder="e.g. item, product"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-espresso-700 block mb-1">
                    Quantity Sold Column <span className="text-terracotta-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={mapping.quantity_sold}
                    onChange={(e) => setMapping({ ...mapping, quantity_sold: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-cream-50 border border-cream-300 text-xs text-espresso-900 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
                    placeholder="e.g. quantity_sold, qty"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-espresso-700 block mb-1">
                    Sold-Out Time (Optional)
                  </label>
                  <input
                    type="text"
                    value={mapping.sold_out_time || ''}
                    onChange={(e) => setMapping({ ...mapping, sold_out_time: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-cream-50 border border-cream-300 text-xs text-espresso-900 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
                    placeholder="e.g. sold_out_time"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-espresso-700 block mb-1">
                    Closing Time (Optional)
                  </label>
                  <input
                    type="text"
                    value={mapping.closing_time || ''}
                    onChange={(e) => setMapping({ ...mapping, closing_time: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-cream-50 border border-cream-300 text-xs text-espresso-900 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
                    placeholder="e.g. closing_time, 17:00"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-espresso-700 block mb-1">
                    Unit Price (Optional)
                  </label>
                  <input
                    type="text"
                    value={mapping.unit_price || ''}
                    onChange={(e) => setMapping({ ...mapping, unit_price: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-cream-50 border border-cream-300 text-xs text-espresso-900 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
                    placeholder="e.g. unit_price, price"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Schema Guide & Info Card */}
        <div className="bg-cream-100 rounded-2xl p-6 border border-cream-300 shadow-warm-sm space-y-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-espresso-700" />
            <h3 className="font-serif font-bold text-base text-espresso-950">
              Canonical POS Schema
            </h3>
          </div>
          <p className="text-xs text-espresso-600 leading-relaxed">
            Tomorrow's Tray automatically cleans dates, sums multiple entries for the same item/date, clamps negative voids, and isolates genuine stockouts from complete store closure days.
          </p>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-lg bg-cream-50 border border-cream-200">
              <strong className="text-espresso-900 block font-semibold">date</strong>
              <span className="text-espresso-600">YYYY-MM-DD or standard datetime string.</span>
            </div>
            <div className="p-2.5 rounded-lg bg-cream-50 border border-cream-200">
              <strong className="text-espresso-900 block font-semibold">quantity_sold</strong>
              <span className="text-espresso-600">Total units sold on that date.</span>
            </div>
            <div className="p-2.5 rounded-lg bg-cream-50 border border-cream-200">
              <strong className="text-espresso-900 block font-semibold">sold_out_time & closing_time</strong>
              <span className="text-espresso-600">Enables Censored Demand estimation if sold before closing.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Report & Data Preview */}
      {report && (
        <div className="space-y-5 animate-fade-in">
          {/* Validation Status Banner */}
          <div
            className={`p-5 rounded-2xl border flex items-start gap-4 ${
              report.is_valid
                ? 'bg-sage-50/80 border-sage-200 text-sage-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            {report.is_valid ? (
              <CheckCircle className="w-6 h-6 text-sage-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <h4 className="font-serif font-bold text-base">
                {report.is_valid
                  ? 'Data Validation Successful'
                  : 'Data Validation Failed'}
              </h4>
              <p className="text-xs">
                {report.is_valid
                  ? `Processed ${report.total_raw_rows} raw records into ${report.valid_aggregated_rows} canonical daily records across ${report.items_count} menu items (${report.date_min} to ${report.date_max}).`
                  : 'Please review the errors below before continuing.'}
              </p>
            </div>
          </div>

          {/* Validation Summary Metrics */}
          {report.is_valid && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-cream-100 p-4 rounded-xl border border-cream-300">
                <span className="text-[11px] font-semibold text-espresso-500 uppercase tracking-wider block">
                  Items Identified
                </span>
                <span className="text-2xl font-serif font-bold text-espresso-950">
                  {report.items_count}
                </span>
              </div>

              <div className="bg-cream-100 p-4 rounded-xl border border-cream-300">
                <span className="text-[11px] font-semibold text-espresso-500 uppercase tracking-wider block">
                  Stockouts Detected
                </span>
                <span className="text-2xl font-serif font-bold text-amber-600">
                  {report.stockouts_detected}
                </span>
              </div>

              <div className="bg-cream-100 p-4 rounded-xl border border-cream-300">
                <span className="text-[11px] font-semibold text-espresso-500 uppercase tracking-wider block">
                  Duplicates Summed
                </span>
                <span className="text-2xl font-serif font-bold text-espresso-950">
                  {report.duplicates_aggregated}
                </span>
              </div>

              <div className="bg-cream-100 p-4 rounded-xl border border-cream-300">
                <span className="text-[11px] font-semibold text-espresso-500 uppercase tracking-wider block">
                  Confirmed Zero Sales
                </span>
                <span className="text-2xl font-serif font-bold text-espresso-950">
                  {report.zero_sales_count}
                </span>
              </div>
            </div>
          )}

          {/* Warnings & Errors List */}
          {(report.errors.length > 0 || report.warnings.length > 0) && (
            <div className="bg-cream-100 rounded-2xl p-5 border border-cream-300 space-y-3">
              {report.errors.map((err, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-red-700">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>{err}</span>
                </div>
              ))}
              {report.warnings.map((warn, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>{warn}</span>
                </div>
              ))}
            </div>
          )}

          {/* Data Preview Table */}
          {report.preview && report.preview.length > 0 && (
            <div className="bg-cream-100 rounded-2xl p-6 border border-cream-300 shadow-warm-sm space-y-4">
              <h4 className="font-serif font-bold text-base text-espresso-950">
                Processed Records Preview (First 10 Rows)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-cream-200 text-espresso-700 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-3 py-2.5 rounded-l-lg">Date</th>
                      <th className="px-3 py-2.5">Item</th>
                      <th className="px-3 py-2.5">Quantity Sold</th>
                      <th className="px-3 py-2.5">Sold Out Time</th>
                      <th className="px-3 py-2.5">Closing Time</th>
                      <th className="px-3 py-2.5">Stockout Status</th>
                      <th className="px-3 py-2.5 rounded-r-lg">Latent Demand</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-200">
                    {report.preview.map((row, idx) => (
                      <tr key={idx} className="hover:bg-cream-200/40">
                        <td className="px-3 py-2 font-mono text-espresso-800">{row.date}</td>
                        <td className="px-3 py-2 font-medium text-espresso-950">{row.item}</td>
                        <td className="px-3 py-2 font-semibold text-espresso-900">{row.quantity_sold}</td>
                        <td className="px-3 py-2 text-espresso-600">{row.sold_out_time || '—'}</td>
                        <td className="px-3 py-2 text-espresso-600">{row.closing_time || '—'}</td>
                        <td className="px-3 py-2">
                          {row.is_stockout ? (
                            <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-amber-50 text-amber-700 border border-amber-200">
                              Stockout
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-sage-50 text-sage-700 border border-sage-200">
                              Full Day
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-bold text-espresso-900">
                          {row.estimated_demand !== undefined ? row.estimated_demand : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
