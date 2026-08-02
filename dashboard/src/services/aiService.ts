import { GoogleGenerativeAI } from "@google/generative-ai";
import { OHLCV, analyzeVCP, VCPAnalysis, fetchQuarterlyFinancials, QuarterlyMetric } from "./dataService";

export interface PatternAnalysis {
    patternName: string;
    confidence: number;
    description: string;
    pivotPoint: number | null;
    stopLoss: number | null;
    targetPrice: number | null;
    setupQuality: "A+" | "A" | "B" | "C" | "Laggard";
    commentary: string;
    vcpStats?: VCPAnalysis;
}

export interface FactorScore {
    name: string;
    status: 'pos' | 'neu' | 'neg';
    reason: string;
}

export interface ResearchAnalysis {
    ticker?: string;
    industry: string;
    moat: string;
    themes: string[];
    researchPriorities: string[];
    summary: string;
    sector?: string;
    leadershipStatus?: 'Industry Apex' | 'Strong Challenger' | 'Niche Player' | 'Fragmented' | 'Laggard';
    marketShare?: string;
    competitiveRanking?: string;
    factors?: FactorScore[];
    verdict?: string;
    score?: string;
    strength?: string;
    valuation?: string;
    companyName?: string;
    caveat?: string;
    essentialBullets?: string[];
    truePeers?: string[];
}

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

const getSettings = () => {
    const provider = localStorage.getItem('ai_provider') || 'ollama';
    const geminiKey = localStorage.getItem('gemini_api_key') || '';
    const ollamaUrl = localStorage.getItem('ollama_url') || 'http://localhost:11434';
    const visionModel = localStorage.getItem('vision_model') || 'gemma4:26b';
    const researchModel = localStorage.getItem('research_model') || 'gemma4:26b';
    return { provider, geminiKey, ollamaUrl, visionModel, researchModel };
};

export async function analyzePattern(
    symbol: string,
    history: OHLCV[],
    chartImageBase64: string
): Promise<PatternAnalysis | null> {
    const settings = getSettings();
    const currentPrice = history.length > 0 ? history[history.length - 1].close : 0;
    const recentData = history.slice(-20).map(d => ({ d: d.date, c: d.close }));
    const high100 = history.length > 0 ? Math.max(...history.map(d => d.high)) : 0;
    const low100 = history.length > 0 ? Math.min(...history.map(d => d.low)) : 0;

    // Mathematical VCP Analysis
    const vcpMath = analyzeVCP(symbol, history);

    // Fetch Fundamentals
    const fundamentals = await fetchQuarterlyFinancials(symbol);
    const fundamentalPrompt = fundamentals.length > 0
        ? fundamentals.slice(0, 8).map((f: QuarterlyMetric) => `${f.date}: EPS ${f.eps} (${f.epsChgYr}), Sales ${f.revenue} (${f.salesChgYr})`).join('\n')
        : "No fundamental data available.";

    const prompt = `
        [ANALYST ROLE]
        Expert Market Technician. Logic-driven. Pixel-perfect vision analysis. Using gemma4:26b capabilities.

        [STEP 1: NUMERICAL ANCHORING]
        - SYMBOL: ${symbol}
        - TRUE CURRENT PRICE: $${currentPrice.toFixed(2)}
        - 100-DAY RANGE: $${low100.toFixed(2)} - $${high100.toFixed(2)}
        - RECENT CLOSING PRICES: ${JSON.stringify(recentData)}

        [STEP 1B: TECHNICAL MATH VERIFICATION]
        The following stats were calculated mathematically based on 1-year history:
        - VCP DETECTED: ${vcpMath.isVCP ? "YES" : "NO"}
        - CONTRACTIONS: ${vcpMath.description}
        - VOLUME DRY-UP: ${vcpMath.hasVDU ? "CONFIRMED" : "NOT DETECTED"}
        - STAGE 2 UPTREND: ${vcpMath.stage2 ? "CONFIRMED" : "WEAK/MISSING"}
        - CURRENT EMAs: 8: ${vcpMath.ema8?.toFixed(2) || '--'} | 21: ${vcpMath.ema21?.toFixed(2) || '--'} | 65: ${vcpMath.ema65?.toFixed(2) || '--'}
        - CURRENT SMAs: 50: ${vcpMath.sma50?.toFixed(2) || '--'} | 200: ${vcpMath.sma200?.toFixed(2) || '--'}
        - PRICE RELATION: Price is ${currentPrice > (vcpMath.sma200 || 0) ? "ABOVE" : "BELOW"} 200 SMA.

        [STEP 1C: FUNDAMENTAL TRENDS (Last 8 Quarters)]
        ${fundamentalPrompt}

        [STEP 2: VISUAL ANALYSIS]
        Examine the chart image. Identify geometric patterns (Cup with Handle, VCP, etc.).
        Verify visual alignment with the EMAs (8/21/65) and SMAs (50/200) provided above.
        Check if the stock is manifesting the "CANSLIM" characteristics (Strong EPS/Sales growth).

        [STEP 3: CALIBRATION RULES]
        1. THE PRICE IS $${currentPrice.toFixed(2)}. anchor all findings here.
        2. Pivot, Stop, Target MUST be within +/- 15% of $${currentPrice.toFixed(2)}.

        [OUTPUT FORMAT]
        Return JSON ONLY:
        {
            "patternName": string,
            "confidence": number,
            "description": string,
            "pivotPoint": number, 
            "stopLoss": number,
            "targetPrice": number,
            "setupQuality": "A+" | "A" | "B" | "C" | "Laggard",
            "commentary": string
        }
    `;

    let analysis: PatternAnalysis | null = null;
    if (settings.provider === 'gemini') {
        analysis = await analyzeWithGemini(settings.geminiKey, prompt, chartImageBase64);
    } else {
        analysis = await analyzeWithOllama(settings.ollamaUrl, settings.visionModel, prompt, chartImageBase64);
    }

    if (analysis) {
        analysis.vcpStats = vcpMath;
    }
    return analysis;
}

