import React, { useEffect, useState } from 'react';
import { Search, Info, TrendingUp, ListFilter } from 'lucide-react';

import { RSStock, fetchStockHeaderData, StockHeaderData, ComprehensiveFundamentals, fetchComprehensiveFundamentals, OHLCV, fetchHistoricalData, fetchEtfTrackerData, ThemeStockData } from '../services/dataService';
import UniversalChart from '../components/UniversalChart';

interface TechnicalProps {
    symbol: string;
    onSymbolChange: (symbol: string) => void;
    rsData?: RSStock;
}

export interface ExtendedThemeStockData extends ThemeStockData {
    dailyChangePct?: number;
    changeW?: number;
    changeM?: number;
    aboveEma8?: boolean;
    aboveEma21?: boolean;
    aboveSma50?: boolean;
    supertrendDirection?: number;
    supertrend?: number;
}

const Technical: React.FC<TechnicalProps> = ({ symbol, onSymbolChange, rsData }) => {
    const [searchInput, setSearchInput] = useState(symbol);
    const [headerData, setHeaderData] = useState<StockHeaderData | null>(null);
    const [fundData, setFundData] = useState<ComprehensiveFundamentals | null>(null);
    const [historicalData, setHistoricalData] = useState<OHLCV[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeInfo, setActiveInfo] = useState<string | null>(null);

    // Watchlist Sidebar State
    const [watchlist, setWatchlist] = useState<ExtendedThemeStockData[]>([]);
    const [watchlistSearch, setWatchlistSearch] = useState<string>('');
    const [selectedGroup, setSelectedGroup] = useState<string>('All');
    const [watchlistSortField, setWatchlistSortField] = useState<string>('symbol');
    const [watchlistSortAsc, setWatchlistSortAsc] = useState<boolean>(true);

    // Render ThinkOrSwim MA parity badge
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
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 800,
                fontSize: '0.75rem',
                display: 'inline-block',
                textAlign: 'center',
                minWidth: '22px'
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

    const getRsColor = (colorFlag?: string, val?: any) => {
        if (colorFlag === 'MAGENTA') return '#d946ef';
        if (colorFlag === 'CYAN') return '#06b6d4';
        if (colorFlag === 'GREEN' || (Number(val) || 0) >= 0) return '#10b981';
        return '#ef4444';
    };

    const formatPct = (val: number | string | undefined | null) => {
        if (val === undefined || val === null || val === 'N/A') return '—';
        const num = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(num)) return '—';
        return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchInput.trim()) {
            onSymbolChange(searchInput.toUpperCase().trim());
        }
    };

    useEffect(() => {
        setSearchInput(symbol);

        const loadLiveData = async () => {
            setLoading(true);
            try {
                const [header, compFunds, history, etfs] = await Promise.all([
                    fetchStockHeaderData(symbol),
                    fetchComprehensiveFundamentals(symbol),
                    fetchHistoricalData(symbol),
                    fetchEtfTrackerData()
                ]);
                setHeaderData(header);
                setFundData(compFunds);
                setHistoricalData(history);
                if (etfs && etfs.length > 0) {
                    setWatchlist(etfs);
                }
            } catch (err) {
                console.error("Error loading stock data:", err);
            }
            setLoading(false);
        };

        loadLiveData();
    }, [symbol]);

    // Filter Watchlist items
    const filteredWatchlist = watchlist.filter(item => {
        const matchesSymbol = item.symbol.toLowerCase().includes(watchlistSearch.toLowerCase()) || 
                              ((item.companyName || (item as any).name || '').toLowerCase().includes(watchlistSearch.toLowerCase()));
        const matchesGroup = selectedGroup === 'All' || 
                             item.sector.toLowerCase() === selectedGroup.toLowerCase() ||
                             (selectedGroup === 'Leveraged' && item.sector.toLowerCase().includes('leveraged'));
        return matchesSymbol && matchesGroup;
    });

    const getValForSort = (item: ExtendedThemeStockData, field: string): any => {
        if (field === 'symbol') return item.symbol;
        if (field === 'sector') return item.sector;
        if (field === 'price') return item.price ?? 0;
        if (field === 'dailyChangePct') return item.dailyChangePct ?? 0;
        if (field === 'supertrend') {
            const price = item.price ?? 0;
            const supertrend = item.supertrend ?? 0;
            const direction = item.supertrendDirection ?? -1;
            const dailyBullish = price > supertrend;
            const weeklyBullish = direction === 1;
            if (dailyBullish && weeklyBullish) return 2;
            if (!dailyBullish && !weeklyBullish) return 0;
            return 1;
        }
        if (field === 'rsWeeklyPct') {
            const val = item.rsWeeklyPct;
            if (val === undefined || val === null || val === 'N/A') return -999999;
            const num = typeof val === 'string' ? parseFloat(val) : val;
            return isNaN(num) ? -999999 : num;
        }
        return '';
    };

    const sortedWatchlist = [...filteredWatchlist].sort((a, b) => {
        const valA = getValForSort(a, watchlistSortField);
        const valB = getValForSort(b, watchlistSortField);
        if (typeof valA === 'string' && typeof valB === 'string') {
            return watchlistSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return watchlistSortAsc ? (valA - valB) : (valB - valA);
    });

    const handleWatchlistHeaderClick = (field: string) => {
        if (watchlistSortField === field) {
            setWatchlistSortAsc(!watchlistSortAsc);
        } else {
            setWatchlistSortField(field);
            setWatchlistSortAsc(true);
        }
    };

    const renderSortIndicator = (field: string) => {
        if (watchlistSortField !== field) return null;
        return watchlistSortAsc ? ' ▲' : ' ▼';
    };

    // --- Scoring Engine ---
    const calculateScores = () => {
        if (!headerData || !fundData || fundData.quarterly.length === 0) {
            return { fundamental: 75, technical: 80, canslim: 'B', setup: 'Consolidating' };
        }

        const quarterly = fundData.quarterly;
        const annuals = fundData.annuals;
        const metrics = fundData.metrics;

        let fundScore = 60;
        const latestRevGrowth = parseFloat(quarterly[0]?.salesChgYr) || 0;
        if (latestRevGrowth > 20) fundScore += 10;
        if ((metrics.roe || 0) > 0.17) fundScore += 10;
        if (headerData.marketCap.includes('T') || headerData.marketCap.includes('B')) fundScore += 5;

        if (annuals.length > 0 && parseFloat(annuals[0].epsChgYr || '0') > 25) fundScore += 10;

        let techScore = 70;
        if (headerData.changePercent > 0) techScore += 5;
        if (rsData && rsData.percentile > 80) techScore += 15;
        if (rsData && rsData.percentile > 90) techScore += 10;

        let canslim = 'B';
        const isLeader = rsData && rsData.percentile > 85;
        const hasGrowth = latestRevGrowth > 25 || (annuals.length > 0 && parseFloat(annuals[0].epsChgYr || '0') > 25);

        if (isLeader && hasGrowth) canslim = 'A+';
        else if (isLeader || hasGrowth) canslim = 'A';

        return {
            fundamental: Math.min(fundScore, 99),
            technical: Math.min(techScore, 99),
            canslim,
            setup: headerData.changePercent > 2 ? 'Breaking Out' : 'Consolidating'
        };
    };

    const scores = calculateScores();

    return (
        <div style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: '0.75rem', height: 'calc(100vh - 40px)', overflow: 'hidden', opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
            {/* Header Area: Compact Search + Key Metrics + Scores */}
            <div style={{
                display: 'flex',
                gap: '1.5rem',
                alignItems: 'center',
                background: 'var(--bg-card)',
                padding: '0.5rem 1.25rem',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                minHeight: '56px',
                height: '56px'
            }}>
                {/* 1. Compact Search */}
                <div style={{ width: '180px' }}>
                    <form onSubmit={handleSearch} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'rgba(255,255,255,0.03)',
                        padding: '0.35rem 0.65rem',
                        borderRadius: '8px',
                        border: '1px solid var(--accent-primary)',
                        boxShadow: '0 0 10px rgba(59, 130, 246, 0.1)'
                    }}>
                        <Search size={14} color="var(--text-muted)" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search ETF Symbol..."
                            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', width: '100%', outline: 'none' }}
                        />
                    </form>
                </div>

                {/* 2. Live Data Strip + Scores */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>
                            ${headerData?.price?.toFixed(2) || '---'}
                        </span>
                        <span style={{
                            fontSize: '0.8rem',
                            color: (headerData?.change || 0) >= 0 ? '#44ba4c' : '#ef4444',
                            fontWeight: 600
                        }}>
                            {headerData ? `${headerData.change >= 0 ? '+' : ''}${headerData.change.toFixed(2)} (${headerData.changePercent.toFixed(2)}%)` : '---'}
                        </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Market Cap</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{headerData?.marketCap || '---'}</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Upcoming Earnings</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{headerData?.nextEarnings || '---'}</div>
                    </div>

                    <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

                    {/* Scores */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Technical Score</span>
                            <Info 
                                size={11} 
                                style={{ cursor: 'pointer', opacity: 0.6, transition: 'all 0.2s' }} 
                                onClick={() => setActiveInfo('technical')}
                            />
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>{scores.technical}/100</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Setup</span>
                            <Info 
                                size={11} 
                                style={{ cursor: 'pointer', opacity: 0.6, transition: 'all 0.2s' }} 
                                onClick={() => setActiveInfo('setup')}
                            />
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981' }}>{scores.setup}</div>
                    </div>
                </div>
            </div>

            {/* Main Area: Split Screen (Left: Candlestick + Indicators Chart, Right: Watchlist Widget) */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 4.5fr) 1fr',
                gap: '0.75rem',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden'
            }}>
                {/* Left Column: Candlestick Chart (with 8 EMA, 21 EMA, 50 SMA, Volume, Mansfield RS) */}
                <div style={{
                    background: 'var(--bg-card)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '4px', height: '18px', background: 'var(--accent-primary)', borderRadius: '2px' }} />
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <TrendingUp size={16} color="#3b82f6" /> {symbol} Technical Analysis Chart
                            </h3>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Daily Candles | 8 EMA | 21 EMA | 50 SMA | Volume | Mansfield RS</span>
                    </div>
                    <div style={{ flex: 1, position: 'relative', height: '100%', minHeight: 0 }}>
                        <UniversalChart symbol={symbol} data={historicalData} containerId="technical_main_chart" />
                    </div>
                </div>

                {/* Right Column: ETF Watchlist Sidebar Widget */}
                <div style={{
                    background: 'var(--bg-card)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}>
                    {/* Watchlist Header */}
                    <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
                                <ListFilter size={16} color="#a855f7" /> ETF Watchlist ({filteredWatchlist.length})
                            </h3>
                        </div>

                        {/* Search + Filter Selector */}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="text"
                                placeholder="Search Ticker..."
                                value={watchlistSearch}
                                onChange={(e) => setWatchlistSearch(e.target.value)}
                                style={{
                                    flex: 1,
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    padding: '0.4rem 0.6rem',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.8rem',
                                    outline: 'none'
                                }}
                            />
                            <select
                                value={selectedGroup}
                                onChange={(e) => setSelectedGroup(e.target.value)}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    padding: '0.4rem 0.5rem',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.8rem',
                                    outline: 'none'
                                }}
                            >
                                <option value="All">All Groups</option>
                                <option value="Canaries">Canaries</option>
                                <option value="Leadership">Leadership</option>
                                <option value="Breadth">Breadth</option>
                                <option value="Defense">Defense</option>
                                <option value="Leveraged_Long">Leveraged Long (3x Bull)</option>
                                <option value="Leveraged_Short">Leveraged Short (3x Bear)</option>
                            </select>
                        </div>
                    </div>

                    {/* Watchlist Header Table Columns */}
                    <div style={{
                        display: 'flex',
                        padding: '0.5rem 1rem',
                        borderBottom: '1px solid var(--border-color)',
                        background: 'rgba(0,0,0,0.1)',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        <div onClick={() => handleWatchlistHeaderClick('symbol')} style={{ width: '16%', cursor: 'pointer', userSelect: 'none' }}>
                            Sym{renderSortIndicator('symbol')}
                        </div>
                        <div onClick={() => handleWatchlistHeaderClick('sector')} style={{ width: '18%', cursor: 'pointer', userSelect: 'none' }}>
                            Group{renderSortIndicator('sector')}
                        </div>
                        <div onClick={() => handleWatchlistHeaderClick('price')} style={{ width: '16%', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                            Last{renderSortIndicator('price')}
                        </div>
                        <div onClick={() => handleWatchlistHeaderClick('dailyChangePct')} style={{ width: '16%', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                            Chg%{renderSortIndicator('dailyChangePct')}
                        </div>
                        <div onClick={() => handleWatchlistHeaderClick('supertrend')} style={{ width: '16%', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}>
                            ST{renderSortIndicator('supertrend')}
                        </div>
                        <div onClick={() => handleWatchlistHeaderClick('rsWeeklyPct')} style={{ width: '18%', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                            RS W%{renderSortIndicator('rsWeeklyPct')}
                        </div>
                    </div>

                    {/* Ticker List Container */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {sortedWatchlist.map((item) => {
                            const isSelected = item.symbol.toUpperCase() === symbol.toUpperCase();
                            const chg = parseFloat((item.dailyChangePct ?? (item as any).changePercent ?? 0) as any) || 0;

                            return (
                                <div
                                    key={item.symbol}
                                    onClick={() => onSymbolChange(item.symbol)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '0.55rem 1rem',
                                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                                        cursor: 'pointer',
                                        background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                                        borderLeft: isSelected ? '4px solid var(--accent-primary)' : '4px solid transparent',
                                        transition: 'background 0.2s',
                                        fontSize: '0.78rem'
                                    }}
                                >
                                    <div style={{ width: '16%', fontWeight: 800, color: isSelected ? '#3b82f6' : '#fff' }}>
                                        {item.symbol}
                                    </div>

                                    <div style={{ width: '18%', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.sector.replace('_', ' ')}
                                    </div>
                                    
                                    <div style={{ width: '16%', textAlign: 'right', fontWeight: 700, color: '#fff' }}>
                                        ${parseFloat(item.price as any || 0).toFixed(2)}
                                    </div>
                                    
                                    <div style={{ width: '16%', textAlign: 'right', fontWeight: 700, color: chg >= 0 ? '#10b981' : '#ef4444' }}>
                                        {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
                                    </div>

                                    <div style={{ width: '16%', display: 'flex', justifyContent: 'center' }}>
                                        <span style={{ transform: 'scale(0.85)', display: 'inline-flex' }}>
                                            {renderSupertrendBadgeForStock(item)}
                                        </span>
                                    </div>
                                    
                                    <div style={{ width: '18%', textAlign: 'right', color: getRsColor((item as any).rsWeeklyColor, item.rsWeeklyPct), fontWeight: 700 }}>
                                        {formatPct(item.rsWeeklyPct)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Interactive Info Dialog */}
            {activeInfo && (
                <div 
                    onClick={() => setActiveInfo(null)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            padding: '2rem',
                            borderRadius: '16px',
                            maxWidth: '480px',
                            width: '90%',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            position: 'relative'
                        }}
                    >
                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Info size={18} color="var(--accent-primary)" />
                            {activeInfo === 'fundamental' && 'Fundamental Score Criterion'}
                            {activeInfo === 'canslim' && 'CANSLIM Score Criterion'}
                            {activeInfo === 'technical' && 'Technical Score Criterion'}
                            {activeInfo === 'setup' && 'Setup State Criterion'}
                        </h3>
                        
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {activeInfo === 'fundamental' && (
                                <>
                                    <p style={{ margin: 0 }}>Rates a company's financial quality and growth capabilities on a scale of 0 to 99:</p>
                                    <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        <li><strong>Base Score:</strong> Starts at 60 points.</li>
                                        <li><strong>YoY Revenue Growth:</strong> +10 points if latest quarterly sales growth exceeds +20%.</li>
                                        <li><strong>Return on Equity (ROE):</strong> +10 points if ROE exceeds +17% (CANSLIM baseline).</li>
                                        <li><strong>Market Cap:</strong> +5 points for large-cap visibility and liquid trading.</li>
                                        <li><strong>Annual EPS Growth:</strong> +10 points if the latest annual EPS growth exceeds +25%.</li>
                                    </ul>
                                </>
                            )}
                            {activeInfo === 'canslim' && (
                                <>
                                    <p style={{ margin: 0 }}>Measures alignment with William O'Neil's CANSLIM growth methodology:</p>
                                    <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        <li><strong>Grade A+:</strong> Stock ranks in the top tier of Relative Strength (RS Percentile &gt; 85) AND shows extreme growth (&gt; 25% YoY quarterly sales or annual EPS growth).</li>
                                        <li><strong>Grade A:</strong> Stock has leading Relative Strength (RS Percentile &gt; 85) OR shows high growth (&gt; 25%).</li>
                                        <li><strong>Grade B:</strong> Normal growth rate or moderate industry relative strength.</li>
                                    </ul>
                                </>
                            )}
                            {activeInfo === 'technical' && (
                                <>
                                    <p style={{ margin: 0 }}>Measures price momentum, relative strength, and trend quality on a scale of 0 to 99:</p>
                                    <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        <li><strong>Base Score:</strong> Starts at 70 points.</li>
                                        <li><strong>Daily Performance:</strong> +5 points if current daily price change is positive.</li>
                                        <li><strong>Relative Strength Rank:</strong> +15 points if RS Percentile is in the top 20% (&gt; 80).</li>
                                        <li><strong>Extreme Momentum:</strong> +10 additional points if RS Percentile is in the top 10% (&gt; 90).</li>
                                    </ul>
                                </>
                            )}
                            {activeInfo === 'setup' && (
                                <>
                                    <p style={{ margin: 0 }}>Identifies entry context based on recent volatility and key price pivots:</p>
                                    <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        <li><strong>Breaking Out:</strong> Daily close change is greater than +2%, indicating potential expansion from a basing structure.</li>
                                        <li><strong>Consolidating:</strong> Price action remains range-bound, building a constructive base.</li>
                                    </ul>
                                </>
                            )}
                        </div>

                        <button 
                            onClick={() => setActiveInfo(null)}
                            style={{
                                marginTop: '1rem',
                                background: 'var(--accent-primary)',
                                color: '#fff',
                                border: 'none',
                                padding: '0.5rem 1rem',
                                borderRadius: '6px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                alignSelf: 'flex-end',
                                fontSize: '0.8rem'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
                            onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Technical;
