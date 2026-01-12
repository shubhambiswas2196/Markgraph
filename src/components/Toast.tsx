"use client"

import React from 'react';

interface ToastProps {
    message: string;
    type: 'success' | 'error';
    onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
    React.useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            padding: '12px 24px',
            borderRadius: '4px',
            backgroundColor: type === 'success' ? '#0d904f' : '#d93025',
            color: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            animation: 'slideIn 0.3s ease-out'
        }}>
            <span>{message}</span>
            <button onClick={onClose} style={{ color: 'white', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
        </div>
    );
}
