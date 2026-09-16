import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchEtfTrackerData, fetchMarketRegimeData, fetchPresetStrategies, fetchAiMarketBriefing, ThemeStockData, SavedStrategy, AiMarketBriefingData } from '../services/dataService';
import { MarketRegimeWidget, MarketRegimeData } from '../components/MarketRegimeWidget';
import { AiMarketBriefingWidget } from '../components/AiMarketBriefingWidget';

export interface ExtendedThemeStockData extends ThemeStockData {
    dailyChangePct?: number;
    changeW?: number;
    changeM?: number;
    return5D?: any;
    return10D?: any;
    aboveEma8?: boolean;
    aboveEma21?: boolean;
    aboveSma50?: boolean;
    supertrendDirection?: number;
    supertrend?: number;
    rsRating?: number | string;
    stage2Trend?: boolean;
    pctOff52WkHigh?: number;
    rsDailyColor?: string;
    rsWeeklyColor?: string;
    rsDailyVelocity?: number;
    rsWeeklyVelocity?: number;
    volRatio?: number;
    hasVDU?: boolean;
    pctAboveLastBase?: number;
    rrgQuadrant?: string;
    rsNewHigh250?: boolean;
}

const Market: React.FC = () => {
    const [data, setData] = useState<ExtendedThemeStockData[]>([]);
    const [regimeData, setRegimeData] = useState<MarketRegimeData | null>(null);
    const [presetStrategies, setPresetStrategies] = useState<SavedStrategy[]>([]);
    const [aiBriefing, setAiBriefing] = useState<AiMarketBriefingData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    const [focusSortField, setFocusSortField] = useState<string>('rsWeeklyPct');
    const [focusSortAsc, setFocusSortAsc] = useState<boolean>(false);
    const [portfolioSize, setPortfolioSize] = useState<number>(() => {
        return Number(localStorage.getItem('portfolio_size') || '100000') || 100000;
    });

    // Live Pipeline Scan State
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [scanLogs, setScanLogs] = useState<string[]>([]);
    const [scanStatus, setScanStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');

    const loadData = async () => {
        setLoading(true);
        try {
            const [res, regimeRes, strategies, briefing] = await Promise.all([
                fetchEtfTrackerData(),
                fetchMarketRegimeData(),
                fetchPresetStrategies(),
                fetchAiMarketBriefing()
            ]);
            setData(res);
            setRegimeData(regimeRes);
            setPresetStrategies(strategies || []);
            setAiBriefing(briefing);
        } catch (e) {
            console.error("Error loading Market Page data:", e);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
        const handleUpdate = () => {
            loadData();
        };
        window.addEventListener('market-data-updated', handleUpdate);
        return () => window.removeEventListener('market-data-updated', handleUpdate);
    }, []);

    const handleRunDailyScan = () => {
        if (isScanning) return;
        setIsScanning(true);
        setScanStatus('running');
        setScanLogs(['Connecting to background Python sidecar...']);

        const SIDECAR_URL = (typeof window !== 'undefined' && (window as any).__SIDECAR_URL__) || 'http://127.0.0.1:8765';
        const eventSource = new EventSource(`${SIDECAR_URL}/api/pipeline/run-stream`);

        eventSource.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.message) {
                    setScanLogs(prev => [...prev.slice(-40), data.message]);
                }
                if (data.status === 'completed') {
                    setScanStatus('completed');
                    setIsScanning(false);
                    eventSource.close();
                    loadData(); // Re-fetch updated market data
                    window.dispatchEvent(new CustomEvent('market-data-updated'));
                } else if (data.status === 'failed') {
                    setScanStatus('failed');
                    setIsScanning(false);
                    eventSource.close();
                }
            } catch (err) {
                console.error('Error parsing SSE event:', err);
            }
        };

        eventSource.onerror = (err) => {
            console.error('SSE connection error:', err);
            setScanLogs(prev => [...prev, 'Scan finished or disconnected.']);
            setIsScanning(false);
            setScanStatus('completed');
            eventSource.close();
            loadData();
            window.dispatchEvent(new CustomEvent('market-data-updated'));
        };
    };

    const handleFocusSortClick = (field: string) => {
        if (focusSortField === field) {
            setFocusSortAsc(!focusSortAsc);
        } else {
            setFocusSortField(field);
            setFocusSortAsc(false);
        }
    };

    const renderFocusSortIndicator = (field: string) => {
        if (focusSortField !== field) return null;
        return focusSortAsc ? ' ▲' : ' ▼';
    };

    const formatPct = (val: number | string | undefined | null) => {
        if (val === undefined || val === null || val === 'N/A') return '—';
        const num = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(num)) return '—';
        return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
    };

    // Render ThinkOrSwim MA parity badge: ✓ (Dark Green) if above, x (Dark Red) if below
    const renderMaBadge = (above: boolean | undefined, themeColor?: 'green' | 'red' | 'yellow') => {
        const isAbove = above === true;

        let bgColor = isAbove ? '#064e3b' : '#7f1d1d';
        let textColor = isAbove ? '#10b981' : '#f87171';

        if (themeColor === 'yellow') {
            bgColor = '#78350f'; // Dark Yellow/Amber
            textColor = '#fbbf24'; // Bright Amber/Yellow
        } else if (themeColor === 'green') {
            bgColor = '#064e3b';
            textColor = '#10b981';
        } else if (themeColor === 'red') {
            bgColor = '#7f1d1d';
            textColor = '#f87171';
        }

        return (
            <span style={{
                backgroundColor: bgColor,
                color: textColor,
                padding: '3px 10px',
                borderRadius: '4px',
                fontWeight: 800,
                fontSize: '0.8rem',
                display: 'inline-block',
                textAlign: 'center',
                minWidth: '28px'
            }}>
                {isAbove ? '✓' : 'x'}
            </span>
        );
    };

    const renderSupertrendBadgeForStock = (stock: ExtendedThemeStockData) => {
        const price = stock.price;
        const supertrend = stock.supertrend;
        const direction = stock.supertrendDirection;
        
        if (price === undefined || supertrend === undefined || direction === undefined) {
            return renderMaBadge(false, 'red');
        }
        
        const dailyBullish = price > supertrend;
        const weeklyBullish = direction === 1;
        
        if (dailyBullish && weeklyBullish) {
            return renderMaBadge(true, 'green');
        } else if (!dailyBullish && !weeklyBullish) {
            return renderMaBadge(false, 'red');
        } else {
            return renderMaBadge(dailyBullish, 'yellow');
        }
    };

    const transitionEtfs = data.filter(stock => {
        const price = stock.price;
        const supertrend = stock.supertrend;
        const direction = stock.supertrendDirection;
        if (price === undefined || supertrend === undefined || direction === undefined) return false;
        const dailyBullish = price > supertrend;
        const weeklyBullish = direction === 1;
        return dailyBullish !== weeklyBullish;
    });

    const getNumericRs = (val: number | string | undefined | null): number => {
        if (val === undefined || val === null || val === 'N/A') return -999999;
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return isNaN(num) ? -999999 : num;
    };

    // Filter helper: Exclude Macro benchmarks and Leveraged ETFs from leadership/rotation widgets
    const isThematicEtf = (stock: ExtendedThemeStockData) => {
        const sec = (stock.sector || '').toLowerCase();
        const sym = (stock.symbol || '').toUpperCase();
        const isLeveraged = sec.includes('leveraged') || ['SPXL', 'TQQQ', 'TNA', 'KORU', 'SOXL', 'SPXS', 'SQQQ', 'TZA'].includes(sym);
        const isMacro = sec === 'macro' || ['UUP', 'TLT', 'HYG', 'IEF', 'RSP', 'VIXY', 'UVXY', 'VXX', '^TNX', 'TNX'].includes(sym);
        return !isLeveraged && !isMacro;
    };

    // Regime-aware filtering for Top 3 widgets
    const regimeCode = regimeData?.regime_code || 'HALF_SIZE';
    const regimeFilteredData = data.filter(stock => {
        if (!isThematicEtf(stock)) return false;
        if (regimeCode === 'PRESS_GAS' && stock.sector === 'Defense') {
            return false; // Exclude Defense in Press Gas bull regime
        }
        if (regimeCode === 'STEP_ASIDE' && (stock.sector === 'Leveraged_Long' || stock.sector === 'Leadership')) {
            return false; // Deprioritize aggressive long ETFs in Step Aside
        }
        return true;
    });

    const topDailyRs = [...regimeFilteredData]
        .filter(x => getNumericRs(x.rsDailyPct) > -999999)
        .sort((a, b) => getNumericRs(b.rsDailyPct) - getNumericRs(a.rsDailyPct))
        .slice(0, 3);

    const topWeeklyRs = [...regimeFilteredData]
        .filter(x => getNumericRs(x.rsWeeklyPct) > -999999)
        .sort((a, b) => getNumericRs(b.rsWeeklyPct) - getNumericRs(a.rsWeeklyPct))
        .slice(0, 3);

    const top52WkHigh = [...regimeFilteredData]
        .filter(x => x.pctOff52WkHigh !== undefined)
        .sort((a, b) => (b.pctOff52WkHigh || 0) - (a.pctOff52WkHigh || 0))
        .slice(0, 3);


    return (
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, overflowY: 'auto' }}>
            {/* Header Flex Row containing Controls & Widgets */}
            <div style={{
                display: 'flex',
                gap: '1.5rem',
                flexWrap: 'wrap',
                width: '100%'
            }}>
                {/* Header & Controls */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    background: 'var(--bg-card)',
                    padding: '1.25rem 1.5rem',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    flex: '1 1 300px',
                    minWidth: '280px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>📈 Market Overview</h1>
                        
                        {/* Live Run Scan Button */}
                        <button
                            onClick={handleRunDailyScan}
                            disabled={isScanning}
                            title="Fetch today's ETF data and calculate Supertrend + RS metrics"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 14px',
                                borderRadius: '10px',
                                background: isScanning ? 'rgba(99, 102, 241, 0.2)' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                cursor: isScanning ? 'wait' : 'pointer',
                                boxShadow: isScanning ? 'none' : '0 2px 10px rgba(99, 102, 241, 0.3)',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <Loader2 size={14} className={isScanning ? 'animate-spin' : ''} style={{ animation: isScanning ? 'spin 1s linear infinite' : 'none' }} />
                            <span>{isScanning ? 'Scanning...' : 'Run Daily Scan'}</span>
                        </button>

                        {/* Last Scan Freshness Badge */}
                        {regimeData?.scan_date && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                🕒 Last scan: <strong style={{ color: 'var(--text-primary)' }}>{regimeData.scan_date}</strong>
                            </span>
                        )}
                    </div>
                </div>


                {/* Supertrend Transitions Widget */}
                <div style={{
                    background: 'var(--bg-card)',
                    padding: '1.25rem 1.5rem',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    flex: '1 1 240px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    minWidth: '240px'
                }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fbbf24', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ⚡ Supertrend Transitions ({transitionEtfs.length})
                    </h3>
                    <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '8px', 
                        overflowY: 'auto', 
                        maxHeight: '75px',
                        padding: '2px 0' 
                    }}>
                        {transitionEtfs.length === 0 ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No transitions active today</span>
                        ) : (
                            transitionEtfs.map((stock, idx) => {
                                const dailyBullish = (stock.price || 0) > (stock.supertrend || 0);
                                return (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        background: 'rgba(251, 191, 36, 0.1)',
                                        border: '1px solid rgba(251, 191, 36, 0.25)',
                                        padding: '4px 10px',
                                        borderRadius: '8px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: '#fbbf24'
                                    }}>
                                        <span>{stock.symbol}</span>
                                        <span>{dailyBullish ? '▲' : '▼'}</span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Top 3 RS Daily% Widget */}
                <div style={{
                    background: 'var(--bg-card)',
                    padding: '1.25rem 1.5rem',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    flex: '1 1 240px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    minWidth: '240px'
                }}>
                    <div>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            🔥 Top 3 RS Daily%
                        </h3>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Filtered: {regimeCode.replace('_', ' ')}
                        </span>
                    </div>
                    <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        gap: '6px', 
                        padding: '2px 0'
                    }}>
                        {topDailyRs.length === 0 ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No RS data available</span>
                        ) : (
                            topDailyRs.map((stock, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '0.8rem',
                                    color: 'var(--text-primary)',
                                    gap: '8px'
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', width: '75px' }}>
                                        <span style={{ fontWeight: 700 }}>{stock.symbol}</span>
                                        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{stock.sector.replace('_', ' ')}</span>
                                    </div>
                                    <span style={{ transform: 'scale(0.85)', display: 'inline-flex' }}>
                                        {renderSupertrendBadgeForStock(stock)}
                                    </span>
                                    <span style={{ color: '#10b981', fontWeight: 600, textAlign: 'right', flex: 1 }}>{formatPct(stock.rsDailyPct)}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Top 3 RS Weekly% Widget */}
                <div style={{
                    background: 'var(--bg-card)',
                    padding: '1.25rem 1.5rem',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    flex: '1 1 240px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    minWidth: '240px'
                }}>
                    <div>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#a855f7', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            💫 Top 3 RS Weekly%
                        </h3>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Filtered: {regimeCode.replace('_', ' ')}
                        </span>
                    </div>
                    <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        gap: '6px', 
                        padding: '2px 0'
                    }}>
                        {topWeeklyRs.length === 0 ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No RS data available</span>
                        ) : (
                            topWeeklyRs.map((stock, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '0.8rem',
                                    color: 'var(--text-primary)',
                                    gap: '8px'
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', width: '75px' }}>
                                        <span style={{ fontWeight: 700 }}>{stock.symbol}</span>
                                        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{stock.sector.replace('_', ' ')}</span>
                                    </div>
                                    <span style={{ transform: 'scale(0.85)', display: 'inline-flex' }}>
                                        {renderSupertrendBadgeForStock(stock)}
                                    </span>
                                    <span style={{ color: '#a855f7', fontWeight: 600, textAlign: 'right', flex: 1 }}>{formatPct(stock.rsWeeklyPct)}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Top 3 %52wk_High Widget */}
                <div style={{
                    background: 'var(--bg-card)',
                    padding: '1.25rem 1.5rem',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    flex: '1 1 240px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    minWidth: '240px'
                }}>
                    <div>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#3b82f6', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            🚀 Top 3 %52wk_High
                        </h3>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Filtered: {regimeCode.replace('_', ' ')}
                        </span>
                    </div>
                    <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        gap: '6px', 
                        padding: '2px 0'
                    }}>
                        {top52WkHigh.length === 0 ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No data available</span>
                        ) : (
                            top52WkHigh.map((stock, idx) => {
                                const val = stock.pctOff52WkHigh !== undefined ? stock.pctOff52WkHigh : 0;
                                let color = '#ef4444'; // RED
                                if (val > -5) color = '#10b981'; // GREEN
                                else if (val > -10) color = '#f59e0b'; // ORANGE
                                return (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        fontSize: '0.8rem',
                                        color: 'var(--text-primary)',
                                        gap: '8px'
                                    }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', width: '75px' }}>
                                            <span style={{ fontWeight: 700 }}>{stock.symbol}</span>
                                            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{stock.sector.replace('_', ' ')}</span>
                                        </div>
                                        <span style={{ transform: 'scale(0.85)', display: 'inline-flex' }}>
                                            {renderSupertrendBadgeForStock(stock)}
                                        </span>
                                        <span style={{ color: color, fontWeight: 600, textAlign: 'right', flex: 1 }}>{val.toFixed(1)}%</span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '1rem' }}>
                    <Loader2 size={36} className="animate-spin" color="var(--accent-primary)" />
                    <span style={{ color: 'var(--text-muted)' }}>Loading Market Overview &amp; Regime Data...</span>
                </div>
            ) : (
                <>
                {/* 3 Widgets Side-by-Side Row */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
                    gap: '1.25rem',
                    alignItems: 'stretch',
                    width: '100%'
                }}>
                    {/* Widget 1: Market Regime Dashboard */}
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <MarketRegimeWidget regimeData={regimeData} />
                    </div>

                    {/* Widget 2: Focus List (Top 10 Bullish Leaders) */}
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '16px',
                        border: '1px solid var(--border-color)',
                        padding: '1.25rem 1.5rem',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.85rem',
                        minWidth: 0
                    }}>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.85rem',
                            flex: 1
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        🎯 Top 10 Focus Leaders
                                    </h3>
                                    {/* Inline Account Size Input */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Acct: $</span>
                                        <input
                                            type="number"
                                            value={portfolioSize}
                                            onChange={(e) => {
                                                const val = Number(e.target.value) || 0;
                                                setPortfolioSize(val);
                                                localStorage.setItem('portfolio_size', val.toString());
                                            }}
                                            style={{
                                                width: '72px',
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#38bdf8',
                                                fontSize: '0.72rem',
                                                fontWeight: 700,
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Leader Changes Pill */}
                                {regimeData?.leader_changes && (
                                    <div style={{ display: 'flex', gap: '4px', fontSize: '0.68rem' }}>
                                        {regimeData.leader_changes.newly_entered.length > 0 && (
                                            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                                +{regimeData.leader_changes.newly_entered.join(', ')} In
                                            </span>
                                        )}
                                        {regimeData.leader_changes.newly_exited.length > 0 && (
                                            <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                                -{regimeData.leader_changes.newly_exited.map(e => `${e.symbol}(${e.reason})`).join(', ')}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {(() => {
                                const getFocusValForSort = (item: ExtendedThemeStockData, field: string): any => {
                                    if (field === 'symbol') return item.symbol;
                                    if (field === 'sector') return item.sector;
                                    if (field === 'price') return item.price ?? 0;
                                    if (field === 'pctOff52WkHigh') return item.pctOff52WkHigh ?? 0;
                                    if (field === 'pctAboveLastBase') return item.pctAboveLastBase ?? 0;
                                    if (field === 'rsWeeklyVelocity') return item.rsWeeklyVelocity ?? 0;
                                    if (field === 'rsDailyVelocity') return item.rsDailyVelocity ?? 0;
                                    if (field === 'rsDailyPct') {
                                        const val = item.rsDailyPct;
                                        if (val === undefined || val === null || val === 'N/A') return -999999;
                                        const num = typeof val === 'string' ? parseFloat(val) : val;
                                        return isNaN(num) ? -999999 : num;
                                    }
                                    if (field === 'rsWeeklyPct') {
                                        const val = item.rsWeeklyPct;
                                        if (val === undefined || val === null || val === 'N/A') return -999999;
                                        const num = typeof val === 'string' ? parseFloat(val) : val;
                                        return isNaN(num) ? -999999 : num;
                                    }
                                    return 0;
                                };

                                const sortedLeaders = [...data]
                                    .filter(stock => {
                                        if (!isThematicEtf(stock)) return false;
                                        const price = stock.price;
                                        const supertrend = stock.supertrend;
                                        const direction = stock.supertrendDirection;
                                        if (price === undefined || supertrend === undefined || direction === undefined) return false;
                                        const dailyBullish = price > supertrend;
                                        const weeklyBullish = direction === 1;
                                        const accelerating = (stock.rsWeeklyVelocity || 0) > 0;
                                        return dailyBullish && weeklyBullish && accelerating;
                                    })
                                    .sort((a, b) => {
                                        const valA = getFocusValForSort(a, focusSortField);
                                        const valB = getFocusValForSort(b, focusSortField);
                                        if (typeof valA === 'string' && typeof valB === 'string') {
                                            return focusSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
                                        }
                                        return focusSortAsc ? (valA - valB) : (valB - valA);
                                    })
                                    .slice(0, 10);

                                // Concentration Check (≥3 from same sector)
                                const sectorCounts: Record<string, number> = {};
                                sortedLeaders.forEach(s => {
                                    sectorCounts[s.sector] = (sectorCounts[s.sector] || 0) + 1;
                                });
                                const concentratedSector = Object.entries(sectorCounts).find(([_, count]) => count >= 3);

                                // Extract top 5 accelerating symbols for mutual intersection highlight
                                const top5AcceleratingSymbols = new Set(
                                    [...data]
                                        .filter(x => x.rsWeeklyVelocity !== undefined)
                                        .sort((a, b) => (b.rsWeeklyVelocity || 0) - (a.rsWeeklyVelocity || 0))
                                        .slice(0, 5)
                                        .map(x => x.symbol)
                                );

                                const getRsColor = (colorFlag?: string, val?: any) => {
                                    if (colorFlag === 'MAGENTA') return '#d946ef';
                                    if (colorFlag === 'CYAN') return '#06b6d4';
                                    if (colorFlag === 'GREEN' || (Number(val) || 0) >= 0) return '#10b981';
                                    return '#ef4444';
                                };

                                return (
                                    <>
                                        {/* Concentration Warning */}
                                        {concentratedSector && (
                                            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem', color: '#fbbf24', fontWeight: 600 }}>
                                                ⚠️ Concentration: {concentratedSector[1]} of 10 leaders are in <strong>{concentratedSector[0].replace('_', ' ')}</strong>
                                            </div>
                                        )}

                                        <div style={{ flex: 1, overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                                                        <th onClick={() => handleFocusSortClick('symbol')} style={{ padding: '0.35rem 0.3rem', textAlign: 'left', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>Symbol{renderFocusSortIndicator('symbol')}</th>
                                                        <th onClick={() => handleFocusSortClick('sector')} style={{ padding: '0.35rem 0.3rem', textAlign: 'left', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>Group{renderFocusSortIndicator('sector')}</th>
                                                        <th onClick={() => handleFocusSortClick('price')} style={{ padding: '0.35rem 0.3rem', textAlign: 'right', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>Entry{renderFocusSortIndicator('price')}</th>
                                                        <th style={{ padding: '0.35rem 0.3rem', textAlign: 'right', fontWeight: 700 }}>Strategy Stop</th>
                                                        <th onClick={() => handleFocusSortClick('rsWeeklyPct')} style={{ padding: '0.35rem 0.3rem', textAlign: 'right', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>RS W%{renderFocusSortIndicator('rsWeeklyPct')}</th>
                                                        <th onClick={() => handleFocusSortClick('rsWeeklyVelocity')} style={{ padding: '0.35rem 0.3rem', textAlign: 'right', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>W-Vel{renderFocusSortIndicator('rsWeeklyVelocity')}</th>
                                                        <th onClick={() => handleFocusSortClick('rsDailyVelocity')} style={{ padding: '0.35rem 0.3rem', textAlign: 'right', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>D-Vel{renderFocusSortIndicator('rsDailyVelocity')}</th>
                                                        <th onClick={() => handleFocusSortClick('pctAboveLastBase')} style={{ padding: '0.35rem 0.3rem', textAlign: 'right', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>Ext%{renderFocusSortIndicator('pctAboveLastBase')}</th>
                                                        <th style={{ padding: '0.35rem 0.3rem', textAlign: 'right', fontWeight: 700 }}>Size (20%)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sortedLeaders.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={9} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                                                                No bullish &amp; accelerating RS leaders found today
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        sortedLeaders.map((stock, idx) => {
                                                            const isBothFocusAndAccelerating = top5AcceleratingSymbols.has(stock.symbol);
                                                            const isDualAccelerating = (stock.rsWeeklyVelocity || 0) > 0 && (stock.rsDailyVelocity || 0) > 0;
                                                            
                                                            // Match Strategy Lab preset optimized for this specific ETF group
                                                            const assignedStrategy = presetStrategies.find(s => 
                                                                s.universe?.toLowerCase() === stock.sector?.toLowerCase() ||
                                                                (stock.sector === 'Leveraged_Long' && s.universe === 'Leveraged_Long')
                                                            ) || presetStrategies.find(s => s.universe === 'All ETFs');

                                                            // Strategy-defined Stop Loss percentage (e.g. 2%, 5%, 6%) or fallback to Supertrend
                                                            const currentPrice = stock.price || 1;
                                                            const stratStopPct = assignedStrategy?.risk_management?.stop_loss_pct || 0.05;
                                                            const stratStopPrice = currentPrice * (1 - stratStopPct);
                                                            const stLevel = stock.supertrend || currentPrice * 0.95;
                                                            
                                                            // Extension % (from last base)
                                                            const extPct = stock.pctAboveLastBase !== undefined ? stock.pctAboveLastBase : 0.0;
                                                            let extColor = '#10b981'; // Buyable <= 5%
                                                            if (extPct > 10) extColor = '#ef4444'; // Extended > 10%
                                                            else if (extPct > 5) extColor = '#f59e0b'; // Caution 5-10%

                                                            // 5-Slot Allocation: 20% of Portfolio Capital per position
                                                            const allocationCapital = portfolioSize * 0.20; // 20% capital allocation
                                                            const shares = Math.floor(allocationCapital / currentPrice);
                                                            const stopDistance = Math.max(currentPrice - stratStopPrice, 0);
                                                            const dollarRiskAtStop = shares * stopDistance;
                                                            const riskPctOfAcct = portfolioSize > 0 ? (dollarRiskAtStop / portfolioSize) * 100 : 0;

                                                            return (
                                                                <tr key={idx} style={{ 
                                                                    borderBottom: '1px solid rgba(255,255,255,0.03)', 
                                                                    verticalAlign: 'middle',
                                                                    background: isBothFocusAndAccelerating ? 'rgba(16, 185, 129, 0.06)' : 'transparent'
                                                                }}>
                                                                    <td style={{ padding: '0.38rem 0.3rem', fontWeight: 800 }}>
                                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
                                                                            <span style={{ color: isBothFocusAndAccelerating ? '#10b981' : '#3b82f6' }}>
                                                                                {stock.symbol}
                                                                            </span>
                                                                            {/* S2 Badge */}
                                                                            {stock.stage2Trend && (
                                                                                <span title="Stage 2 Uptrend Confirmed" style={{ fontSize: '0.58rem', padding: '1px 2px', background: 'rgba(16, 185, 129, 0.25)', color: '#10b981', borderRadius: '3px', fontWeight: 700 }}>
                                                                                    S2
                                                                                </span>
                                                                            )}
                                                                            {/* VDU Badge */}
                                                                            {stock.hasVDU && (
                                                                                <span title="Volume Dry-Up Setup" style={{ fontSize: '0.58rem', padding: '1px 2px', background: 'rgba(6, 182, 212, 0.25)', color: '#06b6d4', borderRadius: '3px', fontWeight: 700 }}>
                                                                                    VDU
                                                                                </span>
                                                                            )}
                                                                            {/* RS New High Dot */}
                                                                            {stock.rsNewHigh250 && (
                                                                                <span title="RS 250-bar New High Breakout" style={{ fontSize: '0.58rem', color: '#fbbf24' }}>
                                                                                    ★
                                                                                </span>
                                                                            )}
                                                                            {/* Dual Velocity Acceleration */}
                                                                            {isDualAccelerating && (
                                                                                <span title="Dual Timeframe Acceleration (Daily + Weekly RS Velocity > 0)" style={{ fontSize: '0.58rem', color: '#38bdf8' }}>
                                                                                    ⚡⚡
                                                                                </span>
                                                                            )}
                                                                            {isBothFocusAndAccelerating && (
                                                                                <span style={{ fontSize: '0.6rem' }}>🔥</span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td style={{ padding: '0.38rem 0.3rem', color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'capitalize' }}>
                                                                        {stock.sector.replace('_', ' ')}
                                                                    </td>
                                                                    <td style={{ padding: '0.38rem 0.3rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                                        ${currentPrice.toFixed(2)}
                                                                    </td>
                                                                    <td style={{ padding: '0.38rem 0.3rem', textAlign: 'right', fontSize: '0.68rem' }}>
                                                                        <span style={{ color: '#f87171', fontWeight: 700 }}>${stratStopPrice.toFixed(2)}</span>
                                                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.62rem' }}>
                                                                            (-{(stratStopPct * 100).toFixed(0)}% SL | ST: ${stLevel.toFixed(1)})
                                                                        </span>
                                                                    </td>
                                                                    <td style={{ padding: '0.38rem 0.3rem', textAlign: 'right', fontWeight: 700, color: getRsColor(stock.rsWeeklyColor, stock.rsWeeklyPct) }}>
                                                                        {formatPct(stock.rsWeeklyPct)}
                                                                    </td>
                                                                    <td style={{ padding: '0.38rem 0.3rem', textAlign: 'right', color: (stock.rsWeeklyVelocity || 0) > 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                                                        {(stock.rsWeeklyVelocity || 0) > 0 ? '+' : ''}{(stock.rsWeeklyVelocity || 0).toFixed(2)}%
                                                                    </td>
                                                                    <td style={{ padding: '0.38rem 0.3rem', textAlign: 'right', color: (stock.rsDailyVelocity || 0) > 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                                                        {(stock.rsDailyVelocity || 0) > 0 ? '+' : ''}{(stock.rsDailyVelocity || 0).toFixed(2)}%
                                                                    </td>
                                                                    <td style={{ padding: '0.38rem 0.3rem', textAlign: 'right', color: extColor, fontWeight: 700 }}>
                                                                        {extPct.toFixed(1)}%
                                                                    </td>
                                                                    <td style={{ padding: '0.38rem 0.3rem', textAlign: 'right', fontSize: '0.68rem' }}>
                                                                        <strong style={{ color: '#38bdf8' }}>{shares} sh</strong>
                                                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.62rem' }}>(${dollarRiskAtStop.toFixed(0)} | {riskPctOfAcct.toFixed(1)}%)</span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                );
                            })()}

                            <div style={{ 
                                borderTop: '1px solid rgba(255,255,255,0.06)', 
                                paddingTop: '0.4rem', 
                                fontSize: '0.65rem', 
                                color: 'var(--text-muted)', 
                                textAlign: 'center',
                                fontWeight: 500
                            }}>
                                5-Position Portfolio Model: 20% capital allocated per position ($20k on $100k) | Group-Optimized Strategy Lab Stops
                            </div>
                        </div>
                    </div>

                    {/* Widget 3: Sector Rotation & RS Acceleration */}
                    {(() => {
                        const focusLeaderSymbols = new Set(
                            [...data]
                                .filter(stock => {
                                    if (!isThematicEtf(stock)) return false;
                                    const price = stock.price;
                                    const supertrend = stock.supertrend;
                                    const direction = stock.supertrendDirection;
                                    if (price === undefined || supertrend === undefined || direction === undefined) return false;
                                    const dailyBullish = price > supertrend;
                                    const weeklyBullish = direction === 1;
                                    const accelerating = (stock.rsWeeklyVelocity || 0) > 0;
                                    return dailyBullish && weeklyBullish && accelerating;
                                })
                                .sort((a, b) => getNumericRs(b.rsWeeklyPct) - getNumericRs(a.rsWeeklyPct))
                                .slice(0, 10)
                                .map(s => s.symbol)
                        );

                        const acceleratingEtfs = [...data]
                            .filter(x => isThematicEtf(x) && x.rsWeeklyVelocity !== undefined)
                            .sort((a, b) => (b.rsWeeklyVelocity || 0) - (a.rsWeeklyVelocity || 0))
                            .slice(0, 5);

                        const deceleratingEtfs = [...data]
                            .filter(x => isThematicEtf(x) && x.rsWeeklyVelocity !== undefined)
                            .sort((a, b) => (a.rsWeeklyVelocity || 0) - (b.rsWeeklyVelocity || 0))
                            .slice(0, 5);

                        const getRsColor = (colorFlag?: string, val?: any) => {
                            if (colorFlag === 'MAGENTA') return '#d946ef';
                            if (colorFlag === 'CYAN') return '#06b6d4';
                            if (colorFlag === 'GREEN' || (Number(val) || 0) >= 0) return '#10b981';
                            return '#ef4444';
                        };

                        const getRrgBadge = (quadrant?: string) => {
                            if (quadrant === 'Leading') return { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981' };
                            if (quadrant === 'Weakening') return { bg: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' };
                            if (quadrant === 'Improving') return { bg: 'rgba(6, 182, 212, 0.2)', color: '#06b6d4' };
                            return { bg: 'rgba(239, 68, 68, 0.2)', color: '#f87171' };
                        };

                        return (
                            <div style={{
                                background: 'var(--bg-card)',
                                borderRadius: '16px',
                                border: '1px solid var(--border-color)',
                                padding: '1.25rem 1.5rem',
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.85rem',
                                minWidth: 0
                            }}>
                                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        🔄 Sector Rotation &amp; RS Acceleration
                                    </h3>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                        Velocity of RS Weekly% over 5 days. <span style={{ color: '#10b981', fontWeight: 600 }}>Green tickers 🔥</span> indicate confirmed Focus Leaders accelerating.
                                    </p>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1 }}>
                                    {/* Accelerating Column */}
                                    <div>
                                        <h4 style={{ fontSize: '0.78rem', fontWeight: 800, color: '#10b981', margin: '0 0 0.35rem 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            🚀 Top 5 Accelerating (Flowing In)
                                        </h4>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                                                    <th style={{ padding: '0.25rem 0.3rem', textAlign: 'left' }}>Symbol</th>
                                                    <th style={{ padding: '0.25rem 0.3rem', textAlign: 'left' }}>Group</th>
                                                    <th style={{ padding: '0.25rem 0.3rem', textAlign: 'center' }}>RRG</th>
                                                    <th style={{ padding: '0.25rem 0.3rem', textAlign: 'right' }}>RS W%</th>
                                                    <th style={{ padding: '0.25rem 0.3rem', textAlign: 'right' }}>1-Wk Vel</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {acceleratingEtfs.map((stock, idx) => {
                                                    const isFocusLeader = focusLeaderSymbols.has(stock.symbol);
                                                    const rrg = getRrgBadge(stock.rrgQuadrant);
                                                    return (
                                                        <tr key={idx} style={{ 
                                                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                            background: isFocusLeader ? 'rgba(16, 185, 129, 0.06)' : 'transparent'
                                                        }}>
                                                            <td style={{ padding: '0.35rem 0.3rem', fontWeight: 800 }}>
                                                                <span style={{
                                                                    color: isFocusLeader ? '#10b981' : '#3b82f6',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '3px'
                                                                }}>
                                                                    {stock.symbol}
                                                                    {isFocusLeader && (
                                                                        <span style={{ fontSize: '0.6rem' }}>🔥</span>
                                                                    )}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '0.35rem 0.3rem', color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'capitalize' }}>
                                                                {stock.sector.replace('_', ' ')}
                                                            </td>
                                                            <td style={{ padding: '0.35rem 0.3rem', textAlign: 'center' }}>
                                                                <span style={{ background: rrg.bg, color: rrg.color, padding: '1px 4px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 700 }}>
                                                                    {stock.rrgQuadrant || 'Leading'}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '0.35rem 0.3rem', textAlign: 'right', fontWeight: 700, color: getRsColor(stock.rsWeeklyColor, stock.rsWeeklyPct) }}>{formatPct(stock.rsWeeklyPct)}</td>
                                                            <td style={{ padding: '0.35rem 0.3rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                                                +{stock.rsWeeklyVelocity?.toFixed(2)}%
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Decelerating Column */}
                                    <div>
                                        <h4 style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ef4444', margin: '0 0 0.35rem 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            ⚠️ Top 5 Decelerating (Flowing Out)
                                        </h4>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                                                    <th style={{ padding: '0.25rem 0.3rem', textAlign: 'left' }}>Symbol</th>
                                                    <th style={{ padding: '0.25rem 0.3rem', textAlign: 'left' }}>Group</th>
                                                    <th style={{ padding: '0.25rem 0.3rem', textAlign: 'center' }}>RRG</th>
                                                    <th style={{ padding: '0.25rem 0.3rem', textAlign: 'right' }}>RS W%</th>
                                                    <th style={{ padding: '0.25rem 0.3rem', textAlign: 'right' }}>1-Wk Vel</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {deceleratingEtfs.map((stock, idx) => {
                                                    const rrg = getRrgBadge(stock.rrgQuadrant);
                                                    return (
                                                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                            <td style={{ padding: '0.35rem 0.3rem', fontWeight: 800, color: '#3b82f6' }}>{stock.symbol}</td>
                                                            <td style={{ padding: '0.35rem 0.3rem', color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'capitalize' }}>
                                                                {stock.sector.replace('_', ' ')}
                                                            </td>
                                                            <td style={{ padding: '0.35rem 0.3rem', textAlign: 'center' }}>
                                                                <span style={{ background: rrg.bg, color: rrg.color, padding: '1px 4px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 700 }}>
                                                                    {stock.rrgQuadrant || 'Lagging'}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '0.35rem 0.3rem', textAlign: 'right', fontWeight: 700, color: getRsColor(stock.rsWeeklyColor, stock.rsWeeklyPct) }}>{formatPct(stock.rsWeeklyPct)}</td>
                                                            <td style={{ padding: '0.35rem 0.3rem', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>
                                                                {stock.rsWeeklyVelocity?.toFixed(2)}%
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* AI Executive Market Briefing & 1-Year Cycle Analysis Widget */}
                <AiMarketBriefingWidget 
                    briefingData={aiBriefing} 
                    onBriefingUpdated={(updated) => setAiBriefing(updated)} 
                />
                </>
            )}

            {/* Live Scan Execution Floating Modal */}
            {isScanning && (
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    width: '460px',
                    maxHeight: '260px',
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    borderRadius: '16px',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(12px)',
                    zIndex: 10000,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    fontFamily: 'monospace'
                }}>
                    <div style={{
                        padding: '10px 16px',
                        background: 'rgba(99, 102, 241, 0.15)',
                        borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Loader2 size={15} style={{ animation: 'spin 1s linear infinite', color: '#818cf8' }} />
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e0e7ff' }}>
                                Executing Python Pipeline ({scanStatus})
                            </span>
                        </div>
                    </div>
                    <div style={{
                        padding: '12px 16px',
                        overflowY: 'auto',
                        fontSize: '0.74rem',
                        color: '#94a3b8',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        maxHeight: '200px'
                    }}>
                        {scanLogs.map((log, i) => (
                            <div key={i} style={{ color: log.includes('completed') ? '#4ade80' : log.includes('error') || log.includes('failed') ? '#f87171' : '#cbd5e1' }}>
                                &gt; {log}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Market;

