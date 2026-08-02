import React, { useEffect, useRef } from 'react';

interface TradingViewChartProps {
    symbol: string;
    containerId?: string;
}

const TradingViewChart: React.FC<TradingViewChartProps> = ({ symbol, containerId = 'tv_chart_container' }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.innerHTML = '';
            const script = document.createElement('script');
            script.src = 'https://s3.tradingview.com/tv.js';
            script.async = true;
            script.onload = () => {
                if ((window as any).TradingView) {
                    new (window as any).TradingView.widget({
                        "width": "100%",
                        "height": "100%",
                        "symbol": symbol.includes(':') ? symbol : `NASDAQ:${symbol}`,
                        "interval": "D",
                        "timezone": "Etc/UTC",
                        "theme": "dark",
                        "style": "1",
                        "locale": "en",
                        "toolbar_bg": "#f1f3f6",
                        "enable_publishing": false,
                        "hide_side_toolbar": false,
                        "allow_symbol_change": true,
                        "container_id": containerId,
                        "studies": [
                            "MASimple@tv-basicstudies",
                            "EMA@tv-basicstudies"
                        ]
                    });
                }
            };
            containerRef.current.appendChild(script);
        }
    }, [symbol, containerId]);

    return (
        <div id={containerId} ref={containerRef} style={{ height: '100%', width: '100%' }} />
    );
};

export default TradingViewChart;
