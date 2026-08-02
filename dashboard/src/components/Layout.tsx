import React, { useState } from 'react';
import Sidebar from './Sidebar';

interface LayoutProps {
    children: React.ReactNode;
    activeTab: string;
    setActiveTab: (tab: string) => void;
    onRefresh: () => void;
    isRefreshing: boolean;
    onScanUpload: (file: File) => void;
    onScanClear: () => void;
    scanCount: number;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, onRefresh, isRefreshing, onScanUpload, onScanClear, scanCount }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div style={{ display: 'flex', minHeight: '100vh', width: '100vw', backgroundColor: 'var(--bg-dark)' }}>
            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                isCollapsed={isCollapsed}
                setIsCollapsed={setIsCollapsed}
                onRefresh={onRefresh}
                isRefreshing={isRefreshing}
                onScanUpload={onScanUpload}
                onScanClear={onScanClear}
                scanCount={scanCount}
            />
            <main style={{
                flex: 1,
                padding: '1rem',
                overflowY: 'auto',
                backgroundColor: 'var(--bg-main)',
                maxHeight: '100vh',
                transition: 'padding-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
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
