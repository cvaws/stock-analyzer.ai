import React, { useEffect, useState } from 'react';
import { Play, Shield, BarChart2, Save, Activity } from 'lucide-react';
import { fetchStrategyLabData, fetchEtfTrackerData, triggerBacktestRun, fetchPresetStrategies, StrategyLabData, ThemeStockData, SavedStrategy } from '../services/dataService';

const StrategyLab: React.FC = () => {
    const [labData, setLabData] = useState<StrategyLabData | null>(null);
    const [etfList, setEtfList] = useState<ThemeStockData[]>([]);
    const [presetStrategies, setPresetStrategies] = useState<SavedStrategy[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [runningBacktest, setRunningBacktest] = useState<boolean>(false);
    const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
    const [optLogs, setOptLogs] = useState<string[]>([]);
    const [optStatus, setOptStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');

    const [selectedUniverse, setSelectedUniverse] = useState<string>('All ETFs');
    const [presetName, setPresetName] = useState<string>('');
    const [tickerQuery, setTickerQuery] = useState<string>('');

    const loadData = async () => {
        setLoading(true);
        const [data, etfs, presets] = await Promise.all([
            fetchStrategyLabData(),
            fetchEtfTrackerData(),
            fetchPresetStrategies()
        ]);
        const mergedPresets = (presets && presets.length > 0) ? presets : (data?.saved_strategies || []);
        setLabData(data);
        setEtfList(etfs);
        setPresetStrategies(mergedPresets);

        if (mergedPresets && mergedPresets.length > 0 && !presetName) {
            setPresetName(mergedPresets[0].name);
            if (mergedPresets[0].universe) {
                setSelectedUniverse(mergedPresets[0].universe);
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleRunBacktest = async () => {
        setRunningBacktest(true);
        await triggerBacktestRun();
        await loadData();
        setRunningBacktest(false);
    };

    const handleRunOptimizer = () => {
        if (isOptimizing) return;
        setIsOptimizing(true);
        setOptStatus('running');
        setOptLogs(['Connecting to Genetic Strategy Optimizer (71,000 parameter permutations)...']);

        const SIDECAR_URL = (typeof window !== 'undefined' && (window as any).__SIDECAR_URL__) || 'http://127.0.0.1:8765';
        const eventSource = new EventSource(`${SIDECAR_URL}/api/pipeline/optimize-stream`);

        eventSource.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.message) {
                    setOptLogs(prev => [...prev.slice(-30), data.message]);
                }
                if (data.status === 'completed') {
                    setOptStatus('completed');
                    setIsOptimizing(false);
                    eventSource.close();
                    loadData();
                } else if (data.status === 'failed') {
                    setOptStatus('failed');
                    setIsOptimizing(false);
                    eventSource.close();
                }
            } catch (err) {
                console.error('Error parsing optimizer SSE:', err);
            }
        };

        eventSource.onerror = (err) => {
            console.error('Optimizer SSE error:', err);
            setOptLogs(prev => [...prev, 'Optimization session closed.']);
            setIsOptimizing(false);
            setOptStatus('completed');
            eventSource.close();
            loadData();
        };
    };



    // Calculate aggregated results for the selected strategy
    const allStratRes = labData?.all_strategy_results || {};
    const results = (presetName && allStratRes[presetName]) ? allStratRes[presetName] : (labData?.backtest_results || {});
    let filteredTickers = Object.keys(results);

    // Portfolio simulation metrics for the active strategy
    const portfolioSummary = (labData as any)?.portfolio_summary || {};
    const portData = (presetName && portfolioSummary[presetName]) ? portfolioSummary[presetName] : null;
    const startingCap  = portData?.starting_capital ?? 100000;
    const endingCap    = portData?.ending_capital   ?? startingCap;
    const totalReturn  = portData?.total_return_pct  ?? 0;
    const maxDrawdown  = portData?.max_drawdown_pct  ?? 0;
    const tradesTaken  = portData?.trades_taken      ?? 0;
    const tradesSkipped = portData?.trades_skipped   ?? 0;
    const capUtil      = portData?.capital_utilization_pct ?? 0;


    if (selectedUniverse !== 'All ETFs') {
        const matchingEtfs = etfList.filter(e => e.sector.toLowerCase() === selectedUniverse.toLowerCase()).map(e => e.symbol);
        if (matchingEtfs.length > 0) {
            filteredTickers = filteredTickers.filter(t => matchingEtfs.includes(t));
        }
    }

    if (tickerQuery.trim()) {
        const queryList = tickerQuery.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        filteredTickers = filteredTickers.filter(t => queryList.some(q => t.toUpperCase().includes(q)));
    }

    let allTradesList: any[] = [];

    filteredTickers.forEach(t => {
        const res = results[t];
        if (res) {
            const trades = res.trades || [];
            trades.forEach((tr: any) => {
                const posSize = tr.position_size || 10000.0;
                const pnlDollar = tr.pnl_dollar !== undefined ? tr.pnl_dollar : (posSize * (tr.pnl_pct / 100.0));
                allTradesList.push({
                    ...tr,
                    position_size: posSize,
                    pnl_dollar: pnlDollar
                });
            });
        }
    });

    // Sort Trade Log by Entry Date descending (newest trades first)
    allTradesList.sort((a, b) => (b.entry_date || '').localeCompare(a.entry_date || ''));



    // Active strategy metadata
    const activeStrategy = presetStrategies?.find(s => s.name === presetName) || presetStrategies?.[0] || {};

    if (loading) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Activity className="animate-spin" size={32} />
                <p style={{ marginTop: '1rem' }}>Loading Strategy Lab Engine...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        StockWave Strategy Lab
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
                        Preset strategy backtesting engine (Source of truth: <code style={{ color: '#3b82f6' }}>data/inputs/strategies.json</code>)
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                        onClick={handleRunBacktest}
                        disabled={runningBacktest || isOptimizing}
                        style={{
                            background: '#3b82f6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '0.6rem 1.25rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: (runningBacktest || isOptimizing) ? 'not-allowed' : 'pointer',
                            opacity: (runningBacktest || isOptimizing) ? 0.7 : 1
                        }}
                    >
                        {runningBacktest ? <Activity className="animate-spin" size={16} /> : <Play size={16} />}
                        {runningBacktest ? 'Running...' : 'Run Backtest'}
                    </button>

                    <button
                        onClick={handleRunOptimizer}
                        disabled={isOptimizing || runningBacktest}
                        title="Run Genetic Multi-Process Strategy Optimizer across 71,000 parameter permutations (~15m)"
                        style={{
                            background: isOptimizing ? 'rgba(234, 88, 12, 0.2)' : 'linear-gradient(135deg, #ea580c 0%, #d97706 100%)',
                            color: '#fff',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '8px',
                            padding: '0.6rem 1.25rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: isOptimizing ? 'wait' : 'pointer',
                            boxShadow: isOptimizing ? 'none' : '0 2px 10px rgba(234, 88, 12, 0.35)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <Activity className={isOptimizing ? 'animate-spin' : ''} size={16} />
                        {isOptimizing ? 'Optimizing (71k)...' : '⚡ Run Strategy Optimizer'}
                    </button>
                </div>

            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
                <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Save size={18} color="#10b981" /> Preset Strategy
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Select Strategy (data/inputs/strategies.json)</label>
                        <select
                            value={presetName}
                            onChange={(e) => {
                                const name = e.target.value;
                                setPresetName(name);
                                const found = presetStrategies?.find(s => s.name === name);
                                if (found && found.universe) {
                                    setSelectedUniverse(found.universe);
                                }
                            }}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                padding: '0.6rem',
                                fontSize: '0.9rem'
                            }}
                        >
                            {presetStrategies && presetStrategies.length > 0 ? (
                                presetStrategies.map((s, idx) => (
                                    <option key={idx} value={s.name}>{s.name}</option>
                                ))
                            ) : (
                                <option value="RS Daily Strategy">RS Daily Strategy</option>
                            )}
                        </select>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Shield size={18} color="#3b82f6" /> Target Universe
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Filter ETF Category</label>
                        <select
                            value={selectedUniverse}
                            onChange={(e) => setSelectedUniverse(e.target.value)}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                padding: '0.6rem',
                                fontSize: '0.9rem'
                            }}
                        >
                            <option value="All ETFs">All ETFs Universe</option>
                            <option value="Canaries">Canaries</option>
                            <option value="Leadership">Leadership</option>
                            <option value="Breadth">Breadth</option>
                            <option value="Defense">Defense</option>
                            <option value="Leveraged_Long">Leveraged Long (3x Bull)</option>
                            <option value="Leveraged_Short">Leveraged Short (3x Bear)</option>
                        </select>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <BarChart2 size={18} color="#a855f7" /> Ticker Filter
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Filter Specific Tickers (e.g. SPY, QQQ)</label>
                        <input
                            type="text"
                            placeholder="All tickers (e.g. SPY, QQQ)"
                            value={tickerQuery}
                            onChange={(e) => setTickerQuery(e.target.value)}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                padding: '0.6rem',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>
                </div>
            </div>

            {activeStrategy && (
                <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '1rem 1.25rem', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Entry Rules ({activeStrategy.entry_combination || 'ALL'})</span>
                        <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {activeStrategy.entry_rules?.map((r: any, i: number) => (
                                <span key={i} style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                    {r.conditions}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Exit Rules ({activeStrategy.exit_combination || 'ANY'})</span>
                        <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {activeStrategy.exit_rules?.map((r: any, i: number) => (
                                <span key={i} style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                    {r.conditions}
                                </span>
                            ))}
                        </div>
                    </div>
                    {activeStrategy.risk_management && (
                        <div>
                            <span style={{ fontSize: '0.75rem', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Risk Management</span>
                            <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {activeStrategy.risk_management.stop_loss_pct !== undefined && (
                                    <span style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', color: '#f87171' }}>
                                        Stop Loss: {activeStrategy.risk_management.stop_loss_pct <= 1 ? `${(activeStrategy.risk_management.stop_loss_pct * 100).toFixed(0)}%` : `${activeStrategy.risk_management.stop_loss_pct}%`}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                    {activeStrategy.profit_taking && activeStrategy.profit_taking.length > 0 && (
                        <div>
                            <span style={{ fontSize: '0.75rem', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Profit Taking</span>
                            <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {activeStrategy.profit_taking.map((step, idx) => (
                                    <span key={idx} style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', color: '#34d399' }}>
                                        Step {idx + 1}: Target {step.profit_target_pct !== undefined ? (step.profit_target_pct <= 1 ? `${(step.profit_target_pct * 100).toFixed(0)}%` : `${step.profit_target_pct}%`) : ''}
                                        {step.position_trim_pct !== undefined ? ` (Trim ${step.position_trim_pct <= 1 ? `${(step.position_trim_pct * 100).toFixed(0)}%` : `${step.position_trim_pct}%`})` : ''}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Portfolio Simulation Widgets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>

                {/* Account Value */}
                <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: `1px solid ${endingCap >= startingCap ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Account Value</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>from ${startingCap.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: endingCap >= startingCap ? '#10b981' : '#ef4444', marginTop: '0.4rem' }}>
                        ${endingCap.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>

                {/* Total Return */}
                <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: `1px solid ${totalReturn >= 0 ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Return</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>on $100k portfolio</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: totalReturn >= 0 ? '#10b981' : '#ef4444', marginTop: '0.4rem' }}>
                        {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
                    </div>
                </div>

                {/* Max Drawdown */}
                <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(251,191,36,0.3)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Max Drawdown</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>peak → trough</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: maxDrawdown <= -10 ? '#ef4444' : '#fbbf24', marginTop: '0.4rem' }}>
                        {maxDrawdown.toFixed(1)}%
                    </div>
                </div>

                {/* Trades Taken / Skipped */}
                <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trades</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>taken / skipped</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.4rem' }}>
                        {tradesTaken}
                        <span style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 600, marginLeft: '4px' }}>/ {tradesSkipped}</span>
                    </div>
                </div>

                {/* Capital Utilization */}
                <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Capital Deployed</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>% of days in market</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#3b82f6', marginTop: '0.4rem' }}>
                        {capUtil.toFixed(1)}%
                    </div>
                </div>

            </div>

            {/* Top 3 Performers Leaderboard for Selected Universe */}
            {(() => {
                const top3Ranked = filteredTickers
                    .map(t => {
                        const r = results[t] || {};
                        return {
                            ticker: t,
                            totalTrades: r.total_trades || 0,
                            winRate: r.win_rate || 0,
                            profitFactor: r.profit_factor || 0,
                            netPnL: r.net_pnl_dollar || 0
                        };
                    })
                    .filter(r => r.totalTrades > 0)
                    .sort((a, b) => b.profitFactor - a.profitFactor || b.netPnL - a.netPnL)
                    .slice(0, 3);

                if (top3Ranked.length === 0) return null;

                return (
                    <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                🏆 Top 3 Performers in {selectedUniverse} Group
                            </h3>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ranked by Profit Factor & Net PnL</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                            {top3Ranked.map((item, index) => {
                                const rankColors = ['#f59e0b', '#94a3b8', '#b45309'];
                                const rankBadges = ['🥇 1st', '🥈 2nd', '🥉 3rd'];
                                return (
                                    <div
                                        key={item.ticker}
                                        onClick={() => setTickerQuery(item.ticker)}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.03)',
                                            border: `1px solid ${rankColors[index]}44`,
                                            borderRadius: '10px',
                                            padding: '1rem',
                                            cursor: 'pointer',
                                            transition: 'transform 0.2s, border-color 0.2s',
                                        }}
                                        title={`Click to filter trades for ${item.ticker}`}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{item.ticker}</span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: rankColors[index], background: `${rankColors[index]}22`, padding: '2px 8px', borderRadius: '4px' }}>
                                                {rankBadges[index]}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                            <span>Profit Factor:</span>
                                            <strong style={{ color: '#3b82f6' }}>{item.profitFactor}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                            <span>Win Rate:</span>
                                            <strong style={{ color: '#10b981' }}>{item.winRate}%</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                            <span>Net PnL:</span>
                                            <strong style={{ color: item.netPnL >= 0 ? '#10b981' : '#ef4444' }}>
                                                {item.netPnL >= 0 ? `+$${item.netPnL.toFixed(0)}` : `-$${Math.abs(item.netPnL).toFixed(0)}`}
                                            </strong>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <BarChart2 size={18} color="#3b82f6" /> Trade Log ({allTradesList.length} Executions | $10,000 Position Size)
                    </h3>
                </div>
                <div style={{ overflowX: 'auto', maxHeight: '450px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>ETF</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Entry Date</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Exit Date</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Entry Price</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Exit Price</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Position Size</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Holding Days</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>PnL ($)</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>PnL (%)</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Exit Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allTradesList.map((tr, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{tr.ticker}</td>
                                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{tr.entry_date}</td>
                                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{tr.exit_date}</td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>${tr.entry_price?.toFixed(2)}</td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>${tr.exit_price?.toFixed(2)}</td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-muted)' }}>$10,000</td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{tr.holding_days}d</td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: tr.pnl_dollar >= 0 ? '#10b981' : '#ef4444' }}>
                                        {tr.pnl_dollar >= 0 ? `+$${tr.pnl_dollar.toFixed(2)}` : `-$${Math.abs(tr.pnl_dollar).toFixed(2)}`}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: tr.pnl_pct >= 0 ? '#10b981' : '#ef4444' }}>
                                        {tr.pnl_pct >= 0 ? `+${tr.pnl_pct.toFixed(2)}%` : `${tr.pnl_pct.toFixed(2)}%`}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                        <span style={{
                                            background: tr.reason === 'Stop Loss' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                            color: tr.reason === 'Stop Loss' ? '#ef4444' : '#3b82f6',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600
                                        }}>
                                            {tr.reason}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Live Optimizer Execution Floating Modal */}
            {isOptimizing && (
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    width: '480px',
                    maxHeight: '280px',
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(234, 88, 12, 0.4)',
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
                        background: 'rgba(234, 88, 12, 0.15)',
                        borderBottom: '1px solid rgba(234, 88, 12, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Activity size={15} className="animate-spin" color="#f97316" />
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffedd5' }}>
                                Genetic Strategy Optimizer ({optStatus})
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
                        maxHeight: '220px'
                    }}>
                        {optLogs.map((log, i) => (
                            <div key={i} style={{ color: log.includes('complete') ? '#4ade80' : log.includes('failed') ? '#f87171' : '#fdba74' }}>
                                &gt; {log}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StrategyLab;

