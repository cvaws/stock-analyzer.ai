const SIDECAR_URL = (typeof window !== 'undefined' && (window as any).__SIDECAR_URL__) || '';

export const getApiUrl = (path: string): string => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (SIDECAR_URL) {
        // Map root data requests to FastAPI /api/data/ route when using sidecar
        if (cleanPath.startsWith('/etfs_tracker.json') || 
            cleanPath.startsWith('/market_regime.json') || 
            cleanPath.startsWith('/strategy_lab.json') || 
            cleanPath.startsWith('/theme_tracker.json') || 
            cleanPath.startsWith('/default_scan.csv')) {
            const fileName = cleanPath.split('?')[0].substring(1);
            return `${SIDECAR_URL}/api/data/${fileName}`;
        }
        return `${SIDECAR_URL}${cleanPath}`;
    }
    return cleanPath;
};

export interface RSStock {
    rank: number;
    ticker: string;
    sector: string;
    industry: string;
    exchange: string;
    rsScore: number;
    percentile: number;
    oneMonthAgo: number;
    threeMonthsAgo: number;
    sixMonthsAgo: number;
}

export interface RSIndustry {
    rank: number;
    industry: string;
    sector: string;
    rsScore: number;
    percentile: number;
    oneMonthAgo: number;
    threeMonthsAgo: number;
    sixMonthsAgo: number;
    tickers: string[];
}

// --- Live Data Types ---

export interface StockHeaderData {
    price: number;
    change: number;
    changePercent: number;
    marketCap: string;
    nextEarnings: string;
    companyName?: string;
}

export interface QuarterlyMetric {
    date: string;
    eps: number;
    revenue: number;
    netIncome: number;
    epsChgYr: string;
    salesChgYr: string;
    gm: string;
    roe: string;
    isEstimate?: boolean;
}

export interface AnnualMetric {
    date: string;
    eps: number;
    revenue: number;
    netIncome: number;
    epsChgYr?: string;
    salesChgYr?: string;
    isEstimate?: boolean;
}

export interface TickerMetrics {
    float_shares?: number;
    inst_pct?: number;
    insider_pct?: number;
    roe?: number;
    op_margin: number;
    shares_out: number;
    company_name?: string;
    sector?: string;
    industry?: string;
    insider_shares_purchased?: number;
}

export interface ComprehensiveFundamentals {
    quarterly: QuarterlyMetric[];
    annuals: AnnualMetric[];
    metrics: TickerMetrics;
}

export interface OHLCV {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    ema8?: number;
    ema21?: number;
    ema65?: number;
    sma50?: number;
    sma200?: number;
}

export interface VCPContraction {
    depth: number; // percentage drop
    width: number; // number of bars
    peakPrice: number;
    troughPrice: number;
}

export interface VCPAnalysis {
    symbol: string;
    isVCP: boolean;
    contractions: VCPContraction[];
    hasVDU: boolean; // Volume Dry Up
    stage2: boolean; // Stage 2 Uptrend confirmed
    currentPrice: number;
    description: string;
    ema8?: number;
    ema21?: number;
    ema65?: number;
    sma50?: number;
    sma200?: number;
}

// --- API Key Helpers ---

const getApiKey = (provider: 'fmp' | 'av' | 'polygon') => {
    switch (provider) {
        case 'fmp': return localStorage.getItem('fmp_api_key') || '';
        case 'av': return localStorage.getItem('av_api_key') || '';
        case 'polygon': return localStorage.getItem('polygon_api_key') || '';
        default: return '';
    }
};

// --- Caching Logic ---
const CACHE_VERSION = 'v9';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

interface CachedData<T> {
    data: T;
    timestamp: number;
}

function getFromCache<T>(key: string): T | null {
    const cached = localStorage.getItem(`cache_${CACHE_VERSION}_${key}`);
    if (!cached) return null;
    const entry: CachedData<T> = JSON.parse(cached);
    if (Date.now() - entry.timestamp > CACHE_DURATION) {
        localStorage.removeItem(`cache_${CACHE_VERSION}_${key}`);
        return null;
    }
    return entry.data;
}

function setToCache<T>(key: string, data: T) {
    const entry: CachedData<T> = { data, timestamp: Date.now() };
    localStorage.setItem(`cache_${CACHE_VERSION}_${key}`, JSON.stringify(entry));
}

// --- Multi-Source Data Fetching ---

