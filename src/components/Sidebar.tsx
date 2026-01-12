"use client"

import React from 'react';
import {
    Database,
    BarChart3,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    Hash,
    Globe,
    DollarSign,
    Mail,
    Loader2,
    Menu,
    X
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

const Sidebar = () => {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = React.useState(false);

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
        { icon: Sparkles, label: 'Nexus AI', path: '/nexus' },

        { icon: Database, label: 'Sources', path: '/sources' },
    ];

    const isAuthPage = pathname === '/login' || pathname === '/register';
    if (isAuthPage) return null;

    return (
        <div style={{ display: 'flex' }}>
            <aside className="sidebar">
                {/* Hamburger Toggle */}
                <div
                    className="sidebar-item"
                    onClick={() => setIsOpen(!isOpen)}
                    style={{
                        cursor: 'pointer',
                        marginBottom: '8px',
                        color: isOpen ? 'var(--primary-color)' : 'var(--text-muted)'
                    }}
                >
                    {isOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
                </div>

                {isOpen && (
                    <>
                        <nav className="sidebar-nav" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                            {navItems.map((item, index) => {
                                const Icon = item.icon;
                                const isActive = pathname.startsWith(item.path);
                                return (
                                    <Link
                                        key={index}
                                        href={item.path}
                                        className={`sidebar-item ${isActive ? 'active' : ''}`}
                                        title={item.label}
                                    >
                                        <Icon size={20} strokeWidth={2} />
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="sidebar-separator"></div>

                        <div className="sidebar-footer" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                            <Link
                                href="/settings"
                                className={`sidebar-item ${pathname === '/settings' ? 'active' : ''}`}
                                title="Settings"
                            >
                                <Settings size={20} strokeWidth={2} />
                            </Link>
                            <div
                                className="sidebar-item"
                                onClick={handleLogout}
                                style={{ cursor: 'pointer' }}
                                title="Logout"
                            >
                                <LogOut size={20} strokeWidth={2} />
                            </div>
                        </div>
                    </>
                )}
            </aside>
        </div>
    );
};

export default Sidebar;
