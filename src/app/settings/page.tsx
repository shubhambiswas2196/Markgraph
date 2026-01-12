"use client"

import React, { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';

interface UserData {
    firstName: string;
    lastName: string;
    email: string;
}

export default function SettingsPage() {
    const [user, setUser] = useState<UserData | null>(null);
    const router = useRouter();

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        } else {
            router.push('/login');
        }
    }, [router]);

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
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111', marginBottom: '32px', letterSpacing: '-0.01em' }}>Properties</h1>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '13px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</label>
                            <div style={{ fontSize: '16px', fontWeight: 600, color: '#111' }}>{user.firstName} {user.lastName}</div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '13px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</label>
                            <div style={{ fontSize: '16px', fontWeight: 600, color: '#111', fontFamily: 'monospace' }}>{user.email}</div>
                        </div>

                        <div style={{ height: '1px', backgroundColor: '#F3F4F6', margin: '8px 0' }}></div>

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
                    </div>
                </div>
            </main>
        </div>
    );
}
