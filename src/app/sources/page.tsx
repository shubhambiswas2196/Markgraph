"use client"

import React, { useState, useEffect, Suspense } from 'react';
import Header from '@/components/Header';
import { Loader2, Trash2, Plus, X, Check, ExternalLink, ChevronRight, ChevronDown, User, Users, Search, Hash, Globe, DollarSign, ShieldCheck, Mail } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { LogOut, Settings } from 'lucide-react';

// --- Types ---
interface DataSource {
    accountId: string;
    accountName: string;
    platform: 'google-ads' | 'google-analytics'; // Normalized for UI
    status: string;
    lastSynced?: string;
    managerId?: string;
    currency?: string;
    googleEmail?: string;
}

interface Account {
    id: string;
    name: string;
    currency: string;
    status: string;
    isManager?: boolean;
    parentId?: string;
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
    setSearchTerm
}: any) => {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)'
        }}>
            <div style={{
                backgroundColor: 'white', borderRadius: '16px', width: '600px', maxWidth: '90%',
                boxShadow: '0 20px 50px rgba(0,0,0,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                maxHeight: '90vh'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
                        {step === 'selection' && 'Connect Data Source'}
                        {step === 'auth' && 'Authorize Access'}
                        {step === 'accounts' && 'Select Accounts'}
                        {step === 'success' && 'Connection Successful'}
                    </h3>
                    <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                        <X size={20} color="#666" />
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
                                    padding: '32px 24px', border: '1px solid #E5E7EB', borderRadius: '12px',
                                    backgroundColor: 'white', cursor: 'pointer', transition: 'all 0.2s',
                                    textAlign: 'center'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--primary-color)';
                                    e.currentTarget.style.backgroundColor = 'rgba(200, 28, 222, 0.02)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = '#E5E7EB';
                                    e.currentTarget.style.backgroundColor = 'white';
                                }}
                            >
                                <img src="/google-ads-logo.png" alt="Google Ads" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                                <div>
                                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#111', marginBottom: '4px' }}>Google Ads</div>
                                    <div style={{ fontSize: '12px', color: '#666' }}>Campaigns & Performance</div>
                                </div>
                            </button>

                            {/* Google Analytics */}
                            <button
                                onClick={() => onSelectSource('google-analytics')}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
                                    padding: '32px 24px', border: '1px solid #E5E7EB', borderRadius: '12px',
                                    backgroundColor: 'white', cursor: 'pointer', transition: 'all 0.2s',
                                    textAlign: 'center',
                                    opacity: 0.6 // Indicating not ready yet based on context, or enable if ready
                                }}
                                title="Coming Soon"
                            >
                                <img src="/google-analytics-logo.png" alt="Google Analytics" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                                <div>
                                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#111', marginBottom: '4px' }}>Google Analytics</div>
                                    <div style={{ fontSize: '12px', color: '#666' }}>Web Traffic & Events</div>
                                </div>
                            </button>
                        </div>
                    )}

                    {/* Step 2: Auth */}
                    {step === 'auth' && (
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
                                                backgroundColor: 'white', border: '1px solid #D1D5DB', padding: '12px',
                                                borderRadius: '8px', fontWeight: 600, cursor: 'pointer', color: '#374151',
                                                fontSize: '14px'
                                            }}
                                        >
                                            Connect another Google account
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p style={{ color: '#666', fontSize: '14px', marginBottom: '32px', lineHeight: '1.6' }}>
                                        You are about to be redirected to Google to authorize access. We only request read-only access to your performance reports.
                                    </p>
                                    <button
                                        onClick={() => handleGoogleLogin()}
                                        className="btn-primary"
                                    >
                                        Authorize Access
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* Step 3: Accounts */}
                    {step === 'accounts' && (
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
                                        border: '1px solid #E5E7EB', outline: 'none', fontSize: '14px',
                                        backgroundColor: '#F9FAFB'
                                    }}
                                />
                            </div>

                            <div style={{
                                flex: 1, overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: '12px',
                                backgroundColor: 'white'
                            }}>
                                {loadingAccounts ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '60px' }}>
                                        <Loader2 className="animate-spin text-primary-color" size={24} />
                                        <span style={{ fontSize: '14px', color: '#666' }}>Fetching your ad accounts...</span>
                                    </div>
                                ) : (
                                    <>
                                        {accounts.length > 0 ? renderAccountTree(null, 0) : (
                                            <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
                                                <div style={{ fontSize: '14px', fontWeight: 500 }}>No accounts found</div>
                                                <p style={{ fontSize: '12px', marginTop: '4px' }}>Make sure you have access in Google Ads.</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <div style={{
                                marginTop: '20px', padding: '16px', backgroundColor: '#F9FAFB',
                                borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                            }}>
                                <div style={{ fontSize: '14px', color: '#374151', fontWeight: 500 }}>
                                    {selectedAccounts.length} account{selectedAccounts.length !== 1 ? 's' : ''} selected
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        onClick={() => setStep('selection')}
                                        style={{
                                            padding: '10px 16px', border: '1px solid #D1D5DB', borderRadius: '8px',
                                            background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                                            color: '#374151'
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
                    )}

                    {/* Step 4: Success */}
                    {step === 'success' && (
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#E6F4EA', color: '#1E8E3E', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                                <Check size={32} strokeWidth={3} />
                            </div>
                            <h4 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px', color: '#111' }}>Data Connected!</h4>
                            <p style={{ color: '#666', fontSize: '15px', marginBottom: '32px' }}>
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
                    )}
                </div>
            </div>
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

    // Popup State
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [popupStep, setPopupStep] = useState<'selection' | 'auth' | 'accounts' | 'success'>('selection');
    const [tempSelectedAccounts, setTempSelectedAccounts] = useState<string[]>([]);
    const [availableAccounts, setAvailableAccounts] = useState<Account[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());
    const [loadingSub, setLoadingSub] = useState<string | null>(null);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const handleGoogleLogin = (isSwitch: boolean = false) => {
        if (!userId) return;
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const url = `/api/google/oauth/initiate?userId=${userId}${isSwitch ? '&switch=true' : ''}`;
        window.open(
            url,
            'google_auth',
            `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=no,location=no`
        );
    };

    const [authorizedEmail, setAuthorizedEmail] = useState<string | null>(null);

    // Initial Load
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const u = JSON.parse(storedUser);
            setUserId(u.id.toString());
            fetchSources(u.id.toString());
        } else {
            router.push('/login');
        }
    }, [router]);

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
    }, [userId, router]);

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
    }, [searchParams, userId, router]);

    const fetchSources = async (uid: string) => {
        setLoading(true);
        try {
            const statusRes = await fetch(`/api/sources/status?userId=${uid}`);
            const statusData = await statusRes.json();

            // Also check auth status
            const authRes = await fetch(`/api/google/oauth/check-auth?userId=${uid}`);
            const authData = await authRes.json();
            setIsAuthorized(authData.authorized);

            if (statusRes.ok && statusData.sources) {
                // Map API response to UI model
                const mapped: DataSource[] = statusData.sources.map((s: any) => ({
                    accountId: s.accountId,
                    accountName: s.accountName,
                    platform: s.sourceType, // 'google-ads'
                    status: s.status,
                    lastSynced: new Date().toLocaleDateString(),
                    managerId: s.managerId,
                    currency: s.currency,
                    googleEmail: s.googleEmail
                }));

                // De-duplicate sources in case of DB inconsistencies
                const uniqueSources = mapped.filter((v, i, a) =>
                    a.findIndex(t => t.accountId === v.accountId) === i
                );
                setSources(uniqueSources);
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
    };

    const handleDelete = async (platform: string, cleanupId?: string, googleEmail?: string) => {
        if (!userId) return;
        const msg = cleanupId ? 'Confirm deletion of this account?' : 'Disconnect ALL Google Ads accounts and remove authorization?';
        if (!confirm(msg)) return;

        try {
            const res = await fetch('/api/sources/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, accountId: cleanupId, googleEmail })
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
                body: JSON.stringify({ userId, accountIds: Array.from(selectedIds) })
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
    const fetchAccounts = async (uid: string, managerId?: string, email?: string) => {
        if (!uid) return;
        if (managerId) setLoadingSub(managerId);
        else setLoadingAccounts(true);

        try {
            let url = managerId
                ? `/api/google/insights/accounts?userId=${uid}&managerId=${managerId}`
                : `/api/google/insights/accounts?userId=${uid}`;

            if (email) {
                url += `&email=${encodeURIComponent(email)}`;
            }

            const res = await fetch(url);
            const data = await res.json();

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
                    setAvailableAccounts(data.accounts);
                }
            }
        } finally {
            setLoadingAccounts(false);
            setLoadingSub(null);
        }
    };

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
                            borderLeft: !searchTerm && level > 0 ? '2px solid #E5E7EB' : 'none',
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
                                    color: isSel ? 'var(--primary-color)' : '#111827',
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                }}>
                                    {acc.name}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '11px', color: '#6B7280', fontFamily: 'monospace' }}>{acc.id}</span>
                                    {acc.currency && <span style={{ fontSize: '10px', color: '#9CA3AF', backgroundColor: '#F3F4F6', padding: '1px 4px', borderRadius: '3px' }}>{acc.currency}</span>}
                                </div>
                            </div>
                        </div>

                        {!acc.isManager && (
                            <div style={{
                                width: '20px', height: '20px', border: '2px solid ' + (isSel ? 'var(--primary-color)' : '#D1D5DB'),
                                borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                backgroundColor: isSel ? 'var(--primary-color)' : 'white',
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

    const handleConnect = () => {
        handleGoogleLogin();
    };

    const finishSetup = async () => {
        if (!userId || tempSelectedAccounts.length === 0) return;
        const selectedData = availableAccounts.filter(a => tempSelectedAccounts.includes(a.id));

        await fetch('/api/sources/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, accounts: selectedData })
        });

        setPopupStep('success');
        fetchSources(userId);
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB' }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 50 }}>
                <Header pageName="Data Sources" hideSearch={true} hideNotifications={true} />
            </div>

            <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>

                {/* Header Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111', fontFamily: "'Inter', sans-serif" }}>Connected Sources</h1>
                        <p style={{ color: '#666', marginTop: '4px', fontSize: '14px' }}>Manage your data integrations and sync status.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {isAuthorized && (
                            <button
                                onClick={() => handleDelete('google-ads')}
                                style={{
                                    backgroundColor: 'white', border: '1px solid #E5E7EB', padding: '10px 20px',
                                    borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px',
                                    cursor: 'pointer', fontWeight: 600, fontSize: '14px', color: '#666'
                                }}
                            >
                                <LogOut size={16} />
                                Disconnect Google Ads
                            </button>
                        )}
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
                            onClick={() => { setIsPopupOpen(true); setPopupStep('selection'); }}
                            style={{
                                backgroundColor: 'white', border: '1px solid #E5E7EB', padding: '10px 20px',
                                borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px',
                                cursor: 'pointer', fontWeight: 600, fontSize: '14px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
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
                        backgroundColor: 'white', borderRadius: '12px', padding: '60px', textAlign: 'center',
                        border: '1px dashed #DDD'
                    }}>
                        <div style={{ fontSize: '18px', fontWeight: 600, color: '#333' }}>No data sources connected</div>
                        <p style={{ color: '#888', marginTop: '8px', marginBottom: '24px' }}>Connect Google Ads or Analytics to start seeing insights.</p>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Select All Bar */}
                        <div style={{
                            padding: '0 24px', display: 'flex', alignItems: 'center', gap: '12px',
                            marginBottom: '4px'
                        }}>
                            <div
                                onClick={toggleSelectAll}
                                style={{
                                    width: '18px', height: '18px', border: '2px solid ' + (selectedIds.size > 0 ? 'var(--primary-color)' : '#DDD'),
                                    borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    backgroundColor: selectedIds.size === sources.length ? 'var(--primary-color)' : (selectedIds.size > 0 ? 'rgba(200, 28, 222, 0.2)' : 'white'),
                                    cursor: 'pointer'
                                }}
                            >
                                {selectedIds.size === sources.length && <Check size={12} color="white" />}
                                {selectedIds.size > 0 && selectedIds.size < sources.length && <div style={{ width: '8px', height: '2px', backgroundColor: 'var(--primary-color)' }} />}
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#666', cursor: 'pointer' }} onClick={toggleSelectAll}>
                                {selectedIds.size === sources.length ? 'Deselect All' : 'Select All'} ({sources.length})
                            </span>
                        </div>

                        {sources.map(source => {
                            const isSelected = selectedIds.has(source.accountId);
                            return (
                                <div key={`${source.platform}-${source.accountId}`} style={{
                                    borderRadius: '12px', border: '1px solid ' + (isSelected ? 'var(--primary-color)' : '#E5E7EB'),
                                    padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    boxShadow: isSelected ? '0 4px 12px rgba(200, 28, 222, 0.08)' : '0 2px 8px rgba(0,0,0,0.02)',
                                    transition: 'all 0.2s',
                                    backgroundColor: isSelected ? 'rgba(200, 28, 222, 0.01)' : 'white'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                        {/* Checkbox */}
                                        <div
                                            onClick={() => toggleId(source.accountId)}
                                            style={{
                                                width: '20px', height: '20px', border: '2px solid ' + (isSelected ? 'var(--primary-color)' : '#DDD'),
                                                borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                backgroundColor: isSelected ? 'var(--primary-color)' : 'white',
                                                cursor: 'pointer', flexShrink: 0
                                            }}
                                        >
                                            {isSelected && <Check size={14} color="white" />}
                                        </div>

                                        <img
                                            src={source.platform === 'google-ads' ? '/google-ads-logo.png' : '/google-analytics-logo.png'}
                                            alt={source.platform}
                                            style={{ width: '40px', height: '40px', objectFit: 'contain' }}
                                        />

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#111' }}>{source.accountName}</h4>
                                                <span style={{
                                                    fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                                                    backgroundColor: source.platform === 'google-ads' ? '#FFF7ED' : '#F0FDF4',
                                                    color: source.platform === 'google-ads' ? '#C2410C' : '#166534',
                                                    textTransform: 'uppercase', letterSpacing: '0.05em'
                                                }}>
                                                    {source.platform.replace('-', ' ')}
                                                </span>
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px',
                                                    fontWeight: 600, color: '#10B981', backgroundColor: '#ECFDF5',
                                                    padding: '2px 8px', borderRadius: '4px'
                                                }}>
                                                    <ShieldCheck size={12} />
                                                    Active
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6B7280', fontSize: '13px' }}>
                                                    <Hash size={14} style={{ color: '#9CA3AF' }} />
                                                    <span style={{ fontFamily: 'monospace' }}>{source.accountId}</span>
                                                </div>

                                                {source.managerId && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6B7280', fontSize: '13px' }}>
                                                        <Globe size={14} style={{ color: '#9CA3AF' }} />
                                                        <span style={{ fontSize: '12px' }}>Manager: </span>
                                                        <span style={{ fontFamily: 'monospace' }}>{source.managerId}</span>
                                                    </div>
                                                )}

                                                {source.currency && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6B7280', fontSize: '13px' }}>
                                                        <DollarSign size={14} style={{ color: '#9CA3AF' }} />
                                                        <span>{source.currency}</span>
                                                    </div>
                                                )}

                                                {source.googleEmail && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6B7280', fontSize: '13px' }}>
                                                        <Mail size={14} style={{ color: '#9CA3AF' }} />
                                                        <span>{source.googleEmail}</span>
                                                    </div>
                                                )}

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9CA3AF', fontSize: '12px' }}>
                                                    <span>Last synced: {source.lastSynced}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleDelete(source.platform, source.accountId, source.googleEmail)}
                                        style={{
                                            padding: '10px', borderRadius: '8px', border: '1px solid #F3F4F6',
                                            backgroundColor: 'white', color: '#EF4444', cursor: 'pointer',
                                            transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                        title="Disconnect Account"
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FEF2F2'; e.currentTarget.style.borderColor = '#FEE2E2'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#F3F4F6'; }}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Popup */}
            <ConnectPopup
                isOpen={isPopupOpen}
                onClose={() => setIsPopupOpen(false)}
                step={popupStep}
                setStep={setPopupStep}
                onSelectSource={async (source: string) => {
                    if (source === 'google-ads' && userId) {
                        try {
                            // Check local state or fetch fresh
                            if (isAuthorized) {
                                setPopupStep('accounts');
                                fetchAccounts(userId);
                                return;
                            }

                            const res = await fetch(`/api/google/oauth/check-auth?userId=${userId}`);
                            const data = await res.json();
                            if (data.authorized) {
                                setIsAuthorized(true);
                                setPopupStep('accounts');
                                fetchAccounts(userId);
                                return;
                            }
                        } catch (e) {
                            console.error('Check auth error', e);
                        }
                    }
                    setPopupStep('auth');
                }}
                userId={userId}
                fetchAccounts={fetchAccounts}
                accounts={availableAccounts}
                loadingAccounts={loadingAccounts}
                isAuthorized={isAuthorized}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                selectedAccounts={tempSelectedAccounts}
                toggleAccount={toggleAccount}
                renderAccountTree={renderAccountTree}
                handleConnect={handleConnect}
                handleGoogleLogin={handleGoogleLogin}
                finishSetup={finishSetup}
            />

            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .text-primary-color { color: var(--primary-color); }
            `}</style>
        </div>
    );

}

export default function SourcesPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary-color" size={32} /></div>}>
            <SourcesContent />
        </Suspense>
    );
}
