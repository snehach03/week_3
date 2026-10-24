import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { OverviewPage } from './pages/OverviewPage';
import { UploadPage } from './pages/UploadPage';
import { ForecastPage } from './pages/ForecastPage';
import { PrepListPage } from './pages/PrepListPage';
import { PerformancePage } from './pages/PerformancePage';
import { SettingsPage } from './pages/SettingsPage';
import { api } from './api/client';
import { Wheat } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');

  useEffect(() => {
    checkInitialData();
  }, []);

  const checkInitialData = async () => {
    try {
      const summary = await api.getSalesSummary();
      if (!summary || summary.total_records === 0) {
        // Automatically load demo data on very first launch so the user has an immediate working experience
        await api.loadDemoData(75);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-cream-50 text-espresso-900 flex flex-col font-sans selection:bg-terracotta-100 selection:text-terracotta-700">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onDemoLoaded={() => {
          // Trigger refresh
        }}
      />

      {/* Main Page Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <OverviewPage onNavigate={(tab) => setActiveTab(tab)} />
        )}
        {activeTab === 'upload' && (
          <UploadPage
            onUploadSuccess={() => {
              setActiveTab('forecast');
            }}
          />
        )}
        {activeTab === 'forecast' && (
          <ForecastPage onNavigateToPrep={() => setActiveTab('prep')} />
        )}
        {activeTab === 'prep' && <PrepListPage />}
        {activeTab === 'performance' && <PerformancePage />}
        {activeTab === 'settings' && (
          <SettingsPage
            onDataReset={() => {
              setActiveTab('overview');
            }}
          />
        )}
      </main>

      {/* Artisanal Bakery Footer */}
      <footer className="border-t border-cream-300 bg-cream-100 py-6 mt-12 text-center text-xs text-espresso-600">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wheat className="w-4 h-4 text-terracotta-500" />
            <span className="font-serif font-bold text-espresso-950">Tomorrow's Tray</span>
            <span>· AI Demand Forecasting for Small Bakeries & Cafés</span>
          </div>
          <div className="flex items-center gap-1 text-espresso-500">
            <span>Built with local AI, Censored Demand Correction, & TabPFN / ML fallbacks.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