export async function fetchStockHeaderData(symbol: string): Promise<StockHeaderData | null> {
    const cacheKey = `header_${symbol}`;
    const cached = getFromCache<StockHeaderData>(cacheKey);
    if (cached) return cached;

    // Try local data first
    try {
        const upperSymbol = symbol.toUpperCase().trim();
        const url = `/technical-data/${upperSymbol}.json?cb=${Date.now()}`;
        const response = await fetch(url);
        if (response.ok) {
            const stock = await response.json();
            if (stock && stock.history && stock.history.length > 0) {
                const last = stock.history[stock.history.length - 1];
                const prev = stock.history[stock.history.length - 2] || last;
                const change = last.close - prev.close;
                const changePercent = (change / prev.close) * 100;

                console.log(`[DataService] Found local header data for ${symbol}: Price=${last.close}`);

                return {
                    price: last.close,
                    change,
                    changePercent,
                    marketCap: formatMarketCap(stock.marketCap || 0),
                    nextEarnings: stock.metrics?.next_earnings_date || 'N/A'
                };
            }
        }
    } catch (e) {
        console.error(`[DataService] Error loading local header for ${symbol}:`, e);
    }

    const apiKey = getApiKey('fmp');
    if (!apiKey) return null;

    try {
        // Fetch Quote for Price, Change, Market Cap
        const response = await fetch(`https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${apiKey}`);
        const data = await response.json();
        if (!data || data.length === 0) return null;

        const q = data[0];

        // Fetch Earnings Calendar for next earnings date
        const earningsRes = await fetch(`https://financialmodelingprep.com/api/v3/earnings-calendar/${symbol}?apikey=${apiKey}`);
        const earningsData = await earningsRes.json();
        const nextEarnings = earningsData && earningsData.length > 0 ? earningsData[0].date : 'TBD';

        const result: StockHeaderData = {
            price: q.price,
            change: q.change,
            changePercent: q.changesPercentage,
            marketCap: formatMarketCap(q.marketCap),
            nextEarnings: nextEarnings,
            companyName: q.name
        };

        setToCache(cacheKey, result);
        return result;
    } catch (error) {
        console.error('Error fetching stock header data:', error);
        return null;
    }
}

