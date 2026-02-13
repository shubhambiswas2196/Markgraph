'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { ArrowUp, Sparkles, User, Bot, Loader2, RotateCcw, ChevronDown, CheckCircle2, Globe, Copy, Check, Activity, PlayCircle, FileSpreadsheet, XCircle, Brain, Search, PlusCircle, LayoutGrid, Layers, Database, Menu } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRouter } from 'next/navigation';
import CreativeGallery from '@/components/CreativeGallery';
import { ThinkingAccordion } from '@/components/ThinkingAccordion';
import { SimpleToolView } from '@/components/SimpleToolView';

import { ApprovalRequest } from '@/components/ApprovalRequests';
import { ChatSidebar } from '@/components/ChatSidebar';

interface ToolLog {
    name: string;
    status: 'running' | 'complete';
    output?: any;
    input?: any;
    timestamp: number;
    type?: 'tool' | 'agent';
}

interface SupervisorDecision {
    next: string;
    reasoning: string;
    todo_list?: string[];
}

interface Message {
    id: string; // Added for more stable rendering
    role: 'user' | 'assistant';
    content: string;
    toolLogs?: ToolLog[];
    supervisorDecision?: SupervisorDecision;
    pendingApproval?: {
        toolName: string;
        description: string;
        toolCall: any;
    };
    sources?: any[];
    activeTool?: string | null; // Added to track current tool activity
}

// Performance Optimized Table Renderer
const TableRenderer = memo(({ children }: { children: React.ReactNode }) => {
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
        <div className="perplexity-table-container">
            <button onClick={handleCopy} className="copy-table-btn">
                {copied ? <Check size={14} /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy'}
            </button>
            <div className="table-wrapper">
                <table>{children}</table>
            </div>
        </div>
    );
});
TableRenderer.displayName = 'TableRenderer';

