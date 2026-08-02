import React, { useState } from 'react';
import { QuarterlyMetric, AnnualMetric, TickerMetrics } from '../services/dataService';

interface FinancialTrendsWidgetProps {
    quarterly: QuarterlyMetric[];
    annuals: AnnualMetric[];
    metrics: TickerMetrics;
}

interface ChartDataPoint {
    label: string;
    value: number;
    isEstimate: boolean;
    displayValue: string;
}

const FinancialTrendsWidget: React.FC<FinancialTrendsWidgetProps> = ({ quarterly, annuals, metrics }) => {
    const [timeframe, setTimeframe] = useState<'Annual' | 'Quarterly'>('Quarterly');

    // Helper: Compute shares outstanding from net income and eps if available, else metrics fallback
    const getSharesForPeriod = (eps: number, netIncome: number): number => {
        if (eps && eps !== 0 && netIncome && netIncome !== 0) {
            return Math.abs(netIncome / eps);
        }
        return metrics.shares_out || 0;
    };

    // Prepare data based on active timeframe
    const getChartData = () => {
        if (timeframe === 'Quarterly') {
            const actuals = quarterly.filter(q => !q.isEstimate);
            const estimates = quarterly.filter(q => q.isEstimate);
            const displayedQuarters = [
                ...actuals.slice(-8),
                ...estimates.slice(0, 2)
            ];

            // Determine scaling for Sales
            const maxSales = Math.max(...displayedQuarters.map(q => q.revenue || 0), 1);
            const salesInBillions = maxSales >= 1e9;
            const salesUnit = salesInBillions ? 'bln' : 'mln';

            // Determine scaling for Shares
            const displayedShares = displayedQuarters.map(q => getSharesForPeriod(q.eps, q.netIncome));
            const maxShares = Math.max(...displayedShares, 1);
            const sharesInBillions = maxShares >= 1e9;
            const sharesUnit = sharesInBillions ? 'bln' : 'mln';

            const epsData: ChartDataPoint[] = displayedQuarters.map(q => ({
                label: q.date,
                value: q.eps || 0,
                isEstimate: !!q.isEstimate,
                displayValue: q.eps != null ? q.eps.toFixed(2) : '--'
            }));

            const salesData: ChartDataPoint[] = displayedQuarters.map(q => {
                const val = q.revenue || 0;
                const scaled = salesInBillions ? val / 1e9 : val / 1e6;
                return {
                    label: q.date,
                    value: scaled,
                    isEstimate: !!q.isEstimate,
                    displayValue: scaled > 0 ? scaled.toFixed(2) : '0'
                };
            });

            const sharesData: ChartDataPoint[] = displayedQuarters.map(q => {
                const val = getSharesForPeriod(q.eps, q.netIncome);
                const scaled = sharesInBillions ? val / 1e9 : val / 1e6;
                return {
                    label: q.date,
                    value: scaled,
                    isEstimate: !!q.isEstimate,
                    displayValue: scaled > 0 ? scaled.toFixed(2) : '--'
                };
            });

            return { epsData, salesData, sharesData, salesUnit, sharesUnit };
        } else {
            const actuals = annuals.filter(a => !a.isEstimate);
            const estimates = annuals.filter(a => a.isEstimate);
            const displayedYears = [
                ...actuals.slice(-8),
                ...estimates.slice(0, 2)
            ];

            // Determine scaling for Sales
            const maxSales = Math.max(...displayedYears.map(y => y.revenue || 0), 1);
            const salesInBillions = maxSales >= 1e9;
            const salesUnit = salesInBillions ? 'bln' : 'mln';

            // Determine scaling for Shares
            const displayedShares = displayedYears.map(y => getSharesForPeriod(y.eps, y.netIncome));
            const maxShares = Math.max(...displayedShares, 1);
            const sharesInBillions = maxShares >= 1e9;
            const sharesUnit = sharesInBillions ? 'bln' : 'mln';

            const epsData: ChartDataPoint[] = displayedYears.map(y => ({
                label: y.date,
                value: y.eps || 0,
                isEstimate: !!y.isEstimate,
                displayValue: y.eps != null ? y.eps.toFixed(2) : '--'
            }));

            const salesData: ChartDataPoint[] = displayedYears.map(y => {
                const val = y.revenue || 0;
                const scaled = salesInBillions ? val / 1e9 : val / 1e6;
                return {
                    label: y.date,
                    value: scaled,
                    isEstimate: !!y.isEstimate,
                    displayValue: scaled > 0 ? scaled.toFixed(2) : '0'
                };
            });

            const sharesData: ChartDataPoint[] = displayedYears.map(y => {
                const val = getSharesForPeriod(y.eps, y.netIncome);
                const scaled = sharesInBillions ? val / 1e9 : val / 1e6;
                return {
                    label: y.date,
                    value: scaled,
                    isEstimate: !!y.isEstimate,
                    displayValue: scaled > 0 ? scaled.toFixed(2) : '--'
                };
            });

            return { epsData, salesData, sharesData, salesUnit, sharesUnit };
        }
    };

    const { epsData, salesData, sharesData, salesUnit, sharesUnit } = getChartData();

    // Reusable Custom SVG Bar Chart Component
    const BarChart = ({
        title,
        data,
        baseColor,
        isEps = false
    }: {
        title: string;
        data: ChartDataPoint[];
        baseColor: string;
        isEps?: boolean;
    }) => {
        const height = 110;
        const width = 450;
        const padding = { top: 20, right: 10, bottom: 25, left: 10 };

        // Calculate scales
        const maxVal = Math.max(...data.map(d => d.value), 0.1);
        const minVal = isEps ? Math.min(...data.map(d => d.value), 0) : 0;
        const range = maxVal - minVal;

        const chartHeight = height - padding.top - padding.bottom;
        const chartWidth = width - padding.left - padding.right;

        // Zero line position ratio
        const zeroY = padding.top + chartHeight * (1 - (0 - minVal) / range);

        const barWidth = (chartWidth / data.length) * 0.7;
        const barSpacing = chartWidth / data.length;

        return (
            <div style={{ flex: 1, minWidth: '130px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', paddingLeft: '2px', letterSpacing: '0.02em' }}>
                    {title}
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid hsla(0,0%,100%,0.03)', borderRadius: '12px', padding: '0.2rem 0' }}>
                    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ overflow: 'visible' }}>
                        {/* Grid lines (dashed horizontal) */}
                        {[0.25, 0.5, 0.75, 1.0].map((ratio, index) => {
                            const y = padding.top + chartHeight * (1 - ratio);
                            return (
                                <line
                                    key={index}
                                    x1={padding.left}
                                    y1={y}
                                    x2={width - padding.right}
                                    y2={y}
                                    stroke="hsla(0,0%,100%,0.04)"
                                    strokeDasharray="2,2"
                                />
                            );
                        })}

                        {/* Bars */}
                        {data.map((d, index) => {
                            const x = padding.left + index * barSpacing + (barSpacing - barWidth) / 2;
                            const isNegative = d.value < 0;

                            // Calculate height and Y coordinate
                            let barHeight = 0;
                            let y = zeroY;

                            if (isNegative) {
                                barHeight = Math.abs(d.value / range) * chartHeight;
                                y = zeroY;
                            } else {
                                barHeight = (d.value / range) * chartHeight;
                                y = zeroY - barHeight;
                            }

                            // Safeguard minimal bar height for zero values so we see something
                            if (d.value === 0) {
                                barHeight = 1;
                                y = zeroY - 1;
                            }

                            // Color selection (Red for negative EPS, Blue/Base for positive)
                            const color = (isEps && isNegative) ? '#ef4444' : baseColor;

                            // Label vertical position
                            const labelY = isNegative ? y + barHeight + 9 : y - 4;

                            return (
                                <g key={index} style={{ transition: 'opacity 0.2s' }}>
                                    {/* Bar element */}
                                    <rect
                                        x={x}
                                        y={y}
                                        width={barWidth}
                                        height={barHeight}
                                        rx={2.5}
                                        fill={d.isEstimate ? 'rgba(255, 255, 255, 0.02)' : color}
                                        stroke={color}
                                        strokeWidth={d.isEstimate ? 1.5 : 0}
                                        strokeDasharray={d.isEstimate ? '3,2' : undefined}
                                        style={{ transition: 'all 0.2s' }}
                                    />
                                    {/* Bar value labels */}
                                    <text
                                        x={x + barWidth / 2}
                                        y={labelY}
                                        fill={d.isEstimate ? 'var(--text-muted)' : '#fff'}
                                        fontSize="9.5"
                                        fontWeight="600"
                                        textAnchor="middle"
                                    >
                                        {d.displayValue}
                                    </text>
                                    {/* Tick labels */}
                                    <text
                                        x={x + barWidth / 2}
                                        y={height - 4}
                                        fill="var(--text-muted)"
                                        fontSize="8"
                                        fontWeight="600"
                                        textAnchor="middle"
                                    >
                                        {d.label}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Baseline Zero axis */}
                        <line
                            x1={padding.left}
                            y1={zeroY}
                            x2={width - padding.right}
                            y2={zeroY}
                            stroke="hsla(0,0%,100%,0.15)"
                            strokeWidth={1}
                        />
                    </svg>
                </div>
            </div>
        );
    };

    return (
        <div style={{
            background: 'var(--bg-card)',
            borderRadius: '24px',
            border: '1px solid var(--border-color)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            width: '100%',
            boxSizing: 'border-box'
        }}>
            {/* Header & Switchers */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '4px', height: '16px', background: 'var(--accent-primary)', borderRadius: '2px' }} />
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Financial Trends</h3>
                </div>

                {/* Timeframe Switcher */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <button
                        onClick={() => setTimeframe('Annual')}
                        style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: timeframe === 'Annual' ? 'var(--accent-primary)' : 'transparent',
                            color: timeframe === 'Annual' ? '#fff' : 'var(--text-muted)',
                            border: 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        Annual
                    </button>
                    <button
                        onClick={() => setTimeframe('Quarterly')}
                        style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: timeframe === 'Quarterly' ? 'var(--accent-primary)' : 'transparent',
                            color: timeframe === 'Quarterly' ? '#fff' : 'var(--text-muted)',
                            border: 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        Quarterly
                    </button>
                </div>
            </div>

            {/* Active Charts Display (All 3 Together) */}
            <div style={{ display: 'flex', width: '100%', gap: '0.75rem' }}>
                <BarChart title="GAAP EPS" data={epsData} baseColor="#3b82f6" isEps={true} />
                <BarChart title={`Sales ($${salesUnit})`} data={salesData} baseColor="#a78bfa" />
                <BarChart title={`Shares (${sharesUnit})`} data={sharesData} baseColor="#14b8a6" />
            </div>
        </div>
    );
};

export default FinancialTrendsWidget;
