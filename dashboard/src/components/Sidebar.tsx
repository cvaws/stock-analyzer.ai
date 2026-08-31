import React from 'react';
import { LayoutDashboard, TrendingUp, BarChart2, Settings as SettingsIcon, LogOut, Pin, ChevronRight, Activity } from 'lucide-react';
import { motion } from 'framer-motion';


interface SidebarProps {
    sidebarStateNotUsed?: any; // avoid lints
    activeTab: string;
    setActiveTab: (tab: string) => void;
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isCollapsed, setIsCollapsed }) => {
    const menuItems = [
        { name: 'Market', icon: <TrendingUp size={20} /> },
        { name: 'Technical', icon: <Activity size={20} /> },
        { name: 'Backtests', icon: <BarChart2 size={20} /> },
    ];

    return (
        <aside style={{
            width: isCollapsed ? '80px' : '220px',
            backgroundColor: 'var(--bg-sidebar)',
            borderRight: '1px solid var(--border-color)',
            padding: '2rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            zIndex: 10,
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden'
        }}>
            <div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsed ? 'center' : 'space-between',
                    marginBottom: '3rem',
                    padding: '0 0.5rem'
                }}>
                    {!isCollapsed && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <LayoutDashboard size={20} color="white" />
                            </div>
                            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>StockWave</h1>
                        </div>
                    )}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                            transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        {isCollapsed ? <ChevronRight size={18} /> : <Pin size={18} style={{ transform: 'rotate(-45deg)' }} />}
                    </button>
                </div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {menuItems.map((item) => (
                        <button
                            key={item.name}
                            onClick={() => setActiveTab(item.name)}
                            title={isCollapsed ? item.name : undefined}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: isCollapsed ? 'center' : 'flex-start',
                                gap: '1rem',
                                padding: '0.875rem 1rem',
                                borderRadius: '12px',
                                transition: 'var(--transition-smooth)',
                                color: activeTab === item.name ? 'var(--text-primary)' : 'var(--text-secondary)',
                                backgroundColor: activeTab === item.name ? 'hsla(0, 0%, 100%, 0.05)' : 'transparent',
                                position: 'relative',
                                width: '100%'
                            }}
                        >
                            {activeTab === item.name && (
                                <motion.div
                                    layoutId="active-pill"
                                    style={{
                                        position: 'absolute',
                                        left: 0,
                                        width: '4px',
                                        height: '20px',
                                        backgroundColor: 'var(--accent-primary)',
                                        borderRadius: '0 4px 4px 0'
                                    }}
                                />
                            )}
                            <span style={{ color: activeTab === item.name ? 'var(--accent-primary)' : 'inherit', display: 'flex' }}>
                                {item.icon}
                            </span>
                            {!isCollapsed && (
                                <span style={{ fontSize: '0.95rem', fontWeight: activeTab === item.name ? 600 : 500, whiteSpace: 'nowrap' }}>
                                    {item.name}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                    onClick={() => setActiveTab('Settings')}
                    title={isCollapsed ? 'Settings' : undefined}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        gap: '1rem',
                        padding: '0.875rem 1rem',
                        borderRadius: '12px',
                        transition: 'var(--transition-smooth)',
                        color: activeTab === 'Settings' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        backgroundColor: activeTab === 'Settings' ? 'hsla(0, 0%, 100%, 0.05)' : 'transparent',
                        width: '100%'
                    }}
                >
                    <SettingsIcon size={20} color={activeTab === 'Settings' ? 'var(--accent-primary)' : 'currentColor'} />
                    {!isCollapsed && <span style={{ fontSize: '0.95rem', fontWeight: activeTab === 'Settings' ? 600 : 500, whiteSpace: 'nowrap' }}>Settings</span>}
                </button>
                <button
                    title={isCollapsed ? 'Logout' : undefined}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        gap: '1rem',
                        padding: '0.875rem 1rem',
                        color: 'var(--text-secondary)',
                        borderRadius: '12px',
                        transition: 'var(--transition-smooth)',
                        width: '100%'
                    }}>
                    <LogOut size={20} />
                    {!isCollapsed && <span style={{ fontSize: '0.95rem', fontWeight: 500, whiteSpace: 'nowrap' }}>Logout</span>}
                </button>
            </div>
        </aside>
    );
};


export default Sidebar;