export async function fetchQuarterlyFinancials(symbol: string): Promise<QuarterlyMetric[]> {
    const cacheKey = `quarterly_${symbol}`;
    const cached = getFromCache<QuarterlyMetric[]>(cacheKey);
    if (cached) return cached;

    // Try local download first
    try {
        const upperSymbol = symbol.toUpperCase().trim();
        const url = `/technical-data/${upperSymbol}.json?cb=${Date.now()}`;
        const response = await fetch(url);
        if (response.ok) {
            const stock = await response.json();
            if (stock && stock.fundamentals) {
                const raw = stock.fundamentals;
                const result: QuarterlyMetric[] = raw.map((r: any, i: number) => {
                    const prevYear = raw[i - 4]; // 4 quarters ago
                    const salesChgYr = (prevYear && prevYear.revenue > 0) ? calculatePercentChange(r.revenue, prevYear.revenue) : '+0%';
                    const epsChgYr = (prevYear && prevYear.eps !== 0) ? calculatePercentChange(r.eps, prevYear.eps) : '+0%';

                    return {
                        date: formatDateToQuarter(r.date),
                        eps: r.eps,
                        revenue: r.revenue,
                        netIncome: r.net_income,
                        epsChgYr,
                        salesChgYr,
                        gm: r.is_estimate ? 'EST' : 'Local',
                        roe: r.is_estimate ? 'EST' : 'Local',
                        isEstimate: !!r.is_estimate
                    };
                });
                setToCache(cacheKey, result);
                return result;
            }
        }
    } catch (e) {
        console.error(`[DataService] Error loading local fundamentals for ${symbol}:`, e);
    }

    const avKey = getApiKey('av');
    if (!avKey) return [];

    try {
        // Alpha Vantage INCOME_STATEMENT for EPS and Sales
        const response = await fetch(`https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol=${symbol}&apikey=${avKey}`);
        const data = await response.json();
        if (!data || !data.quarterlyReports) return [];

        const reports = data.quarterlyReports.slice(0, 8);

        // Fetch OVERVIEW for Return on Equity (Annualized summary)
        const overviewRes = await fetch(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${avKey}`);
        const overviewData = await overviewRes.json();
        const roeValue = overviewData.ReturnOnEquityTTM ? (parseFloat(overviewData.ReturnOnEquityTTM) * 100).toFixed(1) + '%' : '--';

        const result: QuarterlyMetric[] = reports.map((r: any, i: number) => {
            const currentSales = parseFloat(r.totalRevenue);
            const prevYearReport = reports[i + 4]; // Crude year-over-year
            const prevQuarterReport = reports[i + 1];

            const salesChgYr = prevYearReport ?
                calculatePercentChange(currentSales, parseFloat(prevYearReport.totalRevenue)) : '+0%';
            const salesQoQ = prevQuarterReport ?
                calculatePercentChange(currentSales, parseFloat(prevQuarterReport.totalRevenue)) : '+0%';

            const gm = ((parseFloat(r.grossProfit) / currentSales) * 100).toFixed(1) + '%';

            return {
                date: formatDateToQuarter(r.fiscalDateEnding),
                eps: parseFloat(r.netIncome) / 1000000, // Mocked EPS calc - needs actual shares outstanding
                epsChgYr: salesChgYr, // Using sales growth as fallback proxy for demo logic
                epsQoQ: salesQoQ,
                epsSurp: '+0%',
                sales: currentSales / 1000000,
                salesChgYr,
                salesQoQ,
                salesSurp: '+0%',
                gm,
                roe: roeValue
            };
        });

        setToCache(cacheKey, result);
        return result;
    } catch (error) {
        console.error('Error fetching quarterly financials:', error);
        return [];
    }
}

export async function fetchComprehensiveFundamentals(symbol: string): Promise<ComprehensiveFundamentals | null> {
    const cacheKey = `comp_fund_${symbol}`;
    const cached = getFromCache<ComprehensiveFundamentals>(cacheKey);
    if (cached) return cached;

    try {
        const upperSymbol = symbol.toUpperCase().trim();
        const url = `/technical-data/${upperSymbol}.json?cb=${Date.now()}`;
        const response = await fetch(url);
        if (response.ok) {
            const stock = await response.json();

            if (stock) {
                const quarterly: QuarterlyMetric[] = (stock.fundamentals || []).map((r: any, i: number) => {
                    const prevYear = stock.fundamentals[i - 4];
                    const salesChgYr = (prevYear && prevYear.revenue > 0) ? calculatePercentChange(r.revenue, prevYear.revenue) : '+0%';
                    const epsChgYr = (prevYear && prevYear.eps !== 0) ? calculatePercentChange(r.eps, prevYear.eps) : '+0%';

                    return {
                        date: formatDateToQuarter(r.date),
                        eps: r.eps,
                        revenue: r.revenue,
                        netIncome: r.net_income,
                        epsChgYr,
                        salesChgYr,
                        gm: r.is_estimate ? 'EST' : 'Local',
                        roe: r.is_estimate ? 'EST' : 'Local',
                        isEstimate: !!r.is_estimate
                    };
                });

                const annuals: AnnualMetric[] = (stock.annuals || []).map((r: any, i: number) => {
                    const prev = stock.annuals[i - 1];
                    const epsChgYr = prev ? calculatePercentChange(r.eps, prev.eps) : '--';
                    const salesChgYr = (prev && prev.revenue > 0) ? calculatePercentChange(r.revenue, prev.revenue) : '--';
                    return {
                        date: r.date.split('-')[0],
                        eps: r.eps,
                        revenue: r.revenue,
                        netIncome: r.net_income,
                        epsChgYr,
                        salesChgYr,
                        isEstimate: !!r.is_estimate
                    };
                });

                const metrics: TickerMetrics = {
                    float_shares: stock.metrics.float_shares,
                    inst_pct: stock.metrics.inst_pct,
                    insider_pct: stock.metrics.insider_pct,
                    roe: stock.metrics.roe,
                    op_margin: stock.metrics.op_margin,
                    shares_out: stock.metrics.shares_out,
                    company_name: stock.metrics.company_name,
                    sector: stock.metrics.sector,
                    industry: stock.metrics.industry
                };

                const result = {
                    quarterly,
                    annuals,
                    metrics: metrics
                };

                setToCache(cacheKey, result);
                return result;
            }
        }
    } catch (e) {
        console.error(`[DataService] Error loading comprehensive fundamentals for ${symbol}:`, e);
    }

    // --- Live Metadata Rescue Fallback (Yahoo Finance) ---
    try {
        console.log(`[DataService] Rescuing metadata for ${symbol} from Yahoo Finance...`);
        const res = await fetch(`/yf-api/v10/finance/quoteSummary/${symbol}?modules=assetProfile,price`);
        const data = await res.json();

        const summary = data.quoteSummary?.result?.[0];
        if (summary) {
            const profile = summary.assetProfile || {};
            const price = summary.price || {};

            const result: ComprehensiveFundamentals = {
                quarterly: [],
                annuals: [],
                metrics: {
                    company_name: price.longName || price.shortName || symbol,
                    sector: profile.sector || 'Unknown',
                    industry: profile.industry || 'Unknown',
                    op_margin: 0,
                    shares_out: price.averageDailyVolume10Day || 0
                }
            };
            setToCache(cacheKey, result);
            return result;
        }
    } catch (err) {
        console.error(`[DataService] Failed to rescue metadata for ${symbol} from Yahoo Finance:`, err);
    }

    return null;
}

export async function fetchHistoricalData(symbol: string): Promise<OHLCV[]> {
    const cacheKey = `historical_${symbol}`;
    try { sessionStorage.removeItem(`cache_${cacheKey}`); } catch (e) {}

    // Try local download first
    try {
        const upperSymbol = symbol.toUpperCase().trim();
        const response = await fetch(`/technical-data/${upperSymbol}.json?cb=${Date.now()}`);
        if (response.ok) {
            const stock = await response.json();
            if (stock) {
                const result = stock.history ? stock.history : stock; // Backward compatible
                setToCache(cacheKey, result);
                return result;
            }
        }
    } catch (e) {
        console.warn('Local historical data not found or error parsing:', e);
    }

    const avKey = getApiKey('av');
    if (!avKey) return [];

    try {
        const response = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${avKey}`);
        const data = await response.json();
        const timeSeries = data['Time Series (Daily)'];
        if (!timeSeries) return [];

        const result: OHLCV[] = Object.keys(timeSeries).slice(0, 100).map(date => ({
            date,
            open: parseFloat(timeSeries[date]['1. open']),
            high: parseFloat(timeSeries[date]['2. high']),
            low: parseFloat(timeSeries[date]['3. low']),
            close: parseFloat(timeSeries[date]['4. close']),
            volume: parseFloat(timeSeries[date]['5. volume'])
        })).reverse(); // Return in chronological order

        setToCache(cacheKey, result);
        return result;
    } catch (error) {
        console.error('Error fetching historical data:', error);
        return [];
    }
}

