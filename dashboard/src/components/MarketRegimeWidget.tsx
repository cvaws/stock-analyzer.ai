import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, XCircle, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

export interface GroupStat {
    healthy: number;
    total: number;
    percent: number;
    status: string;
    healthy_list: string[];
    weak_list: string[];
}

export interface MarketRegimeData {
    regime: string;
    regime_code: string;
    confidence: number;
    groups: Record<string, GroupStat>;
    group_trends?: Record<string, number>;
    why_bullets: string[];
    weak_canaries: string[];
    weak_breadth: string[];
    strong_defense: string[];
    spy_dist_days?: number;
    qqq_dist_days?: number;
    macro_context?: {
        tlt_bullish_for_equities: boolean;
        vixy_bullish_for_equities: boolean;
        summary: string;
    };
    divergence_warnings?: string[];
    leader_changes?: {
        newly_entered: string[];
        newly_exited: Array<{ symbol: string; reason: string }>;
        previous_leaders: string[];
        current_leaders: string[];
    };
    scan_date?: string;
}

interface Props {
    regimeData: MarketRegimeData | null;
}

export const MarketRegimeWidget: React.FC<Props> = ({ regimeData }) => {
    const [showDivergence, setShowDivergence] = useState<boolean>(true);
    if (!regimeData) return null;

    const { 
        regime, 
        confidence, 
        groups, 
        group_trends = {}, 
        why_bullets, 
        weak_canaries, 
        weak_breadth, 
        strong_defense,
        spy_dist_days = 0,
        qqq_dist_days = 0,
        macro_context,
        divergence_warnings = []
    } = regimeData;

    let regimeBadgeBg = '#064e3b';
    let regimeBadgeText = '#10b981';
    let regimeBorder = 'rgba(16, 185, 129, 0.3)';
    let RegimeIcon = ShieldCheck;

    if (regime.includes('HALF SIZE')) {
        regimeBadgeBg = '#78350f';
        regimeBadgeText = '#f59e0b';
        regimeBorder = 'rgba(245, 158, 11, 0.3)';
        RegimeIcon = AlertTriangle;
    } else if (regime.includes('STEP ASIDE')) {
        regimeBadgeBg = '#7f1d1d';
        regimeBadgeText = '#f87171';
        regimeBorder = 'rgba(239, 68, 68, 0.3)';
        RegimeIcon = XCircle;
    }

    const renderTrendDelta = (groupName: string) => {
        const delta = group_trends[groupName];
        if (delta === undefined || delta === null) return null;
        const isUp = delta > 2.0;
        const isDown = delta < -2.0;
        const color = isUp ? '#10b981' : isDown ? '#f87171' : 'var(--text-muted)';
        const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '0.72rem', color, marginLeft: '4px', fontWeight: 600 }}>
                <Icon size={12} />
                {delta > 0 ? `+${delta}%` : `${delta}%`}
            </span>
        );
    };

    return (
        <div style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            border: `1px solid ${regimeBorder}`,
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.1rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)'
        }}>
            {/* Header / Banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: regimeBadgeBg, padding: '8px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <RegimeIcon size={24} color={regimeBadgeText} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '0.5px' }}>
                            MARKET REGIME DASHBOARD
                        </h2>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Top-Down ETF Rotation Health Model</span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Market Regime</span>
                        <span style={{
                            background: regimeBadgeBg,
                            color: regimeBadgeText,
                            padding: '4px 12px',
                            borderRadius: '6px',
                            fontWeight: 800,
                            fontSize: '0.95rem',
                            display: 'inline-block',
                            marginTop: '2px',
                            border: `1px solid ${regimeBorder}`
                        }}>
                            {regime}
                        </span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Score</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#06b6d4', marginTop: '2px', display: 'block' }}>
                            {confidence}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Macro & Distribution Bar */}
            <div style={{
                display: 'flex',
                gap: '0.75rem',
                flexWrap: 'wrap',
                background: 'rgba(255,255,255,0.02)',
                padding: '0.6rem 0.8rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.05)',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.75rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Macro Context:</span>
                    <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        background: macro_context?.tlt_bullish_for_equities ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: macro_context?.tlt_bullish_for_equities ? '#10b981' : '#f87171'
                    }}>
                        TLT: {macro_context?.tlt_bullish_for_equities ? 'Risk-On' : 'Yields Rising/Defensive'}
                    </span>
                    <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        background: macro_context?.vixy_bullish_for_equities ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: macro_context?.vixy_bullish_for_equities ? '#10b981' : '#f87171'
                    }}>
                        VIXY: {macro_context?.vixy_bullish_for_equities ? 'Calm' : 'Elevated'}
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Distribution (25-bar):</span>
                    <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        background: spy_dist_days >= 5 ? 'rgba(239, 68, 68, 0.2)' : spy_dist_days >= 3 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                        color: spy_dist_days >= 5 ? '#f87171' : spy_dist_days >= 3 ? '#fbbf24' : '#10b981'
                    }}>
                        SPY: {spy_dist_days}d
                    </span>
                    <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        background: qqq_dist_days >= 5 ? 'rgba(239, 68, 68, 0.2)' : qqq_dist_days >= 3 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                        color: qqq_dist_days >= 5 ? '#f87171' : qqq_dist_days >= 3 ? '#fbbf24' : '#10b981'
                    }}>
                        QQQ: {qqq_dist_days}d
                    </span>
                </div>
            </div>

            {/* Group Health Table */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                        <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Group</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Healthy</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Total</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Health % (5D Trend)</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {['Canaries', 'Leadership', 'Breadth', 'Defense'].map((grp, idx) => {
                            const stat = groups[grp] || { healthy: 0, total: 0, percent: 0, status: 'N/A' };
                            const isStrong = stat.percent >= 70;
                            const isQuiet = stat.percent <= 30;
                            let statusBg = 'rgba(255,255,255,0.05)';
                            let statusColor = 'var(--text-primary)';
                            if (isStrong) { statusBg = '#064e3b'; statusColor = '#10b981'; }
                            else if (isQuiet) { statusBg = 'rgba(255,255,255,0.05)'; statusColor = 'var(--text-muted)'; }

                            return (
                                <tr key={grp} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                    <td style={{ padding: '0.55rem 0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{grp}</td>
                                    <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>{stat.healthy}</td>
                                    <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>{stat.total}</td>
                                    <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', fontWeight: 800 }}>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', minWidth: '130px' }}>
                                            <span style={{
                                                color: stat.percent >= 70 ? '#10b981' : stat.percent >= 40 ? '#f59e0b' : '#ef4444',
                                                fontVariantNumeric: 'tabular-nums',
                                                minWidth: '45px',
                                                textAlign: 'right'
                                            }}>
                                                {stat.percent.toFixed(1)}%
                                            </span>
                                            <div style={{ minWidth: '65px', textAlign: 'left' }}>
                                                {renderTrendDelta(grp)}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center' }}>
                                        <span style={{ background: statusBg, color: statusColor, padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                                            {stat.status}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Bottom Row: Why Bullets & Outliers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', background: 'rgba(0,0,0,0.15)', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div>
                    <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 0.4rem 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Why?
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {why_bullets.map((bullet, i) => (
                            <div key={i} style={{ fontSize: '0.78rem', fontWeight: 600, color: bullet.startsWith('✓') ? '#10b981' : bullet.startsWith('⚠️') ? '#f59e0b' : '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {bullet}
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 0.4rem 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Key Outliers & Watchlist
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.75rem' }}>
                        <div>
                            <span style={{ color: 'var(--text-muted)' }}>Weak Canaries: </span>
                            <strong style={{ color: '#ef4444' }}>{weak_canaries.length > 0 ? weak_canaries.join(', ') : 'None'}</strong>
                        </div>
                        <div>
                            <span style={{ color: 'var(--text-muted)' }}>Weak Breadth: </span>
                            <strong style={{ color: '#f59e0b' }}>{weak_breadth.length > 0 ? weak_breadth.join(', ') : 'None'}</strong>
                        </div>
                        <div>
                            <span style={{ color: 'var(--text-muted)' }}>Strong Defense: </span>
                            <strong style={{ color: '#10b981' }}>{strong_defense.length > 0 ? strong_defense.join(', ') : 'None'}</strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* Divergence Warnings Section */}
            {divergence_warnings.length > 0 && (
                <div style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: '10px',
                    padding: '0.6rem 0.8rem'
                }}>
                    <div 
                        onClick={() => setShowDivergence(!showDivergence)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    >
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Activity size={14} /> Divergence Warnings ({divergence_warnings.length})
                        </span>
                        {showDivergence ? <ChevronUp size={14} color="#fbbf24" /> : <ChevronDown size={14} color="#fbbf24" />}
                    </div>
                    {showDivergence && (
                        <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {divergence_warnings.map((warn, i) => (
                                <div key={i} style={{ fontSize: '0.74rem', color: '#fef08a' }}>
                                    {warn}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Formula & Rule Definition Footer */}
            <div style={{
                borderTop: '1px solid rgba(255,255,255,0.06)',
                paddingTop: '0.5rem',
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
                fontWeight: 500,
                lineHeight: 1.4
            }}>
                <div><strong>Formula:</strong> 🟢 <span style={{ color: '#10b981' }}>PRESS GAS</span>: Canaries &ge; 80% &amp; Leadership &ge; 70% &amp; Breadth &ge; 70% &amp; Defense &le; 30% | 🟡 <span style={{ color: '#f59e0b' }}>HALF SIZE</span>: Canaries &ge; 60% &amp; Leadership &ge; 40% &amp; Breadth &ge; 40% &amp; Defense &le; 50% | 🔴 <span style={{ color: '#ef4444' }}>STEP ASIDE</span>: Else</div>
                <div style={{ marginTop: '2px', opacity: 0.85 }}><strong>Score:</strong> 40% &times; Canaries + 30% &times; Leadership + 20% &times; Breadth + 10% &times; (100 - Defense)</div>
            </div>
        </div>
    );
};


