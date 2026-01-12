'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp, Sparkles, User, Bot, Loader2, RotateCcw, ChevronDown, CheckCircle2, Globe, Copy, Check, Activity, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRouter } from 'next/navigation';



interface ToolLog {
    name: string;
    status: 'running' | 'complete';
    output?: any;
    input?: any;
    timestamp: number;
}

interface SupervisorDecision {
    next: string;
    reasoning: string;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    toolLogs?: ToolLog[];
    supervisorDecision?: SupervisorDecision;
}

// Resource Icon component for Source summary
function SourceIcon({ name }: { name: string }) {
    if (name === 'supervisor' || name === 'routing') {
        return (
            <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 107, 107, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <Zap size={10} style={{ color: '#FF6B6B' }} />
            </div>
        );
    }

    // Google Ads Branding
    if (name === 'google-ads' || name === 'ADS_AGENT' || name.startsWith('get_')) {
        return (
            <div style={{
                width: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <img src="/google_ads_logo.png" alt="Ads" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
        );
    }

    // Google Sheets Branding
    if (name === 'google-sheets' || name === 'SHEETS_AGENT' || name === 'create_google_sheet') {
        return (
            <div style={{
                width: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <img src="/google_sheets_logo.png" alt="Sheets" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
        );
    }

    return (
        <div style={{
            width: '16px',
            height: '16px',
            borderRadius: '4px',
            backgroundColor: 'rgba(33, 188, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px'
        }}>
            <Globe size={10} style={{ color: 'var(--primary-color)' }} />
        </div>
    );

}

// Helper to extract follow-up questions
function extractFollowUpQuestions(content: string): { cleanedContent: string; questions: string[] } {
    const followUpHeaderRegex = /###\s*Follow-up Questions[:\s]*\n/i;
    const match = content.match(followUpHeaderRegex);

    if (!match || match.index === undefined) {
        return { cleanedContent: content, questions: [] };
    }

    const cleanedContent = content.substring(0, match.index).trim();
    const questionsPart = content.substring(match.index + match[0].length);

    // Extract questions (lines starting with -, *, or numbers)
    const questions = questionsPart
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.match(/^[-*]|\d+\./))
        .map(line => line.replace(/^[-*]|\d+\.\s*/, '').trim())
        .filter(q => q.length > 0)
        .slice(0, 3); // Limit to 3

    return { cleanedContent, questions };
}

// Table Renderer with Copy Button
const TableRenderer = ({ children }: { children: React.ReactNode }) => {
    const [copied, setCopied] = useState(false);
    const tableRef = useRef<HTMLTableElement>(null);

    const handleCopy = () => {
        if (!tableRef.current) return;

        // Simple CSV-like copy usually works best for Excel/Sheets
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



// Thinking Process Header & Sources Component
function ThinkingProcess({ logs, decision, isComplete = true }: { logs?: ToolLog[], decision?: SupervisorDecision, isComplete?: boolean }) {
    const [isExpanded, setIsExpanded] = useState(!isComplete); // Auto-expand when thinking
    const [displayedReasoning, setDisplayedReasoning] = useState('');
    const hasLogs = (logs && logs.length > 0) || !!decision;

    // Auto-collapse when complete
    useEffect(() => {
        if (isComplete && isExpanded) {
            const timer = setTimeout(() => setIsExpanded(false), 500);
            return () => clearTimeout(timer);
        } else if (!isComplete) {
            setIsExpanded(true);
        }
    }, [isComplete]);

    // Streaming text effect for supervisor decision
    useEffect(() => {
        if (decision?.reasoning) {
            setDisplayedReasoning('');
            let currentIndex = 0;
            const text = decision.reasoning;

            const interval = setInterval(() => {
                if (currentIndex < text.length) {
                    setDisplayedReasoning(text.substring(0, currentIndex + 1));
                    currentIndex++;
                } else {
                    clearInterval(interval);
                }
            }, 10);

            return () => clearInterval(interval);
        }
    }, [decision?.reasoning]);

    if (!hasLogs && isComplete) return null;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0px',
            marginBottom: '24px',
            padding: '2px', // Thin border gap for the glow
            borderRadius: '16px',
            position: 'relative',
            animation: 'fadeInScale 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
            width: '100%',
            maxWidth: '100%',
        }} className="intelligence-glow">
            <div
                onClick={() => hasLogs && setIsExpanded(!isExpanded)}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '16px',
                    borderRadius: '14px',
                    cursor: hasLogs ? 'pointer' : 'default',
                    userSelect: 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    zIndex: 2,
                    border: '1px solid rgba(0, 98, 117, 0.15)',
                }}
                className="glass-panel"
            >
                {/* Header Row */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%'
                }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        background: isComplete ? 'var(--success-color)' : 'var(--primary-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 15px ' + (isComplete ? 'rgba(16, 185, 129, 0.3)' : 'rgba(0, 98, 117, 0.3)'),
                        animation: isComplete ? 'none' : 'pulseIntelligence 2s infinite ease-in-out',
                        transition: 'background 0.5s ease',
                        flexShrink: 0
                    }}>
                        {isComplete ? (
                            <CheckCircle2 size={18} style={{ color: 'white' }} />
                        ) : (
                            <Bot size={18} style={{ color: 'white' }} />
                        )}
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <span style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            color: 'var(--text-main)',
                            letterSpacing: '-0.2px'
                        }}>
                            {!isComplete ? 'Nexus Intelligence at work' : 'Thought synthesis complete'}
                        </span>
                        <span style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            fontWeight: 500,
                            textTransform: 'uppercase',
                            letterSpacing: '0.8px',
                            opacity: 0.7,
                            marginTop: '1px'
                        }}>
                            {logs?.length || 0} Analytical steps taken
                        </span>
                    </div>

                    {hasLogs && (
                        <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            background: 'rgba(0,0,0,0.03)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.3s'
                        }}>
                            <ChevronDown size={14} style={{
                                transform: isExpanded ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                color: 'var(--text-muted)'
                            }} />
                        </div>
                    )}
                </div>

                {/* Vertical Lineage & Steps */}
                <div style={{
                    maxHeight: hasLogs && isExpanded ? '1200px' : '0',
                    overflow: 'hidden',
                    transition: 'max-height 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease',
                    opacity: hasLogs && isExpanded ? 1 : 0,
                    position: 'relative',
                    marginTop: isExpanded ? '20px' : '0',
                }}>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                        paddingLeft: '15px',
                        paddingBottom: '8px',
                        position: 'relative'
                    }}>
                        {/* Connecting Line */}
                        <div style={{
                            position: 'absolute',
                            left: '15px',
                            top: '10px',
                            bottom: '20px',
                            width: '2px',
                            background: 'linear-gradient(180deg, var(--primary-color) 0%, rgba(0, 98, 117, 0.05) 100%)',
                            opacity: 0.2,
                            borderRadius: '1px'
                        }} />

                        {/* Supervisor Step */}
                        {decision && (
                            <div style={{
                                display: 'flex',
                                gap: '16px',
                                position: 'relative'
                            }}>
                                <div style={{
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    background: 'var(--primary-color)',
                                    marginTop: '5px',
                                    marginLeft: '-4px', // Align with border
                                    zIndex: 2,
                                    boxShadow: '0 0 0 4px white, 0 0 10px var(--primary-color)'
                                }} />
                                <div style={{
                                    flex: 1,
                                    background: 'rgba(255, 255, 255, 0.4)',
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(0, 98, 117, 0.1)',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <Zap size={14} color="var(--primary-color)" fill="var(--primary-color)" />
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary-color)' }}>Supervisor Routing</span>
                                    </div>
                                    <div style={{
                                        color: 'var(--text-main)',
                                        fontStyle: 'italic',
                                        lineHeight: '1.5',
                                        fontSize: '13px'
                                    }}>
                                        "{displayedReasoning}"
                                    </div>
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        marginTop: '10px',
                                        padding: '4px 10px',
                                        background: 'var(--bg-color)',
                                        borderRadius: '8px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        color: 'var(--primary-color)',
                                        border: '1px solid rgba(0, 98, 117, 0.1)'
                                    }}>
                                        <span style={{ opacity: 0.6 }}>TARGET</span>
                                        {decision.next.replace('_AGENT', '')}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tool Log Steps */}
                        {logs?.map((log, idx) => (
                            <div key={idx} style={{
                                display: 'flex',
                                gap: '16px',
                                position: 'relative'
                            }}>
                                <div style={{
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    background: log.status === 'complete' ? 'var(--success-color)' : 'var(--primary-color)',
                                    marginTop: '11px',
                                    marginLeft: '-4px',
                                    zIndex: 2,
                                    boxShadow: '0 0 0 4px white, 0 0 10px ' + (log.status === 'complete' ? 'var(--success-color)' : 'var(--primary-color)'),
                                    transition: 'background 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                                }} />
                                <div style={{
                                    flex: 1,
                                    background: 'white',
                                    padding: '10px 16px',
                                    borderRadius: '12px',
                                    border: '1px solid ' + (log.status === 'complete' ? 'var(--success-color)' : 'rgba(0,0,0,0.06)'),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                                    transition: 'border 0.4s ease'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <SourceIcon name={log.name} />
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                                            {log.name.split('_').join(' ')}
                                        </span>
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '11px',
                                        fontWeight: 500,
                                        color: log.status === 'complete' ? 'var(--success-color)' : 'var(--text-muted)'
                                    }}>
                                        {log.status === 'complete' ? (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Check size={12} strokeWidth={3} /> Success
                                            </span>
                                        ) : (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Loader2 size={12} className="animate-spin" /> In progress
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function NexusAIPage() {
    const [messages, setMessages] = useState<Message[]>([]); // Start empty for search-like feel
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeTool, setActiveTool] = useState<string | null>(null);
    const [userId, setUserId] = useState<number | null>(null);



    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const [user, setUser] = useState<{ firstName: string; lastName: string; email: string } | null>(null);

    // Mentions & Input State
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);

    const [selectedSources, setSelectedSources] = useState<any[]>([]);
    const inputTextAreaRef = useRef<HTMLTextAreaElement>(null);

    const [dataSources, setDataSources] = useState<any[]>([]);

    const [flashCards, setFlashCards] = useState<any[]>([]);
    const [loadingCards, setLoadingCards] = useState(false);
    const isSubmittingRef = useRef(false);

    const generateFlashCards = async () => {
        if (flashCards.length > 0 || loadingCards) return;
        setLoadingCards(true);
        // ...
    };

    // Fetch userId and user info on mount
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch('/api/me');
                if (res.ok) {
                    const data = await res.json();
                    setUserId(data.userId);
                    // Set user data directly from /api/me
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
        };
        fetchUser();
    }, []);



    // Populate data sources
    useEffect(() => {
        const fetchSources = async () => {
            if (!userId) return;
            try {
                const res = await fetch(`/api/sources/status?userId=${userId}`);
                const data = await res.json();

                if (data.sources) {
                    const mapped = data.sources.map((s: any) => ({
                        id: s.accountId,
                        name: s.accountName,
                        icon: s.sourceType === 'google-ads' ? <Activity size={14} /> : <CheckCircle2 size={14} />,
                        type: s.sourceType
                    }));
                    setDataSources(mapped);
                }
            } catch (e) {
                console.error("Failed to fetch sources", e);
            }
        };

        if (userId) {
            fetchSources();
        }
    }, [userId]);

    const filteredSources = dataSources.filter(s =>
        s.name.toLowerCase().includes(mentionQuery.toLowerCase())
    );

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



    // ...

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
            // We append a space after the name for better UX
            setInput(`${before}@${source.name} `);
        }

        setShowMentions(false);
        // Ensure focus returns to input
        setTimeout(() => {
            if (inputTextAreaRef.current) {
                inputTextAreaRef.current.focus();
                // Move cursor to end
                const len = inputTextAreaRef.current.value.length;
                inputTextAreaRef.current.setSelectionRange(len, len);
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

        if (msgContent === '/clear') {
            setMessages([]);
            setInput('');
            isSubmittingRef.current = false;
            setIsLoading(false);
            return;
        }

        const userMessage: Message = { role: 'user', content: msgContent };

        // Optimistic update UI
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setTimeout(() => inputTextAreaRef.current?.focus(), 0);

        try {
            // Context prep
            let activeAccountId = null;
            let finalContent = msgContent;

            if (selectedSources.length > 0) {
                const sourceNames = selectedSources.map(s => s.name);
                const sourceIds = selectedSources.map(s => s.id);
                if (sourceIds.length > 0) activeAccountId = sourceIds[0];
                finalContent = `[Sources: ${sourceNames.join(', ')}]\n\n${msgContent}`;
            }

            setSelectedSources([]);

            // API Call
            const response = await fetch('/api/nexus/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, { ...userMessage, content: finalContent }],
                    userId,
                    accountId: activeAccountId
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.details || 'Failed to get AI response');
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            if (!reader) throw new Error('No reader available');

            // Initial Assistant Message
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
                            // Update UI
                            setMessages(prev => {
                                const newMsgs = [...prev];
                                const lastMsg = newMsgs[newMsgs.length - 1];
                                if (lastMsg.role === 'assistant') {
                                    lastMsg.content = accumulatedContent;
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

                            setActiveTool(data.tool);
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

                            setActiveTool(null);
                            setMessages(prev => {
                                const newMsgs = [...prev];
                                const lastMsg = newMsgs[newMsgs.length - 1];
                                lastMsg.toolLogs = [...toolLogs];
                                return newMsgs;
                            });
                        } else if (data.type === 'supervisor_decision') {
                            setMessages(prev => {
                                const newMsgs = [...prev];
                                const lastMsg = newMsgs[newMsgs.length - 1];
                                lastMsg.supervisorDecision = { next: data.next, reasoning: data.reasoning };
                                return newMsgs;
                            });
                        } else if (data.type === 'error') {
                            throw new Error(data.content);
                        }
                    } catch (e) {
                        console.warn("Failed to parse chunk", e);
                    }
                }
            }
        } catch (error: any) {
            console.error('Chat error:', error);
            const errorMsg = {
                role: 'assistant',
                content: `### ⚠️ Connection Error\nI'm sorry, I encountered a problem: **${error.message}**. Please try again.`
            };

            setActiveTool(null);
            setMessages(prev => {
                const filtered = prev.filter(m => m.role !== 'assistant' || m.content !== '');
                return [...filtered, errorMsg as Message];
            });
        } finally {
            isSubmittingRef.current = false;
            setIsLoading(false);
            setActiveTool(null);
            setTimeout(() => inputTextAreaRef.current?.focus(), 50);
        }
    };



    const hasMessages = messages.length > 0;

    return (
        <>

            <div
                style={{
                    flex: 1,
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'var(--bg-color)',
                    position: 'relative',
                    fontFamily: 'var(--font-sans)',
                    marginLeft: 0,
                    width: '100%'
                }}
            >
                {/* User Info - Top Left */}
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    alignItems: 'flex-end'
                }}>
                    <span style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--text-main)',
                        opacity: 0.8
                    }}>
                        {user ? `${user.firstName} ${user.lastName}` : 'User'}
                    </span>
                    <span style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        opacity: 0.7
                    }}>
                        {user?.email || 'user@example.com'}
                    </span>
                </div>

                {/* Chat Container */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '80px 20px 180px', // Reduced top padding
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    scrollbarWidth: 'none',
                    opacity: hasMessages ? 1 : 0, // Hide chat list initially
                    transition: 'opacity 0.4s ease',
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: hasMessages ? '900px' : '850px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '24px',
                    }}>
                        {messages.map((msg, idx) => (
                            <div key={idx} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: idx === 0 ? '0' : '16px',
                                animation: 'messageSlideUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
                                opacity: 1,
                                alignItems: msg.role === 'user' ? 'flex-start' : 'stretch',
                            }}>
                                {msg.role === 'user' && (
                                    <div style={{
                                        fontSize: '20px',
                                        fontWeight: 500,
                                        color: 'var(--text-main)',
                                        padding: '12px 0',
                                        textAlign: 'left',
                                        marginBottom: '8px',
                                        marginTop: '8px',
                                        lineHeight: '1.6'
                                    }}>
                                        {msg.content}
                                    </div>
                                )}

                                {msg.role === 'assistant' && (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {/* Persistent Thinking Process Header */}
                                        <ThinkingProcess
                                            logs={msg.toolLogs}
                                            decision={msg.supervisorDecision}
                                            isComplete={!isLoading || idx < messages.length - 1}
                                        />

                                        <div style={{
                                            fontSize: '16px',
                                            fontWeight: 400,
                                            lineHeight: '1.7',
                                            color: 'var(--text-main)',
                                            textAlign: 'left',
                                            padding: '0'
                                        }} className="markdown-content">
                                            {(() => {
                                                const { cleanedContent, questions } = extractFollowUpQuestions(msg.content);
                                                return (
                                                    <>
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                            components={{
                                                                table: ({ children }) => <TableRenderer>{children}</TableRenderer>,
                                                                thead: ({ children }) => <thead style={{ background: '#f8fafc' }}>{children}</thead>,
                                                                th: ({ children }) => <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--border-color)', color: 'var(--text-main)' }}>{children}</th>,
                                                                td: ({ children }) => <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-main)' }}>{children}</td>
                                                            }}
                                                        >
                                                            {cleanedContent}
                                                        </ReactMarkdown>


                                                        {questions.length > 0 && (
                                                            <div style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                                {questions.map((q, qIdx) => (
                                                                    <button
                                                                        key={qIdx}
                                                                        onClick={() => handleSendMessage(undefined, q)}
                                                                        disabled={isLoading}
                                                                        style={{
                                                                            padding: '8px 16px',
                                                                            borderRadius: '20px',
                                                                            border: '1px solid var(--border-color)',
                                                                            background: 'white',
                                                                            color: 'var(--primary-color)',
                                                                            fontSize: '13px',
                                                                            fontWeight: 500,
                                                                            cursor: isLoading ? 'default' : 'pointer',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '6px',
                                                                            transition: 'all 0.2s',
                                                                            opacity: isLoading ? 0.6 : 1
                                                                        }}
                                                                        className="action-btn"
                                                                    >
                                                                        <Sparkles size={14} />
                                                                        {q}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Active Status / Thinking - Perplexity Style */}
                        {isLoading && (
                            <div style={{ animation: 'fadeIn 0.3s' }}>
                                <div style={{
                                    marginLeft: '28px', // Align with Sources indentation
                                    marginTop: '-8px',
                                    color: 'var(--text-muted)',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}>
                                    <Loader2 size={14} className="animate-spin" style={{ color: 'var(--primary-color)' }} />
                                    <span>{activeTool ? `Executing ${activeTool.split('_').join(' ')}...` : 'Searching for information...'}</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} style={{ height: '40px' }} />
                    </div>
                </div >

                {/* Premium Floating Input Area - Perplexity Style */}
                < div style={{
                    position: 'fixed',
                    top: !hasMessages ? '50%' : 'auto',
                    bottom: !hasMessages ? 'auto' : '40px',
                    left: '50%',
                    transform: !hasMessages ? 'translate(-50%, -50%)' : 'translateX(-50%)',
                    width: '100%',
                    maxWidth: !hasMessages ? '760px' : '620px',
                    padding: '0 24px',
                    zIndex: 1000,
                    transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)', // Smooth "spring-like" ease
                }
                }>
                    {/* Hero Welcome Text */}
                    < div style={{
                        textAlign: 'center',
                        marginBottom: '32px',
                        opacity: !hasMessages ? 1 : 0,
                        transform: !hasMessages ? 'translateY(0)' : 'translateY(-20px)',
                        pointerEvents: !hasMessages ? 'auto' : 'none',
                        position: !hasMessages ? 'relative' : 'absolute',
                    }}>
                        <h1 style={{
                            fontSize: '42px',
                            fontWeight: 600,
                            marginBottom: '16px',
                            color: 'var(--text-main)',
                            letterSpacing: '-0.02em'
                        }}>
                            Marketing Agent
                        </h1>
                    </div >


                    <div
                        className="nexus-input-glow"
                        style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            backdropFilter: 'blur(20px)',
                            borderRadius: '24px', // Reduced radius
                            position: 'relative',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.08)', // Adding slight shadow back for depth
                            padding: '2px',
                            display: 'flex',
                            flexDirection: 'column',
                            transition: 'none',
                        }}>
                        {/* Inner Content Area */}
                        <div style={{
                            backgroundColor: 'white',
                            borderRadius: '22px', // Match outer
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            position: 'relative',
                            zIndex: 2,
                            padding: '8px 12px', // Reduced padding
                        }}>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    gap: '12px',
                                    padding: '0',
                                }}
                            >
                                <textarea
                                    ref={inputTextAreaRef}
                                    value={input}
                                    onChange={handleInput}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask anything... (Type @ for sources)"
                                    disabled={isLoading}
                                    rows={1}
                                    style={{
                                        flex: 1,
                                        border: 'none',
                                        background: 'transparent',
                                        outline: 'none',
                                        fontSize: '16px', // Reduced font size
                                        fontWeight: 400,
                                        color: 'var(--text-main)',
                                        padding: '8px 4px',
                                        fontFamily: '"Google Sans Flex", var(--font-sans)',
                                        resize: 'none',
                                        minHeight: '24px',
                                        maxHeight: '150px',
                                        overflowY: 'auto',
                                        lineHeight: '1.5',
                                        transition: 'height 0.2s cubic-bezier(0.2, 0, 0.2, 1)' // Smooth height transition
                                    }}
                                />
                                <div style={{ display: 'flex', gap: '8px', paddingBottom: '4px' }}>
                                    {/* Premium Send Button */}
                                    <button
                                        onClick={() => handleSendMessage()}
                                        disabled={!input.trim() || isLoading}
                                        style={{
                                            height: '32px', // Smaller button
                                            width: '32px',
                                            borderRadius: '10px',
                                            backgroundColor: (!input.trim() || isLoading) ? '#f1f5f9' : 'var(--primary-color)',
                                            color: 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: 'none',
                                            cursor: (!input.trim() || isLoading) ? 'default' : 'pointer',
                                            transition: 'all 0.2s',
                                            boxShadow: (!input.trim() || isLoading) ? 'none' : '0 2px 5px rgba(0, 136, 163, 0.3)',
                                        }}
                                    >
                                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={18} strokeWidth={2.5} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Suggestions (Moved to bottom) & Selected Sources Chips */}
                    <div style={{
                        marginTop: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        alignItems: 'center'
                    }}>
                        {/* Selected Sources Chips */}
                        {selectedSources.length > 0 && (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                {selectedSources.map(s => (
                                    <div key={s.name} style={{
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        background: 'rgba(0, 98, 117, 0.1)', color: 'var(--primary-color)',
                                        padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 500
                                    }}>
                                        <span>{s.name}</span>
                                        <button onClick={() => removeSource(s.name)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}>
                                            &times;
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Suggested Questions (Always render for transition) */}
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '8px',
                            justifyContent: 'center',
                            padding: '0 20px',
                            // Smooth fade and slide
                            opacity: (!hasMessages && !input && selectedSources.length === 0) ? 1 : 0,
                            transform: (!hasMessages && !input && selectedSources.length === 0) ? 'translateY(0)' : 'translateY(10px)',
                            pointerEvents: (!hasMessages && !input && selectedSources.length === 0) ? 'auto' : 'none',
                            transition: 'all 0.4s cubic-bezier(0.2, 0, 0.2, 1)',
                            maxHeight: (!hasMessages && !input && selectedSources.length === 0) ? '200px' : '0px',
                            overflow: 'hidden'
                        }}>
                            {["Analyze my campaign performance", "Why are conversions down?", "Top performing keywords", "Budget utilization"].map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => setInput(q)}
                                    style={{
                                        pointerEvents: 'auto',
                                        background: 'rgba(255, 255, 255, 0.8)',
                                        backdropFilter: 'blur(10px)',
                                        border: '1px solid var(--border-color)',
                                        padding: '8px 16px',
                                        borderRadius: '20px',
                                        fontSize: '13px',
                                        color: 'var(--text-main)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                                    }}
                                    className="action-btn"
                                >
                                    <span style={{ marginRight: '6px' }}>✨</span>
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mentions Dropdown - Dynamic Positioning */}
                    {showMentions && filteredSources.length > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: hasMessages ? 'auto' : '100%',
                            bottom: hasMessages ? '100%' : 'auto',
                            marginBottom: hasMessages ? '12px' : '0',
                            marginTop: !hasMessages ? '4px' : '0',
                            left: '0',
                            right: '0',
                            background: 'white',
                            border: '1px solid var(--border-color)',
                            borderRadius: '16px',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                            width: 'auto', // Auto width to respect left/right 0
                            overflow: 'hidden',
                            zIndex: 9999,
                            animation: 'slideDownFade 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                            transformOrigin: hasMessages ? 'bottom center' : 'top center'
                        }}>
                            <div style={{
                                padding: '10px 16px',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: 'var(--text-muted)',
                                background: '#f8fafc',
                                letterSpacing: '0.05em',
                                borderBottom: '1px solid var(--border-color)'
                            }}>
                                DATA SOURCES
                            </div>
                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {filteredSources.map((source, idx) => (
                                    <div
                                        key={source.id}
                                        onClick={() => addMention(source)}
                                        // Mouse enter to update index for keyboard/mouse hybrid usage
                                        onMouseEnter={() => setMentionIndex(idx)}
                                        style={{
                                            padding: '10px 16px',
                                            cursor: 'pointer',
                                            background: idx === mentionIndex ? '#f1f5f9' : 'white',
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
                @keyframes messageSlideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes slideDownFade {
                    from { opacity: 0; transform: translateY(-10px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes slideInRight {
                    from { opacity: 0; transform: translateX(100%); }
                    to { opacity: 1; transform: translateX(0); }
                }
                /* Hide scrollbar for Chrome, Safari and Opera */
                ::-webkit-scrollbar {
                    display: none;
                }
                /* Hide scrollbar for IE, Edge and Firefox */
                html {
                    -ms-overflow-style: none;  /* IE and Edge */
                    scrollbar-width: none;  /* Firefox */
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; box-shadow: 0 0 10px var(--primary-color); }
                    50% { transform: scale(1.1); opacity: 0.7; box-shadow: 0 0 20px var(--primary-color); }
                    100% { transform: scale(1); opacity: 1; box-shadow: 0 0 10px var(--primary-color); }
                }
                
                 /* Nexus Input Styling */
                 .nexus-input-glow {
                      border: 1px solid rgba(33, 188, 255, 0.2) !important;
                 }

                 .nexus-input-glow:focus-within {
                     border-color: var(--primary-color) !important;
                     box-shadow: 0 0 0 4px rgba(33, 188, 255, 0.1) !important;
                 }

                /* Ensure text is readable above liquid */
                .nexus-input-glow:focus-within input {
                    color: var(--text-main);
                    position: relative;
                    z-index: 3;
                }

                .action-btn:hover {
                    background-color: #e2e8f0;
                    color: var(--text-main);
                }

                /* Markdown Styling refinements */
                .markdown-content h1, .markdown-content h2, .markdown-content h3 {
                    margin-top: 0;
                    margin-bottom: 16px;
                    color: var(--text-main);
                    font-weight: 700;
                    letter-spacing: -0.02em;
                }
                
                .markdown-content p { 
                    margin-bottom: 12px;
                    font-weight: 400;
                }

                .markdown-content ul, .markdown-content ol {
                    margin-top: 0;
                    margin-bottom: 12px;
                    padding-left: 20px;
                }

                .markdown-content li {
                    margin-bottom: 6px;
                    line-height: 1.6;
                }
                
                .markdown-content strong {
                    color: var(--primary-color);
                    font-weight: 700;
                }

                .markdown-content code {
                    background-color: #f1f5f9;
                    padding: 3px 8px;
                    border-radius: 6px;
                    font-family: inherit;
                    font-weight: 600;
                    color: var(--accent-color);
                    border: 1px solid #e2e8f0;
                }
                
                /* Keep scrollbar clean */
                ::-webkit-scrollbar { width: 0px; background: transparent; }
            `}</style>
            </div>
        </>
    );
}
