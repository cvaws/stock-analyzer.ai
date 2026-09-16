import React, { useEffect, useState } from 'react';
import { Search, Loader2, ChevronDown, ChevronUp, Layers, RefreshCw, Play, Clock } from 'lucide-react';
import { fetchEtfTrackerData, fetchMarketRegimeData, ThemeStockData } from '../services/dataService';
import { ExtendedThemeStockData } from './Market';

const CATEGORY_ORDER = ["Canaries", "Macro", "Leadership", "Breadth", "Defense", "Leveraged_Long", "Leveraged_Short"];

const EtfMatrix: React.FC = () => {
    const [data, setData] = useState<ExtendedThemeStockData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [sortCriteria, setSortCriteria] = useState<Array<{ column: keyof ExtendedThemeStockData; direction: 'asc' | 'desc' }>>([]);
    const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());
    const [scanDate, setScanDate] = useState<string>('');
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [scanStatus, setScanStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
    const [scanLogs, setScanLogs] = useState<string[]>([]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [res, regime] = await Promise.all([
                fetchEtfTrackerData(),
                fetchMarketRegimeData()
            ]);
            setData(res);
            if (regime?.scan_date) {
                setScanDate(regime.scan_date);
            }
            const sectors = new Set(res.map((item: ThemeStockData) => item.sector));
            setExpandedSectors(sectors);
        } catch (e) {
            console.error("Error loading ETF Matrix data:", e);
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
                    loadData();
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
            setScanLogs(prev => [...prev, 'Scan completed or disconnected.']);
            setIsScanning(false);
            setScanStatus('completed');
            eventSource.close();
            loadData();
            window.dispatchEvent(new CustomEvent('market-data-updated'));
        };
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

    const expandAll = () => {
        const sectors = new Set(data.map(item => item.sector));
        setExpandedSectors(sectors);
    };

    const collapseAll = () => {
        setExpandedSectors(new Set());
    };

    const filteredData = data.filter(item => {
        const matchesCategory = selectedCategory === 'ALL' || item.sector === selectedCategory;
        const matchesSearch = item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.subIndustry.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.sector.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    });

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

    const renderMaBadge = (above: boolean | undefined, themeColor?: 'green' | 'red' | 'yellow') => {
        const isAbove = above === true;

        let bgColor = isAbove ? '#064e3b' : '#7f1d1d';
        let textColor = isAbove ? '#10b981' : '#f87171';

        if (themeColor === 'yellow') {
            bgColor = '#78350f';
            textColor = '#fbbf24';
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
                            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
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
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                            <thead>
                                <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                    <th onClick={(e) => handleHeaderClick('symbol', e)} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', cursor: 'pointer' }}>Symbol {renderSortIndicator('symbol')}</th>
                                    <th onClick={(e) => handleHeaderClick('price', e)} style={{ padding: '0.5rem 0.6rem', textAlign: 'right', cursor: 'pointer' }}>Price {renderSortIndicator('price')}</th>
                                    <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>Supertrend</th>
                                    <th onClick={(e) => handleHeaderClick('dailyChangePct', e)} style={{ padding: '0.5rem 0.6rem', textAlign: 'right', cursor: 'pointer' }}>% Chg D {renderSortIndicator('dailyChangePct')}</th>
                                    <th onClick={(e) => handleHeaderClick('changeW', e)} style={{ padding: '0.5rem 0.6rem', textAlign: 'right', cursor: 'pointer' }}>% Chg W {renderSortIndicator('changeW')}</th>
                                    <th onClick={(e) => handleHeaderClick('changeM', e)} style={{ padding: '0.5rem 0.6rem', textAlign: 'right', cursor: 'pointer' }}>% Chg M {renderSortIndicator('changeM')}</th>
                                    <th onClick={(e) => handleHeaderClick('volRatio', e)} style={{ padding: '0.5rem 0.6rem', textAlign: 'right', cursor: 'pointer' }}>Vol {renderSortIndicator('volRatio')}</th>
                                    <th onClick={(e) => handleHeaderClick('rsDailyPct', e)} title="Mansfield RS Index — rate of outperformance vs SPY" style={{ padding: '0.5rem 0.6rem', textAlign: 'right', cursor: 'pointer' }}>RS_D% ℹ️ {renderSortIndicator('rsDailyPct')}</th>
                                    <th onClick={(e) => handleHeaderClick('rsWeeklyPct', e)} title="Mansfield RS Index — rate of outperformance vs SPY" style={{ padding: '0.5rem 0.6rem', textAlign: 'right', cursor: 'pointer' }}>RS_W% ℹ️ {renderSortIndicator('rsWeeklyPct')}</th>
                                    <th onClick={(e) => handleHeaderClick('pctOff52WkHigh', e)} style={{ padding: '0.5rem 0.6rem', textAlign: 'right', cursor: 'pointer' }}>%52wk {renderSortIndicator('pctOff52WkHigh')}</th>
                                    <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>8ema</th>
                                    <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>21ema</th>
                                    <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>50sma</th>
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

                                    const getRsColor = (colorFlag?: string, val?: any) => {
                                        if (colorFlag === 'MAGENTA') return '#d946ef';
                                        if (colorFlag === 'CYAN') return '#06b6d4';
                                        if (colorFlag === 'GREEN' || (Number(val) || 0) >= 0) return '#10b981';
                                        return '#ef4444';
                                    };

                                    return (
                                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                            <td style={{ padding: '0.45rem 0.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <span>{stock.symbol}</span>
                                                    {stock.subIndustry && stock.subIndustry !== stock.symbol && (
                                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                                            ({stock.subIndustry})
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontWeight: 600 }}>${stock.price?.toFixed(2)}</td>
                                            <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center' }}>
                                                {renderSupertrendBadgeForStock(stock)}
                                            </td>
                                            <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: (stock.dailyChangePct || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                                {formatPct(stock.dailyChangePct)}
                                            </td>
                                            <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: (stock.changeW || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                                {formatPct(stock.changeW)}
                                            </td>
                                            <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: (stock.changeM || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                                {formatPct(stock.changeM)}
                                            </td>
                                            <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: volColor, fontWeight: 700 }}>
                                                {volRatioVal.toFixed(2)}x
                                            </td>
                                            <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: getRsColor(stock.rsDailyColor, stock.rsDailyPct), fontWeight: 700 }}>
                                                {formatPct(stock.rsDailyPct)}
                                            </td>
                                            <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: getRsColor(stock.rsWeeklyColor, stock.rsWeeklyPct), fontWeight: 700 }}>
                                                {formatPct(stock.rsWeeklyPct)}
                                            </td>
                                            <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontWeight: 700, color: pctColor }}>
                                                {pctOff.toFixed(1)}%
                                            </td>
                                            <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center' }}>
                                                {renderMaBadge(stock.aboveEma8)}
                                            </td>
                                            <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center' }}>
                                                {renderMaBadge(stock.aboveEma21)}
                                            </td>
                                            <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center' }}>
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
            {/* Header & Filter Controls */}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff'
                    }}>
                        <Layers size={20} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                            ETF Categories &amp; Sector Matrix
                        </h1>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Comprehensive technical overview categorized by market role (Canaries, Leadership, Breadth, Defense, Leveraged)
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {/* Category Filter Pills */}
                    <div style={{
                        display: 'flex',
                        gap: '4px',
                        background: 'rgba(255,255,255,0.03)',
                        padding: '4px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)'
                    }}>
                        {['ALL', ...CATEGORY_ORDER].map((cat) => {
                            const isSelected = selectedCategory === cat;
                            return (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: isSelected ? 'var(--accent-primary)' : 'transparent',
                                        color: isSelected ? '#fff' : 'var(--text-secondary)',
                                        fontSize: '0.75rem',
                                        fontWeight: isSelected ? 700 : 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    {cat === 'ALL' ? 'All Groups' : cat.replace('_', ' ')}
                                </button>
                            );
                        })}
                    </div>

                    {/* Expand / Collapse Buttons */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                            onClick={expandAll}
                            style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'rgba(255,255,255,0.02)',
                                color: 'var(--text-secondary)',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                            }}
                        >
                            Expand All
                        </button>
                        <button
                            onClick={collapseAll}
                            style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'rgba(255,255,255,0.02)',
                                color: 'var(--text-secondary)',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                            }}
                        >
                            Collapse All
                        </button>
                    </div>

                    {/* Search Input */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'rgba(255,255,255,0.02)',
                        padding: '0.45rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        width: '200px'
                    }}>
                        <Search size={15} color="var(--text-muted)" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Filter symbol or theme..."
                            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', width: '100%', outline: 'none' }}
                        />
                    </div>

                    {/* Scan Date Badge */}
                    {scanDate && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '5px 10px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid var(--border-color)',
                            fontSize: '0.74rem',
                            color: 'var(--text-muted)'
                        }}>
                            <Clock size={12} color="#6366f1" />
                            <span>Scan Date: <strong style={{ color: 'var(--text-primary)' }}>{scanDate}</strong></span>
                        </div>
                    )}

                    {/* Refresh Data Button */}
                    <button
                        onClick={loadData}
                        disabled={loading || isScanning}
                        title="Reload market data from disk"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'rgba(255, 255, 255, 0.04)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: (loading || isScanning) ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                        <span>Refresh</span>
                    </button>

                    {/* Run Daily Scan Button */}
                    <button
                        onClick={handleRunDailyScan}
                        disabled={isScanning}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 14px',
                            borderRadius: '8px',
                            border: 'none',
                            background: isScanning ? 'rgba(99, 102, 241, 0.5)' : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                            color: '#fff',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: isScanning ? 'not-allowed' : 'pointer',
                            boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        {isScanning ? (
                            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                            <Play size={13} fill="#fff" />
                        )}
                        <span>{isScanning ? 'Scanning...' : 'Run Daily Scan'}</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '1rem' }}>
                    <Loader2 size={36} className="animate-spin" color="var(--accent-primary)" />
                    <span style={{ color: 'var(--text-muted)' }}>Loading ETF Categories &amp; Technical Parity Indicators...</span>
                </div>
            ) : selectedCategory !== 'ALL' ? (
                /* Single Category Filter Mode */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {sortedSectors.map(sec => renderSectorCard(sec))}
                </div>
            ) : (
                /* 2-Column Dedicated Layout: Left (Canaries, Leadership, Leveraged Long) | Right (Breadth, Defense, Leveraged Short) */
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(520px, 1fr))',
                    gap: '1.5rem',
                    alignItems: 'start'
                }}>
                    {/* Left Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {['Canaries', 'Macro', 'Leadership', 'Leveraged_Long'].map(sec => {
                            return sortedSectors.includes(sec) ? renderSectorCard(sec) : null;
                        })}
                    </div>

                    {/* Right Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {['Breadth', 'Defense', 'Leveraged_Short'].map(sec => {
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

export default EtfMatrix;
