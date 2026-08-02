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
    rsRating?: number;
    stage2Trend?: boolean;
    pctOff52WkHigh?: number;
    rsDailyColor?: string;
    rsWeeklyColor?: string;
}




const Market: React.FC = () => {
    const [data, setData] = useState<ExtendedThemeStockData[]>([]);
    const [regimeData, setRegimeData] = useState<MarketRegimeData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [sortCriteria, setSortCriteria] = useState<Array<{ column: keyof ExtendedThemeStockData; direction: 'asc' | 'desc' }>>([]);

    const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());

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
    const renderMaBadge = (above: boolean | undefined) => {
        const isAbove = above === true;

        return (
            <span style={{
                backgroundColor: isAbove ? '#064e3b' : '#7f1d1d',
                color: isAbove ? '#10b981' : '#f87171',
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
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Description</th>
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
                                            <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{stock.symbol} ETF</td>
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

    return (
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, overflowY: 'auto' }}>
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
                border: '1px solid var(--border-color)'
            }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>📈 Market Overview & ETF Tracker</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                        ThinkOrSwim Parity Indicators matrix grouped by ETF category (*Breadth, Canaries, Defense, Leadership, Leveraged*).
                    </p>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'rgba(255,255,255,0.02)',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    width: '300px'
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

                    {/* Right Column: Market Regime Widget, Breadth, Defense */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: '1 1 500px', minWidth: '0' }}>
                        <MarketRegimeWidget regimeData={regimeData} />
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
