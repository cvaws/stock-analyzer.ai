import React, { useEffect, useState } from 'react';
import { Search, Loader2, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { fetchEtfTrackerData, fetchMarketRegimeData, fetchPresetStrategies, ThemeStockData, SavedStrategy } from '../services/dataService';
import { MarketRegimeWidget, MarketRegimeData } from '../components/MarketRegimeWidget';

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
    const [loading, setLoading] = useState<boolean>(true);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [sortCriteria, setSortCriteria] = useState<Array<{ column: keyof ExtendedThemeStockData; direction: 'asc' | 'desc' }>>([]);

    const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());
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
            const [res, regimeRes, strategies] = await Promise.all([
                fetchEtfTrackerData(),
                fetchMarketRegimeData(),
                fetchPresetStrategies()
            ]);
            setData(res);
            setRegimeData(regimeRes);
            setPresetStrategies(strategies || []);
            const sectors = new Set(res.map(item => item.sector));
            setExpandedSectors(sectors);
        } catch (e) {
            console.error("Error loading Market Page data:", e);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
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

    const toggleExpand = (sector: string) => {
        const next = new Set(expandedSectors);
        if (next.has(sector)) {
            next.delete(sector);
        } else {
            next.add(sector);
        }
        setExpandedSectors(next);
    };

    const filteredData = data.filter(item =>
        item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.subIndustry.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sector.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sectorsMap = new Map<string, ExtendedThemeStockData[]>();
    filteredData.forEach(item => {
        const list = sectorsMap.get(item.sector) || [];
        list.push(item);
        sectorsMap.set(item.sector, list);
    });

    const getSortableNumber = (val: any): number => {
        if (val === 'N/A' || val === undefined || val === null) return -999999;
        const num = Number(val);
        return isNaN(num) ? -999999 : num;
    };

    const sortStocks = (stocks: ExtendedThemeStockData[]): ExtendedThemeStockData[] => {
        if (sortCriteria.length === 0) return stocks;
        return [...stocks].sort((a, b) => {
            for (const crit of sortCriteria) {
                const valA = a[crit.column];
                const valB = b[crit.column];
                if (typeof valA === 'string' && typeof valB === 'string') {
                    const cmp = valA.localeCompare(valB);
                    if (cmp !== 0) return crit.direction === 'asc' ? cmp : -cmp;
                } else {
                    const numA = getSortableNumber(valA);
                    const numB = getSortableNumber(valB);
                    if (numA !== numB) return crit.direction === 'asc' ? numA - numB : numB - numA;
                }
            }
            return 0;
        });
    };

    const CATEGORY_ORDER = ["Canaries", "Leadership", "Breadth", "Defense", "Leveraged_Long", "Leveraged_Short"];

    const sortedSectors = Array.from(sectorsMap.keys()).sort((a, b) => {
        const idxA = CATEGORY_ORDER.indexOf(a);
        const idxB = CATEGORY_ORDER.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });

    const handleHeaderClick = (column: keyof ExtendedThemeStockData, ev?: React.MouseEvent) => {
        const isShift = ev?.shiftKey;
        setSortCriteria(prev => {
            const existing = prev.find(c => c.column === column);
            if (!isShift) {
                if (existing) {
                    return [{ column, direction: existing.direction === 'asc' ? 'desc' : 'asc' }];
                }
                const isText = ['symbol', 'companyName', 'subIndustry'].includes(column as string);
                return [{ column, direction: isText ? 'asc' : 'desc' }];
            }
            if (existing) {
                return prev.map(c => c.column === column ? { ...c, direction: c.direction === 'asc' ? 'desc' : 'asc' } : c);
            }
            const isText = ['symbol', 'companyName', 'subIndustry'].includes(column as string);
            return [...prev, { column, direction: isText ? 'asc' : 'desc' }];
        });
    };

    const renderSortIndicator = (column: keyof ExtendedThemeStockData) => {
        const idx = sortCriteria.findIndex(c => c.column === column);
        if (idx === -1) return null;
        const crit = sortCriteria[idx];
        return (
            <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', marginLeft: '4px' }}>
                {crit.direction === 'asc' ? '▲' : '▼'}
                {sortCriteria.length > 1 ? <sub style={{ fontSize: '0.6rem' }}>{idx + 1}</sub> : null}
            </span>
        );
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

    const renderSectorCard = (sectorName: string) => {
        const rawStocks = sectorsMap.get(sectorName) || [];
        const stocks = sortStocks(rawStocks);
        const isExpanded = expandedSectors.has(sectorName);

        return (

            <div key={sectorName} style={{
                background: 'var(--bg-card)',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
            }}>
                <div
                    onClick={() => toggleExpand(sectorName)}
                    style={{
                        padding: '1rem 1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.02)',
                        borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none',
                        userSelect: 'none'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'rgba(59, 130, 246, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#3b82f6'
                        }}>
                            <Layers size={18} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                                Category: {sectorName.replace('_', ' ')}
                            </h3>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {stocks.length} ETFs
                            </span>

                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {isExpanded ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
                    </div>
                </div>

                {isExpanded && (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                    <th onClick={(e) => handleHeaderClick('symbol', e)} style={{ padding: '0.75rem 1rem', textAlign: 'left', cursor: 'pointer' }}>Symbol {renderSortIndicator('symbol')}</th>
                                    <th onClick={(e) => handleHeaderClick('price', e)} style={{ padding: '0.75rem 1rem', textAlign: 'right', cursor: 'pointer' }}>Price {renderSortIndicator('price')}</th>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Supertrend</th>
                                    <th onClick={(e) => handleHeaderClick('dailyChangePct', e)} style={{ padding: '0.75rem 1rem', textAlign: 'right', cursor: 'pointer' }}>% Change D {renderSortIndicator('dailyChangePct')}</th>
                                    <th onClick={(e) => handleHeaderClick('changeW', e)} style={{ padding: '0.75rem 1rem', textAlign: 'right', cursor: 'pointer' }}>% Change W {renderSortIndicator('changeW')}</th>
                                    <th onClick={(e) => handleHeaderClick('changeM', e)} style={{ padding: '0.75rem 1rem', textAlign: 'right', cursor: 'pointer' }}>% Change M {renderSortIndicator('changeM')}</th>
                                    <th onClick={(e) => handleHeaderClick('volRatio', e)} style={{ padding: '0.75rem 1rem', textAlign: 'right', cursor: 'pointer' }}>Vol Ratio {renderSortIndicator('volRatio')}</th>
                                    <th onClick={(e) => handleHeaderClick('rsDailyPct', e)} title="Mansfield RS Index — rate of outperformance vs SPY. Formula: ((ETF/SPY) / SMA52(ETF/SPY) − 1) × 10" style={{ padding: '0.75rem 1rem', textAlign: 'right', cursor: 'pointer' }}>RS_Daily% ℹ️ {renderSortIndicator('rsDailyPct')}</th>
                                    <th onClick={(e) => handleHeaderClick('rsWeeklyPct', e)} title="Mansfield RS Index — rate of outperformance vs SPY. Formula: ((ETF/SPY) / SMA52(ETF/SPY) − 1) × 10" style={{ padding: '0.75rem 1rem', textAlign: 'right', cursor: 'pointer' }}>RS_Weekly% ℹ️ {renderSortIndicator('rsWeeklyPct')}</th>
                                    <th onClick={(e) => handleHeaderClick('pctOff52WkHigh', e)} style={{ padding: '0.75rem 1rem', textAlign: 'right', cursor: 'pointer' }}>%52wk_High {renderSortIndicator('pctOff52WkHigh')}</th>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>8ema</th>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>21ema</th>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>50 sma</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stocks.map((stock, idx) => {
                                    const pctOff = stock.pctOff52WkHigh !== undefined ? stock.pctOff52WkHigh : 0;
                                    let pctColor = '#ef4444'; // RED
                                    if (pctOff > -5) pctColor = '#10b981'; // GREEN
                                    else if (pctOff > -10) pctColor = '#f59e0b'; // ORANGE

                                    const volRatioVal = stock.volRatio !== undefined && stock.volRatio !== null ? stock.volRatio : 1.0;
                                    const isUpDay = (stock.dailyChangePct || 0) >= 0;
                                    let volColor = 'var(--text-muted)';
                                    if (isUpDay && volRatioVal > 1.2) volColor = '#10b981';
                                    else if (!isUpDay && volRatioVal > 1.5) volColor = '#f87171';

                                    return (
                                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stock.symbol}</td>
                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>${stock.price?.toFixed(2)}</td>
                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                {renderSupertrendBadgeForStock(stock)}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: (stock.dailyChangePct || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                                {formatPct(stock.dailyChangePct)}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: (stock.changeW || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                                {formatPct(stock.changeW)}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: (stock.changeM || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                                {formatPct(stock.changeM)}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: volColor, fontWeight: 700 }}>
                                                {volRatioVal.toFixed(2)}x
                                            </td>
                                            {(() => {
                                                const getRsColor = (colorFlag?: string, val?: any) => {
                                                    if (colorFlag === 'MAGENTA') return '#d946ef';
                                                    if (colorFlag === 'CYAN') return '#06b6d4';
                                                    if (colorFlag === 'GREEN' || (Number(val) || 0) >= 0) return '#10b981';
                                                    return '#ef4444';
                                                };
                                                return (
                                                    <>
                                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: getRsColor(stock.rsDailyColor, stock.rsDailyPct), fontWeight: 700 }}>
                                                            {formatPct(stock.rsDailyPct)}
                                                        </td>
                                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: getRsColor(stock.rsWeeklyColor, stock.rsWeeklyPct), fontWeight: 700 }}>
                                                            {formatPct(stock.rsWeeklyPct)}
                                                        </td>
                                                    </>
                                                );
                                            })()}
                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: pctColor }}>
                                                {pctOff.toFixed(1)}%
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                {renderMaBadge(stock.aboveEma8)}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                {renderMaBadge(stock.aboveEma21)}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                {renderMaBadge(stock.aboveSma50)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>

                        </table>
                    </div>
                )}
            </div>
        );
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

    // Regime-aware filtering for Top 3 widgets
    const regimeCode = regimeData?.regime_code || 'HALF_SIZE';
    const regimeFilteredData = data.filter(stock => {
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
                        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>📈 Market Overview & ETF Tracker</h1>
                        
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


                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'rgba(255,255,255,0.02)',
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        width: '260px'
                    }}>
                        <Search size={16} color="var(--text-muted)" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search ETF symbol or category..."
                            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '0.85rem', width: '100%', outline: 'none' }}
                        />
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
                    <span style={{ color: 'var(--text-muted)' }}>Loading ThinkOrSwim Parity Metrics & Category Matrix...</span>
                </div>
            ) : (
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    {/* Left Column: Canaries, Leveraged Long, Leveraged Short, Leadership */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: '1 1 500px', minWidth: '0' }}>
                        {['Canaries', 'Leveraged_Long', 'Leveraged_Short', 'Leadership'].map(sec => {
                            return sortedSectors.includes(sec) ? renderSectorCard(sec) : null;
                        })}
                    </div>

                    {/* Right Column: Market Regime Widget + Focus List Side-by-Side, Breadth, Defense */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: '1.2 1 600px', minWidth: '0' }}>
                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
                            <div style={{ flex: '1 1 280px', display: 'flex' }}>
                                <MarketRegimeWidget regimeData={regimeData} />
                            </div>
                            
                            {/* Focus List (Top 10 Bullish Leaders) */}
                            <div style={{
                                flex: '1.4 1 360px',
                                background: 'var(--bg-card)',
                                borderRadius: '16px',
                                border: '1px solid var(--border-color)',
                                padding: '1.25rem 1.5rem',
                                boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.85rem'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.85rem',
                                    minHeight: '350px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem', flexWrap: 'wrap', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            🎯 Top 10 Focus Leaders
                                        </h3>
                                        {/* Inline Account Size Input */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Acct: $</span>
                                            <input
                                                type="number"
                                                value={portfolioSize}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value) || 0;
                                                    setPortfolioSize(val);
                                                    localStorage.setItem('portfolio_size', val.toString());
                                                }}
                                                style={{
                                                    width: '78px',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: '#38bdf8',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    outline: 'none'
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Leader Changes Pill */}
                                    {regimeData?.leader_changes && (
                                        <div style={{ display: 'flex', gap: '6px', fontSize: '0.7rem' }}>
                                            {regimeData.leader_changes.newly_entered.length > 0 && (
                                                <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                                    +{regimeData.leader_changes.newly_entered.join(', ')} In
                                                </span>
                                            )}
                                            {regimeData.leader_changes.newly_exited.length > 0 && (
                                                <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
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
                                                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.72rem', color: '#fbbf24', fontWeight: 600 }}>
                                                    ⚠️ Concentration: {concentratedSector[1]} of 10 leaders are in <strong>{concentratedSector[0].replace('_', ' ')}</strong>
                                                </div>
                                            )}

                                            <div style={{ flex: 1, overflowX: 'auto' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                                                            <th onClick={() => handleFocusSortClick('symbol')} style={{ padding: '0.4rem 0.4rem', textAlign: 'left', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>Symbol{renderFocusSortIndicator('symbol')}</th>
                                                            <th onClick={() => handleFocusSortClick('sector')} style={{ padding: '0.4rem 0.4rem', textAlign: 'left', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>Group{renderFocusSortIndicator('sector')}</th>
                                                            <th onClick={() => handleFocusSortClick('price')} style={{ padding: '0.4rem 0.4rem', textAlign: 'right', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>Entry{renderFocusSortIndicator('price')}</th>
                                                            <th style={{ padding: '0.4rem 0.4rem', textAlign: 'right', fontWeight: 700 }}>Lab Strategy Stop</th>
                                                            <th onClick={() => handleFocusSortClick('rsWeeklyPct')} style={{ padding: '0.4rem 0.4rem', textAlign: 'right', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>RS W%{renderFocusSortIndicator('rsWeeklyPct')}</th>
                                                            <th onClick={() => handleFocusSortClick('rsWeeklyVelocity')} style={{ padding: '0.4rem 0.4rem', textAlign: 'right', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>W-Vel{renderFocusSortIndicator('rsWeeklyVelocity')}</th>
                                                            <th onClick={() => handleFocusSortClick('rsDailyVelocity')} style={{ padding: '0.4rem 0.4rem', textAlign: 'right', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>D-Vel{renderFocusSortIndicator('rsDailyVelocity')}</th>
                                                            <th onClick={() => handleFocusSortClick('pctAboveLastBase')} style={{ padding: '0.4rem 0.4rem', textAlign: 'right', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>Ext%{renderFocusSortIndicator('pctAboveLastBase')}</th>
                                                            <th style={{ padding: '0.4rem 0.4rem', textAlign: 'right', fontWeight: 700 }}>5-Slot Size (20%)</th>
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
                                                                        <td style={{ padding: '0.42rem 0.4rem', fontWeight: 800 }}>
                                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                                                                <span style={{ color: isBothFocusAndAccelerating ? '#10b981' : '#3b82f6' }}>
                                                                                    {stock.symbol}
                                                                                </span>
                                                                                {/* S2 Badge */}
                                                                                {stock.stage2Trend && (
                                                                                    <span title="Stage 2 Uptrend Confirmed" style={{ fontSize: '0.6rem', padding: '1px 3px', background: 'rgba(16, 185, 129, 0.25)', color: '#10b981', borderRadius: '3px', fontWeight: 700 }}>
                                                                                        S2
                                                                                    </span>
                                                                                )}
                                                                                {/* VDU Badge */}
                                                                                {stock.hasVDU && (
                                                                                    <span title="Volume Dry-Up Setup" style={{ fontSize: '0.6rem', padding: '1px 3px', background: 'rgba(6, 182, 212, 0.25)', color: '#06b6d4', borderRadius: '3px', fontWeight: 700 }}>
                                                                                        VDU
                                                                                    </span>
                                                                                )}
                                                                                {/* RS New High Dot */}
                                                                                {stock.rsNewHigh250 && (
                                                                                    <span title="RS 250-bar New High Breakout" style={{ fontSize: '0.6rem', color: '#fbbf24' }}>
                                                                                        ★
                                                                                    </span>
                                                                                )}
                                                                                {/* Dual Velocity Acceleration */}
                                                                                {isDualAccelerating && (
                                                                                    <span title="Dual Timeframe Acceleration (Daily + Weekly RS Velocity > 0)" style={{ fontSize: '0.6rem', color: '#38bdf8' }}>
                                                                                        ⚡⚡
                                                                                    </span>
                                                                                )}
                                                                                {isBothFocusAndAccelerating && (
                                                                                    <span style={{ fontSize: '0.65rem' }}>🔥</span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td style={{ padding: '0.42rem 0.4rem', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'capitalize' }}>
                                                                            {stock.sector.replace('_', ' ')}
                                                                        </td>
                                                                        <td style={{ padding: '0.42rem 0.4rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                                            ${currentPrice.toFixed(2)}
                                                                        </td>
                                                                        <td style={{ padding: '0.42rem 0.4rem', textAlign: 'right', fontSize: '0.72rem' }}>
                                                                            <span style={{ color: '#f87171', fontWeight: 700 }}>${stratStopPrice.toFixed(2)}</span>
                                                                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.65rem' }}>
                                                                                (-{(stratStopPct * 100).toFixed(0)}% SL | ST: ${stLevel.toFixed(1)})
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '0.42rem 0.4rem', textAlign: 'right', fontWeight: 700, color: getRsColor(stock.rsWeeklyColor, stock.rsWeeklyPct) }}>
                                                                            {formatPct(stock.rsWeeklyPct)}
                                                                        </td>
                                                                        <td style={{ padding: '0.42rem 0.4rem', textAlign: 'right', color: (stock.rsWeeklyVelocity || 0) > 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                                                            {(stock.rsWeeklyVelocity || 0) > 0 ? '+' : ''}{(stock.rsWeeklyVelocity || 0).toFixed(2)}%
                                                                        </td>
                                                                        <td style={{ padding: '0.42rem 0.4rem', textAlign: 'right', color: (stock.rsDailyVelocity || 0) > 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                                                            {(stock.rsDailyVelocity || 0) > 0 ? '+' : ''}{(stock.rsDailyVelocity || 0).toFixed(2)}%
                                                                        </td>
                                                                        <td style={{ padding: '0.42rem 0.4rem', textAlign: 'right', color: extColor, fontWeight: 700 }}>
                                                                            {extPct.toFixed(1)}%
                                                                        </td>
                                                                        <td style={{ padding: '0.42rem 0.4rem', textAlign: 'right', fontSize: '0.72rem' }}>
                                                                            <strong style={{ color: '#38bdf8' }}>{shares} sh</strong>
                                                                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.65rem' }}>(${dollarRiskAtStop.toFixed(0)} risk | {riskPctOfAcct.toFixed(1)}%)</span>
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
                                    fontSize: '0.68rem', 
                                    color: 'var(--text-muted)', 
                                    textAlign: 'center',
                                    fontWeight: 500
                                }}>
                                    5-Position Portfolio Model: 20% capital allocated per position ($20k on $100k) | Group-Optimized Strategy Lab Stops &amp; Supertrend Rules — default ranked by RS Weekly% (click headers to re-sort)
                                </div>
                            </div>
                        </div>
                    </div>

                        {/* Sector Rotation & RS Acceleration Widget */}
                        {(() => {
                            // Use identical candidate filter and default ranking (getNumericRs on rsWeeklyPct) as Focus Leaders
                            const focusLeaderSymbols = new Set(
                                [...data]
                                    .filter(stock => {
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
                                .filter(x => x.rsWeeklyVelocity !== undefined)
                                .sort((a, b) => (b.rsWeeklyVelocity || 0) - (a.rsWeeklyVelocity || 0))
                                .slice(0, 5);

                            const deceleratingEtfs = [...data]
                                .filter(x => x.rsWeeklyVelocity !== undefined)
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
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1rem'
                                }}>
                                    <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem' }}>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            🔄 Sector Rotation &amp; RS Acceleration
                                        </h3>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                            Tracking velocity of RS Weekly% over 5 days. <span style={{ color: '#10b981', fontWeight: 600 }}>Green tickers 🔥</span> indicate confirmed Focus Leaders accelerating now.
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                                        {/* Accelerating Column */}
                                        <div style={{ flex: '1 1 200px' }}>
                                            <h4 style={{ fontSize: '0.82rem', fontWeight: 800, color: '#10b981', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                🚀 Top 5 Accelerating (Flowing In)
                                            </h4>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left' }}>Symbol</th>
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left' }}>Group</th>
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'center' }}>RRG</th>
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>RS Weekly%</th>
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>1-Wk Velocity</th>
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
                                                                <td style={{ padding: '0.45rem 0.5rem', fontWeight: 800 }}>
                                                                    <span style={{
                                                                        color: isFocusLeader ? '#10b981' : '#3b82f6',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px'
                                                                    }}>
                                                                        {stock.symbol}
                                                                        {isFocusLeader && (
                                                                            <span style={{ fontSize: '0.65rem' }}>🔥</span>
                                                                        )}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '0.45rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'capitalize' }}>
                                                                    {stock.sector.replace('_', ' ')}
                                                                </td>
                                                                <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>
                                                                    <span style={{ background: rrg.bg, color: rrg.color, padding: '1px 5px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>
                                                                        {stock.rrgQuadrant || 'Leading'}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 700, color: getRsColor(stock.rsWeeklyColor, stock.rsWeeklyPct) }}>{formatPct(stock.rsWeeklyPct)}</td>
                                                                <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                                                    +{stock.rsWeeklyVelocity?.toFixed(2)}%
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Decelerating Column */}
                                        <div style={{ flex: '1 1 200px' }}>
                                            <h4 style={{ fontSize: '0.82rem', fontWeight: 800, color: '#ef4444', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                ⚠️ Top 5 Decelerating (Flowing Out)
                                            </h4>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left' }}>Symbol</th>
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left' }}>Group</th>
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'center' }}>RRG</th>
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>RS Weekly%</th>
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>1-Wk Velocity</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {deceleratingEtfs.map((stock, idx) => {
                                                        const rrg = getRrgBadge(stock.rrgQuadrant);
                                                        return (
                                                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                                <td style={{ padding: '0.45rem 0.5rem', fontWeight: 800, color: '#3b82f6' }}>{stock.symbol}</td>
                                                                <td style={{ padding: '0.45rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'capitalize' }}>
                                                                    {stock.sector.replace('_', ' ')}
                                                                </td>
                                                                <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>
                                                                    <span style={{ background: rrg.bg, color: rrg.color, padding: '1px 5px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>
                                                                        {stock.rrgQuadrant || 'Lagging'}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 700, color: getRsColor(stock.rsWeeklyColor, stock.rsWeeklyPct) }}>{formatPct(stock.rsWeeklyPct)}</td>
                                                                <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>
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



                        {['Breadth', 'Defense'].map(sec => {
                            return sortedSectors.includes(sec) ? renderSectorCard(sec) : null;
                        })}
                    </div>

                </div>
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