// Memoized Message Item to prevent re-rendering massive histories
const MessageItem = memo(({ msg, isLast, isLoading, previousMsgSources }: {
    msg: Message;
    isLast: boolean;
    isLoading: boolean;
    previousMsgSources?: any[];
    activeTool?: string | null;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
}) => {
    return (
        <div id={`msg-${msg.id}`} className={`answer-card ${msg.role}`}>
            {msg.role === 'user' ? (
                <div className="query-header">
                    <h2 className="query-text">{msg.content}</h2>
                </div>
            ) : (
                <div className="response-content">
                    {previousMsgSources && previousMsgSources.length > 0 && (
                        <div className="source-row">
                            <div className="source-label"><Layers size={13} /> Sources</div>
                            <div className="source-list">
                                {previousMsgSources.map((s, si) => (
                                    <div key={`${msg.id}-src-${si}`} className="source-item">
                                        <span className="source-circle">{si + 1}</span>
                                        <span className="source-name-text">{s.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Show activity only while this response is being generated or awaiting approval */}
                    {(isLoading && isLast) || msg.pendingApproval ? (
                        <div className="meta-row">
                            <SimpleToolView
                                toolLogs={msg.toolLogs}
                                activeTool={msg.activeTool}
                            />
                        </div>
                    ) : null}

                    <div className="markdown-editorial">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                table: ({ children }) => <TableRenderer>{children}</TableRenderer>,
                                a: ({ node, href, children, ...props }) => {
                                    // Check if link is a Google Sheets URL
                                    const isGoogleSheets = href?.includes('docs.google.com/spreadsheets');

                                    if (isGoogleSheets) {
                                        return (
                                            <a
                                                href={href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="google-sheets-link"
                                                {...props}
                                            >
                                                <img
                                                    src="/google-sheets-icon.png"
                                                    alt="Google Sheets"
                                                    className="sheets-icon"
                                                />
                                                <span>{children}</span>
                                            </a>
                                        );
                                    }

                                    return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
                                }
                            }}
                        >
                            {msg.content}
                        </ReactMarkdown>
                    </div>

                    {msg.role === 'assistant' && (previousMsgSources?.length || msg.toolLogs?.length) && (
                        <div className="answer-meta">
                            <div className="answer-meta-line" />
                            <div className="answer-meta-row">
                                {previousMsgSources?.length ? (
                                    <span className="answer-meta-item">
                                        Sources: {previousMsgSources.map(s => s.name).join(', ')}
                                    </span>
                                ) : null}
                                {msg.toolLogs?.length ? (
                                    <span className="answer-meta-item">
                                        Tools: {[...new Set(msg.toolLogs.filter(l => l.type !== 'agent').map(l => l.name))].join(', ')}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    )}

                    {/* Approval Request */}
                    {msg.pendingApproval && (
                        <div className="meta-row mt-4">
                            <ApprovalRequest
                                approvalId={msg.pendingApproval.toolCall.id || msg.id}
                                description={msg.pendingApproval.description}
                                dataSummary={""}
                                onApprove={onApprove}
                                onReject={onReject}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}, (prev, next) => {
    // Custom comparison to only re-render if essential props change
    return (
        prev.msg.content === next.msg.content &&
        prev.isLast === next.isLast &&
        prev.isLoading === next.isLoading &&
        prev.msg.toolLogs === next.msg.toolLogs &&
        prev.msg.activeTool === next.msg.activeTool &&
        prev.msg.pendingApproval?.toolCall?.id === next.msg.pendingApproval?.toolCall?.id &&
        prev.msg.supervisorDecision?.next === next.msg.supervisorDecision?.next
    );
});
MessageItem.displayName = 'MessageItem';

export default function RomeoChargePage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [agentMode, setAgentMode] = useState<'multi' | 'single'>('multi');

    const [userId, setUserId] = useState<number | null>(null);
    const [user, setUser] = useState<{ firstName: string; lastName: string; email: string } | null>(null);
    const [hasAiConfig, setHasAiConfig] = useState<boolean>(true); // Default to true to avoid flash

    // Chat History & Sidebar
    const [conversations, setConversations] = useState<any[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Mentions & Data Sources
    const [dataSources, setDataSources] = useState<any[]>([]);
    const [selectedSources, setSelectedSources] = useState<any[]>([]);
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);


    const inputTextAreaRef = useRef<HTMLTextAreaElement>(null);
    const isSubmittingRef = useRef(false);
    const shouldAutoScrollRef = useRef(false);

    // Ref for holding the streaming content to throttle state updates
    const streamingBufferRef = useRef({
        content: '',
        lastUpdate: 0,
        requestId: 0
    });

    // Fetch user info
    const fetchUser = useCallback(async () => {
        try {
            const res = await fetch('/api/me');
            if (res.ok) {
                const data = await res.json();
                setUserId(data.userId);
                if (data.firstName && data.lastName) {
                    setUser({ firstName: data.firstName, lastName: data.lastName, email: data.email });
                }
                setHasAiConfig(!!data.hasAiConfig);
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
        } catch (e) { console.error("Failed to fetch sources", e); }
    }, [userId]);

    // Conversation Management Functions
    const fetchConversations = useCallback(async () => {
        if (!userId) return;
        try {
            const res = await fetch('/api/conversations');
            const data = await res.json();
            if (data.conversations) {
                setConversations(data.conversations);
            }
        } catch (e) {
            console.error("Failed to fetch conversations", e);
        }
    }, [userId]);

    const createNewConversation = useCallback(async (firstMessage?: string) => {
        try {
            const title = firstMessage
                ? firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : '')
                : `New Conversation - ${new Date().toLocaleTimeString()}`;

            const res = await fetch('/api/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title })
            });

            const data = await res.json();
            if (data.conversation) {
                setCurrentConversationId(data.conversation.id);
                setConversations(prev => [data.conversation, ...prev]);
                return data.conversation.id;
            }
        } catch (e) {
            console.error("Failed to create conversation", e);
        }
        return null;
    }, []);

    const loadConversation = useCallback(async (conversationId: number) => {
        try {
            const res = await fetch(`/api/conversations/${conversationId}`);
            const data = await res.json();
            if (data.conversation) {
                // Convert messages to the format expected by the UI
                const loadedMessages = data.conversation.messages.map((msg: any) => {
                    let parsedToolLogs = [];
                    try {
                        parsedToolLogs = msg.toolCalls ? JSON.parse(msg.toolCalls) : [];
                    } catch (e) {
                        console.error('Failed to parse toolCalls for msg', msg.id, e);
                    }
                    return {
                        id: msg.id.toString(),
                        role: msg.role === 'human' ? 'user' : 'assistant',
                        content: msg.content,
                        toolLogs: parsedToolLogs
                    };
                });
                setMessages(loadedMessages);
                setCurrentConversationId(conversationId);
            }
        } catch (e) {
            console.error("Failed to load conversation", e);
        }
    }, []);

    const deleteConversation = useCallback(async (conversationId: number) => {
        try {
            const res = await fetch(`/api/conversations/${conversationId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                setConversations(prev => prev.filter(c => c.id !== conversationId));

                // If we deleted the current conversation, start a new one
                if (conversationId === currentConversationId) {
                    setMessages([]);
                    setCurrentConversationId(null);
                }
            }
        } catch (e) {
            console.error("Failed to delete conversation", e);
        }
    }, [currentConversationId]);

    const saveMessageToConversation = useCallback(async (conversationId: number, role: string, content: string, toolCalls?: any[]) => {
        try {
            const res = await fetch(`/api/conversations/${conversationId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role, content, toolCalls })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Failed to save message: ${res.status}`);
            }
        } catch (e) {
            console.error("Failed to save message", e);
            // Re-throw so caller knows it failed (and can show error to user)
            throw e;
        }
    }, []);

    const handleNewChat = useCallback(() => {
        setMessages([]);
        setCurrentConversationId(null);
        setSidebarOpen(false);
        setInput('');
    }, []);


    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    useEffect(() => {
        try {
            const storedMode = localStorage.getItem('agent-mode');
            if (storedMode === 'single' || storedMode === 'multi') {
                setAgentMode(storedMode);
            }
        } catch {
            // Ignore storage errors
        }
    }, []);

    useEffect(() => {
        if (userId) {
            fetchSources();
            fetchConversations();
        }
    }, [userId, fetchSources, fetchConversations]);



    const filteredSources = dataSources.filter(s =>
        s.name.toLowerCase().includes(mentionQuery.toLowerCase())
    );

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setInput(newValue);

        if (inputTextAreaRef.current) {
            inputTextAreaRef.current.style.height = 'auto';
            inputTextAreaRef.current.style.height = `${inputTextAreaRef.current.scrollHeight}px`;
        }

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
        const lastAt = input.lastIndexOf('@');
        if (lastAt !== -1) {
            const before = input.substring(0, lastAt);
            setInput(`${before}@${source.name} `);
        }
        setShowMentions(false);
        setTimeout(() => inputTextAreaRef.current?.focus(), 10);
    };

    const removeSource = (sourceName: string) => {
        setSelectedSources(prev => prev.filter(s => s.name !== sourceName));
    };

    const flushStreamContent = useCallback(() => {
        setMessages(prev => {
            if (prev.length === 0) return prev;
            const newMsgs = [...prev];
            const last = newMsgs[newMsgs.length - 1];
            if (last.role === 'assistant') {
                newMsgs[newMsgs.length - 1] = {
                    ...last,
                    content: streamingBufferRef.current.content
                };
            }
            return newMsgs;
        });
        streamingBufferRef.current.lastUpdate = Date.now();
    }, []);

    const handleApprove = useCallback(async (approvalId: string) => {
        // Find the message with pending approval
        const relevantMsg = messages.find(m => m.pendingApproval?.toolCall.id === approvalId || m.id === approvalId); // Fallback to msg ID if tool ID missing
        if (!relevantMsg) return;

        // Optimistically update UI to remove approval card or show loading?
        setMessages(prev => prev.map(m => {
            if (m.id === relevantMsg.id) {
                return { ...m, pendingApproval: undefined, content: m.content + '\n\n**✅ Approved**' };
            }
            return m;
        }));

        setIsLoading(true);
        try {
            // Re-send request with approvalDecision: 'approved' using same history
            await fetch('/api/romeo-charge/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: messages, // Send full history
                    approvalDecision: 'approved'
                }),
            }).then(handleStreamResponse);
        } catch (e) {
            console.error("Approval failed", e);
            setIsLoading(false);
        }
    }, [messages]);

    const handleReject = useCallback(async (approvalId: string) => {
        setMessages(prev => prev.map(m => {
            if (m.pendingApproval?.toolCall.id === approvalId || m.id === approvalId) {
                return { ...m, pendingApproval: undefined, content: m.content + '\n\n**❌ Rejected**' };
            }
            return m;
        }));
        setIsLoading(false); // Stop loading, let user type new command
    }, []);

    // Extract stream handling to reusable function
    const handleStreamResponse = async (response: Response) => {
        if (!response.ok) throw new Error('Failed to get response');

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error('No reader available');

        // If we are continuing, do we add a new message or append to existing?
        // Usually continuing adds a new Assistant chunk.
        const assistantMsgId = (Date.now() + 1).toString();
        const initialAssistantMsg = { id: assistantMsgId, role: 'assistant', content: '', toolLogs: [], activeTool: 'Generating Answer' };
        setMessages(prev => [...prev, initialAssistantMsg as Message]);

        let buffer = '';
        streamingBufferRef.current.content = '';
        streamingBufferRef.current.lastUpdate = Date.now();

        let toolLogs: ToolLog[] = [];
        let supervisorDecision: SupervisorDecision | undefined;
        let currentActiveTool: string | null = 'Generating Answer'; // Re-init for this stream

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
                        streamingBufferRef.current.content += data.content;
                        const now = Date.now();
                        if (now - streamingBufferRef.current.lastUpdate > 50) {
                            flushStreamContent();
                        }
                    } else if (data.type === 'supervisor_decision') {
                        supervisorDecision = {
                            next: data.next,
                            reasoning: data.reasoning,
                            todo_list: data.todo_list
                        };
                        setMessages(prev => {
                            const newMsgs = [...prev];
                            const last = newMsgs[newMsgs.length - 1];
                            if (last.role === 'assistant') {
                                newMsgs[newMsgs.length - 1] = {
                                    ...last,
                                    supervisorDecision
                                };
                            }
                            return newMsgs;
                        });
                    } else if (data.type === 'tool_start') {
                        currentActiveTool = data.tool;
                        toolLogs.push({ name: data.tool, status: 'running', timestamp: Date.now(), input: data.input });
                        setMessages(prev => {
                            const newMsgs = [...prev];
                            const last = newMsgs[newMsgs.length - 1];
                            if (last.role === 'assistant') {
                                newMsgs[newMsgs.length - 1] = {
                                    ...last,
                                    toolLogs: [...toolLogs],
                                    activeTool: currentActiveTool
                                };
                            }
                            return newMsgs;
                        });
                    } else if (data.type === 'tool_end') {
                        currentActiveTool = null;
                        const index = toolLogs.findIndex(l => l.name === data.tool && l.status === 'running');
                        if (index !== -1) {
                            toolLogs[index].status = 'complete';
                            toolLogs[index].output = data.output;
                        }
                        setMessages(prev => {
                            const newMsgs = [...prev];
                            const last = newMsgs[newMsgs.length - 1];
                            if (last.role === 'assistant') {
                                newMsgs[newMsgs.length - 1] = {
                                    ...last,
                                    toolLogs: [...toolLogs],
                                    activeTool: null
                                };
                            }
                            return newMsgs;
                        });
                    } else if (data.type === 'node_start') {
                        toolLogs.push({ name: data.status, status: 'running', timestamp: Date.now(), type: 'agent' });
                        setMessages(prev => {
                            const newMsgs = [...prev];
                            const last = newMsgs[newMsgs.length - 1];
                            if (last.role === 'assistant') {
                                newMsgs[newMsgs.length - 1] = {
                                    ...last,
                                    toolLogs: [...toolLogs],
                                    activeTool: data.status
                                };
                            }
                            return newMsgs;
                        });
                    } else if (data.type === 'node_end') {
                        const runningAgentIdx = toolLogs.findIndex(l => l.type === 'agent' && l.status === 'running');
                        if (runningAgentIdx !== -1) {
                            toolLogs[runningAgentIdx].status = 'complete';
                            setMessages(prev => {
                                const newMsgs = [...prev];
                                const last = newMsgs[newMsgs.length - 1];
                                if (last.role === 'assistant') {
                                    newMsgs[newMsgs.length - 1] = {
                                        ...last,
                                        toolLogs: [...toolLogs],
                                        activeTool: null
                                    };
                                }
                                return newMsgs;
                            });
                        }
                    } else if (data.type === 'approval_required') {
                        setMessages(prev => {
                            const newMsgs = [...prev];
                            const last = newMsgs[newMsgs.length - 1];
                            if (last.role === 'assistant') {
                                newMsgs[newMsgs.length - 1] = {
                                    ...last,
                                    pendingApproval: {
                                        toolName: 'approvalChecker',
                                        description: data.approval.reason || "This action requires your approval to proceed.",
                                        toolCall: { id: Date.now().toString() }
                                    }
                                };
                            }
                            return newMsgs;
                        });
                        setIsLoading(false); // Stop loading state so user can interact
                    } else if (data.type === 'error') {
                        console.error("Stream Error:", data.content);
                        // Append error to content so user sees it and it gets saved
                        const errorMsg = `\n\n**System Error:** ${data.content}`;
                        streamingBufferRef.current.content += errorMsg;
                        setMessages(prev => {
                            const newMsgs = [...prev];
                            const last = newMsgs[newMsgs.length - 1];
                            if (last.role === 'assistant') {
                                newMsgs[newMsgs.length - 1] = {
                                    ...last,
                                    content: (last.content || '') + errorMsg
                                };
                            }
                            return newMsgs;
                        });
                    }
                } catch (e) { console.warn("Parse error", e); }
            }
        }
        flushStreamContent();
        // Clear any lingering activity indicator at the end of the stream
        setMessages(prev => {
            if (prev.length === 0) return prev;
            const newMsgs = [...prev];
            const last = newMsgs[newMsgs.length - 1];
            if (last.role === 'assistant' && last.activeTool) {
                newMsgs[newMsgs.length - 1] = { ...last, activeTool: null };
            }
            return newMsgs;
        });
        setIsLoading(false);
        return { content: streamingBufferRef.current.content, toolLogs };
    };

    const handleSendMessage = async (e?: React.FormEvent, contentOverride?: string) => {
        e?.preventDefault();
        const msgContent = contentOverride || input;
        if (!msgContent.trim() || isSubmittingRef.current) return;

        isSubmittingRef.current = true;
        setIsLoading(true);
        shouldAutoScrollRef.current = true;

        const currentSources = [...selectedSources];
        let finalContent = msgContent;
        if (currentSources.length > 0) {
            const sourceNames = currentSources.map(s => s.name).join(', ');
            finalContent = `[Context Sources: ${sourceNames}]\n\n${msgContent}`;
        }

        // Create conversation if this is the first message
        let convId = currentConversationId;
        if (!convId) {
            convId = await createNewConversation(msgContent);
        }

        const userMsgId = Date.now().toString();
        const userMessage: Message = { id: userMsgId, role: 'user', content: msgContent, sources: currentSources };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInput('');
        setSelectedSources([]);
        if (inputTextAreaRef.current) inputTextAreaRef.current.style.height = 'auto';

        // Save user message to database
        if (convId) {
            await saveMessageToConversation(convId, 'human', msgContent);
        }

        try {
            const endpoint = agentMode === 'single' ? '/api/blackswan/chat' : '/api/romeo-charge/chat';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: updatedMessages.map(m => m.role === 'user' && m.content === msgContent ? { ...m, content: finalContent } : m)
                }),
            });

            if (!response.ok) throw new Error('Failed to get response');

            const finalData = await handleStreamResponse(response);

            // Save assistant response to database
            if (convId) {
                if (finalData.content || (finalData.toolLogs && finalData.toolLogs.length > 0)) {
                    await saveMessageToConversation(convId, 'ai', finalData.content, finalData.toolLogs);
                }
            }


        } catch (error: any) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: `Sorry, I encountered an error while searching: ${error.message}` }]);
        } finally {
            isSubmittingRef.current = false;
            setIsLoading(false);
            setTimeout(() => inputTextAreaRef.current?.focus(), 50);
        }
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
            }
        }
    };

    useEffect(() => {
        if (messages.length === 0 || !shouldAutoScrollRef.current) return;
        const latestTurn = document.getElementById('turn-latest');
        if (latestTurn) {
            latestTurn.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (!isLoading) {
            shouldAutoScrollRef.current = false;
        }
    }, [messages.length, isLoading]);

    const hasMessages = messages.length > 0;

    return (
        <div className={`perplexity-container ${sidebarOpen ? 'sidebar-open' : ''}`}>
            {/* Chat Sidebar */}
            <ChatSidebar
                conversations={conversations}
                currentConversationId={currentConversationId}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                onNewChat={handleNewChat}
                onSelectConversation={loadConversation}
                onDeleteConversation={deleteConversation}
            />

            {/* Minimal Header */}
            <header className="perplexity-header">
                <div className="header-left">
                    <button
                        className="sidebar-toggle-btn"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        title="Toggle sidebar"
                    >
                        <Menu size={20} />
                    </button>
                </div>
                <div className="header-right">
                    {user && (
                        <div className="user-indicator">
                            <span className="user-initial">{user.firstName[0]}</span>
                        </div>
                    )}
                </div>
            </header>

            {/* Answer Engine Viewport */}
            <main className="perplexity-viewport">
                <div className="content-container">
                    <div className={`hero-section ${hasMessages ? 'hidden' : ''}`}>
                        <div className="title-wrapper">
                            <h1 className="hero-title active">Where knowledge begins.</h1>
                        </div>
                        <p className="hero-subtitle">Ask for insights, data, and automation from your sources.</p>

                        {!hasAiConfig && (
                            <div className="setup-hint ai-config">
                                <Sparkles size={14} />
                                <span>AI configuration missing. <a href="/profile">Add your API key</a> to enable chat.</span>
                            </div>
                        )}

                        {hasAiConfig && dataSources.length === 0 && (
                            <div className="setup-hint sources">
                                <Database size={14} />
                                <span>No data sources connected. <a href="/sources">Connect Google or Meta Ads</a> to analyze data.</span>
                            </div>
                        )}
                    </div>

                    <div className="answer-thread">
                        {messages.reduce((turns: any[], msg, idx) => {
                            if (msg.role === 'user') {
                                turns.push({ user: msg, assistant: null, index: idx });
                            } else if (turns.length > 0) {
                                turns[turns.length - 1].assistant = msg;
                            } else {
                                turns.push({ user: null, assistant: msg, index: idx });
                            }
                            return turns;
                        }, []).map((turn: any, tIdx: number, allTurns: any[]) => {
                            const isLatestTurn = tIdx === allTurns.length - 1;
                            const turnKey = turn.user?.id || turn.assistant?.id || tIdx.toString();
                            return (
                            <div
                                key={`turn-${turnKey}`}
                                id={isLatestTurn ? 'turn-latest' : `turn-${turnKey}`}
                                className={`conversation-turn${isLatestTurn ? ' latest-turn' : ''}`}
                            >
                                {turn.user && (
                                    <MessageItem
                                        msg={turn.user}
                                        isLast={!turn.assistant && isLatestTurn}
                                        isLoading={isLoading}
                                    />
                                )}
                                {turn.assistant && (
                                    <MessageItem
                                        msg={turn.assistant}
                                        isLast={isLatestTurn}
                                        isLoading={isLoading}
                                        previousMsgSources={turn.user?.sources}
                                        activeTool={turn.assistant.activeTool}
                                        onApprove={handleApprove}
                                        onReject={handleReject}
                                    />
                                )}
                                {isLoading && isLatestTurn && (!turn.assistant || !turn.assistant.content) && (
                                    <div className="engine-status">
                                        <div className="status-dot"></div>
                                        <span>
                                            {turn.assistant?.activeTool
                                                ? `Working on ${turn.assistant.activeTool.split('_').join(' ')}...`
                                                : turn.assistant?.toolLogs?.length
                                                    ? 'Synthesizing data...'
                                                    : 'Searching sources...'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )})}
                    </div>

                    {/* Remove the old global engine-status */}
                </div>
            </main>

            {/* Bottom Search Bar */}
            <section className={`search-bar-section ${hasMessages ? 'active' : 'idle'}`}>
                <div className="search-container">
                    {selectedSources.length > 0 && (
                        <div className="context-chips">
                            {selectedSources.map(s => (
                                <div key={s.id} className="context-chip">
                                    <Database size={12} />
                                    <span>{s.name}</span>
                                    <button onClick={() => removeSource(s.name)}>&times;</button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div
                        className="omni-bar nexus-input-glow"
                        style={{
                            backgroundColor: 'var(--px-bg)',
                            backdropFilter: 'blur(25px)',
                            borderRadius: '24px',
                            position: 'relative',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                            padding: '2px',
                            display: 'flex',
                            flexDirection: 'column',
                            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                            border: '1px solid var(--px-border)'
                        }}
                    >
                        {/* Inner Content Area */}
                        <div style={{
                            backgroundColor: 'var(--px-bg)',
                            borderRadius: '22px',
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            position: 'relative',
                            zIndex: 2,
                            padding: '8px 12px',
                        }}>
                            <div className="bar-contents" style={{ padding: 0 }}>
                                <textarea
                                    ref={inputTextAreaRef}
                                    value={input}
                                    onChange={handleInput}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask anything... (@ to select sources)"
                                    rows={1}
                                />

                                <div className="bar-actions">
                                    <button
                                        className="agent-toggle"
                                        type="button"
                                        onClick={() => {
                                            const next = agentMode === 'multi' ? 'single' : 'multi';
                                            setAgentMode(next);
                                            try {
                                                localStorage.setItem('agent-mode', next);
                                            } catch {
                                                // Ignore storage errors
                                            }
                                        }}
                                        disabled={isLoading}
                                        title={`Switch to ${agentMode === 'multi' ? 'Fast' : 'Multi'} Agent`}
                                    >
                                        {agentMode === 'multi' ? 'Multi' : 'Fast'}
                                    </button>

                                    <button
                                        className={`send-action ${input.trim() && !isLoading ? 'enabled' : ''}`}
                                        onClick={() => handleSendMessage()}
                                        disabled={!input.trim() || isLoading}
                                    >
                                        {isLoading ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={20} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {showMentions && filteredSources.length > 0 && (
                        <div className="perplexity-mentions">
                            <div className="list-title">SOURCES</div>
                            <div className="list-body">
                                {filteredSources.map((source, idx) => (
                                    <div
                                        key={source.id}
                                        className={`list-item ${idx === mentionIndex ? 'focused' : ''}`}
                                        onClick={() => addMention(source)}
                                        onMouseEnter={() => setMentionIndex(idx)}
                                    >
                                        {source.icon}
                                        <span>{source.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>



            <style jsx global>{`
                :root {
                    --px-bg: #ffffff;
                    --px-border: #efefef;
                    --px-text: #1a1a1a;
                    --px-muted: #666666;
                    --px-accent: #17c3b2;
                    --px-pro: #e11d48;
                    --px-hover: #f7f7f7;
                    --font-sans: 'Noto Sans', -apple-system, system-ui, sans-serif;
                }

                [data-theme='amoled'] {
                    --px-bg: #000000;
                    --px-border: #1a1a1a;
                    --px-text: #ffffff;
                    --px-muted: #a1a1aa;
                    --px-hover: #111111;
                    --px-accent: #e11d48;
                }

                .setup-hint {
                    margin-top: 24px;
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 16px;
                    background: var(--px-hover);
                    border: 1px solid var(--px-border);
                    border-radius: 12px;
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--px-text);
                    animation: pxFadeIn 0.8s ease-out;
                }

                .setup-hint a {
                    color: var(--px-accent);
                    text-decoration: none;
                    font-weight: 700;
                    margin-left: 4px;
                }

                .setup-hint a:hover {
                    text-decoration: underline;
                }

                .setup-hint.ai-config {
                    border-color: var(--px-pro);
                }

                .perplexity-container {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                    width: auto;
                    background: var(--px-bg);
                    color: var(--px-text);
                    font-family: var(--font-sans);
                    margin-left: 0; /* Default (closed) - relies on main-content 60px margin */
                    transition: margin-left 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .perplexity-container.sidebar-open {
                    margin-left: 0; /* Changed to overlay mode */
                }

                @media (max-width: 768px) {
                    .perplexity-container.sidebar-open {
                        margin-left: 0;
                    }
                }

                .sidebar-toggle-btn {
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    background: var(--px-hover);
                    color: var(--px-text);
                    transition: all 0.2s ease;
                }

                .sidebar-toggle-btn:hover {
                    background: var(--px-border);
                }

                /* Header */
                .perplexity-header {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    width: 100%;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 24px;
                    border-bottom: 1px solid transparent;
                    background: var(--px-bg);
                    z-index: 100;
                    backdrop-filter: blur(10px);
                }

                .logo-pill {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: var(--px-hover);
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 13px;
                    font-weight: 700;
                    color: var(--px-text);
                }

                .logo-icon { color: var(--px-accent); fill: var(--px-accent); }

                .user-indicator {
                    width: 32px;
                    height: 32px;
                    background: var(--px-text);
                    color: var(--px-bg);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    font-weight: 700;
                }

                /* Viewport */
                .perplexity-viewport {
                    --px-header-offset: 84px;
                    --px-footer-offset: 180px;
                    flex: 1;
                    padding: var(--px-header-offset) 24px var(--px-footer-offset); /* Increased top padding for fixed header */
                    scrollbar-width: none;
                    display: flex;
                    justify-content: center;
                    scroll-behavior: smooth;
                }

                .content-container {
                    width: 100%;
                    max-width: 760px;
                    position: relative;
                }

                /* Hero */
                .hero-section {
                    margin-top: 20vh;
                    text-align: center;
                    transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .hero-section.hidden {
                    opacity: 0;
                    transform: translateY(-20px);
                    pointer-events: none;
                    position: absolute;
                    width: 100%;
                }

                .title-wrapper {
                    position: relative;
                    height: 54px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    margin-bottom: 12px;
                }

                .hero-title {
                    position: absolute;
                    font-size: 44px;
                    font-weight: 750;
                    letter-spacing: -0.04em;
                    color: var(--px-text);
                    transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
                    opacity: 0;
                    filter: blur(10px);
                    transform: translateY(10px);
                    white-space: nowrap;
                }

                .hero-title.active {
                    opacity: 1;
                    filter: blur(0);
                    transform: translateY(0);
                }

                .pro-accent {
                    color: var(--px-pro);
                }

                .hero-subtitle {
                    font-size: 17px;
                    color: var(--px-muted);
                    font-weight: 450;
                }

                /* Thread */
                .answer-thread {
                    display: flex;
                    flex-direction: column;
                    gap: 24px; /* Reduced from 40px */
                }

                .conversation-turn {
                    min-height: 10vh;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    padding-bottom: 32px;
                    scroll-margin-top: 96px;
                    justify-content: flex-start;
                }

                /* Keep newest turn at the top with a clear viewport */
                .conversation-turn.latest-turn {
                    min-height: calc(100dvh - var(--px-header-offset) - var(--px-footer-offset));
                    padding-bottom: 0;
                }

                .answer-card {
                    animation: pxFadeIn 0.4s ease-out;
                    padding-bottom: 24px;
                }

                .query-header {
                    margin-bottom: 8px;
                }

                .query-text {
                    font-size: 24px;
                    font-weight: 500;
                    letter-spacing: -0.02em;
                    line-height: 1.4;
                    color: var(--text-main);
                }

                .response-content {
                    padding-top: 8px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    font-size: 16px;
                    line-height: 1.6;
                    color: var(--text-main);
                }

                /* Sources - simplified */
                .source-row {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 16px;
                }

                .source-label {
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--text-muted);
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .source-list {
                    display: flex;
                    gap: 8px;
                    overflow-x: auto;
                    padding-bottom: 4px;
                    scrollbar-width: none;
                }

                .source-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 10px;
                    background: var(--bg-hover);
                    border-radius: 6px;
                    border: 1px solid transparent;
                    flex-shrink: 0;
                    transition: all 0.2s;
                    max-width: 200px;
                    text-decoration: none;
                }
                
                .source-item:hover {
                    background: var(--gray-200);
                }

                .source-circle {
                    width: 16px;
                    height: 16px;
                    background: var(--bg-card);
                    color: var(--text-muted);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 9px;
                    font-weight: 700;
                }

                .source-name-text {
                    font-size: 11px;
                    font-weight: 500;
                    color: var(--text-main);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                /* Minimal Prose */
                .markdown-editorial {
                    font-size: 16px;
                    line-height: 1.6;
                    color: var(--text-main);
                }

                .markdown-editorial p { margin-bottom: 12px; }
                .markdown-editorial h1, .markdown-editorial h2, .markdown-editorial h3 {
                    margin: 24px 0 12px;
                    font-weight: 600;
                    color: var(--text-main);
                }

                .answer-meta {
                    margin-top: 6px;
                }

                .answer-meta-line {
                    height: 1px;
                    background: var(--px-border);
                    opacity: 0.7;
                    margin: 8px 0 6px;
                }

                .answer-meta-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px 14px;
                    font-size: 11px;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }

                .answer-meta-item {
                    white-space: nowrap;
                }

                /* Status */
                .engine-status {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 24px 0;
                    font-size: 14px;
                    font-weight: 500;
                    color: var(--px-muted);
                }

                .status-dot {
                    width: 8px;
                    height: 8px;
                    background: var(--accent-color);
                    border-radius: 50%;
                    animation: pxPulse 1.5s infinite;
                }

                /* Search Bar - Clean & Floating */
                .search-bar-section {
                    position: fixed;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 100%;
                    z-index: 1000;
                    transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                    padding: 0 24px 24px;
                    display: flex;
                    justify-content: center;
                }

                .search-bar-section.idle {
                    top: 50%;
                    transform: translate(-50%, -50%);
                    max-width: 700px;
                }

                .search-bar-section.active {
                    top: auto;
                    bottom: 0;
                    background: linear-gradient(to top, var(--bg-color) 80%, transparent);
                    padding-bottom: 24px;
                    padding-top: 40px;
                    max-width: 700px;
                }

                .search-container {
                    width: 100%;
                    max-width: 700px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    position: relative;
                }

                .context-chips {
                    display: flex;
                    gap: 6px;
                    justify-content: center;
                }

                .context-chip {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 10px;
                    background: var(--bg-hover);
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--text-muted);
                }

                .nexus-input-wrapper {
                    position: relative;
                    z-index: 10;
                }

                .nexus-input-glow {
                    position: relative;
                    background: white;
                    border-radius: 14px;
                    padding: 4px;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    border: 1.5px solid rgba(0, 0, 0, 0.1);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06);
                }

                .nexus-input-glow:focus-within {
                    border-color: rgba(37, 99, 235, 0.4);
                    box-shadow: 0 4px 16px rgba(37, 99, 235, 0.1), 0 2px 6px rgba(37, 99, 235, 0.08);
                }
                
                /* Remove glimmer effects */
                .deep-mode-active {
                    border-color: var(--primary-color) !important;
                }
                
                .shimmer { display: none; }

                /* Omni Bar - Clean */
                .omni-bar {
                    background: transparent;
                    border: none;
                    padding: 2px;
                }
                
                .bar-contents {
                    display: flex;
                    flex-direction: column;
                    padding: 8px 12px;
                }

                .bar-contents textarea {
                    width: 100%;
                    border: none;
                    outline: none;
                    background: transparent;
                    font-size: 16px;
                    color: var(--text-main);
                    padding: 8px 0;
                    resize: none;
                    min-height: 44px;
                    max-height: 250px;
                    font-family: inherit;
                    line-height: 1.5;
                }

                .bar-actions {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 4px;
                }

                .agent-toggle {
                    padding: 6px 10px;
                    border-radius: 12px;
                    border: 1px solid var(--px-border);
                    background: var(--px-hover);
                    color: var(--px-text);
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.02em;
                    text-transform: uppercase;
                    margin-right: 10px;
                    transition: all 0.2s ease;
                }

                .agent-toggle:hover {
                    border-color: var(--primary-color);
                }

                .agent-toggle:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .mode-pill {
                    display: flex;
                    background: var(--bg-hover);
                    padding: 2px;
                    border-radius: 8px;
                    gap: 2px;
                }

                .mode-btn {
                    padding: 4px 10px;
                    font-size: 11px;
                    font-weight: 600;
                    border-radius: 6px;
                    color: var(--text-muted);
                    transition: all 0.2s;
                }

                .mode-btn.active {
                    background: var(--bg-card);
                    color: var(--text-main);
                    box-shadow: var(--shadow-sm);
                }
                
                .deep-mode .mode-btn.active {
                    background: var(--primary-color);
                    color: #fff;
                }

                .send-action {
                    width: 34px;
                    height: 34px;
                    background: rgba(0, 0, 0, 0.05);
                    color: var(--text-muted);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .send-action.enabled {
                    background: linear-gradient(135deg, rgb(37, 99, 235) 0%, rgb(59, 130, 246) 100%);
                    color: #fff;
                    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
                }

                .send-action.enabled:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
                }

                /* Mentions */
                .perplexity-mentions {
                    position: absolute;
                    bottom: calc(100% + 8px); /* Position 8px above the container */
                    left: 0;
                    right: 0;
                    background: var(--px-bg);
                    border: 1px solid var(--px-border);
                    border-radius: 16px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.15);
                    overflow: hidden;
                    z-index: 1001;
                    animation: pxSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .list-title { padding: 10px 16px; font-size: 11px; font-weight: 800; color: var(--px-muted); border-bottom: 1px solid var(--px-border); }
                
                .list-body {
                    max-height: 250px;
                    overflow-y: auto;
                    scrollbar-width: thin;
                }

                .list-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; }
                .list-item.focused { background: var(--px-hover); }

                /* Tables */
                .perplexity-table-container {
                    margin: 20px 0;
                    border: 1px solid var(--px-border);
                    border-radius: 10px;
                    overflow: hidden;
                    position: relative;
                }

                .copy-table-btn {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    padding: 5px 10px;
                    background: var(--px-bg);
                    border: 1px solid var(--px-border);
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .table-wrapper { overflow-x: auto; }
                table { width: 100%; border-collapse: collapse; }
                th { text-align: left; padding: 12px 16px; background: var(--px-hover); border-bottom: 1px solid var(--px-border); font-size: 12px; font-weight: 800; color: var(--px-muted); }
                td { padding: 12px 16px; border-bottom: 1px solid var(--px-border); font-size: 14px; }

                /* Google Sheets Link Styling */
                .google-sheets-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 14px;
                    background: #f1f8f4;
                    border: 1px solid #34a853;
                    border-radius: 8px;
                    color: #137333;
                    text-decoration: none;
                    font-weight: 600;
                    font-size: 14px;
                    transition: all 0.2s ease;
                    margin: 4px 0;
                }

                [data-theme='amoled'] .google-sheets-link {
                    background: rgba(52, 168, 83, 0.1);
                    border-color: #34a853;
                    color: #34a853;
                }

                .google-sheets-link:hover {
                    background: #e6f4ea;
                    border-color: #137333;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(52, 168, 83, 0.2);
                }

                [data-theme='amoled'] .google-sheets-link:hover {
                    background: rgba(52, 168, 83, 0.15);
                    box-shadow: 0 2px 8px rgba(52, 168, 83, 0.3);
                }

                .google-sheets-link .sheets-icon {
                    width: 20px;
                    height: 20px;
                    flex-shrink: 0;
                }


                @keyframes pxFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes pxSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes pxPulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
                @keyframes slideUp { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
                .animate-spin { animation: pxSpin 1s linear infinite; }
                @keyframes pxSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                @media (max-width: 768px) {
                    .perplexity-viewport {
                        padding: 10px 16px 140px;
                    }

                    .hero-section {
                        margin-top: 10vh;
                    }

                    .hero-title {
                        font-size: 28px;
                    }

                    .hero-subtitle {
                        font-size: 15px;
                        padding: 0 10px;
                    }

                    .query-text {
                        font-size: 22px;
                    }

                    .markdown-editorial {
                        font-size: 15px;
                    }

                    .search-bar-section.idle {
                        width: 100%;
                        padding: 0 16px 20px;
                        top: 40%;
                    }

                    .search-bar-section.active {
                        max-width: 100%;
                        bottom: 64px; /* Above bottom nav */
                        padding: 0 12px 12px;
                    }

                    .omni-bar {
                        border-radius: 18px !important;
                    }

                    .bar-contents textarea {
                        font-size: 15px;
                        min-height: 40px;
                    }

                    .mode-btn {
                        padding: 4px 10px;
                        font-size: 11px;
                    }

                    .setup-hint {
                        font-size: 11px;
                        padding: 6px 12px;
                        flex-direction: column;
                        text-align: center;
                    }
                }
            `}</style>
        </div>
    );
}