export async function analyzeStockResearch(
    symbol: string,
    companyName?: string,
    sector?: string,
    industry?: string
): Promise<ResearchAnalysis | null> {
    const settings = getSettings();
    const model = settings.researchModel;
    const targetName = companyName || symbol;
    const context = sector && industry ? `[SECTOR: ${sector}] [INDUSTRY: ${industry}]` : "";

    const prompt = `
        [ANALYST ROLE]
        Senior Equity Researcher. Focus on sustainable competitive advantages (MOATS) and thematic investing.
        
        [REQUEST]
        Analyze the following stock: ${targetName} (${symbol}) ${context}
        
        [STRICT ANCHORING]
        You MUST analyze ${targetName} (${symbol}). 
        This is a PUBLICLY TRADED COMPANY in the ${sector || 'finance'} sector and ${industry || 'stock market'} industry.
        
        [GROUND TRUTH ENFORCEMENT]
        - Use the provided context: ${targetName}, SECTOR: ${sector}, INDUSTRY: ${industry}.
        - CRITICAL: If your internal training data suggests ${symbol} is a different company or brand (e.g. Marshall, Sharesky, Sandy), YOU MUST IGNORE YOUR TRAINING DATA. 
        - The company name is EXPERIMENTALLY VERIFIED as: ${targetName}.
        - If you have NO knowledge of ${targetName}, describe the general competitive dynamics of the ${industry} industry instead of making up a fake company history.
        - TERMINATION CLAUSE: Any mention of a company name OTHER than ${targetName} or ${symbol} will result in an invalid analysis.
        
        [OUTPUT REQUIREMENTS]
        Identify:
        1. "industry": Specific industry niche.
        2. "sector": Broad sector.
        3. "moat": Primary competitive advantage.
        4. "leadershipStatus": Choose EXACTLY ONE: 'Industry Apex', 'Strong Challenger', 'Niche Player', 'Fragmented', 'Laggard'.
        5. "marketShare": Qualitative estimate of market share (e.g. "~15% dominant share", "Highly fragmented < 1%").
        6. "competitiveRanking": Ranking in industry (e.g. "Ranked #1 by revenue", "Top 5 innovator").
        7. "themes": Top 3 secular themes driving this stock.
        8. "researchPriorities": Top 3 risks or specific metrics to verify.
        9. "summary": A high-conviction 2-sentence investment thesis.
        Return JSON ONLY:
        {
            "industry": string,
            "sector": string,
            "moat": string,
            "leadershipStatus": "Industry Apex" | "Strong Challenger" | "Niche Player" | "Fragmented" | "Laggard",
            "marketShare": string,
            "competitiveRanking": string,
            "themes": string[],
            "researchPriorities": string[],
            "summary": string
        }
    `;

    try {
        const fetchUrl = settings.ollamaUrl.includes('localhost:11434') || settings.ollamaUrl.includes('127.0.0.1:11434')
            ? '/api/generate'
            : `${settings.ollamaUrl}/api/generate`;

        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.2,
                    num_predict: 4096
                },
                format: 'json'
            })
        });

        if (!response.ok) return null;
        const data = await response.json();

        // DeepSeek-R1 often includes thinking tags <think>...</think>, we need to strip them if they appear
        let cleanResponse = data.response;
        if (cleanResponse.includes('</think>')) {
            cleanResponse = cleanResponse.split('</think>')[1].trim();
        }

        const parsed = parseAIResponse(cleanResponse);
        const cleanParsed = parsed as any;
        if (cleanParsed) {
            cleanParsed.ticker = symbol;
        }
        return cleanParsed as unknown as ResearchAnalysis;
    } catch (e) {
        console.error("Error during AI research analysis:", e);
        return null;
    }
}

