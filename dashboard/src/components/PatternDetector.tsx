import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import { Sparkles, Loader2, TrendingUp } from 'lucide-react';
import { analyzePattern, PatternAnalysis } from '../services/aiService';
import { OHLCV } from '../services/dataService';

interface PatternDetectorProps {
    symbol: string;
    chartContainerId?: string;
    history: OHLCV[];
}

const PatternDetector: React.FC<PatternDetectorProps> = ({ symbol, chartContainerId = 'universal_chart', history }) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<PatternAnalysis | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [debugImage, setDebugImage] = useState<string | null>(null);
    const [showDebug, setShowDebug] = useState(false);

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        setError(null);
        setResult(null);

        try {
            // 1. Capture the chart image
            const chartElement = document.getElementById(chartContainerId);
            if (!chartElement) {
                throw new Error("Chart container not found.");
            }

            // Small delay to ensure widget is fully rendered if just swapped
            await new Promise(resolve => setTimeout(resolve, 500));

            const canvas = await html2canvas(chartElement, {
                useCORS: true,
                backgroundColor: '#131722', // Match TV dark theme
            });
            const imageBase64 = canvas.toDataURL('image/png');
            setDebugImage(imageBase64);

            // 2. Call AI service using the history passed as prop
            const analysis = await analyzePattern(symbol, history, imageBase64);

            if (analysis) {
                setResult(analysis);
            } else {
                const provider = localStorage.getItem('ai_provider') || 'ollama';
                throw new Error(provider === 'gemini'
                    ? "Failed to get analysis. Check your Gemini API key."
                    : "Local AI failed to respond. Ensure Ollama is running (`ollama serve`) and the 'gemma4:26b' model is installed.");
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || "An unexpected error occurred.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div style={{
            background: 'var(--bg-card)',
            borderRadius: '24px',
            border: '1px solid var(--border-color)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '4px', height: '18px', background: 'var(--accent-primary)', borderRadius: '2px' }} />
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Pattern Detector</h3>
                </div>

                <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    style={{
                        background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
                        color: 'white',
                        border: 'none',
                        padding: '0.6rem 1.2rem',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {isAnalyzing ? 'Analyzing...' : 'Scan Pattern'}
                </button>
            </div>

            {debugImage && (
                <button
                    onClick={() => setShowDebug(!showDebug)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-primary)',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        padding: 0,
                        textAlign: 'left',
                        textDecoration: 'underline'
                    }}
                >
                    {showDebug ? 'Hide' : 'View'} Raw Capture (What AI Sees)
                </button>
            )}

            {showDebug && debugImage && (
                <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <img src={debugImage} alt="Raw Capture" style={{ width: '100%', display: 'block' }} />
                </div>
            )}

            {error && (
                <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', color: '#ef4444', fontSize: '0.85rem' }}>
                    {error}
                </div>
            )}

            {!result && !isAnalyzing && !error && (
                <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
                    Click "Scan Pattern" to analyze the current chart visual and data.
                </div>
            )}

            {result && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                    animation: 'fadeIn 0.5s ease',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    paddingRight: '8px',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'var(--accent-primary) transparent'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{result.patternName}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Confidence: {result.confidence}%</div>
                        </div>
                        <div style={{
                            padding: '4px 12px',
                            borderRadius: '8px',
                            background: result.setupQuality.startsWith('A') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                            color: result.setupQuality.startsWith('A') ? '#10b981' : '#fff',
                            fontWeight: 800,
                            fontSize: '1rem',
                            border: '1px solid' + (result.setupQuality.startsWith('A') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.1)')
                        }}>
                            {result.setupQuality}
                        </div>
                    </div>

                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                        {result.description}
                    </p>

                    {result.vcpStats && (
                        <div style={{
                            background: 'rgba(59, 130, 246, 0.05)',
                            padding: '1rem',
                            borderRadius: '16px',
                            border: '1px solid rgba(59, 130, 246, 0.1)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                        }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mathematical Verification</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{result.vcpStats.description}</div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                <div style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: result.vcpStats.stage2 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)', color: result.vcpStats.stage2 ? '#10b981' : 'var(--text-muted)' }}>
                                    Stage 2: {result.vcpStats.stage2 ? 'YES' : 'NO'}
                                </div>
                                <div style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: result.vcpStats.hasVDU ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)', color: result.vcpStats.hasVDU ? '#10b981' : 'var(--text-muted)' }}>
                                    VDU: {result.vcpStats.hasVDU ? 'YES' : 'NO'}
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '12px', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Pivot</div>
                            <div style={{ fontSize: '1rem', fontWeight: 700 }}>${result.pivotPoint?.toFixed(2) || '---'}</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '12px', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Stop</div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ef4444' }}>${result.stopLoss?.toFixed(2) || '---'}</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '12px', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Target</div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#10b981' }}>${result.targetPrice?.toFixed(2) || '---'}</div>
                        </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                            <TrendingUp size={14} color="var(--accent-primary)" />
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>AI Commentary</span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4', fontStyle: 'italic' }}>
                            "{result.commentary}"
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatternDetector;
