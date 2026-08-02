import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts';
import { OHLCV } from '../services/dataService';

interface UniversalChartProps {
    symbol: string;
    data: OHLCV[];
    containerId?: string;
}

const UniversalChart: React.FC<UniversalChartProps> = ({ symbol, data, containerId = 'universal_chart' }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any>(null);
    const [visibleIndicators, setVisibleIndicators] = React.useState<Set<string>>(
        new Set(['EMA 8', 'EMA 21', 'SMA 50', 'Volume', 'Mansfield RS'])
    );

    const toggleIndicator = (name: string) => {
        const next = new Set(visibleIndicators);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        setVisibleIndicators(next);
    };

    // EMA Calculation helper
    const calculateEMA = (values: number[], period: number) => {
        if (!values || values.length === 0) return [];
        const k = 2 / (period + 1);
        let emaData = [];
        let ema = values[0];
        emaData.push(ema);
        for (let i = 1; i < values.length; i++) {
            ema = values[i] * k + ema * (1 - k);
            emaData.push(ema);
        }
        return emaData;
    };

    // SMA Calculation helper
    const calculateSMA = (values: number[], period: number) => {
        if (!values || values.length === 0) return [];
        let smaData = [];
        for (let i = 0; i < values.length; i++) {
            if (i < period - 1) {
                smaData.push(null);
                continue;
            }
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += values[i - j];
            }
            smaData.push(sum / period);
        }
        return smaData;
    };

    useEffect(() => {
        if (!chartContainerRef.current || data.length === 0) {
            return;
        }

        try {
            const initialWidth = chartContainerRef.current.clientWidth || 800;
            const initialHeight = chartContainerRef.current.clientHeight || 550;

            const chart = createChart(chartContainerRef.current, {
                layout: {
                    background: { type: ColorType.Solid, color: '#131722' },
                    textColor: '#d1d4dc',
                },
                grid: {
                    vertLines: { color: 'rgba(42, 46, 57, 0.4)' },
                    horzLines: { color: 'rgba(42, 46, 57, 0.4)' },
                },
                width: initialWidth,
                height: initialHeight,
                timeScale: {
                    borderColor: 'rgba(42, 46, 57, 0.8)',
                    timeVisible: true,
                    rightOffset: 30,
                    barSpacing: 9,
                },
            });

            // Adjust Price Scale Margins for Main Price Scale
            chart.priceScale('right').applyOptions({
                scaleMargins: { top: 0.05, bottom: 0.38 }
            });

            // Lightweight Charts v5.1.0 Candlesticks Series
            const candlestickSeries = chart.addSeries(CandlestickSeries, {
                upColor: '#26a69a',
                downColor: '#ef5350',
                borderVisible: false,
                wickUpColor: '#26a69a',
                wickDownColor: '#ef5350',
            });

            const sortedData = [...data]
                .map(d => ({
                    ...d,
                    cleanDate: String(d.date || '').split('T')[0]
                }))
                .filter(d => Boolean(d.cleanDate))
                .sort((a, b) => a.cleanDate.localeCompare(b.cleanDate))
                .filter((v, i, a) => i === 0 || v.cleanDate !== a[i - 1].cleanDate);

            const formattedData = sortedData.map(d => ({
                time: d.cleanDate,
                open: Number(d.open ?? (d as any).Open ?? 0),
                high: Number(d.high ?? (d as any).High ?? 0),
                low: Number(d.low ?? (d as any).Low ?? 0),
                close: Number(d.close ?? (d as any).Close ?? 0),
            }));

            candlestickSeries.setData(formattedData);

            if (formattedData.length > 0) {
                chart.timeScale().setVisibleLogicalRange({
                    from: Math.max(0, formattedData.length - 120),
                    to: formattedData.length + 30,
                });
            }

            const closes = sortedData.map(d => Number(d.close ?? (d as any).Close ?? 0));
            const dates = sortedData.map(d => d.cleanDate);

            // Line Indicators (8 EMA, 21 EMA, 50 SMA)
            const addLine = (points: (number | null)[], color: string, width: number, label: string) => {
                if (!visibleIndicators.has(label)) return;

                const lineSeries = chart.addSeries(LineSeries, {
                    color: color,
                    lineWidth: width as any,
                    lastValueVisible: false,
                    priceLineVisible: false,
                    crosshairMarkerVisible: false,
                });
                const lineData = points.map((p, i) => {
                    if (p === null || p === undefined || isNaN(p)) return null;
                    return { time: dates[i], value: p };
                }).filter(p => p !== null) as { time: string, value: number }[];

                if (lineData.length > 0) {
                    lineSeries.setData(lineData);
                }
            };

            const ema8 = calculateEMA(closes, 8);
            const ema21 = calculateEMA(closes, 21);
            const sma50 = calculateSMA(closes, 50);

            if (ema8.length > 0) addLine(ema8, '#3b82f6', 2, 'EMA 8');
            if (ema21.length > 0) addLine(ema21, '#fbbf24', 2, 'EMA 21');
            if (sma50.length > 0) addLine(sma50, '#a855f7', 2, 'SMA 50');

            // Volume Indicator Histogram Subpane
            if (visibleIndicators.has('Volume')) {
                const volumeSeries = chart.addSeries(HistogramSeries, {
                    priceScaleId: 'volume',
                    priceFormat: { type: 'volume' },
                });
                const volumeData = sortedData.map(d => ({
                    time: d.cleanDate,
                    value: Number(d.volume ?? (d as any).Volume ?? 0),
                    color: (Number(d.close) >= Number(d.open)) ? 'rgba(38, 166, 154, 0.4)' : 'rgba(239, 83, 80, 0.4)'
                }));
                volumeSeries.setData(volumeData);

                chart.priceScale('volume').applyOptions({
                    scaleMargins: { top: 0.62, bottom: 0.20 }
                });
            }

            // Mansfield RS Indicator Subpane (Pine Script RS.pine Parity)
            if (visibleIndicators.has('Mansfield RS')) {
                // Configure Left Price Scale dedicated for Mansfield RS subpane (bottom 18% height)
                chart.priceScale('left').applyOptions({
                    scaleMargins: { top: 0.80, bottom: 0.02 },
                    visible: true,
                    borderColor: 'rgba(42, 46, 57, 0.8)',
                });

                // Zero Baseline
                const mrsBaseline = chart.addSeries(LineSeries, {
                    priceScaleId: 'left',
                    color: 'rgba(255, 255, 255, 0.3)',
                    lineWidth: 1,
                    lineStyle: 2,
                    lastValueVisible: false,
                    priceLineVisible: false,
                });
                mrsBaseline.setData(dates.map(d => ({ time: d, value: 0 })));

                // Mansfield RS Histogram Columns (plot.style_columns in RS.pine)
                const mrsSeries = chart.addSeries(HistogramSeries, {
                    priceScaleId: 'left',
                    priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
                });

                const mrsData = sortedData.map((d, i) => {
                    const val = (d as any).mrs_daily_index !== undefined ? Number((d as any).mrs_daily_index) : 0;
                    const e8 = ema8[i];
                    const e21 = ema21[i];
                    const maBull = (e8 !== null && e21 !== null) ? e8 > e21 : true;
                    
                    // Pine Script RS.pine Line 161-167:
                    // is_warning = mrs_index >= 0 ? !maBull : maBull
                    const isWarning = val >= 0 ? !maBull : maBull;

                    let barColor = '#3b82f6'; // Bright Blue (Positive in RS.pine)
                    if (isWarning) {
                        barColor = '#eab308'; // Warning Yellow (Trend Divergence)
                    } else if (val < 0) {
                        barColor = '#ec4899'; // Bright Pink (Negative in RS.pine)
                    }

                    return {
                        time: d.cleanDate,
                        value: val,
                        color: barColor
                    };
                });

                mrsSeries.setData(mrsData);
            }

            chartRef.current = chart;

            const resizeObserver = new ResizeObserver((entries) => {
                if (chartRef.current && entries[0] && entries[0].contentRect) {
                    const { width, height } = entries[0].contentRect;
                    if (width > 0 && height > 0) {
                        chartRef.current.applyOptions({ width, height });
                    }
                }
            });

            if (chartContainerRef.current) {
                resizeObserver.observe(chartContainerRef.current);
            }

            return () => {
                resizeObserver.disconnect();
                chart.remove();
            };
        } catch (err) {
            console.error("CRITICAL CHART ERROR:", err);
        }
    }, [data, symbol, visibleIndicators]);

    const IndicatorToggle = ({ name, color }: { name: string, color: string }) => (
        <div
            onClick={() => toggleIndicator(name)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                opacity: visibleIndicators.has(name) ? 1 : 0.4,
                transition: 'opacity 0.2s',
                userSelect: 'none'
            }}
        >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#d1d4dc' }}>{name}</span>
        </div>
    );

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, overflow: 'hidden' }}>
            <div ref={chartContainerRef} style={{ width: '100%', height: '100%', minHeight: 0 }} id={containerId} />

            {(!data || data.length === 0) && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    fontSize: '0.9rem',
                    background: '#131722',
                    zIndex: 5
                }}>
                    Loading technical chart data for {symbol}...
                </div>
            )}

            {/* Legend & Controls Overlay */}
            <div style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                zIndex: 10,
                background: 'rgba(19, 23, 34, 0.85)',
                backdropFilter: 'blur(6px)',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                pointerEvents: 'auto'
            }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff', marginBottom: '2px' }}>
                    {symbol} (Daily Chart)
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', maxWidth: '400px' }}>
                    <IndicatorToggle name="EMA 8" color="#3b82f6" />
                    <IndicatorToggle name="EMA 21" color="#fbbf24" />
                    <IndicatorToggle name="SMA 50" color="#a855f7" />
                    <IndicatorToggle name="Volume" color="#26a69a" />
                    <IndicatorToggle name="Mansfield RS" color="#06b6d4" />
                </div>
            </div>
        </div>
    );
};

export default UniversalChart;
