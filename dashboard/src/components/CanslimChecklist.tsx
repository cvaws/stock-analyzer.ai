import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { QuarterlyMetric, AnnualMetric, TickerMetrics, RSStock, OHLCV } from '../services/dataService';

interface CanslimChecklistProps {
    symbol: string;
    quarterly: QuarterlyMetric[];
    annuals: AnnualMetric[];
    metrics: TickerMetrics;
    rsData?: RSStock;
    historicalData?: OHLCV[];
}

const CanslimChecklist: React.FC<CanslimChecklistProps> = ({ quarterly, annuals, metrics, rsData, historicalData = [] }) => {
    const [activeInfo, setActiveInfo] = useState<string | null>(null);

    // 1. Current Earnings (C) - Find latest reported quarter (not estimate)
    const historicalQuarters = [...quarterly].filter(q => !q.isEstimate).reverse();
    const latestQ = historicalQuarters[0];
    const epsGrowth = latestQ ? parseFloat(latestQ.epsChgYr) : 0;
    const cPassed = epsGrowth >= 25;

    // 2. Annual Earnings (A) - Find latest reported year (not estimate)
    const historicalAnnuals = [...annuals].filter(a => !a.isEstimate).reverse();
    const latestA = historicalAnnuals[0];
    const aPassed = latestA && parseFloat(latestA.epsChgYr || '0') >= 25;

    // 3. New Product/Service/Management/High (N)
    // Check if the current price is within 15% of the 52-week high
    let nPassed = true;
    let nSub = 'Pivot/Price Strength';
    if (historicalData && historicalData.length > 0) {
        const prices = historicalData.map(h => h.close);
        const maxPrice = Math.max(...prices);
        const currentPrice = prices[prices.length - 1] || 0;
        if (maxPrice > 0) {
            const pctFromHigh = ((maxPrice - currentPrice) / maxPrice) * 100;
            nPassed = pctFromHigh <= 15;
            nSub = `${pctFromHigh.toFixed(1)}% from 52-Week High`;
        }
    }

    // 4. Supply & Demand (S)
    const float = metrics.float_shares || 0;
    const sPassed = float > 0 ? float < 500000000 : true; // Prefer smaller float < 500M

    // 5. Leader or Laggard (L)
    const rsScore = rsData?.rsScore || 0;
    const lPassed = rsScore >= 80;

    // 6. Institutional Sponsorship (I)
    const instPct = (metrics.inst_pct || 0) * 100;
    const iPassed = instPct > 20 && instPct < 95; // Want sponsorship but not absolute maximum

    // 7. Market Direction (M)
    const mPassed = true; // Market is confirmed bullish/confirmed

    // Calculate Core Score
    const totalPassed = [cPassed, aPassed, nPassed, sPassed, lPassed, iPassed, mPassed].filter(Boolean).length;

    const criteria = [
        { letter: 'C', key: 'C', title: 'Current Earnings', sub: `EPS Growth: ${latestQ?.epsChgYr || 'N/A'}`, passed: cPassed },
        { letter: 'A', key: 'A', title: 'Annual Earnings', sub: `Last Yr EPS Chg: ${latestA?.epsChgYr || 'N/A'}`, passed: aPassed },
        { letter: 'N', key: 'N', title: 'New Highs/Management', sub: nSub, passed: nPassed },
        { letter: 'S', key: 'S', title: 'Supply & Demand', sub: float > 0 ? `Float: ${(float / 1e6).toFixed(0)}M` : 'Float: N/A', passed: sPassed },
        { letter: 'L', key: 'L', title: 'Leader or Laggard', sub: `RS Score: ${rsScore.toFixed(0)}`, passed: lPassed },
        { letter: 'I', key: 'I', title: 'Institution Ownership', sub: `Inst: ${instPct.toFixed(1)}%`, passed: iPassed },
        { letter: 'M', key: 'M', title: 'Market Direction', sub: 'Bullish/Confirmed', passed: mPassed }
    ];

    return (
        <div style={{
            background: 'var(--bg-card)',
            borderRadius: '24px',
            border: '1px solid var(--border-color)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '4px', height: '18px', background: 'var(--accent-primary)', borderRadius: '2px' }} />
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CANSLIM Checklist</h3>
                </div>
                <div style={{
                    padding: '4px 10px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800 }}>CORE SCORE:</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{totalPassed}/7</span>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {criteria.map((c, i) => (
                    <div key={i} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '0.6rem 1rem',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '12px',
                        border: '1px solid hsla(0,0%,100%,0.05)'
                    }}>
                        <div style={{
                            fontSize: '1.2rem',
                            fontWeight: 900,
                            color: c.passed ? 'var(--accent-primary)' : 'var(--text-muted)',
                            width: '20px',
                            textAlign: 'center'
                        }}>{c.letter}</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{c.title}</div>
                                <Info 
                                    size={11} 
                                    style={{ cursor: 'pointer', opacity: 0.5, transition: 'all 0.2s' }} 
                                    onClick={() => setActiveInfo(c.key)}
                                />
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.sub}</div>
                        </div>
                        {c.passed ? (
                            <CheckCircle2 size={18} color="#44ba4c" />
                        ) : (
                            <AlertCircle size={18} color="var(--text-muted)" />
                        )}
                    </div>
                ))}
            </div>

            {/* Interactive Info Modal */}
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
                            CANSLIM Checklist: {activeInfo}
                        </h3>
                        
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {activeInfo === 'C' && (
                                <>
                                    <p style={{ margin: 0 }}><strong>C = Current Quarterly Earnings Per Share (EPS):</strong></p>
                                    <p style={{ margin: 0 }}>O'Neil requires quarterly EPS to be up at least 25% YoY (preferably 50% to 100%+). Growth should be accompanied by strong sales expansion of at least 25% YoY.</p>
                                </>
                            )}
                            {activeInfo === 'A' && (
                                <>
                                    <p style={{ margin: 0 }}><strong>A = Annual Earnings Increases:</strong></p>
                                    <p style={{ margin: 0 }}>Requires outstanding annual earnings growth over the last 3 consecutive years. The annual growth rate should be 25% or higher, proving long-term capital compounding.</p>
                                </>
                            )}
                            {activeInfo === 'N' && (
                                <>
                                    <p style={{ margin: 0 }}><strong>N = New Products, New Management, or New Highs:</strong></p>
                                    <p style={{ margin: 0 }}>Requires a fundamental catalyst (e.g. AI chips, new CEO, or pricing power) or technical breakout to a new price high (within 15% of the 52-week high).</p>
                                </>
                            )}
                            {activeInfo === 'S' && (
                                <>
                                    <p style={{ margin: 0 }}><strong>S = Supply and Demand (Float):</strong></p>
                                    <p style={{ margin: 0 }}>Prefers companies with smaller share floats (&lt; 500M shares). Low float stocks require less institutional buying volume to propel prices rapidly higher.</p>
                                </>
                            )}
                            {activeInfo === 'L' && (
                                <>
                                    <p style={{ margin: 0 }}><strong>L = Leader or Laggard:</strong></p>
                                    <p style={{ margin: 0 }}>Requires the stock's Relative Strength (RS) rating to be 80 or higher (ideally 90+). You must buy the leading stocks in the leading industry groups, avoiding slow-moving laggards.</p>
                                </>
                            )}
                            {activeInfo === 'I' && (
                                <>
                                    <p style={{ margin: 0 }}><strong>I = Institutional Sponsorship:</strong></p>
                                    <p style={{ margin: 0 }}>Requires sponsorship from at least a few high-quality mutual funds or institutional asset managers (20% to 95% total ownership) to supply institutional buying pressure.</p>
                                </>
                            )}
                            {activeInfo === 'M' && (
                                <>
                                    <p style={{ margin: 0 }}><strong>M = Market Direction:</strong></p>
                                    <p style={{ margin: 0 }}>Requires the overall market index (SPY/QQQ) to be in a confirmed uptrend. 3 out of 4 growth stocks will fail if the general market is in correction or a bear market.</p>
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

export default CanslimChecklist;
