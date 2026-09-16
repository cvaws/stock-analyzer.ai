import React, { useEffect, useState, useMemo } from 'react';
import { Layers, ArrowUpDown, Search, Loader2, Play, Clock, RefreshCw } from 'lucide-react';
import { fetchEtfTrackerData, fetchMarketRegimeData, ThemeStockData } from '../services/dataService';

interface ThemeMetricRow {
    symbol: string;
    themeName: string;
    value: number;
    formattedValue: string;
    subIndustry: string;
    isPositive: boolean;
    stage2Trend?: boolean;
    supertrendBullish?: boolean;
}

interface ColumnConfig {
    id: 'daily' | 'weekly' | 'monthly' | 'rsWeekly' | 'rsDaily';
    title: string;
    subtitle: string;
    icon: string;
    dataKey: keyof ThemeStockData;
    tooltip: string;
}

const COLUMNS: ColumnConfig[] = [
    {
        id: 'daily',
        title: '% Change Daily',
        subtitle: '1-Day Return vs Prior Close',
        icon: '⚡',
        dataKey: 'dailyChangePct',
        tooltip: 'Today’s price performance'
    },
    {
        id: 'weekly',
        title: '% Change Weekly',
        subtitle: '5-Day Rolling Return',
        icon: '📅',
        dataKey: 'changeW',
        tooltip: '5-Day trailing price performance'
    },
    {
        id: 'monthly',
        title: '% Change Monthly',
        subtitle: '21-Day Rolling Return',
        icon: '🗓️',
        dataKey: 'changeM',
        tooltip: '21-Day (1-Month) trailing price performance'
    },
    {
        id: 'rsWeekly',
        title: 'RS Weekly %',
        subtitle: '52-Week MRS vs SPY',
        icon: '🚀',
        dataKey: 'rsWeeklyPct',
        tooltip: 'Relative Strength Weekly vs S&P 500 (Stage 2 Focus)'
    },
    {
        id: 'rsDaily',
        title: 'RS Daily %',
        subtitle: 'Short-Term RS Velocity vs SPY',
        icon: '🔥',
        dataKey: 'rsDailyPct',
        tooltip: 'Relative Strength Daily short-term momentum'
    }
];