export async function chatWithResearchModel(
    messages: ChatMessage[]
): Promise<string | null> {
    const settings = getSettings();
    const model = settings.researchModel;

    try {
        const fetchUrl = settings.ollamaUrl.includes('localhost:11434') || settings.ollamaUrl.includes('127.0.0.1:11434')
            ? '/api/chat'
            : `${settings.ollamaUrl}/api/chat`;

        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                messages: messages,
                stream: false,
                options: {
                    temperature: 0.7, // Higher for conversational fluidity
                    num_predict: 4096
                }
            })
        });

        if (!response.ok) return null;
        const data = await response.json();

        let content = data.message?.content || "";

        // Strip <think> tags from DeepSeek-R1
        if (content.includes('</think>')) {
            content = content.split('</think>')[1].trim();
        }

        return content;
    } catch (e) {
        console.error("Error during AI research chat:", e);
        return null;
    }
}

async function analyzeWithGemini(apiKey: string, prompt: string, imageBase64: string): Promise<PatternAnalysis | null> {
    if (!apiKey) {
        console.error("Gemini API key not found.");
        return null;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        const imagePart = {
            inlineData: {
                data: imageBase64.split(",")[1],
                mimeType: "image/png",
            },
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        return parseAIResponse(text);
    } catch (error) {
        console.error("Error during Gemini pattern analysis:", error);
        return null;
    }
}

async function analyzeWithOllama(url: string, modelName: string, prompt: string, imageBase64: string): Promise<PatternAnalysis | null> {
    try {
        const fetchUrl = url.includes('localhost:11434') || url.includes('127.0.0.1:11434')
            ? '/api/generate'
            : `${url}/api/generate`;

        const isVisionModel = modelName.toLowerCase().includes('vision') ||
            modelName.toLowerCase().includes('vl') ||
            modelName.toLowerCase().includes('llava') ||
            modelName.toLowerCase().includes('minicpm');

        const requestBody: any = {
            model: modelName,
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.1, // Keep it deterministic
                num_predict: 4096
            },
            format: 'json'
        };

        if (isVisionModel && imageBase64) {
            requestBody.images = [imageBase64.split(",")[1]];
        }

        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama error(${response.status}): ${errorText || response.statusText}`);
        }

        const data = await response.json();
        if (!data.response) throw new Error("Empty response from Ollama");

        return parseAIResponse(data.response);
    } catch (error: any) {
        console.error("Error during Ollama pattern analysis:", error);
        throw error; // Throw so PatternDetector can show the message
    }
}

function parseAIResponse(text: string): any {
    try {
        // Find the first { and last } to extract JSON from chatty responses
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1) throw new Error("No JSON braces found");

        let jsonStr = text.substring(firstBrace, lastBrace + 1);
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Failed to parse AI response. Text:", text, "Error:", e);
        // Fallback to simple cleaning if substring fails
        try {
            const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(cleaned);
        } catch (e2) {
            return null;
        }
    }
}

export async function fetchLocalFundamentalAnalysis(symbol: string): Promise<ResearchAnalysis | null> {
    try {
        const response = await fetch(`/fundamental-analysis/${symbol.toUpperCase()}_analysis.html`);
        if (!response.ok) {
            throw new Error(`Local analysis file for ${symbol} not found.`);
        }
        const htmlText = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');

        // Find the ticker card
        const card = doc.querySelector('.ticker-card');
        if (!card) throw new Error("Could not parse ticker card from HTML");

        const summaryText = doc.querySelector('.summary-text')?.textContent?.trim() || "";
        const caveatsText = doc.querySelector('.caveats')?.textContent?.trim() || "";
        const companyName = doc.querySelector('.ticker-name')?.textContent?.trim() || "";
        const verdict = doc.querySelector('.verdict-badge')?.textContent?.trim() || "";

        // Extract chips
        const chips = Array.from(doc.querySelectorAll('.score-chip'));
        let sector = "Unknown";
        let industry = "Unknown";
        let valuation = "Unknown";
        let strength = "Unknown";
        let score = "Unknown";

        chips.forEach(chip => {
            const text = chip.textContent || "";
            if (text.includes("Sector")) {
                sector = chip.querySelector('span')?.textContent?.trim() || "Unknown";
            } else if (text.includes("Industry")) {
                industry = chip.querySelector('span')?.textContent?.trim() || "Unknown";
            } else if (text.includes("Valuation")) {
                valuation = chip.querySelector('span')?.textContent?.trim() || "Unknown";
            } else if (text.includes("Strength")) {
                strength = chip.querySelector('span')?.textContent?.trim() || "Unknown";
            } else if (text.includes("Score")) {
                score = chip.querySelector('span')?.textContent?.trim() || "Unknown";
            }
        });

        // Extract factors
        const factorsMap: { [key: string]: string } = {};
        const factorScores: FactorScore[] = [];
        const factorItems = doc.querySelectorAll('.factor-item');

        factorItems.forEach(item => {
            const label = item.querySelector('.fi-label')?.textContent?.trim() || "";
            const reason = item.querySelector('.fi-reason')?.textContent?.trim() || "";
            let status: 'pos' | 'neu' | 'neg' = 'neu';
            if (item.classList.contains('pos')) status = 'pos';
            else if (item.classList.contains('neg')) status = 'neg';

            if (label) {
                factorsMap[label] = reason;
                factorScores.push({ name: label, status, reason });
            }
        });

        // Map factors to ResearchAnalysis (Fallback)
        const moatFallback = factorsMap['No disruption risk'] || factorsMap['Valuation vs peers'] || "Assessed in HTML report";
        const leadershipFallback = factorsMap['Leadership stable'] || "Management stable";
        const marketShareFallback = factorsMap['Institutions increasing'] || "Institutional interest stable";
        const rankingFallback = factorsMap['Valuation vs peers'] || `Valued at ${valuation}`;

        const moat = doc.querySelector('.moat-val')?.textContent?.trim() || moatFallback;
        const leadership = doc.querySelector('.leadership-val')?.textContent?.trim() || leadershipFallback;
        const marketShare = doc.querySelector('.market-share-val')?.textContent?.trim() || marketShareFallback;
        const ranking = doc.querySelector('.comp-ranking-val')?.textContent?.trim() || rankingFallback;

        // Extract themes
        const themes: string[] = [];
        const themeTags = doc.querySelectorAll('.theme-tag');
        if (themeTags.length > 0) {
            themeTags.forEach(tag => {
                const text = tag.textContent?.trim();
                if (text) themes.push(text);
            });
        } else {
            factorItems.forEach(item => {
                if (item.classList.contains('pos')) {
                    const label = item.querySelector('.fi-label')?.textContent?.trim();
                    if (label && themes.length < 3) {
                        themes.push(label);
                    }
                }
            });
            if (themes.length === 0) themes.push("Value Divergence");
        }

        // Extract essential bullets
        const essentialBullets: string[] = [];
        const bulletEls = doc.querySelectorAll('.essential-bullets li');
        bulletEls.forEach(el => {
            const text = el.textContent?.trim();
            if (text) essentialBullets.push(text);
        });

        // Extract true peers list
        const truePeersText = doc.querySelector('.true-peers')?.textContent?.trim() || "";
        const truePeers = truePeersText ? truePeersText.split(',').map(s => s.trim()) : [];

        // Map leadership text to one of the allowed categories
        let leadershipStatus: 'Industry Apex' | 'Strong Challenger' | 'Niche Player' | 'Fragmented' | 'Laggard' = 'Niche Player';
        const leadershipLower = leadership.toLowerCase();
        if (leadershipLower.includes('apex') || leadershipLower.includes('leader') || leadershipLower.includes('dominant')) {
            leadershipStatus = 'Industry Apex';
        } else if (leadershipLower.includes('challenger') || leadershipLower.includes('strong')) {
            leadershipStatus = 'Strong Challenger';
        } else if (leadershipLower.includes('fragmented')) {
            leadershipStatus = 'Fragmented';
        } else if (leadershipLower.includes('laggard')) {
            leadershipStatus = 'Laggard';
        }

        return {
            ticker: symbol,
            industry,
            sector,
            moat,
            leadershipStatus,
            marketShare: marketShare.substring(0, 80),
            competitiveRanking: ranking.substring(0, 80),
            themes: themes,
            researchPriorities: caveatsText ? [caveatsText.replace(/^⚠\s*Watch:\s*/, "").substring(0, 100)] : ["Verify forward guidance", "Monitor industry trends"],
            summary: summaryText,
            factors: factorScores,
            verdict,
            score,
            strength,
            valuation,
            companyName,
            caveat: caveatsText,
            essentialBullets: essentialBullets.length > 0 ? essentialBullets : undefined,
            truePeers: truePeers.length > 0 ? truePeers : undefined
        };
    } catch (e) {
        console.error("Error fetching local fundamental analysis:", e);
        return null;
    }
}
