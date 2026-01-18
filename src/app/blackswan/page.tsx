'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowUp, Sparkles, User, Bot, Loader2, RotateCcw, ChevronDown, CheckCircle2, Globe, Copy, Check, Activity, Zap, PlayCircle, FileSpreadsheet, XCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import CreativeGallery from '@/components/CreativeGallery';

interface ToolLog {
    name: string;
    status: 'running' | 'complete';
    output?: any;
    input?: any;
    timestamp: number;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    toolLogs?: ToolLog[];
}

// Resource Icon component (Simplified)
function SourceIcon({ name }: { name: string }) {
    const n = name.toLowerCase();

    if (n.includes('google') || n.includes('ads') || n.includes('keyword') || n.includes('performance')) {
        // Google Ads related
        if (!n.includes('sheet') && !n.includes('meta') && !n.includes('facebook')) {
            return (
                <div style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src="/google_ads_logo.png" alt="Ads" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
            );
        }
    }

    if (n.includes('meta') || n.includes('facebook') || n.includes('instagram')) {
        return (
            <div style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/meta-logo.png" alt="Meta" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
        );
    }

    if (n.includes('sheet') || n.includes('spreadsheet') || n.includes('row') || n.includes('cell')) {
        return (
            <div style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/google_sheets_logo.png" alt="Sheets" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
        );
    }

    return (
        <div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'rgba(33, 188, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe size={10} style={{ color: 'var(--primary-color)' }} />
        </div>
    );
}

// Table Renderer with Copy Button
const TableRenderer = ({ children }: { children: React.ReactNode }) => {
    const [copied, setCopied] = useState(false);
    const tableRef = useRef<HTMLTableElement>(null);

    const handleCopy = () => {
        if (!tableRef.current) return;
        let text = "";
        const rows = tableRef.current.querySelectorAll("tr");
        rows.forEach(row => {
            const cells = row.querySelectorAll("th, td");
            const rowText = Array.from(cells).map(cell => cell.textContent).join("\t");
            text += rowText + "\n";
        });
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{ position: 'relative', margin: '20px 0', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
            <button
                onClick={handleCopy}
                style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    padding: '6px 12px',
                    background: 'var(--bg-color)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    color: 'var(--text-main)',
                    fontWeight: 500,
                    zIndex: 10,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
            >
                {copied ? <Check size={14} color="var(--success-color)" /> : <Copy size={14} color="var(--text-muted)" />}
                {copied ? 'Copied' : 'Copy Table'}
            </button>
            <div style={{ overflowX: 'auto', padding: '0' }}>
                <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '100%' }}>
                    {children}
                </table>
            </div>
        </div>
    );
};

