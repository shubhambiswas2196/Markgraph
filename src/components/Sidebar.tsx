"use client"

import React from 'react';
import {
    Database,
    Settings,
    LogOut,
    Sparkles,
    Home,
    Zap
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

const Sidebar = () => {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            localStorage.removeItem('user');
            router.push('/login');
        } catch (error) {
            console.error('Logout error:', error);
            localStorage.removeItem('user');
            router.push('/login');
        }
    };

    const navItems = [
        { icon: Zap, label: 'Nexus Chat', path: '/romeo-charge' },
        { icon: Database, label: 'Sources', path: '/sources' },
    ];

    const isAuthPage = pathname === '/login' || pathname === '/register';
    const isChatPage = pathname === '/romeo-charge';

    if (isAuthPage) return null;

    // Inject global styles to remove margin on chat page when sidebar is hidden
    if (isChatPage) {
        return (
            <style jsx global>{`
                .main-content { margin-left: 0 !important; }
            `}</style>
        );
    }

    return (
        <>
            <aside className="sidebar">
                <div style={{
                    padding: '24px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '24px',
                    width: '100%',
                    pointerEvents: 'auto'
                }}>
                    {/* Logo removed as requested */}
                </div>

                {/* Main Navigation */}
                <nav className="sidebar-nav">
                    {navItems.map((item: any, index) => {
                        const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
                        return (
                            <Link
                                key={index}
                                href={item.path}
                                className={`sidebar-item ${isActive ? 'active' : ''}`}
                                title={item.label}
                            >
                                {/* @ts-ignore - handling heterogeneous icon types */}
                                {item.image ? (
                                    <img
                                        src={item.image}
                                        alt={item.label}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            objectFit: 'contain',
                                        }}
                                    />
                                ) : (
                                    item.icon && <item.icon size={24} strokeWidth={2} />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '24px', width: '100%', alignItems: 'center', marginTop: 'auto' }}>
                    <Link
                        href="/settings"
                        className={`sidebar-item ${pathname === '/settings' ? 'active' : ''}`}
                        title="Settings"
                    >
                        <Settings size={24} strokeWidth={2} />
                    </Link>
                    <div
                        className="sidebar-item"
                        onClick={handleLogout}
                        title="Logout"
                    >
                        <LogOut size={24} strokeWidth={2} />
                    </div>
                </div>
            </aside>

            {/* Mobile Bottom Nav */}
            <nav className="bottom-nav">
                {navItems.map((item: any, index) => {
                    const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
                    return (
                        <Link
                            key={index}
                            href={item.path}
                            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
                        >
                            {/* @ts-ignore */}
                            <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
                <Link
                    href="/settings"
                    className={`bottom-nav-item ${pathname === '/settings' ? 'active' : ''}`}
                >
                    <Settings size={20} strokeWidth={pathname === '/settings' ? 2.5 : 2} />
                    <span>Settings</span>
                </Link>
                <div className="bottom-nav-item" onClick={handleLogout}>
                    <LogOut size={20} strokeWidth={2} />
                    <span>Logout</span>
                </div>
            </nav>

            <style jsx>{`
                .bottom-nav {
                    display: none;
                }

                @media (max-width: 768px) {
                    .bottom-nav {
                        display: flex;
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        height: 64px;
                        background: var(--bg-card);
                        border-top: 1px solid var(--border-color);
                        z-index: 1300;
                        padding: 0 16px;
                        justify-content: space-around;
                        align-items: center;
                        backdrop-filter: blur(12px);
                    }

                    .bottom-nav-item {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 4px;
                        color: var(--text-muted);
                        text-decoration: none;
                        font-size: 10px;
                        font-weight: 600;
                        flex: 1;
                        padding: 8px 0;
                    }

                    .bottom-nav-item.active {
                        color: var(--primary-color);
                    }
                    
                    .bottom-nav-item span {
                        max-width: 60px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                }
            `}</style>
        </>
    );
};

export default Sidebar;
