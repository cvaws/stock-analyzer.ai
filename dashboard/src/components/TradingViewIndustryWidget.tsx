import React, { useEffect, useRef } from 'react';

interface TradingViewIndustryWidgetProps {
    symbols: string[]; // e.g., ["VAL", "NE", "HP"]
    height?: number | string;
}

const TradingViewIndustryWidget: React.FC<TradingViewIndustryWidgetProps> = ({ symbols, height = 400 }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Clear existing content
        containerRef.current.innerHTML = '';

        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-quotes.js';
        script.type = 'text/javascript';
        script.async = true;


        // Actually, Market Quotes widget uses a simpler "symbols" array sometimes or "symbols": [{"proName": "...", "title": "..."}]
        // Let's use the symbols format that works best for the 'market-quotes' widget
        const config = {
            "symbolsGroups": [
                {
                    "name": "Industry Members",
                    "originalName": "Indices",
                    "symbols": symbols.map(s => ({
                        "name": s,
                        "displayName": s
                    }))
                }
            ],
            "showSymbolLogo": true,
            "colorTheme": "dark",
            "isTransparent": true,
            "locale": "en",
            "width": "100%",
            "height": height,
            "symbolsColumns": [
                "name",
                "last",
                "change",
                "change_abs",
                "volume"
            ]
        };

        script.innerHTML = JSON.stringify(config);
        containerRef.current.appendChild(script);

        return () => {
            // Cleanup: remove the script and widget content
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    }, [symbols, height]);

    return (
        <div className="tradingview-widget-container" ref={containerRef} style={{ height: '100%', width: '100%' }}>
            <div className="tradingview-widget-container__widget"></div>
        </div>
    );
};

export default TradingViewIndustryWidget;
