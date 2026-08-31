import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Market from './pages/Market';
import Quadrant from './pages/Quadrant';
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

  async function loadData() {
    const stocks = await fetchRSStocks();
    setRsStocks(stocks);
    setLoading(false);
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
    const interval = setInterval(() => loadData(), 2 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);


  const renderContent = () => {
    switch (activeTab) {
      case 'Market':
        return <Market />;
      case 'Quadrant':
        return <Quadrant />;
      case 'Fundamental':
        return <Fundamental
          symbol={selectedSymbol}
          onSymbolChange={setSelectedSymbol}
          rsData={rsStocks.find(s => s.ticker === selectedSymbol)}
          rsStocks={rsStocks}
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
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
          Loading Market Data...
        </div>
      ) : renderContent()}
    </Layout>
  )
}

export default App

