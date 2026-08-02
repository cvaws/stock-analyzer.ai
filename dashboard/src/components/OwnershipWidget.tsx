import React from 'react';
import { TickerMetrics } from '../services/dataService';

interface OwnershipWidgetProps {
    metrics: TickerMetrics;
}

const OwnershipWidget: React.FC<OwnershipWidgetProps> = ({ metrics }) => {
    const formatValue = (val: number | undefined, percent = false) => {
        if (val === undefined || val === null) return '--';
        if (percent) return (val * 100).toFixed(1) + '%';
        if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
        if (val >= 1e6) return (val / 1e6).toFixed(0) + 'M';
        return val.toFixed(2);
    };

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '4px', height: '18px', background: 'var(--accent-primary)', borderRadius: '2px' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ownership & Efficiency</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid hsla(0,0%,100%,0.05)' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Float</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>{formatValue(metrics.float_shares)}</div>
                </div>
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid hsla(0,0%,100%,0.05)' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ROE</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: (metrics.roe || 0) > 0.17 ? 'var(--accent-primary)' : '#fff' }}>{formatValue(metrics.roe, true)}</div>
                </div>
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid hsla(0,0%,100%,0.05)' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inst. Own</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>{formatValue(metrics.inst_pct, true)}</div>
                </div>
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid hsla(0,0%,100%,0.05)' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Insider Own</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>{formatValue(metrics.insider_pct, true)}</div>
                </div>
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid hsla(0,0%,100%,0.05)' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Insider Buy (6M)</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: (metrics.insider_shares_purchased || 0) > 0 ? '#44ba4c' : '#fff' }}>
                        {metrics.insider_shares_purchased && metrics.insider_shares_purchased > 0 
                            ? formatValue(metrics.insider_shares_purchased) 
                            : 'None'}
                    </div>
                </div>
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid hsla(0,0%,100%,0.05)' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Op. Margin</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>{formatValue(metrics.op_margin, true)}</div>
                </div>
            </div>

            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                Note: CANSLIM leaders often show high ROE and strong institutional sponsorship.
            </div>
        </div>
    );
};

export default OwnershipWidget;