export const ThemeTracker: React.FC = () => {
    const [data, setData] = useState<ThemeStockData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [scanDate, setScanDate] = useState<string>('');
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [scanStatus, setScanStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
    const [scanLogs, setScanLogs] = useState<string[]>([]);
    const [sortAscMap, setSortAscMap] = useState<Record<string, boolean>>({
        daily: false,
        weekly: false,
        monthly: false,
        rsWeekly: false,
        rsDaily: false
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [rawData, regime] = await Promise.all([
                fetchEtfTrackerData(),
                fetchMarketRegimeData()
            ]);
            if (regime?.scan_date) {
                setScanDate(regime.scan_date);
            }
            // Filter out leveraged and macro ETFs (Theme Tracker is strictly for thematic industry ETFs)
            const thematicData = rawData.filter(item => {
                const sec = (item.sector || item.subIndustry || '').toLowerCase();
                const sym = item.symbol.toUpperCase();
                const isLeveragedGroup = sec.includes('leveraged') || sec.includes('leveraged_long') || sec.includes('leveraged_short');
                const isKnownLeveraged = ['SPXL', 'TQQQ', 'TNA', 'KORU', 'SOXL', 'SPXS', 'SQQQ', 'TZA'].includes(sym);
                const isMacroGroup = sec === 'macro' || sec.includes('macro');
                const isKnownMacro = ['UUP', 'TLT', 'HYG', 'IEF', 'RSP', 'VIXY', 'UVXY', 'VXX', '^TNX', 'TNX'].includes(sym);
                return !isLeveragedGroup && !isKnownLeveraged && !isMacroGroup && !isKnownMacro;
            });
            setData(thematicData);
        } catch (e) {
            console.error('Error fetching Theme Tracker data:', e);
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

    const toggleSortDirection = (colId: string) => {
        setSortAscMap(prev => ({ ...prev, [colId]: !prev[colId] }));
    };

    // Filter by search query (symbol, theme name, or sector)
    const filteredEtfs = useMemo(() => {
        if (!searchTerm.trim()) return data;
        const q = searchTerm.toLowerCase();
        return data.filter(item =>
            item.symbol.toLowerCase().includes(q) ||
            (item.themeName && item.themeName.toLowerCase().includes(q)) ||
            (item.companyName && item.companyName.toLowerCase().includes(q)) ||
            (item.sector && item.sector.toLowerCase().includes(q))
        );
    }, [data, searchTerm]);

    // Build sorted data lists for each of the 5 widgets
    const columnData = useMemo(() => {
        const result: Record<string, { rows: ThemeMetricRow[]; maxAbs: number }> = {};

        COLUMNS.forEach(col => {
            const rows: ThemeMetricRow[] = filteredEtfs.map(item => {
                let rawVal = 0;
                if (col.id === 'daily') rawVal = Number(item.dailyChangePct) || 0;
                else if (col.id === 'weekly') rawVal = Number(item.changeW) || 0;
                else if (col.id === 'monthly') rawVal = Number(item.changeM) || 0;
                else if (col.id === 'rsWeekly') rawVal = Number(item.rsWeeklyPct) || 0;
                else if (col.id === 'rsDaily') rawVal = Number(item.rsDailyPct) || 0;

                const isPos = rawVal >= 0;
                const formatted = `${isPos ? '+' : ''}${rawVal.toFixed(2)}%`;
                const themeTitle = item.themeName || item.companyName || item.symbol;
                const stBullish = (item.price || 0) > (item.supertrend || 0) && item.supertrendDirection === 1;

                return {
                    symbol: item.symbol,
                    themeName: themeTitle,
                    value: rawVal,
                    formattedValue: formatted,
                    subIndustry: item.sector || item.subIndustry || '',
                    isPositive: isPos,
                    stage2Trend: item.stage2Trend,
                    supertrendBullish: stBullish
                };
            });

            const isAsc = sortAscMap[col.id];
            rows.sort((a, b) => (isAsc ? a.value - b.value : b.value - a.value));

            const maxAbs = rows.reduce((max, r) => Math.max(max, Math.abs(r.value)), 0.01);
            result[col.id] = { rows, maxAbs };
        });

        return result;
    }, [filteredEtfs, sortAscMap]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '1.25rem 1.5rem',
            height: 'calc(100vh - 46px)',
            overflow: 'hidden',
            boxSizing: 'border-box',
            backgroundColor: 'var(--bg-app)'
        }}>
            {/* Top Header Bar */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '0.85rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: '34px',
                        height: '34px',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                    }}>
                        <Layers size={18} color="white" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                            Theme & Sector Tracker
                        </h1>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Top-Down Market Momentum • 5-View Multi-Timeframe Ranking ({filteredEtfs.length} ETFs)
                        </span>
                    </div>
                </div>

                {/* Right Header: Search & Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '4px 10px',
                        width: '180px'
                    }}>
                        <Search size={14} color="var(--text-muted)" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Filter theme or ticker..."
                            style={{
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: 'var(--text-primary)',
                                fontSize: '0.8rem',
                                width: '100%'
                            }}
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

                    {/* Refresh Button */}
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
                            cursor: (loading || isScanning) ? 'not-allowed' : 'pointer'
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
                            boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)'
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

            {/* 5 Side-by-Side Ranked Widgets */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '0.85rem',
                flex: 1,
                minHeight: 0,
                overflowX: 'auto'
            }}>
                {COLUMNS.map(col => {
                    const colInfo = columnData[col.id] || { rows: [], maxAbs: 1 };
                    const isAsc = sortAscMap[col.id];

                    return (
                        <div
                            key={col.id}
                            style={{
                                background: 'var(--bg-card)',
                                borderRadius: '16px',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
                            }}
                        >
                            {/* Column Header */}
                            <div
                                onClick={() => toggleSortDirection(col.id)}
                                style={{
                                    padding: '0.85rem 1rem',
                                    borderBottom: '1px solid var(--border-color)',
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    userSelect: 'none'
                                }}
                                title={`${col.tooltip} (Click to sort ${isAsc ? 'Descending' : 'Ascending'})`}
                            >
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>{col.icon}</span>
                                        <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                            {col.title}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                        {col.subtitle}
                                    </span>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    color: 'var(--accent-primary)',
                                    fontSize: '0.72rem',
                                    fontWeight: 700
                                }}>
                                    <ArrowUpDown size={13} />
                                    <span>{isAsc ? 'ASC' : 'DESC'}</span>
                                </div>
                            </div>

                            {/* Rows List */}
                            <div style={{
                                flex: 1,
                                overflowY: 'auto',
                                padding: '0.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '3px'
                            }}>
                                {colInfo.rows.map((row, idx) => {
                                    const absVal = Math.abs(row.value);
                                    const barWidthPct = colInfo.maxAbs > 0 ? Math.min(100, Math.max(5, (absVal / colInfo.maxAbs) * 100)) : 0;
                                    const isPositive = row.isPositive;

                                    const textColor = isPositive ? '#10b981' : '#ef4444';
                                    const barColor = isPositive ? 'rgba(16, 185, 129, 0.75)' : 'rgba(239, 68, 68, 0.75)';
                                    const barTrackColor = isPositive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';

                                    return (
                                        <div
                                            key={`${row.symbol}-${idx}`}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1.4fr 1.6fr 1fr',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                background: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                                                fontSize: '0.75rem',
                                                border: '1px solid transparent',
                                                transition: 'background 0.15s ease'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'transparent'}
                                        >
                                            {/* Left: Symbol & Theme Name */}
                                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.78rem' }}>
                                                        {row.symbol}
                                                    </span>
                                                    {row.themeName && row.themeName !== row.symbol && (
                                                        <span style={{
                                                            fontSize: '0.68rem',
                                                            color: 'var(--text-muted)',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap'
                                                        }}>
                                                            {row.themeName}
                                                        </span>
                                                    )}
                                                    {row.stage2Trend && (
                                                        <span title="Stage 2 Uptrend (21EMA > 50SMA > 200SMA)" style={{
                                                            fontSize: '0.6rem',
                                                            fontWeight: 800,
                                                            color: '#10b981',
                                                            background: 'rgba(16, 185, 129, 0.15)',
                                                            padding: '0px 3px',
                                                            borderRadius: '3px'
                                                        }}>
                                                            S2
                                                        </span>
                                                    )}
                                                    {row.supertrendBullish && (
                                                        <span style={{ fontSize: '0.6rem' }} title="Bullish Supertrend">
                                                            🔥
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Center: Relative Proportion Bar */}
                                            <div style={{
                                                height: '14px',
                                                background: barTrackColor,
                                                borderRadius: '3px',
                                                overflow: 'hidden',
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '0 2px'
                                            }}>
                                                <div style={{
                                                    width: `${barWidthPct}%`,
                                                    height: '8px',
                                                    background: barColor,
                                                    borderRadius: '2px',
                                                    transition: 'width 0.25s ease'
                                                }} />
                                            </div>

                                            {/* Right: Tabular Numeric % Badge */}
                                            <div style={{ textAlign: 'right' }}>
                                                <span style={{
                                                    fontSize: '0.76rem',
                                                    fontWeight: 800,
                                                    color: textColor,
                                                    fontVariantNumeric: 'tabular-nums'
                                                }}>
                                                    {row.formattedValue}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

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

export default ThemeTracker;
