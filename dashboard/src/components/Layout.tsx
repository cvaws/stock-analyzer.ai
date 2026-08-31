import React from 'react';
import TopNav from './TopNav';

interface LayoutProps {
    children: React.ReactNode;
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100vw', backgroundColor: 'var(--bg-dark)' }}>
            {/* Top Navigation Bar with window drag region */}
            <TopNav activeTab={activeTab} setActiveTab={setActiveTab} />

            <main style={{
                flex: 1,
                padding: '1rem',
                overflowY: 'auto',
                backgroundColor: 'var(--bg-main)',
                maxHeight: 'calc(100vh - 46px)',
                position: 'relative'
            }}>
                <div style={{
                    position: 'absolute',
                    top: '-10%',
                    right: '-5%',
                    width: '40%',
                    height: '40%',
                    background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)',
                    zIndex: 0,
                    pointerEvents: 'none'
                }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;

