'use client';

import React, { useMemo } from 'react';
import { Plus, X, Database, Settings, Sun, Moon } from 'lucide-react';
import { ConversationItem } from './ConversationItem';
import { isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { useTheme } from '@/components/ThemeProvider';

interface Conversation {
    id: number;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    messageCount: number;
}

interface ChatSidebarProps {
    conversations: Conversation[];
    currentConversationId: number | null;
    isOpen: boolean;
    onClose: () => void;
    onNewChat: () => void;
    onSelectConversation: (id: number) => void;
    onDeleteConversation: (id: number) => void;
}

export function ChatSidebar({
    conversations,
    currentConversationId,
    isOpen,
    onClose,
    onNewChat,
    onSelectConversation,
    onDeleteConversation
}: ChatSidebarProps) {
    const { theme, setTheme } = useTheme();

    const toggleTheme = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setTheme(theme === 'light' ? 'amoled' : 'light');
    };

    // Group conversations by date
    const groupedConversations = useMemo(() => {
        const groups: Record<string, Conversation[]> = {
            Today: [],
            Yesterday: [],
            'Last 7 Days': [],
            'Last 30 Days': [],
            Older: []
        };

        conversations.forEach(conv => {
            const date = new Date(conv.updatedAt);
            if (isToday(date)) {
                groups.Today.push(conv);
            } else if (isYesterday(date)) {
                groups.Yesterday.push(conv);
            } else if (isThisWeek(date)) {
                groups['Last 7 Days'].push(conv);
            } else if (isThisMonth(date)) {
                groups['Last 30 Days'].push(conv);
            } else {
                groups.Older.push(conv);
            }
        });

        return groups;
    }, [conversations]);

    return (
        <>
            {/* Overlay for mobile */}
            {isOpen && (
                <div className="sidebar-overlay" onClick={onClose} />
            )}

            {/* Sidebar */}
            <div className={`chat-sidebar ${isOpen ? 'open' : ''}`}>
                {/* Header */}
                <div className="sidebar-header">
                    <button className="new-chat-btn" onClick={onNewChat}>
                        <Plus size={18} />
                        <span>New Chat</span>
                    </button>
                    <button className="close-sidebar-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Conversation List */}
                <div className="conversation-list">
                    {conversations.length === 0 ? (
                        <div className="empty-state">
                            <p>No conversations yet</p>
                            <p className="empty-hint">Start a new chat to begin</p>
                        </div>
                    ) : (
                        Object.entries(groupedConversations).map(([groupName, groupConvs]) => {
                            if (groupConvs.length === 0) return null;

                            return (
                                <div key={groupName} className="conversation-group">
                                    <div className="group-header">{groupName}</div>
                                    {groupConvs.map(conv => (
                                        <ConversationItem
                                            key={conv.id}
                                            id={conv.id}
                                            title={conv.title}
                                            updatedAt={conv.updatedAt}
                                            messageCount={conv.messageCount}
                                            isActive={conv.id === currentConversationId}
                                            onClick={() => onSelectConversation(conv.id)}
                                            onDelete={onDeleteConversation}
                                        />
                                    ))}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Integrated Navigation (Since Global Sidebar is hidden) */}
                <div className="sidebar-footer-nav">
                    <button className="nav-item" onClick={() => window.location.href = '/sources'}>
                        <Database size={18} />
                        <span>Sources</span>
                    </button>
                    <button className="nav-item" onClick={() => window.location.href = '/settings'}>
                        <Settings size={18} />
                        <span>Settings</span>
                    </button>
                    <button className="nav-item theme-toggle" onClick={toggleTheme}>
                        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                        <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                    </button>
                </div>

                <style jsx>{`
                    .sidebar-footer-nav {
                        padding: 16px;
                        border-top: 1px solid var(--border-color);
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }
                    .nav-item {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 10px;
                        width: 100%;
                        border-radius: var(--radius-md);
                        color: var(--text-muted);
                        font-size: 14px;
                        transition: all 0.2s;
                    }
                    .nav-item:hover {
                        background: var(--bg-hover);
                        color: var(--text-main);
                    }
                `}</style>

                <style jsx>{`
                    .sidebar-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0, 0, 0, 0.4);
                        backdrop-filter: blur(2px);
                        z-index: 998;
                        display: block; /* Always show overlay if isOpen */
                    }

                    .chat-sidebar {
                        position: fixed;
                        top: 0;
                        left: 0; /* Full screen / no global sidebar offset */
                        width: 260px; /* Fixed width */
                        height: 100vh;
                        background: var(--bg-sidebar);
                        border-right: 1px solid var(--border-color);
                        display: flex;
                        flex-direction: column;
                        z-index: 1000; /* Above overlay */
                        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                        transform: translateX(-110%); /* Hidden by default */
                    }

                    .chat-sidebar.open {
                        transform: translateX(0);
                    }

                    @media (max-width: 768px) {
                        .chat-sidebar {
                            left: 0; /* Full screen on mobile */
                            width: 80%;
                            max-width: 300px;
                            transform: translateX(-100%);
                            box-shadow: 2px 0 20px rgba(0, 0, 0, 0.15);
                            z-index: 1000;
                        }

                        .chat-sidebar.open {
                            transform: translateX(0);
                        }
                    }

                    .sidebar-header {
                        padding: 20px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 8px;
                        border-bottom: 1px solid rgba(0, 0, 0, 0.06);
                    }

                    .new-chat-btn {
                        flex: 1;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        padding: 11px 14px;
                        background: linear-gradient(135deg, rgb(37, 99, 235) 0%, rgb(59, 130, 246) 100%);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-weight: 600;
                        font-size: 14px;
                        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                        box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
                    }

                    .new-chat-btn:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
                    }

                    .new-chat-btn:active {
                        transform: translateY(0);
                    }

                    .close-sidebar-btn {
                        display: flex; /* Always show close button since toggle is outside */
                        width: 36px;
                        height: 36px;
                        align-items: center;
                        justify-content: center;
                        border-radius: 8px;
                        background: transparent;
                        color: var(--text-muted);
                        transition: all 0.2s ease;
                        opacity: 0.7;
                    }

                    .close-sidebar-btn:hover {
                        background: rgba(0, 0, 0, 0.05);
                        color: var(--text-main);
                        opacity: 1;
                    }

                    .conversation-list {
                        flex: 1;
                        overflow-y: auto;
                        padding: 16px;
                        scrollbar-width: thin;
                        scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
                    }

                    .conversation-list::-webkit-scrollbar {
                        width: 6px;
                    }

                    .conversation-list::-webkit-scrollbar-track {
                        background: transparent;
                    }

                    .conversation-list::-webkit-scrollbar-thumb {
                        background: rgba(0, 0, 0, 0.15);
                        border-radius: 3px;
                    }

                    .conversation-list::-webkit-scrollbar-thumb:hover {
                        background: rgba(0, 0, 0, 0.25);
                    }

                    .empty-state {
                        text-align: center;
                        padding: 48px 16px;
                        color: var(--text-muted);
                    }

                    .empty-state p {
                        margin: 0;
                        font-size: 14px;
                        font-weight: 500;
                    }

                    .empty-hint {
                        font-size: 12px;
                        margin-top: 8px;
                        opacity: 0.7;
                    }

                    .conversation-group {
                        margin-bottom: 28px;
                    }

                    .group-header {
                        font-size: 11px;
                        font-weight: 700;
                        color: var(--text-muted);
                        text-transform: uppercase;
                        letter-spacing: 0.06em;
                        margin-bottom: 10px;
                        padding: 0 12px;
                        opacity: 0.6;
                    }
                `}</style>
            </div>
        </>
    );
}
