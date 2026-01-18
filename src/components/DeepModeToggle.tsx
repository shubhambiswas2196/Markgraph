import React from 'react';
import { Sparkles, BrainCircuit, Zap } from 'lucide-react';

interface DeepModeToggleProps {
    isDeepMode: boolean;
    onToggle: () => void;
}

export function DeepModeToggle({ isDeepMode, onToggle }: DeepModeToggleProps) {
    return (
        <button
            onClick={onToggle}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                border: isDeepMode ? '1px solid rgba(225, 29, 72, 0.3)' : '1px solid transparent',
                background: isDeepMode
                    ? 'rgba(225, 29, 72, 0.1)'
                    : 'rgba(148, 163, 184, 0.1)',
                color: isDeepMode
                    ? '#e11d48' // Red-600
                    : 'var(--text-muted)',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden'
            }}
            title={isDeepMode ? "Deep Agent Mode Active" : "Enable Deep Agent Mode"}
        >
            {isDeepMode && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(45deg, transparent, rgba(225, 29, 72, 0.1), transparent)',
                    animation: 'shimmer 2s infinite linear'
                }} />
            )}

            {isDeepMode ? (
                <span style={{ color: '#e11d48', textShadow: '0 0 12px rgba(225, 29, 72, 0.2)' }}>
                    Deep Agent
                </span>
            ) : (
                <span style={{ opacity: 0.9 }}>Deep Mode</span>
            )}

            <style jsx>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </button>
    );
}