// --- Utils ---

function formatMarketCap(val: number): string {
    if (val >= 1e12) return (val / 1e12).toFixed(2) + 'T';
    if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
    if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
    return val.toString();
}

function calculatePercentChange(current: number, previous: number): string {
    if (!previous) return '+0%';
    const change = ((current - previous) / Math.abs(previous)) * 100;
    return (change >= 0 ? '+' : '') + change.toFixed(1) + '%';
}

function formatDateToQuarter(dateStr: string): string {
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]}-${d.getFullYear().toString().slice(-2)}`;
}

// --- Existing RS Data Mock/Fetch ---

let resolvedStocksUrl = 'https://raw.githubusercontent.com/Fred6725/rs-log/main/output/rs_stocks.csv';
let resolvedIndustriesUrl = 'https://raw.githubusercontent.com/Fred6725/rs-log/main/output/rs_industries.csv';
let urlsInitialized = false;

async function initUrls() {
    if (urlsInitialized) return;
    try {
        const res = await fetch('/api/config');
        if (res.ok) {
            const data = await res.json();
            if (data.rs_stocks_url) resolvedStocksUrl = data.rs_stocks_url;
            if (data.rs_industries_url) resolvedIndustriesUrl = data.rs_industries_url;
            urlsInitialized = true;
        }
    } catch (e) {
        console.warn('Failed to load dynamic urls from config', e);
    }
}

export async function fetchRSStocks(): Promise<RSStock[]> {
    try {
        await initUrls();
        const response = await fetch(resolvedStocksUrl);
        const text = await response.text();
        const lines = text.split('\n').filter(line => line.trim() !== '');

        return lines.slice(1).map(line => {
            const parts = parseCSVLine(line);
            return {
                rank: parseInt(parts[0]),
                ticker: parts[1],
                sector: parts[2],
                industry: parts[3],
                exchange: parts[4],
                rsScore: parseFloat(parts[5]),
                percentile: parseInt(parts[6]),
                oneMonthAgo: parseInt(parts[7]),
                threeMonthsAgo: parseInt(parts[8]),
                sixMonthsAgo: parseInt(parts[9])
            };
        });
    } catch (error) {
        console.error('Error fetching RS stocks:', error);
        return [];
    }
}

export async function fetchRSIndustries(): Promise<RSIndustry[]> {
    try {
        await initUrls();
        const response = await fetch(resolvedIndustriesUrl);
        const text = await response.text();
        const lines = text.split('\n').filter(line => line.trim() !== '');

        return lines.slice(1).map(line => {
            const parts = parseCSVLine(line);
            return {
                rank: parseInt(parts[0]),
                industry: parts[1],
                sector: parts[2],
                rsScore: parseFloat(parts[3]),
                percentile: parseInt(parts[4]),
                oneMonthAgo: parseInt(parts[5]),
                threeMonthsAgo: parseInt(parts[6]),
                sixMonthsAgo: parseInt(parts[7]),
                tickers: parts[8] ? parts[8].replace(/"/g, '').split(',').map(t => t.trim()) : []
            };
        });
    } catch (error) {
        console.error('Error fetching RS industries:', error);
        return [];
    }
}

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}
// --- VCP & Trend Analysis ---

export function analyzeVCP(symbol: string, history: OHLCV[]): VCPAnalysis {
    if (!history || history.length < 50) {
        return { symbol, isVCP: false, contractions: [], hasVDU: false, stage2: false, currentPrice: 0, description: "Insufficient data" };
    }

    const prices = history.map(d => d.close);
    const volumes = history.map(d => d.volume);
    const currentPrice = prices[prices.length - 1];

    // 1. Stage 2 Trend Check (Simplified for 100-day data)
    const sma50 = calculateSMA(prices, 50);
    const sma20 = calculateSMA(prices, 20);

    // Low and High of last 100 days
    const low100 = Math.min(...history.map(d => d.low));
    const high100 = Math.max(...history.map(d => d.high));

    const stage2 =
        currentPrice > sma50 &&
        sma20 > sma50 &&
        currentPrice > (low100 * 1.25) && // 25% above low
        currentPrice > (high100 * 0.75); // Within 25% of high

    // 2. Find Contractions (Looking for peaks and troughs)
    const contractions: VCPContraction[] = [];
    let searchIndex = Math.max(0, history.length - 80);

    // Simple peak finding: finding relative highs and subsequent lows
    while (searchIndex < history.length - 10) {
        // Find a peak (Local high in a 10-day window)
        let peakIdx = -1;
        let peakPrice = -1;

        for (let i = searchIndex; i < searchIndex + 20 && i < history.length; i++) {
            if (history[i].high > peakPrice) {
                peakPrice = history[i].high;
                peakIdx = i;
            }
        }

        if (peakIdx === -1) break;

        // Find subsequent trough
        let troughPrice = peakPrice;
        let troughIdx = peakIdx;
        for (let i = peakIdx; i < peakIdx + 30 && i < history.length; i++) {
            if (history[i].low < troughPrice) {
                troughPrice = history[i].low;
                troughIdx = i;
            }
        }

        const depth = ((peakPrice - troughPrice) / peakPrice) * 100;
        const width = troughIdx - peakIdx;

        if (depth > 2) { // Filter out noise
            contractions.push({ depth, width, peakPrice, troughPrice });
        }

        searchIndex = Math.max(searchIndex + 1, troughIdx);
        if (searchIndex >= history.length - 5) break;
    }

    // Filter contractions: Only keep those that are sequential and tightening
    const validContractions: VCPContraction[] = [];
    if (contractions.length > 0) {
        validContractions.push(contractions[0]);
        for (let i = 1; i < contractions.length; i++) {
            if (contractions[i].depth <= validContractions[validContractions.length - 1].depth) {
                validContractions.push(contractions[i]);
            }
        }
    }

    // 3. Volume Dry Up (VDU)
    const avgVol50 = calculateSMA(volumes, 50);
    const recentVolAvg = calculateSMA(volumes.slice(-5), 5);
    const hasVDU = recentVolAvg < (avgVol50 * 0.7); // Volume is 30% below average

    const isVCP = validContractions.length >= 2 && stage2;

    let description = isVCP
        ? `${validContractions.length} Contractions detected (${validContractions.map(c => Math.round(c.depth) + '%').join(' → ')}).`
        : "No clear tightening pattern detected.";

    if (hasVDU) description += " Volume dry-up confirmed.";
    if (!stage2) description += " Missing strong Stage 2 uptrend.";

    const latest = history[history.length - 1];

    return {
        symbol,
        isVCP,
        contractions: validContractions,
        hasVDU,
        stage2,
        currentPrice,
        description,
        ema8: latest.ema8,
        ema21: latest.ema21,
        ema65: latest.ema65,
        sma50: latest.sma50,
        sma200: latest.sma200
    };
}

function calculateSMA(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1];
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

export interface EtfHolding {
    symbol: string;
    name: string;
    holdingPercent: number;
}

export interface RrgHistoryPoint {
    date: string;
    rsWeeklyPct: number;
    rsWeeklyVelocity: number;
    quadrant: string;
}

export interface ThemeStockData {
    symbol: string;
    companyName: string;
    price: number;
    dailyChangePct?: number;
    changeW?: number;
    changeM?: number;
    subIndustry: string;
    sector: string;
    rsPercentile: number | string;
    rsScore: number | string;
    rsDailyPct: number | string;
    rsWeeklyPct: number | string;
    rsDailyVelocity?: number;
    rsWeeklyVelocity?: number;
    rrgQuadrant?: string;
    rrgHistory?: RrgHistoryPoint[];
    rsRating?: number | string;
    supertrend?: number;
    supertrendDirection?: number;
    stage2Trend?: boolean;
    hasVDU?: boolean;
    rsNewHigh250?: boolean;
    volRatio?: number;
    pctAboveLastBase?: number;
    pctOff52WkHigh?: number;

    return5D?: number;
    return10D?: number;
    return1M?: number;
    return3M?: number;
    holdings?: EtfHolding[];
}

export async function fetchThemeTrackerData(): Promise<ThemeStockData[]> {
    try {
        const res = await fetch(getApiUrl('/theme_tracker.json'));
        if (res.ok) {
            return await res.json();
        }
        return [];
    } catch (e) {
        console.error('[ThemeTracker] Error fetching theme tracker data:', e);
        return [];
    }
}

export async function fetchEtfTrackerData(): Promise<ThemeStockData[]> {
    try {
        const res = await fetch(getApiUrl(`/etfs_tracker.json?t=${Date.now()}`));
        if (res.ok) {
            return await res.json();
        }
        return [];
    } catch (e) {
        console.error('[ThemeTracker] Error fetching ETF tracker data:', e);
        return [];
    }
}

export async function fetchMarketRegimeData(): Promise<any> {
    try {
        const res = await fetch(getApiUrl(`/market_regime.json?t=${Date.now()}`));
        if (res.ok) {
            return await res.json();
        }
        return null;
    } catch (e) {
        console.error('[MarketRegime] Error fetching market regime data:', e);
        return null;
    }
}

export interface RuleDefinition {
    id: string;
    name: string;
    category: string;
    value_type: string;
    default_op: string;
    default_val: any;
}

export interface ProfitTakingStep {
    profit_target_pct?: number;
    position_trim_pct?: number;
}

export interface SavedStrategy {
    name: string;
    universe?: string;
    tickers?: string[];
    entry_combination?: string;
    entry_rules?: any[];
    exit_combination?: string;
    exit_rules?: any[];
    risk_management?: {
        stop_loss_pct?: number;
    };
    profit_taking?: ProfitTakingStep[];
}

export interface StrategyLabData {
    available_rules: RuleDefinition[];
    categories: string[];
    saved_strategies?: SavedStrategy[];
    all_strategy_results?: Record<string, Record<string, any>>;
    backtest_results: Record<string, any>;
}



export async function fetchStrategyLabData(): Promise<StrategyLabData | null> {
    try {
        const res = await fetch(getApiUrl('/strategy_lab.json'));
        if (res.ok) {
            return await res.json();
        }
        return null;
    } catch (e) {
        console.error('[StrategyLab] Error fetching strategy lab data:', e);
        return null;
    }
}

export async function fetchPresetStrategies(): Promise<SavedStrategy[]> {
    try {
        const data = await fetchStrategyLabData();
        if (data && data.saved_strategies && data.saved_strategies.length > 0) {
            return data.saved_strategies;
        }
        const res = await fetch(getApiUrl(`/data/inputs/strategies.json?cb=${Date.now()}`));
        if (res.ok) {
            return await res.json();
        }
        return [];
    } catch (e) {
        console.error('[StrategyLab] Error fetching preset strategies:', e);
        return [];
    }
}



export async function triggerBacktestRun(): Promise<boolean> {
    try {
        const res = await fetch(getApiUrl('/api/run-backtest'), { method: 'POST' });
        return res.ok;
    } catch (e) {
        console.error('[StrategyLab] Error triggering backtest run:', e);
        return false;
    }
}





