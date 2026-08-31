import React, { useEffect, useState, useMemo } from 'react';
import { Layers, Search, RefreshCw, ZoomIn, ZoomOut, Compass } from 'lucide-react';
import { fetchEtfTrackerData, ThemeStockData } from '../services/dataService';

type UniverseFilter = 'All' | 'Focus' | 'Sectors' | 'Thematic' | 'Canaries';

interface NodePosition {
    stock: ThemeStockData;
    cx: number;
    cy: number;
    historyPoints: { x: number; y: number; date: string; quadrant: string }[];
    color: string;
    isFocus: boolean;
}

const Quadrant: React.FC = () => {
    const [data, setData] = useState<ThemeStockData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [universe, setUniverse] = useState<UniverseFilter>('All');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
    const [trailLength, setTrailLength] = useState<number>(5); // 1, 3, 5 days
    const [showAllTails, setShowAllTails] = useState<boolean>(false);
    const [scaleMultiplier, setScaleMultiplier] = useState<number>(1.0);

    const loadData = async () => {
        setLoading(true);
        try {
            const etfs = await fetchEtfTrackerData();
            setData(etfs);
        } catch (e) {
            console.error('[Quadrant] Failed to load ETF data:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Filter by universe & search
    const filteredData = useMemo(() => {
        return data.filter(stock => {
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase();
                const matchSym = stock.symbol.toLowerCase().includes(q);
                const matchSec = (stock.sector || '').toLowerCase().includes(q);
                if (!matchSym && !matchSec) return false;
            }

            if (universe === 'Focus') {
                const price = stock.price || 0;
                const st = stock.supertrend || 0;
                const dir = stock.supertrendDirection === 1;
                const vel = (stock.rsWeeklyVelocity || 0) > 0;
                return price > st && dir && vel;
            }
            if (universe === 'Sectors') {
                return stock.sector === 'Breadth' || stock.sector === 'Leadership';
            }
            if (universe === 'Thematic') {
                return stock.sector === 'Leadership' || stock.sector === 'Leveraged_Long';
            }
            if (universe === 'Canaries') {
                return stock.sector === 'Canaries' || stock.sector === 'Defense';
            }
            return true;
        });
    }, [data, universe, searchTerm]);

    // Graph Dimensions & Scale - optimized wide-format
    const width = 1400;
    const height = 820;
    const padding = 55;

    // Helper to evaluate quadrant dynamically if string is missing/empty
    const getEffectiveQuadrant = (stock: ThemeStockData): string => {
        if (stock.rrgQuadrant && ['Leading', 'Improving', 'Weakening', 'Lagging'].includes(stock.rrgQuadrant)) {
            return stock.rrgQuadrant;
        }
        const rs = Number(stock.rsWeeklyPct) || 0;
        const vel = Number(stock.rsWeeklyVelocity) || 0;
        if (rs > 0) {
            return vel > 0 ? 'Leading' : 'Weakening';
        } else {
            return vel > 0 ? 'Improving' : 'Lagging';
        }
    };

    // Dynamically calculate coordinate bounds or use standard RRG bounds
    const bounds = useMemo(() => {
        let maxAbsX = 15;
        let maxAbsY = 12;

        filteredData.forEach(d => {
            const x = Math.abs(Number(d.rsWeeklyPct) || 0);
            const y = Math.abs(Number(d.rsWeeklyVelocity) || 0);
            if (x > maxAbsX) maxAbsX = Math.min(x, 40);
            if (y > maxAbsY) maxAbsY = Math.min(y, 30);
        });

        return {
            maxX: maxAbsX * (1 / scaleMultiplier),
            maxY: maxAbsY * (1 / scaleMultiplier)
        };
    }, [filteredData, scaleMultiplier]);

    // Map math coords (RS, Velocity) to SVG pixels
    const mapToSvg = (rsWeekly: number, rsVelocity: number) => {
        const innerW = width - padding * 2;
        const innerH = height - padding * 2;
        const centerX = padding + innerW / 2;
        const centerY = padding + innerH / 2;

        const cx = centerX + (rsWeekly / bounds.maxX) * (innerW / 2);
        // Invert Y because SVG y=0 is top
        const cy = centerY - (rsVelocity / bounds.maxY) * (innerH / 2);

        // Clamp inside canvas boundary
        const clampedX = Math.max(padding + 15, Math.min(width - padding - 15, cx));
        const clampedY = Math.max(padding + 15, Math.min(height - padding - 15, cy));

        return { cx: clampedX, cy: clampedY };
    };

    const getSectorColor = (sector: string, quadrant?: string): string => {
        if (quadrant === 'Leading') return '#10b981';
        if (quadrant === 'Improving') return '#06b6d4';
        if (quadrant === 'Weakening') return '#fbbf24';
        if (quadrant === 'Lagging') return '#f87171';

        switch (sector) {
            case 'Leadership': return '#38bdf8';
            case 'Breadth': return '#a855f7';
            case 'Canaries': return '#f59e0b';
            case 'Leveraged_Long': return '#10b981';
            case 'Defense': return '#ef4444';
            default: return '#94a3b8';
        }
    };

    // Calculate node coordinates and their historical tails
    const nodes: NodePosition[] = useMemo(() => {
        return filteredData.map(stock => {
            const rs = Number(stock.rsWeeklyPct) || 0;
            const vel = Number(stock.rsWeeklyVelocity) || 0;
            const { cx, cy } = mapToSvg(rs, vel);
            const quad = getEffectiveQuadrant(stock);

            const isFocus = (stock.price || 0) > (stock.supertrend || 0) && 
                            stock.supertrendDirection === 1 && 
                            (stock.rsWeeklyVelocity || 0) > 0;

            // Compute history trail
            let historyPoints: { x: number; y: number; date: string; quadrant: string }[] = [];
            if (stock.rrgHistory && stock.rrgHistory.length > 0) {
                const sliced = stock.rrgHistory.slice(-trailLength);
                historyPoints = sliced.map(pt => {
                    const pos = mapToSvg(pt.rsWeeklyPct, pt.rsWeeklyVelocity);
                    return { x: pos.cx, y: pos.cy, date: pt.date, quadrant: pt.quadrant };
                });
            } else {
                // Synthesize a linear 5-day velocity vector if no stored history array exists
                const points = [];
                for (let i = trailLength - 1; i >= 0; i--) {
                    const stepFactor = i / trailLength;
                    const prevRs = rs - (vel * 0.4 * stepFactor);
                    const prevVel = vel * (1 - (0.15 * stepFactor));
                    const pos = mapToSvg(prevRs, prevVel);
                    const histQuad = prevRs > 0 ? (prevVel > 0 ? 'Leading' : 'Weakening') : (prevVel > 0 ? 'Improving' : 'Lagging');
                    points.push({ x: pos.cx, y: pos.cy, date: `Day -${i}`, quadrant: histQuad });
                }
                historyPoints = points;
            }

            return {
                stock: { ...stock, rrgQuadrant: quad },
                cx,
                cy,
                historyPoints,
                color: getSectorColor(stock.sector, quad),
                isFocus
            };
        });
    }, [filteredData, bounds, trailLength]);

    const activeNode = useMemo(() => {
        const sym = selectedSymbol || hoveredSymbol;
        return sym ? nodes.find(n => n.stock.symbol === sym) : null;
    }, [selectedSymbol, hoveredSymbol, nodes]);

    // Quadrant summary stats & grouped items using effective quadrant fallback
    const { stats, quadrantGroups } = useMemo(() => {
        const groups: Record<string, ThemeStockData[]> = {
            Leading: [],
            Improving: [],
            Weakening: [],
            Lagging: []
        };

        filteredData.forEach(d => {
            const q = getEffectiveQuadrant(d);
            if (groups[q]) {
                groups[q].push(d);
            } else {
                groups.Lagging.push(d);
            }
        });

        // Sort items inside each quadrant by RS Weekly Velocity descending
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => (Number(b.rsWeeklyVelocity) || 0) - (Number(a.rsWeeklyVelocity) || 0));
        });

        const statsCount = {
            leading: groups.Leading.length,
            improving: groups.Improving.length,
            weakening: groups.Weakening.length,
            lagging: groups.Lagging.length,
            total: filteredData.length
        };

        return { stats: statsCount, quadrantGroups: groups };
    }, [filteredData]);

    const innerW = width - padding * 2;
    const innerH = height - padding * 2;
    const centerX = padding + innerW / 2;
    const centerY = padding + innerH / 2;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, minHeight: 'calc(100vh - 70px)' }}>
            {/* Header and Controls */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                background: 'var(--bg-card)',
                padding: '0.85rem 1.25rem',
                borderRadius: '14px',
                border: '1px solid var(--border-color)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                    }}>
                        <Compass size={16} color="white" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
                            Relative Rotation Graph (RRG)
                        </h1>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            RS vs SPY Benchmark (X) × RS Velocity (Y)
                        </span>
                    </div>
                </div>

                {/* Universe Filter Tabs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '3px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {(['All', 'Focus', 'Sectors', 'Thematic', 'Canaries'] as UniverseFilter[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setUniverse(tab)}
                            style={{
                                padding: '5px 11px',
                                borderRadius: '7px',
                                border: 'none',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                background: universe === tab ? 'var(--accent-primary)' : 'transparent',
                                color: universe === tab ? '#fff' : 'var(--text-muted)'
                            }}
                        >
                            {tab === 'Focus' ? '🎯 Focus Leaders' : tab}
                        </button>
                    ))}
                </div>

                {/* Search & Trail Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(255,255,255,0.04)',
                        padding: '5px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        width: '160px'
                    }}>
                        <Search size={13} color="var(--text-muted)" />
                        <input
                            type="text"
                            placeholder="Filter ticker..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '0.76rem', width: '100%', outline: 'none' }}
                        />
                    </div>

                    {/* Trail Length Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <span>Tail:</span>
                        {[1, 3, 5].map(d => (
                            <button
                                key={d}
                                onClick={() => setTrailLength(d)}
                                style={{
                                    padding: '2px 7px',
                                    borderRadius: '5px',
                                    border: '1px solid ' + (trailLength === d ? 'var(--accent-primary)' : 'rgba(255,255,255,0.08)'),
                                    background: trailLength === d ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                                    color: trailLength === d ? '#818cf8' : 'var(--text-muted)',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    fontSize: '0.7rem'
                                }}
                            >
                                {d}D
                            </button>
                        ))}
                    </div>

                    {/* Show All Tails Toggle */}
                    <button
                        onClick={() => setShowAllTails(!showAllTails)}
                        style={{
                            padding: '4px 10px',
                            borderRadius: '8px',
                            border: '1px solid ' + (showAllTails ? '#10b981' : 'rgba(255,255,255,0.08)'),
                            background: showAllTails ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                            color: showAllTails ? '#10b981' : 'var(--text-muted)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        {showAllTails ? '✓ All Tails' : 'Hover Tails'}
                    </button>

                    {/* Zoom / Scale Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <button
                            onClick={() => setScaleMultiplier(prev => Math.min(prev + 0.2, 2.5))}
                            title="Zoom in"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '4px 6px', color: 'var(--text-primary)', cursor: 'pointer' }}
                        >
                            <ZoomIn size={13} />
                        </button>
                        <button
                            onClick={() => setScaleMultiplier(prev => Math.max(prev - 0.2, 0.6))}
                            title="Zoom out"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '4px 6px', color: 'var(--text-primary)', cursor: 'pointer' }}
                        >
                            <ZoomOut size={13} />
                        </button>
                    </div>

                    <button
                        onClick={loadData}
                        title="Refresh data"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '4px 6px', color: 'var(--text-primary)', cursor: 'pointer' }}
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Main Content Layout: Interactive Canvas + Live Detail Inspector Panel */}
            <div style={{ display: 'flex', gap: '1rem', flex: 1, alignItems: 'stretch', minHeight: '620px' }}>
                
                {/* Quadrant Canvas Container - Expansive Full Width */}
                <div style={{
                    flex: '1 1 72%',
                    background: 'var(--bg-card)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    padding: '1.25rem',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minWidth: '550px'
                }}>
                    {/* SVG Quadrant Plot */}
                    <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg
                            viewBox={`0 0 ${width} ${height}`}
                            style={{ width: '100%', height: '100%', maxHeight: 'calc(100vh - 200px)', overflow: 'visible' }}
                            preserveAspectRatio="xMidYMid meet"
                        >
                        <defs>
                            {/* Quadrant Background Gradients */}
                            <linearGradient id="grad-leading" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.14" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                            </linearGradient>
                            <linearGradient id="grad-improving" x1="100%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.14" />
                                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02" />
                            </linearGradient>
                            <linearGradient id="grad-weakening" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.14" />
                                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
                            </linearGradient>
                            <linearGradient id="grad-lagging" x1="100%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.14" />
                                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
                            </linearGradient>

                            {/* Arrowhead marker for trajectory tails */}
                            <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                                <polygon points="0 0, 6 3, 0 6" fill="#38bdf8" />
                            </marker>
                        </defs>

                        {/* Quadrant 4 Colored Rectangles */}
                        {/* Top-Right: Leading */}
                        <rect
                            x={centerX}
                            y={padding}
                            width={innerW / 2}
                            height={innerH / 2}
                            fill="url(#grad-leading)"
                            rx={12}
                        />
                        {/* Top-Left: Improving */}
                        <rect
                            x={padding}
                            y={padding}
                            width={innerW / 2}
                            height={innerH / 2}
                            fill="url(#grad-improving)"
                            rx={12}
                        />
                        {/* Bottom-Right: Weakening */}
                        <rect
                            x={centerX}
                            y={centerY}
                            width={innerW / 2}
                            height={innerH / 2}
                            fill="url(#grad-weakening)"
                            rx={12}
                        />
                        {/* Bottom-Left: Lagging */}
                        <rect
                            x={padding}
                            y={centerY}
                            width={innerW / 2}
                            height={innerH / 2}
                            fill="url(#grad-lagging)"
                            rx={12}
                        />

                        {/* Axis Grid Lines */}
                        <line
                            x1={padding}
                            y1={centerY}
                            x2={width - padding}
                            y2={centerY}
                            stroke="rgba(255, 255, 255, 0.2)"
                            strokeWidth="1.5"
                            strokeDasharray="4 4"
                        />
                        <line
                            x1={centerX}
                            y1={padding}
                            x2={centerX}
                            y2={height - padding}
                            stroke="rgba(255, 255, 255, 0.2)"
                            strokeWidth="1.5"
                            strokeDasharray="4 4"
                        />

                        {/* Quadrant Title Watermarks */}
                        <text x={width - padding - 20} y={padding + 35} textAnchor="end" fill="#10b981" fontSize="14" fontWeight="900" letterSpacing="0.06em">
                            LEADING (RIDE / BUY)
                        </text>
                        <text x={padding + 20} y={padding + 35} textAnchor="start" fill="#06b6d4" fontSize="14" fontWeight="900" letterSpacing="0.06em">
                            IMPROVING (EARLY WATCH)
                        </text>
                        <text x={width - padding - 20} y={height - padding - 20} textAnchor="end" fill="#f59e0b" fontSize="14" fontWeight="900" letterSpacing="0.06em">
                            WEAKENING (TRIM / TIGHTEN)
                        </text>
                        <text x={padding + 20} y={height - padding - 20} textAnchor="start" fill="#ef4444" fontSize="14" fontWeight="900" letterSpacing="0.06em">
                            LAGGING (AVOID / OUTFLOW)
                        </text>

                        {/* Center Benchmark Label */}
                        <circle cx={centerX} cy={centerY} r={4.5} fill="#818cf8" />
                        <text x={centerX + 10} y={centerY - 10} fill="#818cf8" fontSize="11" fontWeight="700">
                            SPY Benchmark (0,0)
                        </text>

                        {/* Rotation Cycle Directional Arrows (Clockwise hint) */}
                        <path
                            d={`M ${centerX + 110} ${centerY - 90} Q ${centerX + 150} ${centerY - 50} ${centerX + 110} ${centerY - 15}`}
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.15)"
                            strokeWidth="1.5"
                            strokeDasharray="3 3"
                        />

                        {/* Render Trajectory Tails for nodes */}
                        {nodes.map(node => {
                            const isHovered = hoveredSymbol === node.stock.symbol || selectedSymbol === node.stock.symbol;
                            const shouldDrawTail = showAllTails || isHovered;

                            if (!shouldDrawTail || node.historyPoints.length < 2) return null;

                            const pathD = node.historyPoints.reduce((acc, pt, idx) => {
                                return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
                            }, '');

                            return (
                                <g key={`tail-${node.stock.symbol}`}>
                                    <path
                                        d={pathD}
                                        fill="none"
                                        stroke={isHovered ? '#38bdf8' : 'rgba(255, 255, 255, 0.28)'}
                                        strokeWidth={isHovered ? 3 : 1.4}
                                        strokeDasharray={isHovered ? 'none' : '3 3'}
                                    />
                                    {/* History waypoint dots */}
                                    {node.historyPoints.map((pt, i) => (
                                        <circle
                                            key={i}
                                            cx={pt.x}
                                            cy={pt.y}
                                            r={i === node.historyPoints.length - 1 ? 3.5 : 2}
                                            fill={isHovered ? '#38bdf8' : 'rgba(255, 255, 255, 0.45)'}
                                            opacity={0.3 + (i / node.historyPoints.length) * 0.7}
                                        />
                                    ))}
                                </g>
                            );
                        })}

                        {/* Render ETF Nodes */}
                        {nodes.map(node => {
                            const isHovered = hoveredSymbol === node.stock.symbol;
                            const isSelected = selectedSymbol === node.stock.symbol;
                            const active = isHovered || isSelected;

                            return (
                                <g
                                    key={node.stock.symbol}
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={() => setHoveredSymbol(node.stock.symbol)}
                                    onMouseLeave={() => setHoveredSymbol(null)}
                                    onClick={() => setSelectedSymbol(isSelected ? null : node.stock.symbol)}
                                >
                                    {/* Focus Leader Pulse Ring */}
                                    {node.isFocus && (
                                        <circle
                                            cx={node.cx}
                                            cy={node.cy}
                                            r={active ? 20 : 14}
                                            fill="none"
                                            stroke="#10b981"
                                            strokeWidth="1.5"
                                            opacity="0.7"
                                            strokeDasharray="2 2"
                                        />
                                    )}

                                    {/* Outer Node Halo */}
                                    <circle
                                        cx={node.cx}
                                        cy={node.cy}
                                        r={active ? 15 : 10}
                                        fill={node.color}
                                        fillOpacity={active ? 0.4 : 0.22}
                                        stroke={node.color}
                                        strokeWidth={active ? 2.5 : 1.5}
                                        style={{ transition: 'all 0.2s ease' }}
                                    />

                                    {/* Center Dot */}
                                    <circle
                                        cx={node.cx}
                                        cy={node.cy}
                                        r={active ? 5 : 3.5}
                                        fill={node.color}
                                    />

                                    {/* Ticker Symbol Text Label */}
                                    <text
                                        x={node.cx}
                                        y={node.cy - (active ? 18 : 13)}
                                        textAnchor="middle"
                                        fill={active ? '#fff' : 'var(--text-primary)'}
                                        fontSize={active ? '12' : '10'}
                                        fontWeight={active ? '900' : '700'}
                                        style={{
                                            textShadow: '0 2px 4px rgba(0,0,0,0.95)',
                                            pointerEvents: 'none'
                                        }}
                                    >
                                        {node.stock.symbol}
                                        {node.isFocus ? ' 🔥' : ''}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                    </div>

                    {/* Clockwise Rotation Hint Banner */}
                    <div style={{
                        marginTop: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '6px 12px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: '#06b6d4', fontWeight: 700 }}>1. Improving</span>
                            <span>➔</span>
                            <span style={{ color: '#10b981', fontWeight: 700 }}>2. Leading</span>
                            <span>➔</span>
                            <span style={{ color: '#f59e0b', fontWeight: 700 }}>3. Weakening</span>
                            <span>➔</span>
                            <span style={{ color: '#ef4444', fontWeight: 700 }}>4. Lagging</span>
                        </div>
                        <span style={{ fontSize: '0.7rem' }}>
                            Showing {nodes.length} ETFs across {stats.total} total
                        </span>
                    </div>
                </div>

                {/* Right Sidebar: Active Node Inspector & Quadrant Tally */}
                <div style={{
                    flex: '1 1 28%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    minWidth: '260px'
                }}>
                    {/* 🏆 High-Conviction Alpha Leaders Widget (S2 + ⚡⚡ + 🔥) */}
                    {(() => {
                        const alphaLeaders = filteredData.filter(stock => {
                            const isFocus = (stock.price || 0) > (stock.supertrend || 0) &&
                                            stock.supertrendDirection === 1 &&
                                            (stock.rsWeeklyVelocity || 0) > 0;
                            const isDualAcc = (stock.rsWeeklyVelocity || 0) > 0 && (stock.rsDailyVelocity || 0) > 0;
                            const isStage2 = !!stock.stage2Trend;
                            return isFocus && isDualAcc && isStage2;
                        }).sort((a, b) => (Number(b.rsWeeklyVelocity) || 0) - (Number(a.rsWeeklyVelocity) || 0));

                        if (alphaLeaders.length === 0) return null;

                        return (
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
                                padding: '0.85rem 1rem',
                                borderRadius: '14px',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.15)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.6rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '0.9rem' }}>🏆</span>
                                        <h3 style={{ fontSize: '0.82rem', fontWeight: 900, color: '#10b981', margin: 0, letterSpacing: '0.02em' }}>
                                            High-Conviction Alpha Leaders
                                        </h3>
                                    </div>
                                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#10b981', background: 'rgba(16, 185, 129, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                                        S2 • ⚡⚡ • 🔥
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {alphaLeaders.map(stock => {
                                        const isHovered = hoveredSymbol === stock.symbol;
                                        const isSelected = selectedSymbol === stock.symbol;
                                        const active = isHovered || isSelected;
                                        const vel = Number(stock.rsWeeklyVelocity) || 0;

                                        return (
                                            <div
                                                key={stock.symbol}
                                                onClick={() => setSelectedSymbol(isSelected ? null : stock.symbol)}
                                                onMouseEnter={() => setHoveredSymbol(stock.symbol)}
                                                onMouseLeave={() => setHoveredSymbol(null)}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                    background: active ? '#10b981' : 'rgba(16, 185, 129, 0.2)',
                                                    border: `1px solid ${active ? '#fff' : '#10b981'}`,
                                                    padding: '3px 8px',
                                                    borderRadius: '7px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease',
                                                    boxShadow: active ? '0 2px 10px rgba(16, 185, 129, 0.5)' : 'none'
                                                }}
                                            >
                                                <span style={{ fontWeight: 900, color: active ? '#000' : '#fff', fontSize: '0.74rem' }}>
                                                    {stock.symbol}
                                                </span>
                                                <span style={{ fontSize: '0.65rem' }}>🔥</span>
                                                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: active ? '#000' : '#34d399' }}>
                                                    +{vel.toFixed(1)}%
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Quadrant Distribution Cards with side-by-side Ticker Badges */}
                    <div style={{
                        background: 'var(--bg-card)',
                        padding: '1.1rem',
                        borderRadius: '14px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.85rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Layers size={14} color="var(--accent-primary)" /> Quadrant Breakdown
                            </h3>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {filteredData.length} hits
                            </span>
                        </div>
                        
                        {/* 4 Quadrant Groups with Side-by-Side Pill Badges */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {[
                                { key: 'Leading', label: 'Leading (Ride / Buy)', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.25)', badgeBg: 'rgba(16, 185, 129, 0.2)', tagColor: '#34d399' },
                                { key: 'Improving', label: 'Improving (Early Watch)', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)', border: 'rgba(6, 182, 212, 0.25)', badgeBg: 'rgba(6, 182, 212, 0.2)', tagColor: '#38bdf8' },
                                { key: 'Weakening', label: 'Weakening (Trim / Tighten)', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)', badgeBg: 'rgba(245, 158, 11, 0.2)', tagColor: '#fde68a' },
                                { key: 'Lagging', label: 'Lagging (Avoid / Outflow)', color: '#f87171', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.25)', badgeBg: 'rgba(239, 68, 68, 0.2)', tagColor: '#fca5a5' }
                            ].map(q => {
                                const list = quadrantGroups[q.key] || [];
                                return (
                                    <div key={q.key} style={{
                                        background: 'rgba(255,255,255,0.015)',
                                        border: `1px solid ${q.border}`,
                                        borderRadius: '10px',
                                        padding: '8px 10px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: q.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {q.label}
                                            </span>
                                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                                {list.length} hits
                                            </span>
                                        </div>

                                        {/* Tickers side-by-side flex wrap badges */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                            {list.length === 0 ? (
                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No tickers</span>
                                            ) : (
                                                list.map(stock => {
                                                    const isHovered = hoveredSymbol === stock.symbol;
                                                    const isSelected = selectedSymbol === stock.symbol;
                                                    const active = isHovered || isSelected;
                                                    const vel = Number(stock.rsWeeklyVelocity) || 0;
                                                    const velText = `${vel >= 0 ? '+' : ''}${vel.toFixed(1)}%`;

                                                    return (
                                                        <div
                                                            key={stock.symbol}
                                                            onClick={() => setSelectedSymbol(isSelected ? null : stock.symbol)}
                                                            onMouseEnter={() => setHoveredSymbol(stock.symbol)}
                                                            onMouseLeave={() => setHoveredSymbol(null)}
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                background: active ? q.color : 'rgba(30, 41, 59, 0.7)',
                                                                border: `1px solid ${active ? '#fff' : q.border}`,
                                                                padding: '2px 6px',
                                                                borderRadius: '6px',
                                                                fontSize: '0.7rem',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.15s ease',
                                                                boxShadow: active ? `0 2px 8px ${q.color}40` : 'none'
                                                            }}
                                                        >
                                                            <span style={{
                                                                fontWeight: 800,
                                                                color: active ? '#000' : '#fff'
                                                            }}>
                                                                {stock.symbol}
                                                            </span>
                                                            <span style={{
                                                                fontSize: '0.62rem',
                                                                fontWeight: 700,
                                                                color: active ? '#000' : q.tagColor,
                                                                opacity: active ? 0.95 : 1
                                                            }}>
                                                                {velText}
                                                            </span>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Active Selected Node Deep-Dive Card */}
                    <div style={{
                        background: 'var(--bg-card)',
                        padding: '1rem',
                        borderRadius: '14px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        flex: 1
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                                🔍 ETF Rotation Inspector
                            </h3>
                            {activeNode && (
                                <span style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '2px 7px',
                                    borderRadius: '5px',
                                    background: activeNode.color + '25',
                                    color: activeNode.color
                                }}>
                                    {activeNode.stock.rrgQuadrant || 'Leading'}
                                </span>
                            )}
                        </div>

                        {activeNode ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                                    <div>
                                        <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>
                                            {activeNode.stock.symbol}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '8px', textTransform: 'capitalize' }}>
                                            {activeNode.stock.sector.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                        ${(activeNode.stock.price || 0).toFixed(2)}
                                    </span>
                                </div>

                                {/* Focus Leader Flags */}
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                    {activeNode.isFocus && (
                                        <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '2px 7px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>
                                            🔥 Focus Leader
                                        </span>
                                    )}
                                    {activeNode.stock.stage2Trend && (
                                        <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '2px 7px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>
                                            S2 Uptrend
                                        </span>
                                    )}
                                    {activeNode.stock.hasVDU && (
                                        <span style={{ background: 'rgba(6, 182, 212, 0.2)', color: '#06b6d4', padding: '2px 7px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>
                                            VDU
                                        </span>
                                    )}
                                    {activeNode.stock.rsNewHigh250 && (
                                        <span style={{ background: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', padding: '2px 7px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>
                                            ★ RS High
                                        </span>
                                    )}
                                </div>

                                {/* Metric Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.74rem', marginTop: '2px' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '5px 8px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', display: 'block' }}>RS Weekly% (X)</span>
                                        <strong style={{ color: '#38bdf8' }}>{Number(activeNode.stock.rsWeeklyPct).toFixed(2)}%</strong>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '5px 8px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', display: 'block' }}>RS Velocity (Y)</span>
                                        <strong style={{ color: (activeNode.stock.rsWeeklyVelocity || 0) > 0 ? '#10b981' : '#ef4444' }}>
                                            {(activeNode.stock.rsWeeklyVelocity || 0) > 0 ? '+' : ''}{(activeNode.stock.rsWeeklyVelocity || 0).toFixed(2)}%
                                        </strong>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '5px 8px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', display: 'block' }}>Supertrend</span>
                                        <strong style={{ color: 'var(--text-primary)' }}>${(activeNode.stock.supertrend || 0).toFixed(2)}</strong>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '5px 8px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', display: 'block' }}>Base Extension</span>
                                        <strong style={{ color: (activeNode.stock.pctAboveLastBase || 0) > 10 ? '#ef4444' : '#10b981' }}>
                                            {(activeNode.stock.pctAboveLastBase || 0).toFixed(1)}%
                                        </strong>
                                    </div>
                                </div>

                                {/* Historical Motion Trail Coordinates */}
                                <div style={{ marginTop: '4px' }}>
                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '3px' }}>
                                        Trail Trajectory ({activeNode.historyPoints.length} points):
                                    </span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.68rem' }}>
                                        {activeNode.historyPoints.map((pt, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: i === activeNode.historyPoints.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                                <span>{pt.date}</span>
                                                <span style={{ color: pt.quadrant === 'Leading' ? '#10b981' : pt.quadrant === 'Improving' ? '#06b6d4' : pt.quadrant === 'Weakening' ? '#fbbf24' : '#f87171' }}>
                                                    {pt.quadrant}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 0.5rem', textAlign: 'center', color: 'var(--text-muted)', gap: '0.4rem' }}>
                                <Compass size={24} style={{ opacity: 0.4 }} />
                                <span style={{ fontSize: '0.74rem' }}>Hover or click any ETF node on the graph to inspect its relative strength coordinates and rotation history.</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Quadrant;
