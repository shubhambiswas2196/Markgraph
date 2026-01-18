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
        { image: '/nexus-logo.png', label: 'Nexus AI', path: '/nexus' },
        { icon: Sparkles, label: 'Blackswan', path: '/blackswan' },
        { icon: Database, label: 'Sources', path: '/sources' },
    ];

    const isAuthPage = pathname === '/login' || pathname === '/register';
    if (isAuthPage) return null;

    return (
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
                <Link href="/nexus" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img
                        src="/nexus-logo.png?v=3"
                        alt="Nexus AI"
                        style={{
                            width: '32px',
                            height: '32px',
                            objectFit: 'contain'
                        }}
                    />
                </Link>
            </div>

            {/* Main Navigation */}
            <nav className="sidebar-nav">
                {navItems.map((item, index) => {
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
                                        // Add filter to match the white/active color scheme if needed, 
                                        // or keep original colors if intended. 
                                        // For now, assuming original image.
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
    );
};

export default Sidebar;
