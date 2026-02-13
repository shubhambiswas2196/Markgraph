"use client"

import React, { useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
    pageName: string;
    extended?: boolean;
    maxWidth?: string;
    stationary?: boolean;
    hideSearch?: boolean;
    hideNotifications?: boolean;
}

const Header: React.FC<HeaderProps> = ({ pageName, extended, maxWidth, stationary, hideSearch, hideNotifications }) => {
    const searchRef = useRef<HTMLInputElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = React.useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);

    const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                searchRef.current?.focus();
            }
            if (e.key === 'Escape') {
                searchRef.current?.blur();
                setIsNotificationsOpen(false);
            }
        };

        const handleClickOutside = (e: MouseEvent) => {
            if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
                setIsNotificationsOpen(false);
            }
        };

        const handleSidebarCollapse = (e: any) => {
            setIsSidebarCollapsed(e.detail);
        };

        // Check initial state
        const storedCollapse = localStorage.getItem('sidebar-collapsed');
        if (storedCollapse === 'true') {
            setIsSidebarCollapsed(true);
        }

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('sidebar-collapse-changed', handleSidebarCollapse);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('sidebar-collapse-changed', handleSidebarCollapse);
        };
    }, []);

    const notifications = [
        { id: 1, text: 'Google Ads sync completed successfully', time: '2m ago', unread: true },
        { id: 2, text: 'New weekly performance report is ready', time: '1h ago', unread: true },
        { id: 3, text: 'Account "Search-Campaign-01" reached budget limit', time: '5h ago', unread: false },
    ];

    return (
        <header
            className={`main-header ${(extended && !isSidebarCollapsed) ? 'extended' : ''}`}
            style={{
                position: stationary ? 'relative' : undefined,
                left: stationary ? '0' : undefined,
                width: stationary ? '100%' : undefined,
                backgroundColor: 'transparent',
                borderBottom: 'none',
                backdropFilter: 'none',
                zIndex: stationary ? 1 : undefined,
                pointerEvents: 'none' // Allow clicking through empty space
            }}
        >
            <div style={{
                width: '100%',
                maxWidth: maxWidth || 'none',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                pointerEvents: 'auto' // Re-enable pointer events for content
            }}>
                {/* Breadcrumb removed for cleaner design */}

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, justifyContent: 'flex-end' }}>
                    {/* Search Bar */}
                    {!hideSearch && (
                        <div className={`search-container ${isFocused ? 'focused' : ''}`}>
                            <div style={{
                                position: 'absolute',
                                left: '14px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                fontSize: '12px',
                                fontWeight: 700,
                                color: isFocused ? 'var(--primary-color)' : 'var(--text-muted)',
                                zIndex: 2,
                                opacity: 0.6
                            }}>&rarr;</div>
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder="Type to search"
                                style={{
                                    width: '100%',
                                    padding: '10px 12px 10px 38px',
                                    fontSize: '13px',
                                    backgroundColor: isFocused ? 'var(--bg-card)' : 'var(--bg-hover)',
                                    border: '1px solid',
                                    borderColor: isFocused ? 'var(--primary-color)' : 'var(--border-color)',
                                    borderRadius: '10px',
                                    outline: 'none',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    color: 'var(--text-main)',
                                    boxShadow: isFocused ? '0 4px 12px var(--primary-glow)' : 'none'
                                }}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                            />
                            <div style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px',
                                padding: '2px 6px',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                pointerEvents: 'none',
                                opacity: isFocused ? 0 : 1,
                                transition: 'opacity 0.2s'
                            }}>
                                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', opacity: 0.7 }}>Ctrl</span>
                                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', opacity: 0.7 }}>K</span>
                            </div>

                            {/* Search Dropdown Panel */}
                            <div className="search-dropdown">
                                <div className="search-dropdown-header">Quick Actions</div>
                                <div className="search-dropdown-item">
                                    <div style={{ width: '20px', fontSize: '10px', textAlign: 'center', fontWeight: 800 }}>+</div>
                                    Connect New Source
                                </div>
                                <div className="search-dropdown-item">
                                    <div style={{ width: '20px', fontSize: '10px', textAlign: 'center', fontWeight: 800 }}>^</div>
                                    View Ads Insights
                                </div>
                                <div style={{ margin: '8px 0', borderTop: '1px solid var(--border-color)' }}></div>
                                <div className="search-dropdown-header">Recent Pages</div>
                                <div className="search-dropdown-item">Settings</div>
                            </div>
                        </div>
                    )}

                    {/* Notifications */}
                    {!hideNotifications && (
                        <div className={`notification-container ${isNotificationsOpen ? 'open' : ''}`} ref={notificationsRef}>
                            <button
                                className={`notification-btn ${isNotificationsOpen ? 'active' : ''}`}
                                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                                title="Notifications"
                            >
                                <Bell size={20} strokeWidth={2} />
                                <div style={{
                                    position: 'absolute',
                                    top: '10px',
                                    right: '10px',
                                    width: '6px',
                                    height: '6px',
                                    backgroundColor: 'var(--error-color)',
                                    borderRadius: '50%',
                                    border: '1.5px solid var(--bg-card)'
                                }}></div>
                            </button>

                            <div className="notification-dropdown">
                                <div className="search-dropdown-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Notifications</span>
                                    <span style={{ color: 'var(--primary-color)', cursor: 'pointer', textTransform: 'none' }}>Mark all read</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    {notifications.map(n => (
                                        <div key={n.id} className="notification-item">
                                            {n.unread && <div className="notification-dot"></div>}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.4' }}>{n.text}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{n.time}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ margin: '8px 0', borderTop: '1px solid var(--border-color)' }}></div>
                                <div className="search-dropdown-item" style={{ justifyContent: 'center', color: 'var(--primary-color)', fontSize: '12px' }}>
                                    View All Notifications
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
