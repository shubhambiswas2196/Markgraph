import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Brain, CheckCircle2, Circle, Clock, Loader2 } from 'lucide-react';

interface ToolLog {
    name: string;
    status: 'running' | 'complete';
    output?: any;
    input?: any;
}

interface ThinkingAccordionProps {
    reasoning: string;
    isComplete?: boolean;
    toolLogs?: ToolLog[];
    activeTool?: string | null;
    todoList?: string[];
}

export const ThinkingAccordion: React.FC<ThinkingAccordionProps> = ({ reasoning, isComplete, toolLogs = [], activeTool, todoList = [] }) => {
    // Default closed if complete, open if running
    const [isOpen, setIsOpen] = useState(!isComplete);

    // Auto-collapse when complete
    React.useEffect(() => {
        if (isComplete) {
            setIsOpen(false);
        } else {
            setIsOpen(true);
        }
    }, [isComplete]);

    const hasHarnessTodos = todoList && todoList.length > 0;
    // Parse steps or fallback to reasoning paragraphs
    let steps: string[] = [];
    if (hasHarnessTodos) {
        steps = todoList;
    } else if (reasoning) {
        // Dedup: sometimes reasoning repeats. Take unique lines or chunks.
        const rawLines = reasoning.split('\n');
        const uniqueLines = Array.from(new Set(rawLines.map(l => l.trim()))).filter(l => l.length > 0);

        // Try to identify numbered list
        const numbered = uniqueLines.filter(line => /^\d+\./.test(line));

        if (numbered.length > 0) {
            steps = numbered.map(s => s.replace(/^\d+\.\s*/, '').replace(/\*\*/g, ''));
        } else {
            // Fallback: Use unique lines as bullet points if they look like sentences
            steps = uniqueLines;
        }
    }

    const getStepDetails = (step: string) => {
        if (!hasHarnessTodos) return { status: isComplete ? 'completed' : 'pending', text: step };
        const statusMatch = step.match(/^\[(.*?)\] (.*)/);
        if (statusMatch) {
            return { status: statusMatch[1], text: statusMatch[2] };
        }
        return { status: 'pending', text: step };
    };

    return (
        <div style={{
            width: '100%',
            marginBottom: '16px',
            animation: 'fadeIn 0.5s',
            fontFamily: '"Google Sans Flex", var(--font-sans)'
        }}>
            {/* Minimal Header Toggle */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 0',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontSize: '13px',
                    fontWeight: 500,
                    transition: 'color 0.2s'
                }}
            >
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    color: isComplete ? 'var(--text-muted)' : 'var(--primary-color)'
                }}>
                    {isComplete ? <Brain size={14} /> : <Loader2 size={14} className="animate-spin" />}
                    <span>
                        {isComplete
                            ? (reasoning ? 'View reasoning' : 'View activity')
                            : (activeTool && !activeTool.includes('_') ? activeTool : 'Thinking...')}
                    </span>
                </div>
                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* Content Area - Minimal & Clean */}
            {
                isOpen && (
                    <div style={{
                        marginTop: '8px',
                        paddingLeft: '14px', // Slight indentation
                        borderLeft: '2px solid var(--border-color)', // Simple thread line
                        marginLeft: '6px'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '8px' }}>
                            {/* Steps List */}
                            {steps.map((step, idx) => {
                                const { status, text } = getStepDetails(step);
                                const isDone = status === 'completed';
                                const isRunning = status === 'in_progress';

                                return (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        gap: '10px',
                                        alignItems: 'flex-start',
                                        opacity: isDone ? 0.7 : 1
                                    }}>
                                        <div style={{ marginTop: '3px', flexShrink: 0 }}>
                                            {isDone ? <CheckCircle2 size={14} color="var(--text-muted)" /> :
                                                isRunning ? <Loader2 size={14} className="animate-spin" color="var(--primary-color)" /> :
                                                    <Circle size={12} color="var(--border-color)" />}
                                        </div>
                                        <span style={{
                                            fontSize: '14px',
                                            lineHeight: '1.5',
                                            color: 'var(--text-main)',
                                            fontWeight: isRunning ? 500 : 400
                                        }}>
                                            {text}
                                        </span>
                                    </div>
                                );
                            })}

                            {/* Active Tool Indicator (if running) */}
                            {activeTool && !isComplete && (
                                <div style={{
                                    display: 'flex',
                                    gap: '10px',
                                    alignItems: 'center',
                                    marginTop: '4px',
                                    color: 'var(--primary-color)',
                                    fontSize: '13px',
                                    fontWeight: 500
                                }}>
                                    <Loader2 size={12} className="animate-spin" />
                                    <span>{activeTool.includes('_') ? `Using tool: ${activeTool.split('_').join(' ')}` : activeTool}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
};
