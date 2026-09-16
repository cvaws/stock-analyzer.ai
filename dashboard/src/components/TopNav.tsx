import React, { useEffect, useState } from 'react';
import { TrendingUp, Activity, BarChart2, Compass, Settings as SettingsIcon, LayoutDashboard, Database, Layers, LayoutGrid, Play, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface TopNavProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const TopNav: React.FC<TopNavProps> = ({ activeTab, setActiveTab }) => {
    const [isMac, setIsMac] = useState(false);
    const [dataDirName, setDataDirName] = useState<string>('Local');
    const [isScanning, setIsScanning] = useState(false);

    const handleRunDailyScan = () => {
        if (isScanning) return;
        setIsScanning(true);

        const SIDECAR_URL = (typeof window !== 'undefined' && (window as any).__SIDECAR_URL__) || 'http://127.0.0.1:8765';
        const eventSource = new EventSource(`${SIDECAR_URL}/api/pipeline/run-stream`);

        eventSource.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.status === 'completed' || data.status === 'failed') {
                    setIsScanning(false);
                    eventSource.close();
                    if (data.status === 'completed') {
                        window.dispatchEvent(new CustomEvent('market-data-updated'));
                    }
                }
            } catch (err) {
                console.error('Error parsing SSE event:', err);
            }
        };

        eventSource.onerror = (err) => {
            console.error('SSE connection error:', err);
            setIsScanning(false);
            eventSource.close();
            window.dispatchEvent(new CustomEvent('market-data-updated'));
        };
    };

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const platform = (window as any).desktopEnv?.platform || navigator.platform;
            setIsMac(platform.toLowerCase().includes('mac') || platform.toLowerCase().includes('darwin'));

            if ((window as any).desktopEnv?.getCustomDataDir) {
                (window as any).desktopEnv.getCustomDataDir().then((dir: string) => {
                    if (dir) {
                        const parts = dir.replace(/\\/g, '/').split('/').filter(Boolean);
                        setDataDirName(parts.pop() || 'Local');
                    }
                });
            }
        }
    }, []);

    const navItems = [
        { name: 'Market', label: 'Market Overview', icon: <TrendingUp size={16} /> },
        { name: 'ThemeTracker', label: 'Theme Tracker', icon: <Layers size={16} /> },
        { name: 'EtfMatrix', label: 'ETF Categories', icon: <LayoutGrid size={16} /> },
        { name: 'Quadrant', label: 'Quadrant Map', icon: <Compass size={16} /> },
        { name: 'Technical', label: 'Technical Charts', icon: <Activity size={16} /> },
        { name: 'Backtests', label: 'Strategy Lab', icon: <BarChart2 size={16} /> },
    ];

    return (
        <header
            className="titlebar-drag-region"
            style={{
                height: '46px',
                backgroundColor: 'var(--bg-sidebar)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingLeft: isMac ? '80px' : '1rem',
                paddingRight: '1rem',
                userSelect: 'none',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                backdropFilter: 'blur(16px)',
                width: '100%'
            }}
        >
            {/* Left: Brand Logo & Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }} className="no-drag">
                <div style={{
                    width: '26px',
                    height: '26px',
                    background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                    borderRadius: '7px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)'
                }}>
                    <LayoutDashboard size={15} color="white" />
                </div>
                <span style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                    StockWave
                </span>
            </div>

            {/* Center: Main Navigation Tabs */}
            <nav style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '3px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)'
            }} className="no-drag">
                {navItems.map((item) => {
                    const isActive = activeTab === item.name || (item.name === 'Backtests' && activeTab === 'StrategyLab');
                    return (
                        <button
                            key={item.name}
                            onClick={() => setActiveTab(item.name)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                padding: '5px 14px',
                                borderRadius: '8px',
                                border: 'none',
                                background: isActive ? 'var(--bg-card)' : 'transparent',
                                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontWeight: isActive ? 700 : 500,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                position: 'relative',
                                boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)' : 'none'
                            }}
                        >
                            <span style={{ color: isActive ? 'var(--accent-primary)' : 'currentColor', display: 'flex' }}>
                                {item.icon}
                            </span>
                            <span>{item.label}</span>
                            {isActive && (
                                <motion.div
                                    layoutId="top-active-indicator"
                                    style={{
                                        position: 'absolute',
                                        bottom: '-4px',
                                        left: '20%',
                                        right: '20%',
                                        height: '2px',
                                        background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                                        borderRadius: '2px'
                                    }}
                                />
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Right: Storage Badge, Scan Button & Settings */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }} className="no-drag">
                {/* Global Run Daily Scan Button */}
                <button
                    onClick={handleRunDailyScan}
                    disabled={isScanning}
                    title="Execute incremental daily scan across all ETFs"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        borderRadius: '7px',
                        border: 'none',
                        background: isScanning ? 'rgba(99, 102, 241, 0.5)' : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                        color: '#fff',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: isScanning ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 6px rgba(79, 70, 229, 0.3)',
                        transition: 'all 0.15s ease'
                    }}
                >
                    {isScanning ? (
                        <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                        <Play size={11} fill="#fff" />
                    )}
                    <span>{isScanning ? 'Scanning...' : 'Run Scan'}</span>
                </button>

                {/* Data Directory Indicator */}
                <div 
                    title="Active storage data location"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        fontSize: '0.74rem',
                        color: 'var(--text-muted)'
                    }}
                >
                    <Database size={12} color="#10b981" />
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{dataDirName}</span>
                </div>

                {/* Settings Tab on the Extreme Right */}
                <button
                    onClick={() => setActiveTab('Settings')}
                    title="Open Settings & Data Paths"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '5px 12px',
                        borderRadius: '8px',
                        border: activeTab === 'Settings' ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        background: activeTab === 'Settings' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                        color: activeTab === 'Settings' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        fontWeight: activeTab === 'Settings' ? 700 : 500,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <SettingsIcon size={15} color={activeTab === 'Settings' ? 'var(--accent-primary)' : 'currentColor'} />
                    <span>Settings</span>
                </button>
            </div>
        </header>
    );
};

export default TopNav;
