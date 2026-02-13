"use client"

import React, { useEffect, useState } from 'react';
import { LogOut, Key, CheckCircle, AlertCircle, RefreshCw, Cpu } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';

interface UserData {
    id?: number;
    firstName: string;
    lastName: string;
    email: string;
}

interface TokenStatus {
    exists: boolean;
    expiresAt?: string;
    updatedAt?: string;
    maskedToken?: string;
}

interface AIConfig {
    exists: boolean;
    maskedKey: string | null;
    selectedModel: string;
    updatedAt: string | null;
}

// Available AI Models
const DEFAULT_MODEL = 'x-ai/grok-4.1-fast';

export default function SettingsPage() {
    const [user, setUser] = useState<UserData | null>(null);
    const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
    const [metaToken, setMetaToken] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // AI Configuration state
    const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
    const [openrouterKey, setOpenrouterKey] = useState('');
    const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiMessage, setAiMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const router = useRouter();

    useEffect(() => {
        let cancelled = false;

        const init = async () => {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                try {
                    const parsed = JSON.parse(storedUser);
                    if (!cancelled) {
                        setUser(parsed);
                        fetchTokenStatus();
                        fetchAiConfig();
                    }
                    return;
                } catch (error) {
                    console.error('Failed to parse stored user', error);
                    localStorage.removeItem('user');
                }
            }

            try {
                const res = await fetch('/api/me');
                if (!res.ok) {
                    throw new Error('Not authenticated');
                }
                const data = await res.json();
                const hydratedUser = {
                    id: data.userId,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email
                };
                localStorage.setItem('user', JSON.stringify(hydratedUser));
                if (!cancelled) {
                    setUser(hydratedUser);
                    fetchTokenStatus();
                    fetchAiConfig();
                }
            } catch (error) {
                if (!cancelled) {
                    router.push('/login');
                }
            }
        };

        void init();

        return () => {
            cancelled = true;
        };
    }, [router]);

    const fetchTokenStatus = async () => {
        setIsFetching(true);
        try {
            const res = await fetch('/api/settings/meta-token');
            const data = await res.json();
            setTokenStatus(data);
        } catch (error) {
            console.error('Error fetching token status:', error);
        } finally {
            setIsFetching(false);
        }
    };

    const fetchAiConfig = async () => {
        try {
            const res = await fetch('/api/settings/ai-config');
            const data = await res.json();
            setAiConfig(data);
            // Always enforce default model display locally, but respect DB if it matches
            setSelectedModel(DEFAULT_MODEL);
        } catch (error) {
            console.error('Error fetching AI config:', error);
        }
    };

    const handleSaveToken = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!metaToken.trim()) return;

        setIsLoading(true);
        setMessage(null);

        try {
            const res = await fetch('/api/settings/meta-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken: metaToken.trim() }),
            });

            const data = await res.json();

            if (res.ok) {
                setMessage({ type: 'success', text: 'Meta access token updated successfully!' });
                setMetaToken('');
                fetchTokenStatus();
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to update token' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'An unexpected error occurred' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveAiConfig = async (e: React.FormEvent) => {
        e.preventDefault();

        setIsAiLoading(true);
        setAiMessage(null);

        try {
            const body: { apiKey?: string; selectedModel?: string } = {};

            if (openrouterKey.trim()) {
                body.apiKey = openrouterKey.trim();
            }

            // Always save the default model
            body.selectedModel = DEFAULT_MODEL;

            const res = await fetch('/api/settings/ai-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (res.ok) {
                setAiMessage({ type: 'success', text: 'AI configuration updated successfully!' });
                setOpenrouterKey('');
                fetchAiConfig();
            } else {
                setAiMessage({ type: 'error', text: data.error || 'Failed to update AI config' });
            }
        } catch (error) {
            setAiMessage({ type: 'error', text: 'An unexpected error occurred' });
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            localStorage.removeItem('user');
            router.push('/login');
        } catch (error) {
            console.error('Logout error:', error);
            localStorage.removeItem('user');
            router.push('/login');
        }
    };

    if (!user) return (
        <div style={{ padding: '24px 40px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: '16px', color: 'var(--text-muted)' }}>Loading...</div>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB' }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 50 }}>
                <Header pageName="Settings" hideSearch={true} hideNotifications={true} />
            </div>

            <main style={{ maxWidth: '600px', margin: '0 auto', padding: '60px 24px' }}>
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    border: '1px solid #E5E7EB',
                    padding: '40px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '40px'
                }}>
                    {/* Profile Section */}
                    <section>
                        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111', marginBottom: '32px', letterSpacing: '-0.01em' }}>Profile</h1>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</label>
                                <div style={{ fontSize: '16px', fontWeight: 600, color: '#111' }}>{user.firstName} {user.lastName}</div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</label>
                                <div style={{ fontSize: '16px', fontWeight: 600, color: '#111', fontFamily: 'monospace' }}>{user.email}</div>
                            </div>
                        </div>
                    </section>

                    <div style={{ height: '1px', backgroundColor: '#F3F4F6' }}></div>

                    {/* AI Configuration Section */}
                    <section>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111' }}>AI Configuration</h2>
                            {aiConfig?.exists ? (
                                <div title="API Key Configured" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#059669', fontSize: '12px', fontWeight: 600, backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '12px' }}>
                                    <CheckCircle size={12} /> Configured
                                </div>
                            ) : (
                                <div title="No API Key" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#DC2626', fontSize: '12px', fontWeight: 600, backgroundColor: '#FEF2F2', padding: '2px 8px', borderRadius: '12px' }}>
                                    <AlertCircle size={12} /> Not Configured
                                </div>
                            )}
                        </div>
                        <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '24px', lineHeight: '1.5' }}>
                            Configure your OpenRouter API key for the x-ai/grok-4.1-fast model.
                        </p>

                        {aiConfig?.exists && aiConfig.maskedKey && (
                            <div style={{
                                backgroundColor: '#F9FAFB',
                                border: '1px solid #E5E7EB',
                                borderRadius: '12px',
                                padding: '16px',
                                marginBottom: '24px'
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '12px', color: '#6B7280' }}>Current API Key</span>
                                        <span style={{ fontSize: '12px', color: '#6B7280' }}>Updated: {aiConfig.updatedAt ? new Date(aiConfig.updatedAt).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                    <code style={{ fontSize: '14px', color: '#111', fontWeight: 600 }}>{aiConfig.maskedKey}</code>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSaveAiConfig} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* API Key Input */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label htmlFor="openrouterKey" style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>OpenRouter API Key</label>
                                <div style={{ position: 'relative' }}>
                                    <Key size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                                    <input
                                        id="openrouterKey"
                                        type="password"
                                        placeholder="sk-or-v1-..."
                                        value={openrouterKey}
                                        onChange={(e) => setOpenrouterKey(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '12px 12px 12px 40px',
                                            borderRadius: '8px',
                                            border: '1px solid #D1D5DB',
                                            fontSize: '14px',
                                            outline: 'none',
                                            transition: 'border-color 0.2s',
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = '#2563EB'}
                                        onBlur={(e) => e.target.style.borderColor = '#D1D5DB'}
                                    />
                                </div>
                                <span style={{ fontSize: '12px', color: '#6B7280' }}>Leave blank to keep current key</span>
                            </div>

                            {/* Model Selector REMOVED */}

                            {aiMessage && (
                                <div style={{
                                    padding: '12px',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    backgroundColor: aiMessage.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                                    color: aiMessage.type === 'success' ? '#065F46' : '#991B1B',
                                    border: `1px solid ${aiMessage.type === 'success' ? '#A7F3D0' : '#FECACA'}`
                                }}>
                                    {aiMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                    {aiMessage.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isAiLoading}
                                style={{
                                    padding: '12px 24px',
                                    backgroundColor: isAiLoading ? '#93C5FD' : '#2563EB',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: isAiLoading ? 'not-allowed' : 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    transition: 'background-color 0.2s',
                                }}
                            >
                                {isAiLoading ? 'Saving...' : 'Save AI Configuration'}
                            </button>
                        </form>
                    </section>

                    <div style={{ height: '1px', backgroundColor: '#F3F4F6' }}></div>

                    {/* Meta Ads Section */}
                    <section>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111' }}>Meta Ads Integration</h2>
                            {isFetching ? (
                                <RefreshCw size={14} className="animate-spin" style={{ color: '#6B7280' }} />
                            ) : tokenStatus?.exists ? (
                                <div title="Token Active" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#059669', fontSize: '12px', fontWeight: 600, backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '12px' }}>
                                    <CheckCircle size={12} /> Active
                                </div>
                            ) : (
                                <div title="No Token" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#DC2626', fontSize: '12px', fontWeight: 600, backgroundColor: '#FEF2F2', padding: '2px 8px', borderRadius: '12px' }}>
                                    <AlertCircle size={12} /> Not Connected
                                </div>
                            )}
                        </div>
                        <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '24px', lineHeight: '1.5' }}>
                            Paste your Meta Marketing API Access Token below. This allows the Meta Agent to fetch your ad performance data.
                        </p>

                        {tokenStatus?.exists && (
                            <div style={{
                                backgroundColor: '#F9FAFB',
                                border: '1px solid #E5E7EB',
                                borderRadius: '12px',
                                padding: '16px',
                                marginBottom: '24px'
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '12px', color: '#6B7280' }}>Current Token</span>
                                        <span style={{ fontSize: '12px', color: '#6B7280' }}>Updated: {new Date(tokenStatus.updatedAt!).toLocaleDateString()}</span>
                                    </div>
                                    <code style={{ fontSize: '14px', color: '#111', fontWeight: 600 }}>{tokenStatus.maskedToken}</code>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSaveToken} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label htmlFor="metaToken" style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Update Access Token</label>
                                <div style={{ position: 'relative' }}>
                                    <Key size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                                    <input
                                        id="metaToken"
                                        type="password"
                                        placeholder="EAAQ..."
                                        value={metaToken}
                                        onChange={(e) => setMetaToken(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '12px 12px 12px 40px',
                                            borderRadius: '8px',
                                            border: '1px solid #D1D5DB',
                                            fontSize: '14px',
                                            outline: 'none',
                                            transition: 'border-color 0.2s',
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = '#2563EB'}
                                        onBlur={(e) => e.target.style.borderColor = '#D1D5DB'}
                                    />
                                </div>
                            </div>

                            {message && (
                                <div style={{
                                    padding: '12px',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    backgroundColor: message.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                                    color: message.type === 'success' ? '#065F46' : '#991B1B',
                                    border: `1px solid ${message.type === 'success' ? '#A7F3D0' : '#FECACA'}`
                                }}>
                                    {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                    {message.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading || !metaToken.trim()}
                                style={{
                                    padding: '12px 24px',
                                    backgroundColor: isLoading || !metaToken.trim() ? '#93C5FD' : '#2563EB',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: isLoading || !metaToken.trim() ? 'not-allowed' : 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    transition: 'background-color 0.2s',
                                }}
                            >
                                {isLoading ? 'Updating...' : 'Update Meta Token'}
                            </button>
                        </form>
                    </section>

                    <div style={{ height: '1px', backgroundColor: '#F3F4F6' }}></div>

                    {/* Danger Zone */}
                    <section>
                        <button
                            onClick={handleLogout}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                padding: '12px 24px',
                                backgroundColor: '#FEF2F2',
                                color: '#DC2626',
                                border: '1px solid #FECACA',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 600,
                                width: '100%',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#FECACA';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#FEF2F2';
                            }}
                        >
                            <LogOut size={16} strokeWidth={2.5} />
                            Log Out
                        </button>
                    </section>
                </div>
            </main>
        </div>
    );
}

