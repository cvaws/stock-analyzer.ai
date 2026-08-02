import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Market from './pages/Market';
import Fundamental from './pages/Fundamental';
import Technical from './pages/Technical';
import Settings from './pages/Settings';
import { fetchRSStocks, RSStock } from './services/dataService';


import StrategyLab from './pages/StrategyLab';

function App() {

  const [activeTab, setActiveTab] = useState('Market');
  const [selectedSymbol, setSelectedSymbol] = useState('SPY');
  const [rsStocks, setRsStocks] = useState<RSStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [scanTickers, setScanTickers] = useState<Set<string>>(new Set());
  // Map of industry name → list of tickers from the uploaded scan
  const [scanIndustries, setScanIndustries] = useState<Map<string, string[]>>(new Map());

  const parseScanCSV = (text: string): { tickers: Set<string>; industries: Map<string, string[]> } => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return { tickers: new Set(), industries: new Map() };

    // Parse header to find column positions dynamically
    const parseRow = (row: string) => (row.match(/(?:"[^"]*"|[^,])+/g) ?? row.split(',')).map(c => c.trim().replace(/^"$/g, ''));
    const headers = parseRow(lines[0]).map(h => h.toLowerCase());
    const symIdx = headers.findIndex(h => h === 'symbol' || h === 'ticker');
    const indIdx = headers.findIndex(h => h === 'industry');

    const tickers = new Set<string>();
    const industries = new Map<string, string[]>();
    lines.slice(1).forEach(line => {
      const cols = parseRow(line);
      const symbol = symIdx >= 0 ? cols[symIdx]?.toUpperCase() : cols[0]?.toUpperCase();
      const industry = indIdx >= 0 ? cols[indIdx] : undefined;
      if (!symbol) return;
      tickers.add(symbol);
      if (industry) {
        const list = industries.get(industry) ?? [];
        list.push(symbol);
        industries.set(industry, list);
      }
    });
    return { tickers, industries };
  };

  const loadDefaultScan = async () => {
    try {
      const res = await fetch('/default_scan.csv');
      const text = await res.text();
      const { tickers, industries } = parseScanCSV(text);
      setScanTickers(tickers);
      setScanIndustries(industries);
    } catch (e) {
      console.warn('Could not load default scan:', e);
    }
  };

  const handleScanUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { tickers, industries } = parseScanCSV(text);
      setScanTickers(tickers);
      setScanIndustries(industries);
    };
    reader.readAsText(file);
  };

  const handleScanClear = () => loadDefaultScan();

  async function loadData(manual = false) {
    if (manual) {
      setIsRefreshing(true);
      // Clear local storage cache keys starting with cache_
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('cache_')) {
          localStorage.removeItem(key);
        }
      });
    }
    const stocks = await fetchRSStocks();
    setRsStocks(stocks);
    setLoading(false);
    if (manual) setIsRefreshing(false);
  }

  useEffect(() => {
    // Migrate stored models to the correct installed local model
    const storedVision = localStorage.getItem('vision_model');
    if (!storedVision || storedVision === 'llama3.2-vision:latest' || storedVision === 'gemma4:latest') {
      localStorage.setItem('vision_model', 'gemma4:26b');
    }
    const storedResearch = localStorage.getItem('research_model');
    if (!storedResearch || storedResearch === 'deepseek-r1:32b' || storedResearch === 'deepseek-r1:latest' || storedResearch === 'gemma4:latest') {
      localStorage.setItem('research_model', 'gemma4:26b');
    }

    loadData();
    loadDefaultScan();
    const interval = setInterval(() => loadData(), 2 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'Market':
        return <Market />;
      case 'Fundamental':
        return <Fundamental
          symbol={selectedSymbol}
          onSymbolChange={setSelectedSymbol}
          rsData={rsStocks.find(s => s.ticker === selectedSymbol)}
          rsStocks={rsStocks}
          scanTickers={scanTickers}
          scanIndustries={scanIndustries}
        />;
      case 'Technical':
        return <Technical
          symbol={selectedSymbol}
          onSymbolChange={setSelectedSymbol}
          rsData={rsStocks.find(s => s.ticker === selectedSymbol)}
        />;
      case 'Settings':
        return <Settings />;
      case 'StrategyLab':
      case 'Backtests':
        return <StrategyLab />;
      default:
        return <Market />;
    }

  };


  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} onRefresh={() => loadData(true)} isRefreshing={isRefreshing} onScanUpload={handleScanUpload} onScanClear={handleScanClear} scanCount={scanTickers.size}>
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
          Loading Market Data...
        </div>
      ) : renderContent()}
    </Layout>
  )
}

export default App
