"use client"

import React, { useEffect } from 'react';
import { Check } from 'lucide-react';

export default function GoogleSuccessPage() {
    const [error, setError] = React.useState<string | null>(null);

    useEffect(() => {
        // Parse email and error from URL
        const params = new URLSearchParams(window.location.search);
        const email = params.get('email');
        const errParam = params.get('error');
        const detail = params.get('detail');

        if (errParam) {
            setError(detail || errParam);
        }

        // Send message to parent window if it exists
        if (window.opener) {
            if (errParam) {
                window.opener.postMessage(
                    { type: 'GOOGLE_AUTH_ERROR', error: detail || errParam },
                    window.location.origin
                );
            } else {
                window.opener.postMessage(
                    { type: 'GOOGLE_AUTH_SUCCESS', email },
                    window.location.origin
                );

                // Close the window after a short delay on success
                setTimeout(() => {
                    window.close();
                }, 3000);
            }
        }
    }, []);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F9FAFB',
            fontFamily: "'Inter', sans-serif",
            padding: '24px',
            textAlign: 'center'
        }}>
            <div style={{
                backgroundColor: 'white',
                padding: '48px',
                borderRadius: '24px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
                maxWidth: '400px',
                width: '100%'
            }}>
                <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    backgroundColor: error ? '#FEF2F2' : '#ECFDF5',
                    color: error ? '#EF4444' : '#10B981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px'
                }}>
                    {error ? <Check size={40} style={{ transform: 'rotate(45deg)' }} /> : <Check size={40} />}
                </div>

                <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>
                    {error ? 'Connection Failed' : 'Connected Successfully!'}
                </h1>

                <p style={{ color: '#6B7280', fontSize: '16px', lineHeight: '1.5', marginBottom: '32px' }}>
                    {error
                        ? `There was an error connecting your account: ${error}. You can try again or close this window.`
                        : 'Your Google account has been connected. This window will close automatically in a moment.'}
                </p>

                <button
                    onClick={() => window.close()}
                    style={{
                        backgroundColor: error ? '#EF4444' : '#111827',
                        color: 'white',
                        border: 'none',
                        padding: '12px 24px',
                        borderRadius: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '15px'
                    }}
                >
                    Close Window
                </button>
            </div>
        </div>
    );
}