// Simple Source Chips
function SourcesRow({ logs }: { logs?: ToolLog[] }) {
    if (!logs || logs.length === 0) return null;

    // We want to show all running tools, plus unique completed ones
    // But mostly we just want to show what's happening.
    // Let's simplify: show all logs, but unique by name?
    // Actually, if I run "google_ads" twice, maybe I want to see it twice?
    // For now, keep the unique logic but ensure we update status if it changes

    // Better logic: Map all logs to show everything associated with this message
    // But deduplicate by name to keep it clean, taking the LATEST status
    const uniqueLogsMap = new Map<string, ToolLog>();
    logs.forEach(log => {
        const existing = uniqueLogsMap.get(log.name);
        if (!existing || (existing.status === 'running' && log.status === 'complete')) {
            uniqueLogsMap.set(log.name, log);
        } else if (!existing) {
            uniqueLogsMap.set(log.name, log);
        }
    });

    const uniqueSources = Array.from(uniqueLogsMap.values());

    // Filter mainly for data fetching tools
    const relevantSources = uniqueSources.filter(s =>
        !s.name.includes('harness') &&
        !s.name.includes('planner')
    );

    if (relevantSources.length === 0) return null;

    return (
        <div style={{ marginBottom: '16px', animation: 'fadeIn 0.5s' }}>
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px'
            }}>
                {relevantSources.map((log, idx) => (
                    <div key={idx} className={log.status === 'running' ? 'running-tool' : ''} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 10px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: 'var(--text-main)',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        maxWidth: '200px',
                        transition: 'all 0.3s ease'
                    }}>
                        <div style={{ width: '16px', height: '16px', flexShrink: 0 }}>
                            <SourceIcon name={log.name} />
                        </div>
                        <span style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {log.name.replace(/_/g, ' ').replace('google', 'Google').replace('ads', 'Ads').replace('meta', 'Meta')}
                        </span>
                        {log.status === 'running' && (
                            <Loader2 size={12} className="animate-spin" style={{ marginLeft: '4px', opacity: 0.7 }} />
                        )}
                        {log.status === 'complete' && (
                            <CheckCircle2 size={12} style={{ marginLeft: '4px', color: 'var(--success-color)' }} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ... (BlackswanPage component start) ...

// (Inside BlackswanPage render)
// ...

<style jsx global>{`
                 /* Reuse Styles */
                 .markdown-content h1, .markdown-content h2 { margin-top: 0; margin-bottom: 16px; color: var(--text-main); font-weight: 700; }
                 .markdown-content p { margin-bottom: 12px; }
                 .markdown-content ul { margin-bottom: 12px; padding-left: 20px; }
                 .markdown-content li { margin-bottom: 6px; }
                 .markdown-content strong { color: var(--primary-color); font-weight: 700; }
                 .nexus-input-glow { border: 1px solid rgba(33, 188, 255, 0.2) !important; }
                 .nexus-input-glow:focus-within { border-color: var(--primary-color) !important; box-shadow: 0 0 0 4px rgba(33, 188, 255, 0.1) !important; }
                 @keyframes pulse-ring {
                     0% { box-shadow: 0 0 0 0 rgba(33, 188, 255, 0.4); border-color: rgba(33, 188, 255, 0.8); }
                     70% { box-shadow: 0 0 0 4px rgba(33, 188, 255, 0); border-color: rgba(33, 188, 255, 0.4); }
                     100% { box-shadow: 0 0 0 0 rgba(33, 188, 255, 0); border-color: rgba(33, 188, 255, 0.8); }
                 }
                 .running-tool { animation: pulse-ring 2s infinite; }
                 
                 @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                 }
                 .animate-spin { animation: spin 1s linear infinite; }
             `}</style>

export default function BlackswanPage() {
    const { theme } = useTheme();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [userId, setUserId] = useState<number | null>(null);
    const [user, setUser] = useState<{ firstName: string; lastName: string; email: string } | null>(null);
    const inputTextAreaRef = useRef<HTMLTextAreaElement>(null);
    const isSubmittingRef = useRef(false);

    // Mentions & Data Sources State
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);
    const [dataSources, setDataSources] = useState<any[]>([]);
    const [selectedSources, setSelectedSources] = useState<any[]>([]);

    const filteredSources = dataSources.filter(s =>
        s.name.toLowerCase().includes(mentionQuery.toLowerCase())
    );

    // Fetch user info
    const fetchUser = useCallback(async () => {
        try {
            const res = await fetch('/api/me');
            if (res.ok) {
                const data = await res.json();
                setUserId(data.userId);
                if (data.firstName && data.lastName) {
                    setUser({
                        firstName: data.firstName,
                        lastName: data.lastName,
                        email: data.email
                    });
                }
            }
        } catch (e) {
            console.error('Failed to fetch user:', e);
        }
    }, []);

    const fetchSources = useCallback(async () => {
        if (!userId) return;
        try {
            const res = await fetch(`/api/sources/status`);
            const data = await res.json();

            if (data.sources) {
                const mapped = data.sources.map((s: any) => ({
                    id: s.accountId,
                    name: s.accountName,
                    icon: s.sourceType === 'google-ads' ? <Activity size={14} /> :
                        s.sourceType === 'meta-ads' ? <Activity size={14} style={{ color: '#1877F2' }} /> :
                            <CheckCircle2 size={14} />,
                    type: s.sourceType
                }));
                setDataSources(mapped);
            }
        } catch (e) {
            console.error("Failed to fetch sources", e);
        }
    }, [userId]);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    useEffect(() => {
        if (userId) {
            fetchSources();
        }
    }, [userId, fetchSources]);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setInput(newValue);

        // Check for @ mention trigger
        const lastAt = newValue.lastIndexOf('@');
        if (lastAt !== -1 && lastAt < newValue.length) {
            const query = newValue.slice(lastAt + 1);
            if (!query.includes(' ')) {
                setShowMentions(true);
                setMentionQuery(query);
                setMentionIndex(0);
                return;
            }
        }
        setShowMentions(false);
    };

    const addMention = (source: any) => {
        if (selectedSources.some(s => s.name === source.name)) {
            setShowMentions(false);
            return;
        }
        setSelectedSources(prev => [...prev, source]);

        // Replace the @query part with @Name
        const lastAt = input.lastIndexOf('@');
        if (lastAt !== -1) {
            const before = input.substring(0, lastAt);
            setInput(`${before}@${source.name} `);
        }

        setShowMentions(false);
        setTimeout(() => {
            if (inputTextAreaRef.current) {
                inputTextAreaRef.current.focus();
            }
        }, 10);
    };

    const removeSource = (sourceName: string) => {
        setSelectedSources(prev => prev.filter(s => s.name !== sourceName));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (showMentions && filteredSources.length > 0) {
                addMention(filteredSources[mentionIndex]);
            } else {
                handleSendMessage();
            }
        } else if (showMentions) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(prev => (prev + 1) % filteredSources.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(prev => (prev - 1 + filteredSources.length) % filteredSources.length);
            } else if (e.key === 'Escape') {
                setShowMentions(false);
            } else if (e.key === 'Tab') {
                e.preventDefault();
                if (filteredSources.length > 0) addMention(filteredSources[mentionIndex]);
            }
        }
    };

    const handleSendMessage = async (e?: React.FormEvent, contentOverride?: string) => {
        e?.preventDefault();
        const msgContent = contentOverride || input;
        if (!msgContent.trim() || isSubmittingRef.current) return;

        isSubmittingRef.current = true;
        setIsLoading(true);

        // Prepend sources to content if any are selected
        let finalContent = msgContent;
        if (selectedSources.length > 0) {
            const sourceNames = selectedSources.map(s => s.name).join(', ');
            finalContent = `[Context Sources: ${sourceNames}]\n\n${msgContent}`;
        }

        const userMessage: Message = { role: 'user', content: msgContent }; // Show original to user
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setSelectedSources([]); // Clear selection
        setTimeout(() => inputTextAreaRef.current?.focus(), 0);

        try {
            const apiEndpoint = '/api/blackswan/chat';
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, { ...userMessage, content: finalContent }], // Send modified content to API
                }),
            });

            if (!response.ok) throw new Error('Failed to get response');

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            if (!reader) throw new Error('No reader available');

            const initialAssistantMsg = { role: 'assistant', content: '', toolLogs: [] };
            setMessages(prev => [...prev, initialAssistantMsg as Message]);

            let buffer = '';
            let accumulatedContent = '';
            let toolLogs: ToolLog[] = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);

                        if (data.type === 'text') {
                            accumulatedContent += data.content;
                            setMessages(prev => {
                                const newMsgs = [...prev];
                                if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'assistant') {
                                    newMsgs[newMsgs.length - 1] = {
                                        ...newMsgs[newMsgs.length - 1],
                                        content: accumulatedContent
                                    };
                                }
                                return newMsgs;
                            });
                        } else if (data.type === 'tool_start') {
                            const newLog: ToolLog = {
                                name: data.tool,
                                status: 'running',
                                timestamp: Date.now(),
                                input: data.input
                            };
                            toolLogs.push(newLog);
                            setMessages(prev => {
                                const newMsgs = [...prev];
                                const lastMsg = newMsgs[newMsgs.length - 1];
                                lastMsg.toolLogs = [...toolLogs];
                                return newMsgs;
                            });
                        } else if (data.type === 'tool_end') {
                            const index = toolLogs.findIndex(l => l.name === data.tool && l.status === 'running');
                            if (index !== -1) {
                                toolLogs[index].status = 'complete';
                                toolLogs[index].output = data.output;
                            }
                            setMessages(prev => {
                                const newMsgs = [...prev];
                                const lastMsg = newMsgs[newMsgs.length - 1];
                                lastMsg.toolLogs = [...toolLogs];
                                return newMsgs;
                            });
                        }
                    } catch (e) { console.warn("Parse error", e); }
                }
            }
        } catch (error: any) {
            console.error('Chat error:', error);
            const errorMsg = { role: 'assistant', content: `Sorry, I encountered an error: ${error.message}` };
            setMessages(prev => [...prev, errorMsg as Message]);
        } finally {
            isSubmittingRef.current = false;
            setIsLoading(false);
            setTimeout(() => inputTextAreaRef.current?.focus(), 50);
        }
    };

    // Auto Scroll logic
    const hasMessages = messages.length > 0;
    useEffect(() => {
        if (messages.length === 0) return;
        const lastIdx = messages.length - 1;
        const lastMsg = messages[lastIdx];
        let focusTargetIdx = lastIdx;
        if (lastMsg.role === 'assistant' && lastIdx > 0) {
            focusTargetIdx = lastIdx - 1;
        }
        const targetId = `msg-${focusTargetIdx}`;
        const scrollToTarget = () => {
            const el = document.getElementById(targetId);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        scrollToTarget();
        setTimeout(scrollToTarget, 100);
    }, [messages.length]);

    return (
        <div style={{ flex: 1, height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-color)', position: 'relative', fontFamily: 'var(--font-sans)', width: '100%' }}>

            {/* User Info */}
            <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 100, display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', opacity: 0.8 }}>
                        {user ? `${user.firstName} ${user.lastName}` : 'User'}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', opacity: 0.7 }}>
                        {user?.email || 'blackswan@centori.io'}
                    </span>
                </div>
            </div>

            {/* Chat Container */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '80px 20px 120px', display: 'flex', flexDirection: 'column', alignItems: 'center', scrollbarWidth: 'none', transition: 'opacity 0.4s ease', scrollBehavior: 'smooth' }}>
                <div style={{ width: '100%', maxWidth: hasMessages ? '900px' : '850px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {messages.map((msg, idx) => (
                        <div key={idx} id={`msg-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: idx === 0 ? '0' : '16px', animation: 'messageSlideUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)', alignItems: msg.role === 'user' ? 'flex-start' : 'stretch', paddingTop: msg.role === 'user' ? '20px' : '0' }}>
                            {msg.role === 'user' && (
                                <div style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text-main)', padding: '12px 0', textAlign: 'left', marginBottom: '8px', marginTop: '8px', lineHeight: '1.6' }}>
                                    {msg.content}
                                </div>
                            )}

                            {msg.role === 'assistant' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {/* 1. SOURCES Section */}
                                    <SourcesRow logs={msg.toolLogs} />

                                    {/* 2. ANSWER Section */}
                                    {msg.content && msg.content.trim().length > 0 && (
                                        <div style={{ marginTop: '0', paddingTop: '0' }}>
                                            <div className="markdown-content" style={{ fontSize: '16px', fontWeight: 400, lineHeight: '1.7', color: 'var(--text-main)', textAlign: 'left' }}>
                                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                                                    table: ({ children }) => <TableRenderer>{children}</TableRenderer>,
                                                    thead: ({ children }) => <thead style={{ background: 'var(--bg-hover)' }}>{children}</thead>,
                                                    th: ({ children }) => <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--border-color)', color: 'var(--text-main)', background: 'var(--bg-hover)' }}>{children}</th>,
                                                    td: ({ children }) => <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-main)', background: 'var(--bg-color)' }}>{children}</td>,
                                                }}>
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Loader */}
                    {isLoading && (
                        <div style={{ animation: 'fadeIn 0.3s', display: 'flex', gap: '10px', alignItems: 'center', marginLeft: '20px', color: 'var(--text-muted)' }}>
                            <Loader2 size={16} className="animate-spin" />
                            <span style={{ fontSize: '14px' }}>
                                {messages.length > 0 && messages[messages.length - 1].toolLogs?.some(t => t.status === 'running')
                                    ? (() => {
                                        const runningTool = messages[messages.length - 1].toolLogs?.find(t => t.status === 'running');
                                        const toolName = runningTool?.name.replace(/_/g, ' ').replace('google', 'Google').replace('ads', 'Ads').replace('meta', 'Meta') || 'Tool';
                                        return `Blackswan is using ${toolName}...`;
                                    })()
                                    : "Blackswan is thinking..."}
                            </span>
                        </div>
                    )}
                    <div style={{ minHeight: '20vh', width: '100%', flexShrink: 0 }} />
                </div>
            </div>

            {/* Input Area */}
            <div style={{ position: 'fixed', top: !hasMessages ? '50%' : 'auto', bottom: !hasMessages ? 'auto' : '40px', left: '50%', transform: !hasMessages ? 'translate(-50%, -50%)' : 'translateX(-50%)', width: '100%', maxWidth: !hasMessages ? '760px' : '620px', padding: '0 24px', zIndex: 1000, transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                {/* ... existing Input Area code ... */}
                {/* Welcome Text */}
                <div style={{ textAlign: 'center', marginBottom: '32px', opacity: !hasMessages ? 1 : 0, transform: !hasMessages ? 'translateY(0)' : 'translateY(-20px)', pointerEvents: !hasMessages ? 'auto' : 'none', position: !hasMessages ? 'relative' : 'absolute' }}>
                    <h1 style={{ fontSize: '42px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-main)', letterSpacing: '-0.02em', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
                        <Sparkles size={42} style={{ color: 'var(--primary-color)' }} />
                        Blackswan
                    </h1>
                </div>

                <div className={`nexus-input-glow`} style={{ backgroundColor: 'var(--bg-card)', backdropFilter: 'blur(25px)', borderRadius: '24px', position: 'relative', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', padding: '2px', display: 'flex', flexDirection: 'column', transition: 'all 0.4s', border: '1px solid var(--border-color)' }}>
                    <div style={{ backgroundColor: 'var(--input-bg)', borderRadius: '22px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 2, padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', padding: '0' }}>
                            {/* ... textarea and button ... */}
                            <textarea
                                ref={inputTextAreaRef}
                                value={input}
                                onChange={handleInput}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask Blackswan anything..."
                                disabled={isLoading}
                                rows={1}
                                style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '16px', fontWeight: 400, color: 'var(--text-main)', padding: '8px 4px', fontFamily: '"Google Sans Flex", var(--font-sans)', resize: 'none', minHeight: '24px', maxHeight: '150px', overflowY: 'auto', lineHeight: '1.5' }}
                            />
                            <div style={{ display: 'flex', gap: '8px', paddingBottom: '4px', alignItems: 'center' }}>
                                <button onClick={() => handleSendMessage()} disabled={!input.trim() || isLoading} style={{ height: '32px', width: '32px', borderRadius: '10px', backgroundColor: (!input.trim() || isLoading) ? '#f1f5f9' : 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: (!input.trim() || isLoading) ? 'default' : 'pointer', transition: 'all 0.2s' }}>
                                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={18} strokeWidth={2.5} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Selected Sources Chips */}
                {selectedSources.length > 0 && (
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {selectedSources.map(s => (
                            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0, 98, 117, 0.1)', color: 'var(--primary-color)', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 500 }}>
                                <span>{s.name}</span>
                                <button onClick={() => removeSource(s.name)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}>
                                    &times;
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Mentions Dropdown */}
                {showMentions && filteredSources.length > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: hasMessages ? 'auto' : '100%',
                        bottom: hasMessages ? '100%' : 'auto',
                        marginBottom: hasMessages ? '12px' : '0',
                        marginTop: !hasMessages ? '4px' : '0',
                        left: '0',
                        right: '0',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '16px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                        width: 'auto',
                        overflow: 'hidden',
                        zIndex: 9999,
                        animation: 'slideDownFade 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        transformOrigin: hasMessages ? 'bottom center' : 'top center'
                    }}>
                        {/* ... dropdown content ... */}
                        <div style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-sidebar)', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)' }}>
                            DATA SOURCES
                        </div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {filteredSources.map((source, idx) => (
                                <div
                                    key={source.id}
                                    onClick={() => addMention(source)}
                                    onMouseEnter={() => setMentionIndex(idx)}
                                    style={{
                                        padding: '10px 16px',
                                        cursor: 'pointer',
                                        background: idx === mentionIndex ? 'var(--border-color)' : 'var(--bg-card)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        color: 'var(--text-main)',
                                        transition: 'background 0.1s'
                                    }}
                                >
                                    <div style={{ color: 'var(--primary-color)' }}>{source.icon}</div>
                                    {source.name}
                                    {idx === mentionIndex && <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>↵</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <style jsx global>{`
                 /* Reuse Styles */
                 .markdown-content h1, .markdown-content h2 { margin-top: 0; margin-bottom: 16px; color: var(--text-main); font-weight: 700; }
                 .markdown-content p { margin-bottom: 12px; }
                 .markdown-content ul { margin-bottom: 12px; padding-left: 20px; }
                 .markdown-content li { margin-bottom: 6px; }
                 .markdown-content strong { color: var(--primary-color); font-weight: 700; }
                 .nexus-input-glow { border: 1px solid rgba(33, 188, 255, 0.2) !important; }
                 .nexus-input-glow:focus-within { border-color: var(--primary-color) !important; box-shadow: 0 0 0 4px rgba(33, 188, 255, 0.1) !important; }
                 @keyframes pulse-ring {
                     0% { box-shadow: 0 0 0 0 rgba(33, 188, 255, 0.4); }
                     70% { box-shadow: 0 0 0 4px rgba(33, 188, 255, 0); }
                     100% { box-shadow: 0 0 0 0 rgba(33, 188, 255, 0); }
                 }
                 .running-tool { animation: pulse-ring 2s infinite; border-color: var(--primary-color) !important; }
             `}</style>
        </div>
    );
}
