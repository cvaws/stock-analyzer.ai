import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, Landmark, Target, Layers, HelpCircle, Trophy, BarChart3, Send, CheckCircle2, XCircle, MinusCircle, Users, Info } from 'lucide-react';
import { analyzeStockResearch, ResearchAnalysis, chatWithResearchModel, ChatMessage, fetchLocalFundamentalAnalysis } from '../services/aiService';

interface AIResearchWidgetProps {
    symbol: string;
    companyName?: string;
    sector?: string;
    industry?: string;
    rsStocks?: any[];
    onPeerClick?: (symbol: string) => void;
}

const TRUE_COMPETITORS: { [key: string]: string[] } = {
    'MU': ['WDC', 'STX', 'AMD', 'INTC', 'TSM'],
    'NVDA': ['AMD', 'INTC', 'AVGO', 'MRVL', 'QCOM', 'TSM'],
    'AMD': ['NVDA', 'INTC', 'TSM', 'QCOM'],
    'INTC': ['AMD', 'NVDA', 'TSM', 'AVGO'],
    'AAPL': ['MSFT', 'GOOGL', 'AMZN', 'META'],
    'MSFT': ['AAPL', 'GOOGL', 'AMZN', 'META', 'ORCL'],
    'TSM': ['ASML', 'AMD', 'NVDA', 'INTC', 'LRCX', 'AMAT'],
    'AVGO': ['QCOM', 'TXN', 'ADI', 'NXPI', 'MRVL', 'NVDA'],
    'QCOM': ['AVGO', 'AAPL', 'TXN', 'NXPI', 'AMD'],
    'MRVL': ['AVGO', 'NVDA', 'AMD', 'CSCO'],
    'WDC': ['MU', 'STX'],
    'STX': ['WDC', 'MU'],
    'AMZN': ['MSFT', 'GOOGL', 'AAPL', 'WMT', 'BABA'],
    'META': ['GOOGL', 'SNAP', 'PINS', 'MSFT', 'AAPL'],
    'GOOGL': ['MSFT', 'META', 'AAPL', 'AMZN'],
    'NFLX': ['DIS', 'AMZN', 'PARA', 'WBD'],
    'TSLA': ['RIVN', 'LCID', 'GM', 'F', 'BYDDF']
};

const FACTOR_CRITERIA: { [key: string]: string } = {
    'revenue growth': 'Evaluates if top-line revenue is accelerating, aiming for at least 20-25% YoY growth or strong sequential QoQ momentum to qualify as a high-growth leader.',
    'margins expanding': 'Checks if operating, gross, or net profit margins are improving over consecutive quarters, signaling pricing power and operational leverage.',
    'no contract losses': 'Ensures the business is retaining key clients and backlog commitments, avoiding high customer concentration risks or lost contracts.',
    'net cash positive': 'Checks if the company has a net cash positive balance sheet (cash exceeds total debt) or maintains a very healthy debt-to-equity ratio.',
    'leadership stable': 'Verifies executive management stability (CEO/CFO/key founders) and the absence of sudden departures or boardroom conflicts.',
    'forward guidance strong': 'Requires management\'s official revenue outlook or earnings forecast for upcoming quarters to meet or exceed analyst consensus expectations.',
    'no disruption risk': 'Assesses vulnerability to rapid technological obsolescence, severe regulatory changes, patent expirations, or market disruption.',
    'institutions increasing': 'Looks for stable or increasing institutional sponsorship (mutual funds, banks, pension funds) over recent quarters, a key CANSLIM indicator.',
    'valuation vs peers': 'Compares key multiples (P/E, P/S, PEG ratio) against direct competitors and historical averages to avoid buying overvalued stocks.'
};

