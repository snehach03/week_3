import React, { useState, useEffect } from 'react';
import {
  Wheat,
  UploadCloud,
  Sparkles,
  ClipboardList,
  BarChart3,
  Settings as SettingsIcon,
  Cpu,
  Bot,
  RefreshCw,
  LayoutDashboard
} from 'lucide-react';
import { api } from '../api/client';
import type { OllamaStatus, TabPFNStatus } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onDemoLoaded?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onDemoLoaded }) => {
  const [llmStatus, setLlmStatus] = useState<OllamaStatus | null>(null);
  const [tabpfnStatus, setTabpfnStatus] = useState<TabPFNStatus | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);

  useEffect(() => {
    api.getLlmStatus().then(setLlmStatus).catch(() => null);
    api.getTabpfnStatus().then(setTabpfnStatus).catch(() => null);
  }, []);

  const handleQuickDemo = async () => {
    try {
      setLoadingDemo(true);
      await api.loadDemoData(75);
      if (onDemoLoaded) onDemoLoaded();
      setActiveTab('forecast');
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDemo(false);
    }
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'upload', label: 'Upload Sales', icon: UploadCloud },
    { id: 'forecast', label: "Tomorrow's Forecast", icon: Sparkles },
    { id: 'prep', label: 'Prep List', icon: ClipboardList },
    { id: 'performance', label: 'Model Performance', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <header className="bg-cream-100 border-b border-cream-300 sticky top-0 z-40 shadow-warm-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo / Brand */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setActiveTab('overview')}
          >
            <div className="w-10 h-10 rounded-xl bg-terracotta-500 text-cream-50 flex items-center justify-center shadow-warm-sm group-hover:bg-terracotta-600 transition-colors">
              <Wheat className="w-5 h-5" />
            </div>
            <div>
              <span className="font-serif font-bold text-xl text-espresso-950 tracking-tight block leading-tight">
                Tomorrow's Tray
              </span>
              <span className="text-[11px] font-medium text-espresso-500 uppercase tracking-wider block">
                Bakery Demand Forecasting
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-cream-200 text-espresso-950 font-semibold shadow-warm-sm border border-cream-300'
                      : 'text-espresso-700 hover:text-espresso-950 hover:bg-cream-200/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-terracotta-600' : 'text-espresso-500'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* System Indicators & Quick Action */}
          <div className="flex items-center gap-2">
            {/* AI Explanation Status Pill */}
            <div
              className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                llmStatus?.is_available
                  ? 'bg-sage-50 text-sage-700 border-sage-200'
                  : 'bg-cream-200/80 text-espresso-700 border-cream-300'
              }`}
              title={llmStatus?.status_message || 'AI Explanations'}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{llmStatus?.is_available ? 'Gemma (Ollama)' : 'Deterministic Template'}</span>
            </div>

            {/* TabPFN / ML Status Pill */}
            <div
              className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                tabpfnStatus?.is_available
                  ? 'bg-sage-50 text-sage-700 border-sage-200'
                  : 'bg-cream-200/80 text-espresso-700 border-cream-300'
              }`}
              title={tabpfnStatus?.status_message || 'ML Forecaster'}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>{tabpfnStatus?.is_available ? 'TabPFN' : 'Scikit-Learn (RF)'}</span>
            </div>

            {/* Quick Demo Button */}
            <button
              onClick={handleQuickDemo}
              disabled={loadingDemo}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 rounded-lg shadow-warm-sm transition-all disabled:opacity-50"
              title="Loads 75-day realistic bakery POS demo dataset with stockout events"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDemo ? 'animate-spin' : ''}`} />
              <span>{loadingDemo ? 'Loading...' : 'Load Demo'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation bar */}
      <div className="md:hidden flex overflow-x-auto px-4 py-2 border-t border-cream-300 space-x-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-cream-200 text-espresso-950 font-semibold'
                  : 'text-espresso-600 hover:bg-cream-200/40'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
