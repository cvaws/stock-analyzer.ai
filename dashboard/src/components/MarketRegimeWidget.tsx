import React from 'react';
import { ShieldCheck, AlertTriangle, XCircle } from 'lucide-react';


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
    why_bullets: string[];
    weak_canaries: string[];
    weak_breadth: string[];
    strong_defense: string[];
}

interface Props {
    regimeData: MarketRegimeData | null;
}

export const MarketRegimeWidget: React.FC<Props> = ({ regimeData }) => {
    if (!regimeData) return null;

    const { regime, confidence, groups, why_bullets, weak_canaries, weak_breadth, strong_defense } = regimeData;

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

    return (
        <div style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            border: `1px solid ${regimeBorder}`,
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)'
        }}>
            {/* Header / Banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
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

            {/* Group Health Table */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                        <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Group</th>
                            <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>Healthy</th>
                            <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>Total</th>
                            <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Percent</th>
                            <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>Status</th>
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
                                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{grp}</td>
                                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>{stat.healthy}</td>
                                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>{stat.total}</td>
                                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 800, color: stat.percent >= 70 ? '#10b981' : stat.percent >= 40 ? '#f59e0b' : '#ef4444' }}>
                                        {stat.percent}%
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Why?
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {why_bullets.map((bullet, i) => (
                            <div key={i} style={{ fontSize: '0.8rem', fontWeight: 600, color: bullet.startsWith('✓') ? '#10b981' : '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {bullet}
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Key Outliers & Watchlist
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.78rem' }}>
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
        </div>
    );
};
