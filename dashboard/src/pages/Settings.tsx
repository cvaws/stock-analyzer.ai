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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', maxWidth: '1200px' }}>
                {/* Appearance Section */}
                <section>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>Appearance</h3>

                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        padding: '2rem',
                        borderRadius: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem'
                    }}>
                        <div>
                            <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Interface Theme</p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                                Choose how the dashboard looks on your device.
                            </p>

                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                {themeOptions.map((option) => (
                                    <button
                                        key={option.id}
                                        onClick={() => setTheme(option.id as any)}
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '1rem',
                                            borderRadius: '16px',
                                            border: '2px solid',
                                            borderColor: theme === option.id ? 'var(--accent-primary)' : 'var(--border-color)',
                                            backgroundColor: theme === option.id ? 'var(--accent-glow)' : 'transparent',
                                            color: theme === option.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                                            transition: 'var(--transition-smooth)'
                                        }}
                                    >
                                        {option.icon}
                                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{option.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Data Sources Section */}
                <section>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>Data Sources</h3>

                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        padding: '2rem',
                        borderRadius: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem'
                    }}>
                        <div>
                            <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>AI Configuration</p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                                Choose your AI pattern detection provider.
                            </p>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                                    Provider
                                </label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {['ollama', 'gemini'].map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setAiProvider(p)}
                                            style={{
                                                flex: 1,
                                                padding: '0.75rem',
                                                borderRadius: '12px',
                                                border: '1px solid',
                                                borderColor: aiProvider === p ? 'var(--accent-primary)' : 'var(--border-color)',
                                                background: aiProvider === p ? 'var(--accent-glow)' : 'transparent',
                                                color: aiProvider === p ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                textTransform: 'capitalize'
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

                            <p style={{ fontWeight: 600, marginBottom: '0.25rem', marginTop: '2rem' }}>Market Data API Keys</p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                                Enter your free API keys for stock and technical data.
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

                            <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                <p style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', lineHeight: '1.5' }}>
                                    <strong>Note:</strong> Keys are stored locally on your device and are never sent to our servers. Your data stays private.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Settings;
