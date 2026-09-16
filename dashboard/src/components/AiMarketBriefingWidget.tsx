import React, { useState } from 'react';
import { Sparkles, Bot, RefreshCw, ShieldAlert, Target, Compass, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Globe, Repeat, Zap } from 'lucide-react';
import { AiMarketBriefingData, regenerateAiMarketBriefing } from '../services/dataService';

interface Props {
    briefingData: AiMarketBriefingData | null;
    onBriefingUpdated?: (updated: AiMarketBriefingData) => void;
}

export const AiMarketBriefingWidget: React.FC<Props> = ({ briefingData, onBriefingUpdated }) => {
    const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
    const [isExpanded, setIsExpanded] = useState<boolean>(true);
    const [data, setData] = useState<AiMarketBriefingData | null>(briefingData);

    const activeModel = localStorage.getItem('research_model') || 'qwen3-coder:30b';

    // Sync state when props change
    React.useEffect(() => {
        setData(briefingData);
    }, [briefingData]);

    const handleRegenerate = async () => {
        if (isRegenerating) return;
        setIsRegenerating(true);
        try {
            const res = await regenerateAiMarketBriefing();
            if (res) {
                setData(res);
                if (onBriefingUpdated) {
                    onBriefingUpdated(res);
                }
            }
        } catch (e) {
            console.error('Error during AI regeneration:', e);
        }
        setIsRegenerating(false);
    };

    if (!data) {
        return (
            <div style={{
                background: 'var(--bg-card)',
                borderRadius: '16px',
                border: '1px dashed var(--border-color)',
                padding: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: 'var(--text-muted)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Bot size={24} color="#8b5cf6" />
                    <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                            AI Executive Market Briefing
                        </h3>
                        <span style={{ fontSize: '0.75rem' }}>Run a daily scan to generate 1-year historical cycle analysis &amp; executive market briefing.</span>
                    </div>
                </div>
                <button
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        border: 'none',
                        color: '#fff',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: isRegenerating ? 'wait' : 'pointer'
                    }}
                >
                    <RefreshCw size={14} className={isRegenerating ? 'animate-spin' : ''} />
                    <span>{isRegenerating ? 'Analyzing...' : 'Generate Briefing'}</span>
                </button>
            </div>
        );
    }

    const {
        headline,
        the_bottom_line,
        executive_summary,
        cycle_context,
        one_year_cycle_context,
        macro_synthesis,
        sector_rotation_summary,
        tactical_action_plan = [],
        leader_spotlights = [],
        key_risk_alerts = []
    } = data;

    const rawBottomLine = the_bottom_line || executive_summary || headline;
    const bottomLineBullets: string[] = Array.isArray(rawBottomLine) 
        ? rawBottomLine 
        : typeof rawBottomLine === 'string'
            ? rawBottomLine.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).filter(s => s.trim().length > 0)
            : [String(rawBottomLine)];

    const cycleSummary = cycle_context || one_year_cycle_context || '1-Year Historical Regime Analysis Active';

    return (
        <div style={{
            background: 'linear-gradient(180deg, rgba(30, 27, 75, 0.35) 0%, rgba(15, 23, 42, 0.55) 100%)',
            backdropFilter: 'blur(16px)',
            borderRadius: '16px',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.35), 0 0 20px rgba(139, 92, 246, 0.1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Header Strip */}
            <div style={{
                padding: '0.9rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
                background: 'rgba(255, 255, 255, 0.02)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        boxShadow: '0 2px 10px rgba(139, 92, 246, 0.4)'
                    }}>
                        <Sparkles size={17} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '0.3px' }}>
                                AI EXECUTIVE MARKET BRIEFING &amp; 1-YEAR CYCLE ANALYSIS
                            </h2>
                            <span style={{
                                fontSize: '0.68rem',
                                color: '#c084fc',
                                background: 'rgba(192, 132, 252, 0.12)',
                                border: '1px solid rgba(192, 132, 252, 0.3)',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontWeight: 700
                            }}>
                                🤖 {activeModel}
                            </span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Synthesizing 4 regime buckets, 1-year transition memory, and intermarket macro flows
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                        onClick={handleRegenerate}
                        disabled={isRegenerating}
                        title="Re-synthesize executive note with local LLM"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 12px',
                            borderRadius: '8px',
                            background: isRegenerating ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.15)',
                            border: '1px solid rgba(139, 92, 246, 0.4)',
                            color: '#c084fc',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: isRegenerating ? 'wait' : 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <RefreshCw size={13} className={isRegenerating ? 'animate-spin' : ''} />
                        <span>{isRegenerating ? 'Synthesizing...' : 'Regenerate Note'}</span>
                    </button>

                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '4px'
                        }}
                    >
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                </div>
            </div>

            {/* Collapsible Content Body */}
            {isExpanded && (
                <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                    
                    {/* The Bottom Line Banner (Bulleted List) */}
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)',
                        borderLeft: '4px solid #8b5cf6',
                        padding: '0.85rem 1.15rem',
                        borderRadius: '0 10px 10px 0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                        borderLeftWidth: '4px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Zap size={14} color="#a855f7" />
                            <span style={{ fontSize: '0.7rem', color: '#c084fc', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                The Bottom Line
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {bottomLineBullets.map((bullet, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc', lineHeight: '1.45' }}>
                                    <span style={{ color: '#a855f7', fontWeight: 800, fontSize: '1rem', lineHeight: '1.2' }}>•</span>
                                    <span>{bullet}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 3 Key Diagnostic Pillars (Side-by-Side Cards) */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: '1rem'
                    }}>
                        {/* Pillar 1: 1-Year Cycle Context */}
                        <div style={{
                            background: 'rgba(0, 0, 0, 0.22)',
                            borderRadius: '12px',
                            padding: '0.85rem 1rem',
                            border: '1px solid rgba(56, 189, 248, 0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontWeight: 800, fontSize: '0.78rem' }}>
                                <Compass size={15} />
                                <span>1-Year Regime Cycle</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.45' }}>
                                {cycleSummary}
                            </p>
                        </div>

                        {/* Pillar 2: Intermarket Macro Driver */}
                        <div style={{
                            background: 'rgba(0, 0, 0, 0.22)',
                            borderRadius: '12px',
                            padding: '0.85rem 1rem',
                            border: '1px solid rgba(192, 132, 252, 0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c084fc', fontWeight: 800, fontSize: '0.78rem' }}>
                                <Globe size={15} />
                                <span>Intermarket Macro Drivers</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.45' }}>
                                {macro_synthesis || '10Y Yields and US Dollar remain key determinants of valuation risk and multiple expansion.'}
                            </p>
                        </div>

                        {/* Pillar 3: Sector Rotation & Money Flows */}
                        <div style={{
                            background: 'rgba(0, 0, 0, 0.22)',
                            borderRadius: '12px',
                            padding: '0.85rem 1rem',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: 800, fontSize: '0.78rem' }}>
                                <Repeat size={15} />
                                <span>Sector Rotation &amp; Flows</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.45' }}>
                                {sector_rotation_summary || 'Capital is rotating selectively into high-conviction themes while broader cyclicals consolidate.'}
                            </p>
                        </div>
                    </div>

                    {/* 3-Column Tactical Grid: Action Plan | Leader Spotlights | Risk Alerts */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: '1rem'
                    }}>
                        {/* Column 1: Tactical Action Plan */}
                        <div style={{
                            background: 'rgba(16, 185, 129, 0.04)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            borderRadius: '12px',
                            padding: '0.85rem 1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem'
                        }}>
                            <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#10b981', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <CheckCircle2 size={15} /> Tactical Execution Playbook
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.76rem' }}>
                                {tactical_action_plan.map((item, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '6px', color: '#e2e8f0', lineHeight: '1.35' }}>
                                        <span style={{ color: '#10b981', fontWeight: 800 }}>•</span>
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Column 2: Leader Setup Spotlights */}
                        <div style={{
                            background: 'rgba(56, 189, 248, 0.04)',
                            border: '1px solid rgba(56, 189, 248, 0.2)',
                            borderRadius: '12px',
                            padding: '0.85rem 1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem'
                        }}>
                            <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#38bdf8', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Target size={15} /> Top Focus Leader Setup Theses
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.74rem' }}>
                                {leader_spotlights.length === 0 ? (
                                    <span style={{ color: 'var(--text-muted)' }}>No high-conviction leaders meeting criteria</span>
                                ) : (
                                    leader_spotlights.map((leader, i) => (
                                        <div key={i} style={{
                                            background: 'rgba(255, 255, 255, 0.02)',
                                            padding: '5px 7px',
                                            borderRadius: '6px',
                                            border: '1px solid rgba(255, 255, 255, 0.04)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                                <strong style={{ color: '#38bdf8' }}>{leader.symbol}</strong>
                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>({leader.theme})</span>
                                            </div>
                                            <div style={{ color: '#cbd5e1', lineHeight: '1.25' }}>
                                                {leader.thesis}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Column 3: Key Risk Alerts */}
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.04)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '12px',
                            padding: '0.85rem 1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem'
                        }}>
                            <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f87171', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <ShieldAlert size={15} /> Key Macro &amp; Divergence Risks
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.76rem' }}>
                                {key_risk_alerts.length === 0 ? (
                                    <span style={{ color: '#10b981' }}>No immediate cross-asset divergence warnings active.</span>
                                ) : (
                                    key_risk_alerts.map((risk, i) => (
                                        <div key={i} style={{ display: 'flex', gap: '6px', color: '#fecaca', lineHeight: '1.35' }}>
                                            <AlertCircle size={13} color="#f87171" style={{ flexShrink: 0, marginTop: '2px' }} />
                                            <span>{risk}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};
