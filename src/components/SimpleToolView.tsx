import React, { useState } from 'react';
import { Loader2, CheckCircle2, Terminal, ChevronDown, ChevronRight, Clock, Box, PlayCircle } from 'lucide-react';

interface ToolLog {
    name: string;
    status: 'running' | 'complete';
    input?: any;
    output?: any;
    timestamp?: number;
    type?: 'tool' | 'agent';
}

interface SimpleToolViewProps {
    toolLogs?: ToolLog[];
    activeTool?: string | null;
}

export const SimpleToolView: React.FC<SimpleToolViewProps> = ({ toolLogs = [], activeTool }) => {
    const [expandedStep, setExpandedStep] = useState<number | null>(null);

    // If no logs and no active tool, show nothing
    if ((!toolLogs || toolLogs.length === 0) && !activeTool) return null;

    const toggleStep = (idx: number) => {
        setExpandedStep(expandedStep === idx ? null : idx);
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0px',
            marginBottom: '20px',
            fontSize: '13px',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-card)',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '8px 12px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
            }}>
                <Terminal size={12} />
                Activity Log
            </div>

            {/* List of Steps */}
            <div style={{ padding: '4px 0' }}>
                {toolLogs.map((log, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column' }}>
                        {/* Step Header (Clickable) */}
                        <div
                            onClick={() => toggleStep(idx)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 12px',
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                                backgroundColor: expandedStep === idx ? 'var(--bg-hover)' : 'transparent'
                            }}
                            className="tool-step-row"
                        >
                            {/* Icon based on Type */}
                            <div style={{ color: log.type === 'agent' ? 'var(--accent-color)' : 'var(--success-color)', display: 'flex' }}>
                                {log.type === 'agent' ? <Box size={16} /> : <CheckCircle2 size={16} />}
                            </div>

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                                    {formatToolName(log.name)}
                                </span>
                                {log.timestamp && (
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={10} />
                                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                )}
                            </div>

                            <div style={{ color: 'var(--text-muted)' }}>
                                {expandedStep === idx ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </div>
                        </div>

                        {/* Expandable Detail Panel */}
                        {expandedStep === idx && (
                            <div style={{
                                padding: '0 12px 12px 38px',
                                fontSize: '12px',
                                borderBottom: '1px solid var(--border-color)'
                            }}>
                                {log.input && (
                                    <div style={{ marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                            <PlayCircle size={10} /> Input
                                        </div>
                                        <pre style={{
                                            background: 'var(--bg-hover)',
                                            padding: '8px',
                                            borderRadius: '6px',
                                            overflowX: 'auto',
                                            border: '1px solid var(--border-color)',
                                            margin: 0,
                                            fontFamily: 'monospace',
                                            color: 'var(--text-main)'
                                        }}>
                                            {typeof log.input === 'string' ? log.input : JSON.stringify(log.input, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {log.output && (
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                            <Box size={10} /> Output
                                        </div>
                                        <pre style={{
                                            background: 'var(--bg-hover)',
                                            padding: '8px',
                                            borderRadius: '6px',
                                            overflowX: 'auto',
                                            border: '1px solid var(--border-color)',
                                            margin: 0,
                                            fontFamily: 'monospace',
                                            maxHeight: '200px',
                                            color: 'var(--text-main)'
                                        }}>
                                            {typeof log.output === 'string' ? log.output : JSON.stringify(log.output, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {/* Active Running Step - Enhanced with prominent styling */}
                {activeTool && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 12px',
                        background: 'linear-gradient(135deg, rgba(0, 188, 212, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
                        borderTop: '1px solid var(--border-color)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        {/* Animated pulse background */}
                        <div style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            width: '100%',
                            height: '100%',
                            background: 'linear-gradient(90deg, transparent, rgba(0, 188, 212, 0.1), transparent)',
                            animation: 'shimmer 2s infinite',
                            pointerEvents: 'none'
                        }} />

                        {/* Pulsing dot indicator */}
                        <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--primary-color)',
                            animation: 'pulse 1.5s ease-in-out infinite',
                            flexShrink: 0,
                            zIndex: 1
                        }} />

                        <div style={{ color: 'var(--primary-color)', display: 'flex', zIndex: 1 }}>
                            <Loader2 size={16} className="animate-spin" />
                        </div>
                        <div style={{ flex: 1, zIndex: 1 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '13px' }}>
                                {activeTool.includes('_') ? formatToolName(activeTool) : activeTool}
                            </span>
                        </div>
                        <div style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: 'var(--primary-color)',
                            color: 'white',
                            fontSize: '10px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            zIndex: 1
                        }}>
                            Working...
                        </div>
                    </div>
                )}
            </div>

            {/* CSS Animations */}
            <style jsx>{`
                @keyframes pulse {
                    0%, 100% {
                        opacity: 1;
                        transform: scale(1);
                    }
                    50% {
                        opacity: 0.5;
                        transform: scale(1.2);
                    }
                }
                
                @keyframes shimmer {
                    0% {
                        transform: translateX(-100%);
                    }
                    100% {
                        transform: translateX(100%);
                    }
                }
                
                .tool-step-row:hover {
                    background: var(--bg-hover) !important;
                }
            `}</style>
        </div>
    );
};

// Helper to make tool names readable (e.g. get_google_ads becomes Get Google Ads)
const formatToolName = (name: string | undefined | null) => {
    if (!name) return 'Unknown Tool';
    return name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};