const AIResearchWidget: React.FC<AIResearchWidgetProps> = ({ symbol, companyName, sector, industry, rsStocks = [], onPeerClick }) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<ResearchAnalysis | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [followUpQuery, setFollowUpQuery] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [activeInfo, setActiveInfo] = useState<string | null>(null);

    useEffect(() => {
        const loadLocalOnly = async () => {
            setIsAnalyzing(true);
            setError(null);
            setResult(null);
            setChatHistory([]);
            try {
                const data = await fetchLocalFundamentalAnalysis(symbol);
                if (data) {
                    setResult(data);
                    setChatHistory([
                        { role: 'system', content: `You are an expert equity analyst. You just performed research on ${companyName || symbol} (${symbol}) in the ${sector} / ${industry} sector. Use this research summary as your primary context for follow-up questions: ${data.summary}. Keep answers concise and evidence-based.` }
                    ]);
                }
            } catch (err) {
                console.error("Error loading pre-compiled report:", err);
            } finally {
                setIsAnalyzing(false);
            }
        };
        loadLocalOnly();
    }, [symbol, companyName, sector, industry]);

    const getPeers = () => {
        if (!rsStocks || rsStocks.length === 0) return [];
        const upperSym = symbol.toUpperCase().trim();
        const directCompetitorList = result?.truePeers || TRUE_COMPETITORS[upperSym];

        if (directCompetitorList && directCompetitorList.length > 0) {
            // Include both direct competitors and the active stock itself
            const matchedPeers = rsStocks.filter((s: any) => directCompetitorList.includes(s.ticker) || s.ticker === upperSym);
            if (matchedPeers.length > 0) {
                return matchedPeers.sort((a: any, b: any) => b.rsScore - a.rsScore);
            }
        }

        const industryPeers = rsStocks
            .filter((s: any) => s.industry === (result?.industry || industry))
            .sort((a: any, b: any) => b.rsScore - a.rsScore);

        const currentStock = rsStocks.find((s: any) => s.ticker === upperSym);
        let finalPeers = industryPeers.slice(0, 5);
        if (currentStock && !finalPeers.some((p: any) => p.ticker === upperSym)) {
            finalPeers.push(currentStock);
            finalPeers.sort((a: any, b: any) => b.rsScore - a.rsScore);
        }

        return finalPeers;
    };

    const peers = getPeers();

    const handleResearch = async () => {
        setIsAnalyzing(true);
        setError(null);
        setChatHistory([]); // Reset history on new research
        try {
            // Try fetching local compiled analysis first
            let data = await fetchLocalFundamentalAnalysis(symbol);

            // If local data doesn't exist, run the live AI model fallback
            if (!data) {
                console.log(`Local analysis file not found for ${symbol}. Falling back to live local AI model...`);
                data = await analyzeStockResearch(symbol, companyName, sector, industry);
            }
            if (data) {
                setResult(data);
                // Initialize chat history with the research summary as the system context
                setChatHistory([
                    { role: 'system', content: `You are an expert equity analyst. You just performed research on ${companyName || symbol} (${symbol}) in the ${sector} / ${industry} sector. Use this research summary as your primary context for follow-up questions: ${data.summary}. Keep answers concise and evidence-based.` }
                ]);
            } else {
                throw new Error("Failed to receive research data from the AI model.");
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || "An error occurred during AI research.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleFollowUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!followUpQuery.trim() || isThinking) return;

        const userMsg: ChatMessage = { role: 'user', content: followUpQuery };
        const newHistory = [...chatHistory, userMsg];
        setChatHistory(newHistory);
        setFollowUpQuery('');
        setIsThinking(true);

        try {
            const response = await chatWithResearchModel(newHistory);
            if (response) {
                setChatHistory([...newHistory, { role: 'assistant', content: response }]);
            } else {
                setError("Failed to get response for follow-up question.");
            }
        } catch (err: any) {
            setError(err.message || "Error during chat.");
        } finally {
            setIsThinking(false);
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
            gap: '1.25rem'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '4px', height: '18px', background: '#8b5cf6', borderRadius: '2px' }} />
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fundamental Research (AI)</h3>
                </div>

                <button
                    onClick={handleResearch}
                    disabled={isAnalyzing}
                    style={{
                        background: 'rgba(139, 92, 246, 0.1)',
                        color: '#a78bfa',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        padding: '0.5rem 1rem',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                    {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {isAnalyzing ? 'Loading...' : 'Run Fundamental Research'}
                </button>
            </div>

            {error && (
                <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', color: '#ef4444', fontSize: '0.8rem' }}>
                    {error}
                </div>
            )}

            {!result && !isAnalyzing && (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '16px', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '0.85rem', margin: 0 }}>Load the pre-compiled fundamental report or fallback to live local AI research for <strong>{symbol}</strong>.</p>
                </div>
            )}

            {result && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.4s ease' }}>
                    {/* Brand Header & Verdict Badge */}
                    {(result.companyName || result.ticker || symbol) && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'rgba(255, 255, 255, 0.02)',
                            padding: '1rem 1.25rem',
                            borderRadius: '16px',
                            border: '1px solid hsla(0,0%,100%,0.04)'
                        }}>
                            <div>
                                <h4 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#fff' }}>{result.ticker || symbol}</h4>
                                {result.companyName && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>{result.companyName}</p>}
                            </div>
                            {result.verdict && (
                                <span style={{
                                    fontFamily: 'monospace',
                                    fontSize: '0.75rem',
                                    padding: '5px 12px',
                                    borderRadius: '20px',
                                    fontWeight: 'bold',
                                    background: result.verdict.toLowerCase().includes('strong') ? 'rgba(5, 46, 22, 0.4)' :
                                        result.verdict.toLowerCase().includes('watchlist') ? 'rgba(28, 20, 0, 0.4)' : 'rgba(45, 10, 10, 0.4)',
                                    color: result.verdict.toLowerCase().includes('strong') ? '#22c55e' :
                                        result.verdict.toLowerCase().includes('watchlist') ? '#f59e0b' : '#ef4444',
                                    border: `1px solid ${result.verdict.toLowerCase().includes('strong') ? '#16653a' :
                                        result.verdict.toLowerCase().includes('watchlist') ? '#7c5c00' : '#7c1e1e'}`
                                }}>
                                    {result.verdict}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Score, Strength, Valuation, Sector, and Industry Chips */}
                    {(result.score || result.sector || result.industry) && (
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            {result.score && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.5rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    <span>Score: <strong style={{ color: '#fff' }}>{result.score}</strong></span>
                                    <Info 
                                        size={12} 
                                        style={{ cursor: 'pointer', opacity: 0.6, transition: 'all 0.2s' }} 
                                        onClick={() => setActiveInfo('score')}
                                    />
                                </div>
                            )}
                            {result.strength && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.5rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    <span>Strength: <strong style={{ color: '#fff' }}>{result.strength}</strong></span>
                                    <Info 
                                        size={12} 
                                        style={{ cursor: 'pointer', opacity: 0.6, transition: 'all 0.2s' }} 
                                        onClick={() => setActiveInfo('strength')}
                                    />
                                </div>
                            )}
                            {result.valuation && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.5rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    <span>Valuation: <strong style={{ color: '#fff' }}>{result.valuation}</strong></span>
                                    <Info 
                                        size={12} 
                                        style={{ cursor: 'pointer', opacity: 0.6, transition: 'all 0.2s' }} 
                                        onClick={() => setActiveInfo('valuation')}
                                    />
                                </div>
                            )}
                            {result.sector && (
                                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.5rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    Sector: <strong style={{ color: '#fff' }}>{result.sector}</strong>
                                </div>
                            )}
                            {result.industry && (
                                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.5rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    Industry: <strong style={{ color: '#fff' }}>{result.industry}</strong>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Summary Text (Styled as a quote block right below the metrics) */}
                    {result.summary && (
                        <div style={{
                            fontSize: '0.85rem',
                            color: 'var(--text-secondary)',
                            lineHeight: '1.6',
                            borderLeft: '3px solid var(--border-color)',
                            paddingLeft: '14px',
                            fontStyle: 'italic',
                            marginTop: '0.25rem',
                            marginBottom: '0.5rem'
                        }}>
                            "{result.summary}"
                        </div>
                    )}
                    {/* Grid Container for Side-by-Side Widgets */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                        gap: '1.5rem',
                        alignItems: 'start'
                    }}>
                        {/* Left Column: Narrative Analysis & Chat */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* 1. Industry & Moat */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '16px', border: '1px solid hsla(0,0%,100%,0.05)', minHeight: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                        <Target size={14} color="#8b5cf6" />
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Specific Industry</span>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{result.industry || 'Unknown'}</div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '16px', border: '1px solid hsla(0,0%,100%,0.05)', minHeight: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                        <Landmark size={14} color="#8b5cf6" />
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Economic Moat</span>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{result.moat || 'Assessing...'}</div>
                                </div>
                            </div>

                            {/* 2. Leadership StatusRow */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '16px', border: '1px solid hsla(0,0%,100%,0.05)', minHeight: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                        <Trophy size={14} color="#f59e0b" />
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Leadership Status</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{
                                            padding: '4px 8px',
                                            background: result.leadershipStatus?.toLowerCase().includes('apex') ? 'rgba(245, 158, 11, 0.1)' :
                                                result.leadershipStatus?.toLowerCase().includes('challenger') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
                                            color: result.leadershipStatus?.toLowerCase().includes('apex') ? '#f59e0b' :
                                                result.leadershipStatus?.toLowerCase().includes('challenger') ? '#10b981' : '#fff',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: 800,
                                            textTransform: 'uppercase',
                                            border: `1px solid ${result.leadershipStatus?.toLowerCase().includes('apex') ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.1)'}`
                                        }}>
                                            {result.leadershipStatus || 'Niche Player'}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '16px', border: '1px solid hsla(0,0%,100%,0.05)', minHeight: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                        <BarChart3 size={14} color="#3b82f6" />
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Market Context</span>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{result.marketShare || 'Fragmented < 1%'}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>{result.competitiveRanking || 'Market Participant'}</div>
                                </div>
                            </div>

                            {/* 3. Secular Themes */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                    <Layers size={14} color="#8b5cf6" />
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Thematic Drivers</span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {result.themes.map((t, i) => (
                                        <span key={i} style={{ padding: '4px 10px', background: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Core Business & Key Industry Role Bullets */}
                            {result.essentialBullets && result.essentialBullets.length > 0 && (
                                <div style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '1rem', borderRadius: '16px', border: '1px solid hsla(0,0%,100%,0.04)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                                        <Sparkles size={14} color="#10b981" />
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Core Business &amp; Key Industry Role</span>
                                    </div>
                                    <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {result.essentialBullets.map((b, i) => (
                                            <li key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                                                {b}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* 3. Research Priorities */}
                            <div style={{ background: 'rgba(139, 92, 246, 0.03)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                                    <HelpCircle size={14} color="#a78bfa" />
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase' }}>Next Phase Research</span>
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {result.researchPriorities.map((p, i) => (
                                        <li key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{p}</li>
                                    ))}
                                </ul>
                            </div>

                            {/* Chat Section */}
                            <div style={{
                                marginTop: '1rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem',
                                borderTop: '1px solid var(--border-color)',
                                paddingTop: '1.25rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Sparkles size={14} color="#8b5cf6" />
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ask Follow-up Questions</span>
                                </div>

                                <div style={{
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.75rem',
                                    paddingRight: '4px'
                                }}>
                                    {chatHistory.filter(m => m.role !== 'system').map((msg, i) => (
                                        <div key={i} style={{
                                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                            background: msg.role === 'user' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                                            padding: '0.6rem 0.8rem',
                                            borderRadius: '12px',
                                            maxWidth: '85%',
                                            border: `1px solid ${msg.role === 'user' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)'}`
                                        }}>
                                            <p style={{ fontSize: '0.8rem', margin: 0, color: msg.role === 'user' ? '#a78bfa' : 'var(--text-secondary)', lineHeight: 1.4 }}>
                                                {msg.content}
                                            </p>
                                        </div>
                                    ))}
                                    {isThinking && (
                                        <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '4px', padding: '0.4rem' }}>
                                            <div className="animate-bounce" style={{ width: '4px', height: '4px', background: 'var(--text-muted)', borderRadius: '50%' }} />
                                            <div className="animate-bounce" style={{ width: '4px', height: '4px', background: 'var(--text-muted)', borderRadius: '50%', animationDelay: '0.2s' }} />
                                            <div className="animate-bounce" style={{ width: '4px', height: '4px', background: 'var(--text-muted)', borderRadius: '50%', animationDelay: '0.4s' }} />
                                        </div>
                                    )}
                                </div>

                                <form onSubmit={handleFollowUp} style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        type="text"
                                        value={followUpQuery}
                                        onChange={(e) => setFollowUpQuery(e.target.value)}
                                        placeholder="Ask about its moat, risks, etc..."
                                        style={{
                                            flex: 1,
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '10px',
                                            padding: '0.6rem 0.8rem',
                                            color: '#fff',
                                            fontSize: '0.8rem',
                                            outline: 'none'
                                        }}
                                    />
                                    <button
                                        type="submit"
                                        disabled={isThinking || !followUpQuery.trim()}
                                        style={{
                                            background: 'var(--accent-primary)',
                                            color: '#fff',
                                            border: 'none',
                                            padding: '0.6rem',
                                            borderRadius: '10px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s',
                                            opacity: (isThinking || !followUpQuery.trim()) ? 0.5 : 1
                                        }}
                                    >
                                        <Send size={14} />
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* Right Column: Scorecard, Peers, Warnings */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* 9-Factor Scorecard */}
                            {result.factors && result.factors.length > 0 && (
                                <div style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '1.25rem', borderRadius: '20px', border: '1px solid hsla(0,0%,100%,0.04)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                                        <Trophy size={14} color="#f59e0b" />
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>9-Factor Scorecard</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {result.factors.map((f, i) => (
                                            <div key={i} style={{
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '10px',
                                                padding: '0.6rem 0.8rem',
                                                background: 'rgba(255, 255, 255, 0.02)',
                                                border: '1px solid hsla(0,0%,100%,0.04)',
                                                borderRadius: '12px',
                                                fontSize: '0.8rem'
                                            }}>
                                                {f.status === 'pos' && <CheckCircle2 size={16} color="#44ba4c" style={{ flexShrink: 0, marginTop: '2px' }} />}
                                                {f.status === 'neg' && <XCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />}
                                                {f.status === 'neu' && <MinusCircle size={16} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ fontWeight: 700, color: '#fff' }}>{f.name}</span>
                                                        <Info 
                                                            size={12} 
                                                            style={{ cursor: 'pointer', opacity: 0.6, transition: 'all 0.2s' }} 
                                                            onClick={() => setActiveInfo(f.name.toLowerCase().trim())}
                                                            onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                                            onMouseOut={(e) => e.currentTarget.style.opacity = '0.6'}
                                                        />
                                                    </div>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>{f.reason}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Industry Peers */}
                            {peers && peers.length > 0 && (
                                <div style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '1.25rem', borderRadius: '20px', border: '1px solid hsla(0,0%,100%,0.04)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                                        <Users size={14} color="#3b82f6" />
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Industry Peers</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {peers.map((peer: any, idx: number) => {
                                            const isActive = peer.ticker === symbol.toUpperCase().trim();
                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => onPeerClick && onPeerClick(peer.ticker)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '0.6rem 0.8rem',
                                                        background: isActive ? 'rgba(139, 92, 246, 0.12)' : 'rgba(255,255,255,0.01)',
                                                        border: isActive ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid hsla(0,0%,100%,0.03)',
                                                        borderRadius: '10px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseOver={(e) => {
                                                        e.currentTarget.style.background = isActive ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.04)';
                                                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                                                    }}
                                                    onMouseOut={(e) => {
                                                        e.currentTarget.style.background = isActive ? 'rgba(139, 92, 246, 0.12)' : 'rgba(255, 255, 255, 0.01)';
                                                        e.currentTarget.style.borderColor = isActive ? 'rgba(139, 92, 246, 0.4)' : 'hsla(0,0%,100%,0.03)';
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>{peer.ticker}</span>
                                                        {isActive && (
                                                            <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '3px', background: '#8b5cf6', color: '#fff', fontWeight: 800, textTransform: 'uppercase' }}>
                                                                Active
                                                            </span>
                                                        )}
                                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Rank #{peer.rank}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <span style={{
                                                            fontSize: '0.65rem',
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            background: peer.percentile > 80 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
                                                            color: peer.percentile > 80 ? '#10b981' : 'var(--text-muted)',
                                                            fontWeight: 700
                                                        }}>
                                                            {peer.percentile}%
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Warnings/Caveats */}
                            {result.caveat && (
                                <div style={{
                                    background: 'rgba(245, 158, 11, 0.05)',
                                    border: '1px solid rgba(245, 158, 11, 0.2)',
                                    borderRadius: '12px',
                                    padding: '0.8rem 1.25rem',
                                    fontSize: '0.8rem',
                                    color: '#f59e0b',
                                    lineHeight: '1.4'
                                }}>
                                    {result.caveat}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Interactive Details Modal */}
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
                                                            {activeInfo === 'score' && 'AI Score Criterion'}
                                                            {activeInfo === 'strength' && 'Relative Strength Criterion'}
                                                            {activeInfo === 'valuation' && 'Valuation State Criterion'}
                                                            {activeInfo && FACTOR_CRITERIA[activeInfo] && `${activeInfo.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Criterion`}
                                                        </h3>
                                                        
                                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                            {activeInfo === 'score' && (
                                                                <>
                                                                    <p style={{ margin: 0 }}>Represents the net count of positive criteria from the 9-Factor Checklist:</p>
                                                                    <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                                        <li><strong>Positive Factor (+2):</strong> Adds 2 points to the total score.</li>
                                                                        <li><strong>Neutral Factor (0):</strong> Adds 0 points.</li>
                                                                        <li><strong>Negative Factor (-2):</strong> Subtracts 2 points.</li>
                                                                        <li><strong>Checklist Range:</strong> Score is displayed out of a maximum of 18 points (e.g. +1 / 18).</li>
                                                                    </ul>
                                                                </>
                                                            )}
                                                            {activeInfo === 'strength' && (
                                                                <>
                                                                    <p style={{ margin: 0 }}>Indicates the stock's Relative Strength (RS) percentile rank compared to the scanned market universe:</p>
                                                                    <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                                        <li><strong>Percentile Score (0% - 100%):</strong> Reflects the percentage of stocks this ticker has outperformed over the past year.</li>
                                                                        <li><strong>Calculation Basis:</strong> Incorporates weighted price momentum over the last 3, 6, 9, and 12 months.</li>
                                                                        <li><strong>O'Neil Leader Standard:</strong> A score &gt; 80% represents a true market leader.</li>
                                                                    </ul>
                                                                </>
                                                            )}
                                                            {activeInfo === 'valuation' && (
                                                                <>
                                                                    <p style={{ margin: 0 }}>Calculates the stock's pricing attractiveness compared to industry peers:</p>
                                                                    <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                                        <li><strong>Cheap / Fair Value:</strong> Low trailing/forward PE or a PEG ratio below 1.0 relative to historical peers.</li>
                                                                        <li><strong>Premium Reasonable:</strong> A premium PE/PEG ratio that is fully justified by high projected earnings growth.</li>
                                                                        <li><strong>Expensive:</strong> Elevated PE multiples and a PEG ratio &gt; 1.5 with slow top-line growth.</li>
                                                                    </ul>
                                                                </>
                                                            )}
                                                            {activeInfo && FACTOR_CRITERIA[activeInfo] && (
                                                                <p style={{ margin: 0 }}>{FACTOR_CRITERIA[activeInfo]}</p>
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

export default AIResearchWidget;
