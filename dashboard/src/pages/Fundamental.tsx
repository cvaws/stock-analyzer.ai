import React, { useEffect, useState } from 'react';
import { Search, Info } from 'lucide-react';

import { RSStock, fetchStockHeaderData, StockHeaderData, ComprehensiveFundamentals, fetchComprehensiveFundamentals, TickerMetrics, OHLCV, fetchHistoricalData } from '../services/dataService';
import CanslimChecklist from '../components/CanslimChecklist';
import OwnershipWidget from '../components/OwnershipWidget';
import FinancialTrendsWidget from '../components/FinancialTrendsWidget';
import AIResearchWidget from '../components/AIResearchWidget';

interface FundamentalProps {
    symbol: string;
    onSymbolChange: (symbol: string) => void;
    rsData?: RSStock;
    rsStocks?: RSStock[];
    scanTickers?: Set<string>;
    scanIndustries?: Map<string, string[]>;
}

const Fundamental: React.FC<FundamentalProps> = ({ symbol, onSymbolChange, rsData, rsStocks }) => {
    const [searchInput, setSearchInput] = useState(symbol);
    const [headerData, setHeaderData] = useState<StockHeaderData | null>(null);
    const [fundData, setFundData] = useState<ComprehensiveFundamentals | null>(null);
    const [historicalData, setHistoricalData] = useState<OHLCV[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeInfo, setActiveInfo] = useState<string | null>(null);

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
                const [header, compFunds, history] = await Promise.all([
                    fetchStockHeaderData(symbol),
                    fetchComprehensiveFundamentals(symbol),
                    fetchHistoricalData(symbol)
                ]);
                setHeaderData(header);
                setFundData(compFunds);
                setHistoricalData(history);
            } catch (err) {
                console.error("Error loading stock data:", err);
            }
            setLoading(false);
        };

        loadLiveData();
    }, [symbol]);

    // --- Scoring Engine ---
    const calculateScores = () => {
        if (!headerData || !fundData || fundData.quarterly.length === 0) {
            return { fundamental: 75, technical: 80, canslim: 'B', setup: 'Consolidating' };
        }

        const quarterly = fundData.quarterly;
        const annuals = fundData.annuals;
        const metrics = fundData.metrics;

        // Basic Fundamental Score Logic
        let fundScore = 60;
        const latestRevGrowth = parseFloat(quarterly[0]?.salesChgYr) || 0;
        if (latestRevGrowth > 20) fundScore += 10;
        if ((metrics.roe || 0) > 0.17) fundScore += 10;
        if (headerData.marketCap.includes('T') || headerData.marketCap.includes('B')) fundScore += 5;

        // Annual check
        if (annuals.length > 0 && parseFloat(annuals[0].epsChgYr || '0') > 25) fundScore += 10;

        // Basic Technical Score
        let techScore = 70;
        if (headerData.changePercent > 0) techScore += 5;
        if (rsData && rsData.percentile > 80) techScore += 15;
        if (rsData && rsData.percentile > 90) techScore += 10;

        // CANSLIM Grade
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
        <div style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s', overflowY: 'auto', paddingBottom: '2rem' }}>
            {/* Header Area: Compact Search + Key Metrics + Scores */}
            <div style={{
                display: 'flex',
                gap: '2rem',
                alignItems: 'center',
                background: 'var(--bg-card)',
                padding: '0.6rem 1.25rem',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                minHeight: '64px'
            }}>
                {/* 1. Compact Search */}
                <div style={{ width: '200px' }}>
                    <form onSubmit={handleSearch} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'rgba(255,255,255,0.03)',
                        padding: '0.4rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--accent-primary)',
                        boxShadow: '0 0 10px rgba(59, 130, 246, 0.1)'
                    }}>
                        <Search size={14} color="var(--text-muted)" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Swap Symbol..."
                            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', width: '100%', outline: 'none' }}
                        />
                    </form>
                </div>

                {/* 2. Live Data Strip + Scores */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>
                            ${headerData?.price?.toFixed(2) || '---'}
                        </span>
                        <span style={{
                            fontSize: '0.85rem',
                            color: (headerData?.change || 0) >= 0 ? '#44ba4c' : '#ef4444',
                            fontWeight: 600
                        }}>
                            {headerData ? `${headerData.change >= 0 ? '+' : ''}${headerData.change.toFixed(2)} (${headerData.changePercent.toFixed(2)}%)` : '---'}
                        </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Market Cap</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{headerData?.marketCap || '---'}</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Upcoming Earnings</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{headerData?.nextEarnings || '---'}</div>
                    </div>

                    {/* Divider */}
                    <div style={{ width: '1px', height: '28px', background: 'var(--border-color)' }} />

                    {/* Scores */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fundamental Score</span>
                            <Info 
                                size={11} 
                                style={{ cursor: 'pointer', opacity: 0.6, transition: 'all 0.2s' }} 
                                onClick={() => setActiveInfo('fundamental')}
                            />
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>{scores.fundamental}/100</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Canslim Score</span>
                            <Info 
                                size={11} 
                                style={{ cursor: 'pointer', opacity: 0.6, transition: 'all 0.2s' }} 
                                onClick={() => setActiveInfo('canslim')}
                            />
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{scores.canslim}</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Technical Score</span>
                            <Info 
                                size={11} 
                                style={{ cursor: 'pointer', opacity: 0.6, transition: 'all 0.2s' }} 
                                onClick={() => setActiveInfo('technical')}
                            />
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>{scores.technical}/100</div>
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
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#10b981' }}>{scores.setup}</div>
                    </div>
                </div>
            </div>

            {/* Upper Area: CANSLIM Checklist (left) & (Ownership + Financial Trends stacked) (right) */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1.25fr 1fr',
                gap: '1.5rem',
                marginBottom: '1.5rem',
                alignItems: 'stretch'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <CanslimChecklist
                        symbol={symbol}
                        quarterly={fundData?.quarterly || []}
                        annuals={fundData?.annuals || []}
                        metrics={fundData?.metrics as TickerMetrics || { float_shares: 0, inst_pct: 0, insider_pct: 0, roe: 0, op_margin: 0, shares_out: 0 }}
                        rsData={rsData}
                        historicalData={historicalData}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', justifyContent: 'space-between' }}>
                    <OwnershipWidget metrics={fundData?.metrics as TickerMetrics || { float_shares: 0, inst_pct: 0, insider_pct: 0, roe: 0, op_margin: 0, shares_out: 0 }} />
                    <FinancialTrendsWidget
                        quarterly={fundData?.quarterly || []}
                        annuals={fundData?.annuals || []}
                        metrics={fundData?.metrics as TickerMetrics || { float_shares: 0, inst_pct: 0, insider_pct: 0, roe: 0, op_margin: 0, shares_out: 0 }}
                    />
                </div>
            </div>

            {/* AI Research Widget (Fundamental Research) below */}
            <div>
                <AIResearchWidget
                    symbol={symbol}
                    companyName={fundData?.metrics?.company_name || headerData?.companyName}
                    sector={fundData?.metrics?.sector}
                    industry={fundData?.metrics?.industry}
                    rsStocks={rsStocks}
                    onPeerClick={onSymbolChange}
                />
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

export default Fundamental;
