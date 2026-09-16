import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const Settings: React.FC = () => {
    const { theme, setTheme } = useTheme();
    const [apiKeyFMP, setApiKeyFMP] = React.useState(localStorage.getItem('fmp_api_key') || '');
    const [apiKeyAV, setApiKeyAV] = React.useState(localStorage.getItem('av_api_key') || '');
    const [apiKeyPoly, setApiKeyPoly] = React.useState(localStorage.getItem('polygon_api_key') || '');
    const [apiKeyGemini, setApiKeyGemini] = React.useState(localStorage.getItem('gemini_api_key') || '');
    const [aiProvider, setAiProvider] = React.useState(localStorage.getItem('ai_provider') || 'ollama');
    const [ollamaUrl, setOllamaUrl] = React.useState(localStorage.getItem('ollama_url') || 'http://localhost:11434');
    const [visionModel, setVisionModel] = React.useState(() => {
        const stored = localStorage.getItem('vision_model');
        return (stored && stored !== 'llama3.2-vision:latest' && stored !== 'gemma4:latest') ? stored : 'gemma4:26b';
    });
    const [researchModel, setResearchModel] = React.useState(() => {
        const stored = localStorage.getItem('research_model');
        return (stored && stored !== 'deepseek-r1:32b' && stored !== 'deepseek-r1:latest' && stored !== 'gemma4:latest') ? stored : 'gemma4:26b';
    });

    React.useEffect(() => {
        localStorage.setItem('fmp_api_key', apiKeyFMP);
    }, [apiKeyFMP]);

    React.useEffect(() => {
        localStorage.setItem('av_api_key', apiKeyAV);
    }, [apiKeyAV]);

    React.useEffect(() => {
        localStorage.setItem('polygon_api_key', apiKeyPoly);
    }, [apiKeyPoly]);

    React.useEffect(() => {
        localStorage.setItem('gemini_api_key', apiKeyGemini);
    }, [apiKeyGemini]);

    React.useEffect(() => {
        localStorage.setItem('ai_provider', aiProvider);
    }, [aiProvider]);

    React.useEffect(() => {
        localStorage.setItem('ollama_url', ollamaUrl);
    }, [ollamaUrl]);

    React.useEffect(() => {
        localStorage.setItem('vision_model', visionModel);
    }, [visionModel]);

    React.useEffect(() => {
        localStorage.setItem('research_model', researchModel);
    }, [researchModel]);

    const [customDataDir, setCustomDataDirState] = React.useState<string>('');

    React.useEffect(() => {
        if (typeof window !== 'undefined' && (window as any).desktopEnv?.getCustomDataDir) {
            (window as any).desktopEnv.getCustomDataDir().then((dir: string) => {
                if (dir) setCustomDataDirState(dir);
            });
        }
    }, []);

    const handleSelectCustomFolder = async () => {
        if (typeof window !== 'undefined' && (window as any).desktopEnv?.selectFolder) {
            const selected = await (window as any).desktopEnv.selectFolder();
            if (selected) {
                setCustomDataDirState(selected);
                await (window as any).desktopEnv.setCustomDataDir(selected);
            }
        }
    };


    const themeOptions = [
        { id: 'light', label: 'Light', icon: <Sun size={20} /> },
        { id: 'dark', label: 'Dark', icon: <Moon size={20} /> },
        { id: 'system', label: 'System', icon: <Monitor size={20} /> },
    ];

    const ApiKeyInput = ({ label, value, onChange, placeholder, type = "password" }: { label: string; value: string; onChange: (v: string) => void; placeholder: string, type?: string }) => (
        <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
            </label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '0.8rem 1rem',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
            />
        </div>
    );

    return (
        <div style={{ padding: '1rem' }}>
            <header style={{ marginBottom: '2.5rem' }}>
                <h2 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Settings</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Dashboard configuration and user preferences</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '2rem', maxWidth: '1400px' }}>
                {/* LEFT COLUMN: Data Sources */}
                <section>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🔌 Data Sources
                    </h3>

                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        padding: '1.75rem',
                        borderRadius: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.25rem'
                    }}>
                        <div>
                            <p style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>AI Configuration</p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                Choose your AI pattern detection and research provider.
                            </p>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                                    Provider
                                </label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {['ollama', 'gemini'].map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setAiProvider(p)}
                                            style={{
                                                flex: 1,
                                                padding: '0.65rem',
                                                borderRadius: '10px',
                                                border: '1px solid',
                                                borderColor: aiProvider === p ? 'var(--accent-primary)' : 'var(--border-color)',
                                                background: aiProvider === p ? 'var(--accent-glow)' : 'transparent',
                                                color: aiProvider === p ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                fontSize: '0.85rem'
                                            }}
                                        >
                                            {p === 'ollama' ? 'Gemma 4 (Local)' : 'Gemini (Cloud)'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {aiProvider === 'gemini' ? (
                                <ApiKeyInput
                                    label="Google Gemini"
                                    value={apiKeyGemini}
                                    onChange={setApiKeyGemini}
                                    placeholder="Enter Gemini API Key..."
                                />
                            ) : (
                                <>
                                    <ApiKeyInput
                                        label="Ollama Server URL"
                                        value={ollamaUrl}
                                        onChange={setOllamaUrl}
                                        placeholder="http://localhost:11434"
                                    />
                                    <ApiKeyInput
                                        label="Vision Model"
                                        value={visionModel}
                                        onChange={setVisionModel}
                                        placeholder="gemma4:26b"
                                        type="text"
                                    />
                                    <ApiKeyInput
                                        label="Research Model"
                                        value={researchModel}
                                        onChange={setResearchModel}
                                        placeholder="gemma4:26b"
                                        type="text"
                                    />
                                </>
                            )}

                            <p style={{ fontWeight: 600, marginBottom: '0.25rem', marginTop: '1.75rem', color: 'var(--text-primary)' }}>Market Data API Keys</p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                Enter your free API keys for optional supplemental live feeds.
                            </p>

                            <ApiKeyInput
                                label="Financial Modeling Prep (FMP)"
                                value={apiKeyFMP}
                                onChange={setApiKeyFMP}
                                placeholder="Enter FMP API Key..."
                            />

                            <ApiKeyInput
                                label="Alpha Vantage (AV)"
                                value={apiKeyAV}
                                onChange={setApiKeyAV}
                                placeholder="Enter Alpha Vantage API Key..."
                            />

                            <ApiKeyInput
                                label="Polygon.io"
                                value={apiKeyPoly}
                                onChange={setApiKeyPoly}
                                placeholder="Enter Polygon.io API Key..."
                            />

                            <div style={{ marginTop: '1rem', padding: '0.85rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                <p style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', lineHeight: '1.4' }}>
                                    <strong>Note:</strong> Keys are stored locally on your device and are never sent to external servers.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* RIGHT COLUMN: Appearance (Top) + Local Data (Bottom) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Appearance Section */}
                    <section>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🎨 Appearance
                        </h3>

                        <div style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            padding: '1.75rem',
                            borderRadius: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.25rem'
                        }}>
                            <div>
                                <p style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Interface Theme</p>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                    Choose how the dashboard looks on your screen.
                                </p>

                                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                    {themeOptions.map((option) => (
                                        <button
                                            key={option.id}
                                            onClick={() => setTheme(option.id as any)}
                                            style={{
                                                flex: 1,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                padding: '0.85rem',
                                                borderRadius: '12px',
                                                border: '2px solid',
                                                borderColor: theme === option.id ? 'var(--accent-primary)' : 'var(--border-color)',
                                                backgroundColor: theme === option.id ? 'var(--accent-glow)' : 'transparent',
                                                color: theme === option.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                transition: 'var(--transition-smooth)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {option.icon}
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{option.label}</span>
                                        </button>
                                    ))}
                                </div>

                                <p style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Portfolio Risk &amp; Sizing</p>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                                    Base portfolio capital used to compute the 1% risk position size in Top 10 Focus Leaders.
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 700 }}>$</span>
                                    <input
                                        type="number"
                                        defaultValue={localStorage.getItem('portfolio_size') || '100000'}
                                        onChange={(e) => localStorage.setItem('portfolio_size', e.target.value)}
                                        placeholder="100000"
                                        style={{
                                            flex: 1,
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '8px',
                                            padding: '0.55rem 0.75rem',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.85rem',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Local Storage & System Paths Section */}
                    <section>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                📁 Local Data & Storage
                            </h3>
                            
                            {/* Custom Data Directory Picker Button */}
                            <button
                                onClick={handleSelectCustomFolder}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    border: '1px solid rgba(99, 102, 241, 0.35)',
                                    color: '#a5b4fc',
                                    padding: '6px 14px',
                                    borderRadius: '10px',
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                📁 Change Data Directory
                            </button>
                        </div>

                        <div style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            padding: '1.75rem',
                            borderRadius: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem'
                        }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                Monitored file locations used by the app and local Python sidecar service:
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
                                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>🏠 Active Data Directory</span>
                                        <span style={{ fontSize: '0.7rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '2px 6px', borderRadius: '6px', fontWeight: 600 }}>Active Storage</span>
                                    </div>
                                    <code style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '6px', display: 'block', wordBreak: 'break-all' }}>
                                        {customDataDir || 'data/'}
                                    </code>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                                        Stores user database, output JSONs, and strategy definitions.
                                    </p>
                                </div>

                                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>📊 SQLite Database</span>
                                        <span style={{ fontSize: '0.7rem', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '2px 6px', borderRadius: '6px', fontWeight: 600 }}>Active</span>
                                    </div>
                                    <code style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '6px', display: 'block', wordBreak: 'break-all' }}>
                                        {customDataDir ? `${customDataDir}/db/etfs.db` : 'data/db/etfs.db'}
                                    </code>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                                        Stores 3-5 years of historical OHLCV bars, MA checks, and RS series.
                                    </p>
                                </div>

                                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>📈 Market Page Feed</span>
                                        <span style={{ fontSize: '0.7rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '2px 6px', borderRadius: '6px', fontWeight: 600 }}>JSON</span>
                                    </div>
                                    <code style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '6px', display: 'block', wordBreak: 'break-all' }}>
                                        data/outputs/etfs_tracker.json
                                    </code>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                                        Supertrend trend directions, RS daily/weekly rankings.
                                    </p>
                                </div>

                                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>🚦 Market Regime Score</span>
                                        <span style={{ fontSize: '0.7rem', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '2px 6px', borderRadius: '6px', fontWeight: 600 }}>JSON</span>
                                    </div>
                                    <code style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '6px', display: 'block', wordBreak: 'break-all' }}>
                                        data/outputs/market_regime.json
                                    </code>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                                        Top header widget (Press Gas / Half Size / Step Aside) & group health scores.
                                    </p>
                                </div>

                                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>🧬 Strategy Lab & Backtests</span>
                                        <span style={{ fontSize: '0.7rem', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', padding: '2px 6px', borderRadius: '6px', fontWeight: 600 }}>JSON</span>
                                    </div>
                                    <code style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '6px', display: 'block', wordBreak: 'break-all' }}>
                                        data/outputs/strategy_lab.json
                                    </code>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                                        Champion strategy genomes and validation backtests.
                                    </p>
                                </div>

                                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>📁 ETF Category Lists</span>
                                        <span style={{ fontSize: '0.7rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '2px 6px', borderRadius: '6px', fontWeight: 600 }}>CSV</span>
                                    </div>
                                    <code style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '6px', display: 'block', wordBreak: 'break-all' }}>
                                        data/inputs/etfs/
                                    </code>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                                        Breadth, Canaries, Defense, Leadership, Leveraged definitions.
                                    </p>
                                </div>

                                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>⚙️ Sidecar API Endpoint</span>
                                        <span style={{ fontSize: '0.7rem', background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', padding: '2px 6px', borderRadius: '6px', fontWeight: 600 }}>HTTP / SSE</span>
                                    </div>
                                    <code style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '6px', display: 'block', wordBreak: 'break-all' }}>
                                        http://127.0.0.1:8765/api/
                                    </code>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                                        Background Python server supplying data and streaming logs.
                                    </p>
                                </div>
                            </div>

                        </div>
                    </section>
                </div>
            </div>

        </div>
    );
};

export default Settings;

