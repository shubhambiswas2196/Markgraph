"use client"

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import Header from '@/components/Header';
import { Loader2, Trash2, Plus, X, Check, ExternalLink, ChevronRight, ChevronDown, User, Users, Search, Hash, Globe, DollarSign, ShieldCheck, Mail } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { LogOut, Settings } from 'lucide-react';

// --- Types ---
interface DataSource {
    accountId: string;
    accountName: string;
    platform: 'google-ads' | 'google-analytics' | 'meta-ads'; // Added meta-ads
    status: string;
    lastSynced?: string;
    managerId?: string;
    currency?: string;
    googleEmail?: string;
    clientName?: string; // Added clientName
}

interface Account {
    id: string;
    name: string;
    currency: string;
    status: string;
    isManager?: boolean;
    parentId?: string;
    platform?: 'google-ads' | 'meta-ads'; // Added platform
}

// --- Popup Component ---
const ConnectPopup = ({
    isOpen,
    onClose,
    onSelectSource,
    step,
    setStep,
    userId,
    fetchAccounts,
    accounts,
    loadingAccounts,
    selectedAccounts,
    toggleAccount,
    renderAccountTree,
    handleConnect,
    handleGoogleLogin,
    finishSetup,
    isConnecting,
    isAuthorized,
    searchTerm,
    setSearchTerm,
    selectedPlatform,
    metaToken,
    setMetaToken,
    tokenMessage,
    setTokenMessage,
    isSavingToken,
    setIsSavingToken,
    handleMetaDiscovery
}: any) => {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)'
        }}>
            <div style={{
                backgroundColor: 'var(--bg-card)', borderRadius: '16px', width: '600px', maxWidth: '90%',
                boxShadow: 'var(--shadow-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                maxHeight: '90vh', border: '1px solid var(--border-color)',
                transition: 'background-color 0.5s ease, border-color 0.5s ease'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, fontFamily: "'Inter', sans-serif", color: 'var(--text-main)' }}>
                        {step === 'selection' && 'Connect Data Source'}
                        {step === 'auth' && 'Authorize Access'}
                        {step === 'meta-token' && 'Meta Ads Access Token'}
                        {step === 'accounts' && `Select ${selectedPlatform === 'google-ads' ? 'Google Ads' : 'Meta Ads'} Accounts`}
                        {step === 'success' && 'Connection Successful'}
                    </h3>
                    <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                        <X size={20} color="var(--text-muted)" />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '32px', overflowY: 'auto' }}>

                    {/* Step 1: Selection */}
                    {step === 'selection' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            {/* Google Ads */}
                            <button
                                onClick={() => onSelectSource('google-ads')}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
                                    padding: '32px 24px', border: '1px solid var(--border-color)', borderRadius: '12px',
                                    backgroundColor: 'var(--bg-card)', cursor: 'pointer', transition: 'all 0.2s',
                                    textAlign: 'center'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--primary-color)';
                                    e.currentTarget.style.backgroundColor = 'rgba(200, 28, 222, 0.02)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border-color)';
                                    e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                                }}
                            >
                                <img src="/google-ads-logo.png" alt="Google Ads" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                                <div>
                                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>Google Ads</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Campaigns & Performance</div>
                                </div>
                            </button>

                            {/* Meta Ads */}
                            <button
                                onClick={() => onSelectSource('meta-ads')}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
                                    padding: '32px 24px', border: '1px solid var(--border-color)', borderRadius: '12px',
                                    backgroundColor: 'var(--bg-card)', cursor: 'pointer', transition: 'all 0.2s',
                                    textAlign: 'center'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = '#1877F2';
                                    e.currentTarget.style.backgroundColor = 'rgba(24, 119, 242, 0.02)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border-color)';
                                    e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                                }}
                            >
                                <img src="/meta-logo.png" alt="Meta Ads" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                                <div>
                                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>Meta Ads</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>FB & Instagram Performance</div>
                                </div>
                            </button>
                        </div>
                    )}

                    {/* Step 2a: Meta Token Input */}
                    {step === 'meta-token' && (
                        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ width: '200px', height: '200px', marginBottom: '16px' }}>
                                <img src="/meta.gif" alt="Meta" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            </div>
                            <h4 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Enter Meta Access Token</h4>
                            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px', maxWidth: '400px', lineHeight: '1.5' }}>
                                Paste your Meta Marketing API Access Token below to connect your Meta Ads accounts.
                            </p>
                            <a
                                href="https://developers.facebook.com/tools/explorer/"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    fontSize: '13px',
                                    color: '#1877F2',
                                    marginBottom: '24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    textDecoration: 'none',
                                    fontWeight: 500
                                }}
                            >
                                Get access token from Graph API Explorer <ExternalLink size={14} />
                            </a>

                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                if (!metaToken.trim()) return;

                                setIsSavingToken(true);
                                setTokenMessage(null);

                                try {
                                    const res = await fetch('/api/settings/meta-token', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ accessToken: metaToken.trim() }),
                                    });

                                    const data = await res.json();

                                    if (res.ok) {
                                        setTokenMessage({ type: 'success', text: 'Token saved successfully!' });
                                        setTimeout(() => {
                                            handleMetaDiscovery();
                                        }, 500);
                                    } else {
                                        setTokenMessage({ type: 'error', text: data.error || 'Failed to save token' });
                                    }
                                } catch (error) {
                                    setTokenMessage({ type: 'error', text: 'An unexpected error occurred' });
                                } finally {
                                    setIsSavingToken(false);
                                }
                            }} style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="password"
                                        placeholder="EAAQ..."
                                        value={metaToken}
                                        onChange={(e) => setMetaToken(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '12px 16px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            fontSize: '14px',
                                            outline: 'none',
                                            transition: 'border-color 0.2s',
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = '#1877F2'}
                                        onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                                    />
                                </div>

                                {tokenMessage && (
                                    <div style={{
                                        padding: '12px',
                                        borderRadius: '8px',
                                        backgroundColor: tokenMessage.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                                        color: tokenMessage.type === 'success' ? '#059669' : '#DC2626',
                                        fontSize: '13px',
                                        fontWeight: 500
                                    }}>
                                        {tokenMessage.text}
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setStep('selection');
                                            setMetaToken('');
                                            setTokenMessage(null);
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: '12px 24px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: 'var(--bg-card)',
                                            color: 'var(--text-main)',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!metaToken.trim() || isSavingToken}
                                        style={{
                                            flex: 1,
                                            padding: '12px 24px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            backgroundColor: metaToken.trim() && !isSavingToken ? '#1877F2' : 'var(--border-color)',
                                            color: metaToken.trim() && !isSavingToken ? 'white' : '#9CA3AF',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            cursor: metaToken.trim() && !isSavingToken ? 'pointer' : 'not-allowed',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {isSavingToken ? 'Saving...' : 'Continue'}
                                    </button>
                                </div>
                            </form>
                        </div >
                    )}

                    {/* Step 2: Auth (Only for Google) */}
                    {
                        step === 'auth' && (
                            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ width: '160px', height: '160px', marginBottom: '8px' }}>
                                    <DotLottieReact
                                        src="https://lottie.host/aa37af10-cb1b-4b1d-b7ce-52837729b201/cwaaZfEoNH.lottie"
                                        autoplay
                                    />
                                </div>
                                <h4 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>Connect to Google Ads</h4>
                                {isAuthorized ? (
                                    <>
                                        <div style={{
                                            backgroundColor: '#F0FDF4', color: '#166534', padding: '12px',
                                            borderRadius: '8px', fontSize: '14px', marginBottom: '24px',
                                            display: 'flex', alignItems: 'center', gap: '8px'
                                        }}>
                                            <Check size={16} />
                                            Your Google account is already authorized.
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                                            <button
                                                onClick={() => { setStep('accounts'); fetchAccounts(userId!); }}
                                                className="btn-primary"
                                            >
                                                Continue with current account
                                            </button>
                                            <button
                                                onClick={() => handleGoogleLogin(true)}
                                                style={{
                                                    backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '12px',
                                                    borderRadius: '8px', fontWeight: 600, cursor: 'pointer', color: 'var(--text-main)',
                                                    fontSize: '14px'
                                                }}
                                            >
                                                Connect another Google account
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '32px', lineHeight: '1.6' }}>
                                            You are about to be redirected to Google to authorize access. We only request read-only access to your performance reports.
                                        </p>
                                        <button
                                            onClick={() => handleGoogleLogin()}
                                            className="btn-primary"
                                        >
                                            Authorize Access
                                        </button>
                                    </>
                                )
                                }
                            </div >
                        )}

                    {/* Step 3: Accounts */}
                    {
                        step === 'accounts' && (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '480px' }}>
                                <div style={{ marginBottom: '16px', position: 'relative' }}>
                                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                                    <input
                                        type="text"
                                        placeholder="Search by account name or ID..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{
                                            width: '100%', padding: '12px 12px 12px 40px', borderRadius: '10px',
                                            border: '1px solid var(--border-color)', outline: 'none', fontSize: '14px',
                                            backgroundColor: 'var(--bg-hover)', color: 'var(--text-main)'
                                        }}
                                    />
                                </div>

                                <div style={{
                                    flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px',
                                    backgroundColor: 'var(--bg-card)'
                                }}>
                                    {loadingAccounts ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '60px' }}>
                                            <Loader2 className="animate-spin text-primary-color" size={24} />
                                            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Fetching your ad accounts...</span>
                                        </div>
                                    ) : (
                                        <>
                                            {accounts.length > 0 ? renderAccountTree(null, 0) : (
                                                <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
                                                    <div style={{ fontSize: '14px', fontWeight: 500 }}>No accounts found</div>
                                                    <p style={{ fontSize: '12px', marginTop: '4px' }}>Make sure you have access to {selectedPlatform}.</p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                <div style={{
                                    marginTop: '20px', padding: '16px', backgroundColor: 'var(--bg-hover)',
                                    borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <div style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: 500 }}>
                                        {selectedAccounts.length} account{selectedAccounts.length !== 1 ? 's' : ''} selected
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button
                                            onClick={() => setStep('selection')}
                                            style={{
                                                padding: '10px 16px', border: '1px solid var(--border-color)', borderRadius: '8px',
                                                background: 'var(--bg-card)', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                                                color: 'var(--text-main)'
                                            }}
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={finishSetup}
                                            disabled={selectedAccounts.length === 0}
                                            className="btn-primary"
                                            style={{
                                                padding: '10px 24px', opacity: selectedAccounts.length === 0 ? 0.5 : 1,
                                                cursor: selectedAccounts.length === 0 ? 'not-allowed' : 'pointer',
                                                width: 'auto'
                                            }}
                                        >
                                            Connect Selected
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {/* Step 4: Success */}
                    {
                        step === 'success' && (
                            <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'var(--bg-hover)', color: 'var(--success-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                                    <Check size={32} strokeWidth={3} />
                                </div>
                                <h4 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-main)' }}>Data Connected!</h4>
                                <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginBottom: '32px' }}>
                                    Your data is now syncing. You can view it in the dashboard.
                                </p>
                                <button
                                    onClick={onClose}
                                    style={{
                                        backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', padding: '12px 40px',
                                        borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer'
                                    }}
                                >
                                    Done
                                </button>
                            </div>
                        )
                    }
                </div >
            </div >
        </div >
    );
};


function SourcesContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [userId, setUserId] = useState<string | null>(null);
    const [sources, setSources] = useState<DataSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<'platform' | 'client'>('platform');

    // Popup State
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [popupStep, setPopupStep] = useState<'selection' | 'auth' | 'meta-token' | 'accounts' | 'success'>('selection');
    const [selectedPlatform, setSelectedPlatform] = useState<'google-ads' | 'meta-ads' | null>(null);
    const [tempSelectedAccounts, setTempSelectedAccounts] = useState<string[]>([]);
    const [availableAccounts, setAvailableAccounts] = useState<Account[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());
    const [loadingSub, setLoadingSub] = useState<string | null>(null);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Meta Token State
    const [metaToken, setMetaToken] = useState('');
    const [tokenMessage, setTokenMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isSavingToken, setIsSavingToken] = useState(false);

    // Client Entry State
    const [editingSource, setEditingSource] = useState<{ accountId: string, sourceType: string, clientName: string } | null>(null);

    const onSelectSource = (platform: 'google-ads' | 'meta-ads') => {
        setSelectedPlatform(platform);
        if (platform === 'google-ads') {
            setPopupStep('auth');
        } else {
            // For Meta, show token input first
            setPopupStep('meta-token');
        }
    };

    const handleMetaDiscovery = async () => {
        setPopupStep('accounts');
        setLoadingAccounts(true);
        try {
            const res = await fetch('/api/meta/accounts');
            const data = await res.json();
            if (res.ok) {
                setAvailableAccounts(data.accounts.map((a: any) => ({
                    id: a.id,
                    name: a.name,
                    currency: a.currency,
                    status: a.account_status === 1 ? 'ACTIVE' : 'INACTIVE',
                    platform: 'meta-ads'
                })));
            } else {
                alert(data.error || 'Failed to fetch Meta accounts. Please check your token in Settings.');
                setPopupStep('selection');
                setIsPopupOpen(false);
            }
        } catch (error) {
            console.error('Meta discovery error:', error);
        } finally {
            setLoadingAccounts(false);
        }
    };

    const handleGoogleLogin = (isSwitch: boolean = false) => {
        if (!userId) return;
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const url = `/api/google/oauth/initiate${isSwitch ? '?switch=true' : ''}`;
        window.open(
            url,
            'google_auth',
            `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=no,location=no`
        );
    };

    const [authorizedEmail, setAuthorizedEmail] = useState<string | null>(null);

    // --- Data Fetching Logic (Unified) ---
    const fetchAccounts = useCallback(async (uid: string, managerId?: string, email?: string) => {
        if (!uid) return;
        if (managerId) setLoadingSub(managerId);
        else setLoadingAccounts(true);

        try {
            let url = managerId
                ? `/api/google/insights/accounts?managerId=${managerId}`
                : `/api/google/insights/accounts`;

            if (email) {
                url += managerId ? `&email=${encodeURIComponent(email)}` : `?email=${encodeURIComponent(email)}`;
            }

            console.log('[fetchAccounts] Calling:', url);
            const res = await fetch(url);
            const data = await res.json();
            console.log('[fetchAccounts] Response status:', res.status);
            console.log('[fetchAccounts] Response data:', data);

            if (res.ok) {
                if (managerId) {
                    setAvailableAccounts(prev => {
                        const next = [...prev];
                        data.accounts.forEach((newA: Account) => {
                            if (!next.find(a => a.id === newA.id)) next.push(newA);
                        });
                        return next;
                    });
                } else {
                    console.log('[fetchAccounts] Setting accounts:', data.accounts);
                    setAvailableAccounts(data.accounts || []);
                }
            } else {
                console.error('[fetchAccounts] API error:', data);
            }
        } catch (error) {
            console.error('[fetchAccounts] Exception:', error);
        } finally {
            setLoadingAccounts(false);
            setLoadingSub(null);
        }
    }, []);

    const fetchSources = useCallback(async (uid: string) => {
        setLoading(true);
        try {
            const statusRes = await fetch(`/api/sources/status`);
            const statusData = await statusRes.json();

            // Also check auth status
            const authRes = await fetch(`/api/google/oauth/check-auth`);
            const authData = await authRes.json();
            setIsAuthorized(authData.authorized);

            if (statusRes.ok && statusData.sources) {
                // Map API response to UI model
                const mapped: DataSource[] = statusData.sources.map((s: any) => ({
                    accountId: s.accountId,
                    accountName: s.accountName,
                    platform: s.sourceType,
                    status: s.status,
                    lastSynced: new Date().toLocaleDateString(),
                    managerId: s.managerId,
                    currency: s.currency,
                    googleEmail: s.googleEmail,
                    clientName: s.clientName // Include clientName
                }));

                setSources(mapped);
                setSelectedIds(new Set());

                // Auto-open popup if no sources (first time experience)
                if (mapped.length === 0 && !searchParams.get('step')) {
                    setIsPopupOpen(true);
                }
            }
        } catch (e) {
            console.error('Fetch sources error', e);
        } finally {
            setLoading(false);
        }
    }, [searchParams]);


    // Initial Load
    useEffect(() => {
        let cancelled = false;

        const init = async () => {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                try {
                    const u = JSON.parse(storedUser);
                    const storedId = u?.id ?? u?.userId;
                    if (storedId) {
                        if (!cancelled) {
                            setUserId(storedId.toString());
                            fetchSources(storedId.toString());
                        }
                        return;
                    }
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
                    setUserId(hydratedUser.id.toString());
                    fetchSources(hydratedUser.id.toString());
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
    }, [router, fetchSources]);

    // Handle Message from Popup
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;

            if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
                const email = event.data.email;
                console.log('Received auth success for email:', email);
                setPopupStep('accounts');
                setIsPopupOpen(true);
                if (email) setAuthorizedEmail(email);
                if (userId) fetchAccounts(userId, undefined, email || undefined);
            } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
                alert('Authentication Failed: ' + (event.data.error || 'Unknown error'));
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [userId, fetchAccounts]);

    // Handle Redirects from Google Auth (Fallback/Legacy)
    useEffect(() => {
        const stepParam = searchParams.get('step');
        const emailParam = searchParams.get('email');
        if (userId && stepParam === 'accounts') {
            setIsPopupOpen(true);
            setPopupStep('accounts');
            if (emailParam) setAuthorizedEmail(emailParam);
            fetchAccounts(userId, undefined, emailParam || undefined);

            // Cleanup URL parameters to prevent re-opening on refresh
            router.replace('/sources', { scroll: false });
        } else if (searchParams.get('error')) {
            alert('Authentication Failed: ' + searchParams.get('error'));
            router.replace('/sources', { scroll: false });
        }
    }, [searchParams, userId, router, fetchAccounts]);


    const handleDelete = async (platform: string, cleanupId?: string, googleEmail?: string) => {
        if (!userId) return;
        const msg = cleanupId ? 'Confirm deletion of this account?' : 'Disconnect ALL Google Ads accounts and remove authorization?';
        if (!confirm(msg)) return;

        try {
            const res = await fetch('/api/sources/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId: cleanupId, googleEmail })
            });
            if (res.ok) {
                fetchSources(userId);
            }
        } catch (e) { console.error(e); }
    };

    const handleBulkDelete = async () => {
        if (!userId || selectedIds.size === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected source(s)?`)) return;

        try {
            const res = await fetch('/api/sources/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountIds: Array.from(selectedIds) })
            });
            if (res.ok) {
                fetchSources(userId);
            }
        } catch (e) { console.error(e); }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === sources.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(sources.map(s => s.accountId)));
        }
    };

    const toggleId = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // --- Account Fetching Logic (Reused) ---

    const toggleManager = (id: string) => {
        setExpandedManagers(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else { next.add(id); if (userId) fetchAccounts(userId, id); }
            return next;
        });
    };

    const toggleAccount = (id: string) => {
        setTempSelectedAccounts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const renderAccountTree = (parentId: string | null = null, level: number = 0) => {
        const relevant = availableAccounts.filter(a => {
            const matchesParent = (a.parentId || null) === parentId;
            if (!searchTerm) return matchesParent;

            // If searching, show all matches regardless of hierarchy (flat-ish view but still showing structure)
            // Or better: show items that match OR have children that match.
            // Simplified for now: just filter matches.
            return a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.id.includes(searchTerm);
        });

        // If searching, we show a flat list of matches
        const itemsToRender = searchTerm ? availableAccounts.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.id.includes(searchTerm)) : relevant;

        return itemsToRender.map(acc => {
            if (searchTerm && itemsToRender.length > 50 && level > 0) return null; // Avoid recursion mess on deep searches

            const isSel = tempSelectedAccounts.includes(acc.id);
            const isExp = expandedManagers.has(acc.id);
            const hasChildren = availableAccounts.some(a => a.parentId === acc.id);

            return (
                <React.Fragment key={acc.id}>
                    <div
                        onClick={() => acc.isManager ? toggleManager(acc.id) : toggleAccount(acc.id)}
                        style={{
                            padding: '12px 16px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer',
                            paddingLeft: searchTerm ? '16px' : `${16 + (level * 24)}px`,
                            backgroundColor: isSel ? 'rgba(0, 120, 212, 0.03)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            transition: 'all 0.1s ease',
                            borderLeft: !searchTerm && level > 0 ? '2px solid var(--border-color)' : 'none',
                            marginLeft: !searchTerm && level > 0 ? '-2px' : '0'
                        }}
                        onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                        onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                            {!searchTerm && acc.isManager && (
                                <div style={{ color: '#9CA3AF', display: 'flex' }}>
                                    {isExp ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                </div>
                            )}
                            {!acc.isManager && !searchTerm && <div style={{ width: 18 }} />}

                            <div style={{
                                width: '32px', height: '32px', borderRadius: '6px',
                                backgroundColor: acc.isManager ? '#EEF2FF' : '#F3F4F6',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: acc.isManager ? '#4F46E5' : '#6B7280', flexShrink: 0
                            }}>
                                {acc.isManager ? <Users size={16} /> : <User size={16} />}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                <span style={{
                                    fontSize: '14px', fontWeight: isSel ? 600 : 500,
                                    color: isSel ? 'var(--primary-color)' : 'var(--text-main)',
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                }}>
                                    {acc.name}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '11px', color: '#6B7280', fontFamily: 'monospace' }}>{acc.id}</span>
                                    {acc.currency && <span style={{ fontSize: '10px', color: '#9CA3AF', backgroundColor: 'var(--bg-hover)', padding: '1px 4px', borderRadius: '3px' }}>{acc.currency}</span>}
                                </div>
                            </div>
                        </div>

                        {!acc.isManager && (
                            <div style={{
                                width: '20px', height: '20px', border: '2px solid ' + (isSel ? 'var(--primary-color)' : 'var(--border-color)'),
                                borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                backgroundColor: isSel ? 'var(--primary-color)' : 'var(--bg-card)',
                                transition: 'all 0.1s ease', flexShrink: 0
                            }}>
                                {isSel && <Check size={14} color="white" />}
                            </div>
                        )}
                    </div>
                    {!searchTerm && isExp && renderAccountTree(acc.id, level + 1)}
                </React.Fragment>
            );
        });
    };

    const handleUpdateClientName = async () => {
        if (!userId || !editingSource) return;

        try {
            const res = await fetch('/api/sources/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountId: editingSource.accountId,
                    sourceType: editingSource.sourceType,
                    clientName: editingSource.clientName.trim() || null
                })
            });

            if (res.ok) {
                setEditingSource(null);
                fetchSources(userId);
            } else {
                alert('Failed to update client name.');
            }
        } catch (error) {
            console.error('Error updating client name:', error);
        }
    };

    const handleConnect = () => {
        // This is now handled via the popup steps
    };

    const finishSetup = async () => {
        if (!userId || tempSelectedAccounts.length === 0) return;

        // For Google Ads
        const selectedData = availableAccounts.filter(a => tempSelectedAccounts.includes(a.id));
        console.log('[finishSetup] Selected platform:', selectedPlatform);
        console.log('[finishSetup] Selected accounts:', selectedData);

        if (selectedPlatform === 'google-ads') {
            const response = await fetch('/api/sources/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accounts: selectedData })
            });
            const result = await response.json();
            console.log('[finishSetup] Google Ads connect result:', result);
        } else {
            // For Meta Ads
            console.log('[finishSetup] Connecting Meta Ads accounts...');
            for (const acc of selectedData) {
                const payload = {
                    sourceType: 'meta-ads',
                    accountId: acc.id,
                    accountName: acc.name,
                    currency: acc.currency,
                    status: 'active'
                };
                console.log('[finishSetup] Meta payload:', payload);
                const response = await fetch('/api/sources/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                console.log('[finishSetup] Meta connect result:', result);
            }
        }

        setPopupStep('success');
        fetchSources(userId);
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', transition: 'background-color 0.5s ease, color 0.5s ease' }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 50 }}>
                <Header pageName="Data Sources" hideSearch={true} hideNotifications={true} />
            </div>

            <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    {/* View Switcher */}
                    <div style={{
                        display: 'flex',
                        backgroundColor: 'var(--bg-hover)',
                        padding: '4px',
                        borderRadius: '10px',
                        gap: '4px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <button
                            onClick={() => setViewMode('platform')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                backgroundColor: viewMode === 'platform' ? 'var(--bg-card)' : 'transparent',
                                color: viewMode === 'platform' ? 'var(--text-main)' : 'var(--text-muted)',
                                boxShadow: viewMode === 'platform' ? 'var(--shadow-sm)' : 'none',
                                transition: 'all 0.2s',
                                border: viewMode === 'platform' ? '1px solid var(--border-color)' : 'none'
                            }}
                        >
                            Platform View
                        </button>
                        <button
                            onClick={() => setViewMode('client')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                backgroundColor: viewMode === 'client' ? 'var(--bg-card)' : 'transparent',
                                color: viewMode === 'client' ? 'var(--text-main)' : 'var(--text-muted)',
                                boxShadow: viewMode === 'client' ? 'var(--shadow-sm)' : 'none',
                                transition: 'all 0.2s',
                                border: viewMode === 'client' ? '1px solid var(--border-color)' : 'none'
                            }}
                        >
                            Client View
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {selectedIds.size > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                style={{
                                    backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2', padding: '10px 20px',
                                    borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px',
                                    cursor: 'pointer', fontWeight: 600, fontSize: '14px', color: '#EF4444'
                                }}
                            >
                                <Trash2 size={16} />
                                Delete Selected ({selectedIds.size})
                            </button>
                        )}
                        <button
                            onClick={() => { setIsPopupOpen(true); setPopupStep('selection'); setAvailableAccounts([]); setTempSelectedAccounts([]); }}
                            style={{
                                backgroundColor: 'var(--primary-color)', border: 'none', padding: '10px 20px',
                                borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px',
                                cursor: 'pointer', fontWeight: 600, fontSize: '14px', color: 'white',
                                boxShadow: '0 4px 12px rgba(200, 28, 222, 0.2)'
                            }}
                        >
                            <Plus size={16} />
                            Add New Source
                        </button>
                    </div>
                </div>

                {/* List Section */}
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                        <Loader2 className="animate-spin text-primary-color" size={32} />
                    </div>
                ) : sources.length === 0 ? (
                    <div style={{
                        backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '60px', textAlign: 'center',
                        border: '1px dashed var(--border-color)'
                    }}>
                        <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>No data sources connected</div>
                        <p style={{ color: 'var(--text-muted)', marginTop: '8px', marginBottom: '24px' }}>Connect Google Ads or Meta Ads to start seeing insights.</p>
                        <button
                            onClick={() => { setIsPopupOpen(true); setPopupStep('selection'); }}
                            style={{
                                backgroundColor: 'var(--primary-color)', color: 'white', border: 'none',
                                padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
                            }}
                        >
                            Connect Data
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        {/* Grouping Logic */}
                        {(() => {
                            const groups: { [key: string]: DataSource[] } = {};

                            if (viewMode === 'platform') {
                                sources.forEach(s => {
                                    const key = s.platform;
                                    if (!groups[key]) groups[key] = [];
                                    groups[key].push(s);
                                });
                            } else {
                                sources.forEach(s => {
                                    const key = s.clientName || 'Unassigned';
                                    if (!groups[key]) groups[key] = [];
                                    groups[key].push(s);
                                });
                            }

                            return Object.entries(groups).map(([groupName, items]) => (
                                <div key={groupName} style={{ marginBottom: '32px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '0 8px' }}>
                                        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {viewMode === 'platform' ? groupName.replace('-', ' ') : groupName}
                                        </h3>
                                        <div style={{ height: '1px', flex: 1, backgroundColor: 'var(--border-color)' }}></div>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{items.length} accounts</span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {items.map(source => {
                                            const isSelected = selectedIds.has(source.accountId);
                                            return (
                                                <div key={`${source.platform}-${source.accountId}`} style={{
                                                    borderRadius: '8px',
                                                    border: isSelected ? '1px solid var(--primary-color)' : '1px solid transparent',
                                                    padding: '12px 16px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                                                    transition: 'all 0.2s',
                                                    cursor: 'default'
                                                }}
                                                    onMouseEnter={(e) => {
                                                        if (!isSelected) {
                                                            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (!isSelected) {
                                                            e.currentTarget.style.backgroundColor = 'transparent';
                                                        }
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
                                                        <div
                                                            onClick={() => toggleId(source.accountId)}
                                                            style={{
                                                                width: '16px', height: '16px',
                                                                border: isSelected ? 'none' : '1px solid var(--text-muted)',
                                                                borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                backgroundColor: isSelected ? 'var(--primary-color)' : 'transparent',
                                                                cursor: 'pointer', flexShrink: 0,
                                                                transition: 'all 0.1s'
                                                            }}
                                                        >
                                                            {isSelected && <Check size={10} color="white" />}
                                                        </div>

                                                        {/* Icon with subtle background */}
                                                        <div style={{
                                                            width: '32px', height: '32px', borderRadius: '6px',
                                                            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                        }}>
                                                            <img
                                                                src={source.platform === 'google-ads' ? '/google-ads-logo.png' : '/meta-logo.png'}
                                                                alt={source.platform}
                                                                style={{ width: '18px', height: '18px', objectFit: 'contain' }}
                                                            />
                                                        </div>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <h4 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-main)' }}>{source.accountName}</h4>

                                                                {/* Client Badge - Cleaner */}
                                                                <div
                                                                    onClick={() => setEditingSource({ accountId: source.accountId, sourceType: source.platform, clientName: source.clientName || '' })}
                                                                    style={{
                                                                        fontSize: '11px',
                                                                        color: source.clientName ? 'var(--text-main)' : 'var(--text-muted)',
                                                                        backgroundColor: 'transparent',
                                                                        padding: '2px 6px',
                                                                        borderRadius: '4px',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        fontWeight: source.clientName ? 500 : 400,
                                                                        border: '1px solid var(--border-color)',
                                                                        opacity: source.clientName ? 1 : 0.6
                                                                    }}
                                                                    className="client-badge"
                                                                >
                                                                    <span>{source.clientName || 'Assign Client'}</span>
                                                                </div>
                                                            </div>

                                                            <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-color)' }}></div>

                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                                                <span style={{ fontFamily: 'monospace', opacity: 0.8 }}>{source.accountId}</span>
                                                                {source.currency && <span>{source.currency}</span>}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.6 }} className="action-buttons">
                                                        <button
                                                            onClick={() => handleDelete(source.platform, source.accountId, source.googleEmail)}
                                                            style={{
                                                                padding: '6px', borderRadius: '6px', border: 'none',
                                                                backgroundColor: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
                                                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                )}
            </div>

            {/* Client Naming Modal - Minimalist */}
            {editingSource && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                    <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', width: '400px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>Assign Client Name</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5' }}>
                            Group multiple accounts under one client name (e.g. "ABC Corp") for unified reporting.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                            <input
                                autoFocus
                                type="text"
                                value={editingSource.clientName}
                                onChange={(e) => setEditingSource({ ...editingSource, clientName: e.target.value })}
                                placeholder="e.g. Acme Corp"
                                style={{
                                    width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)',
                                    fontSize: '14px', outline: 'none', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)',
                                    boxShadow: 'none'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setEditingSource(null)}
                                style={{
                                    padding: '8px 16px', borderRadius: '6px', border: 'none',
                                    backgroundColor: 'transparent', color: 'var(--text-muted)',
                                    fontWeight: 500, cursor: 'pointer', fontSize: '13px'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateClientName}
                                style={{
                                    padding: '8px 16px', borderRadius: '6px', border: 'none',
                                    backgroundColor: 'var(--primary-color)', color: '#fff',
                                    fontSize: '13px', fontWeight: 500, cursor: 'pointer'
                                }}
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )
            }

            <ConnectPopup
                isOpen={isPopupOpen}
                onClose={() => setIsPopupOpen(false)}
                onSelectSource={onSelectSource}
                step={popupStep}
                setStep={setPopupStep}
                userId={userId}
                fetchAccounts={fetchAccounts}
                accounts={availableAccounts}
                loadingAccounts={loadingAccounts}
                selectedAccounts={tempSelectedAccounts}
                toggleAccount={toggleAccount}
                renderAccountTree={renderAccountTree}
                handleConnect={handleConnect}
                handleGoogleLogin={handleGoogleLogin}
                finishSetup={finishSetup}
                isAuthorized={isAuthorized}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                selectedPlatform={selectedPlatform}
                metaToken={metaToken}
                setMetaToken={setMetaToken}
                tokenMessage={tokenMessage}
                setTokenMessage={setTokenMessage}
                isSavingToken={isSavingToken}
                setIsSavingToken={setIsSavingToken}
                handleMetaDiscovery={handleMetaDiscovery}
            />

            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .text-primary-color { color: var(--primary-color); }
                
                /* Minimalist Scrollbar */
                ::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                ::-webkit-scrollbar-track {
                    background: transparent;
                }
                ::-webkit-scrollbar-thumb {
                    background: var(--border-color);
                    border-radius: 3px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: var(--text-muted);
                }
            `}</style>
        </div >
    );

}

export default function SourcesPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary-color" size={24} /></div>}>
            <SourcesContent />
        </Suspense>
    );
}
