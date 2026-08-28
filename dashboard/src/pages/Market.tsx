import React, { useEffect, useState } from 'react';
import { Search, Loader2, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { fetchEtfTrackerData, fetchMarketRegimeData, ThemeStockData } from '../services/dataService';
import { MarketRegimeWidget, MarketRegimeData } from '../components/MarketRegimeWidget';

export interface ExtendedThemeStockData extends ThemeStockData {
    dailyChangePct?: number;
    changeW?: number;
    changeM?: number;
    aboveEma8?: boolean;
    aboveEma21?: boolean;
    aboveSma50?: boolean;
    supertrendDirection?: number;
    supertrend?: number;
    rsRating?: number;
    stage2Trend?: boolean;
    pctOff52WkHigh?: number;
    rsDailyColor?: string;
    rsWeeklyColor?: string;
    rsDailyVelocity?: number;
    rsWeeklyVelocity?: number;
}




const Market: React.FC = () => {
    const [data, setData] = useState<ExtendedThemeStockData[]>([]);
    const [regimeData, setRegimeData] = useState<MarketRegimeData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [sortCriteria, setSortCriteria] = useState<Array<{ column: keyof ExtendedThemeStockData; direction: 'asc' | 'desc' }>>([]);

    const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());
    const [focusSortField, setFocusSortField] = useState<string>('rsWeeklyPct');
    const [focusSortAsc, setFocusSortAsc] = useState<boolean>(false);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [res, regimeRes] = await Promise.all([
                    fetchEtfTrackerData(),
                    fetchMarketRegimeData()
                ]);
                setData(res);
                setRegimeData(regimeRes);
                const sectors = new Set(res.map(item => item.sector));
                setExpandedSectors(sectors);
            } catch (e) {
                console.error("Error loading Market Page data:", e);
            }
            setLoading(false);
        };
        loadData();
    }, []);

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
                                    <th onClick={(e) => handleHeaderClick('rsDailyPct', e)} style={{ padding: '0.75rem 1rem', textAlign: 'right', cursor: 'pointer' }}>RS_Daily% {renderSortIndicator('rsDailyPct')}</th>
                                    <th onClick={(e) => handleHeaderClick('rsWeeklyPct', e)} style={{ padding: '0.75rem 1rem', textAlign: 'right', cursor: 'pointer' }}>RS_Weekly% {renderSortIndicator('rsWeeklyPct')}</th>
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

    const topDailyRs = [...data]
        .filter(x => getNumericRs(x.rsDailyPct) > -999999)
        .sort((a, b) => getNumericRs(b.rsDailyPct) - getNumericRs(a.rsDailyPct))
        .slice(0, 3);

    const topWeeklyRs = [...data]
        .filter(x => getNumericRs(x.rsWeeklyPct) > -999999)
        .sort((a, b) => getNumericRs(b.rsWeeklyPct) - getNumericRs(a.rsWeeklyPct))
        .slice(0, 3);

    const top52WkHigh = [...data]
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
                    <div>
                        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>📈 Market Overview & ETF Tracker</h1>
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
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🔥 Top 3 RS Daily%
                    </h3>
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
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#a855f7', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        💫 Top 3 RS Weekly%
                    </h3>
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
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#3b82f6', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🚀 Top 3 %52wk_High
                    </h3>
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
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem',
                                minHeight: '350px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        🎯 Top 10 Focus Leaders
                                    </h3>
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '380px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                                                <th onClick={() => handleFocusSortClick('symbol')} style={{ padding: '0.4rem 0.5rem', textAlign: 'left', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>Symbol{renderFocusSortIndicator('symbol')}</th>
                                                <th onClick={() => handleFocusSortClick('sector')} style={{ padding: '0.4rem 0.5rem', textAlign: 'left', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>Group{renderFocusSortIndicator('sector')}</th>
                                                <th onClick={() => handleFocusSortClick('rsWeeklyPct')} style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>RS Weekly%{renderFocusSortIndicator('rsWeeklyPct')}</th>
                                                <th onClick={() => handleFocusSortClick('rsDailyPct')} style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>RS Daily%{renderFocusSortIndicator('rsDailyPct')}</th>
                                                <th onClick={() => handleFocusSortClick('rsWeeklyVelocity')} style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>1-Wk Velocity{renderFocusSortIndicator('rsWeeklyVelocity')}</th>
                                                <th onClick={() => handleFocusSortClick('pctOff52WkHigh')} style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>Off 52W{renderFocusSortIndicator('pctOff52WkHigh')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const getFocusValForSort = (item: ExtendedThemeStockData, field: string): any => {
                                                    if (field === 'symbol') return item.symbol;
                                                    if (field === 'sector') return item.sector;
                                                    if (field === 'price') return item.price ?? 0;
                                                    if (field === 'pctOff52WkHigh') return item.pctOff52WkHigh ?? 0;
                                                    if (field === 'rsWeeklyVelocity') return item.rsWeeklyVelocity ?? 0;
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
                                                        return dailyBullish && weeklyBullish && accelerating; // Bullish ST + Accelerating RS
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

                                                const getRsColor = (colorFlag?: string, val?: any) => {
                                                    if (colorFlag === 'MAGENTA') return '#d946ef';
                                                    if (colorFlag === 'CYAN') return '#06b6d4';
                                                    if (colorFlag === 'GREEN' || (Number(val) || 0) >= 0) return '#10b981';
                                                    return '#ef4444';
                                                };

                                                if (sortedLeaders.length === 0) {
                                                    return (
                                                        <tr>
                                                            <td colSpan={6} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                                                                No bullish &amp; accelerating RS leaders found today
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                return sortedLeaders.map((stock, idx) => {
                                                    const off52 = stock.pctOff52WkHigh !== undefined ? stock.pctOff52WkHigh : 0;
                                                    let off52Color = '#ef4444';
                                                    if (off52 > -5) off52Color = '#10b981';
                                                    else if (off52 > -10) off52Color = '#f59e0b';

                                                    return (
                                                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', verticalAlign: 'middle' }}>
                                                            <td style={{ padding: '0.55rem 0.5rem', fontWeight: 800, color: '#3b82f6' }}>{stock.symbol}</td>
                                                            <td style={{ padding: '0.55rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'capitalize' }}>
                                                                {stock.sector.replace('_', ' ')}
                                                            </td>
                                                            <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: 700, color: getRsColor(stock.rsWeeklyColor, stock.rsWeeklyPct) }}>
                                                                {formatPct(stock.rsWeeklyPct)}
                                                            </td>
                                                            <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', color: getRsColor(stock.rsDailyColor, stock.rsDailyPct), fontWeight: 600 }}>
                                                                {formatPct(stock.rsDailyPct)}
                                                            </td>
                                                            <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', color: '#10b981', fontWeight: 700 }}>
                                                                +{stock.rsWeeklyVelocity?.toFixed(2)}%
                                                            </td>
                                                            <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', color: off52Color, fontWeight: 600 }}>
                                                                {off52.toFixed(1)}%
                                                            </td>
                                                        </tr>
                                                    );
                                                });
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ 
                                    borderTop: '1px solid rgba(255,255,255,0.06)', 
                                    paddingTop: '0.6rem', 
                                    fontSize: '0.72rem', 
                                    color: 'var(--text-muted)', 
                                    textAlign: 'center',
                                    fontWeight: 500
                                }}>
                                    Formula: (Price &gt; Weekly Supertrend &amp; Direction = Bullish &amp; 1-Wk RS Velocity &gt; 0) ranked by RS Weekly%
                                </div>
                            </div>
                        </div>

                        {/* Sector Rotation & RS Acceleration Widget */}
                        {(() => {
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
                                            Tracking the velocity (momentum rate of change) of RS Weekly% over the last 5 trading days.
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
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>RS Weekly%</th>
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>1-Wk Velocity</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {acceleratingEtfs.map((stock, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                            <td style={{ padding: '0.45rem 0.5rem', fontWeight: 800, color: '#3b82f6' }}>{stock.symbol}</td>
                                                            <td style={{ padding: '0.45rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'capitalize' }}>
                                                                {stock.sector.replace('_', ' ')}
                                                            </td>
                                                            <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 700, color: getRsColor(stock.rsWeeklyColor, stock.rsWeeklyPct) }}>{formatPct(stock.rsWeeklyPct)}</td>
                                                            <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                                                +{stock.rsWeeklyVelocity?.toFixed(2)}%
                                                            </td>
                                                        </tr>
                                                    ))}
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
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>RS Weekly%</th>
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>1-Wk Velocity</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {deceleratingEtfs.map((stock, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                            <td style={{ padding: '0.45rem 0.5rem', fontWeight: 800, color: '#3b82f6' }}>{stock.symbol}</td>
                                                            <td style={{ padding: '0.45rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'capitalize' }}>
                                                                {stock.sector.replace('_', ' ')}
                                                            </td>
                                                            <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 700, color: getRsColor(stock.rsWeeklyColor, stock.rsWeeklyPct) }}>{formatPct(stock.rsWeeklyPct)}</td>
                                                            <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>
                                                                {stock.rsWeeklyVelocity?.toFixed(2)}%
                                                            </td>
                                                        </tr>
                                                    ))}
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
        </div>
    );
};


export default Market;
