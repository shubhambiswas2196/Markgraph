"use client"

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User as UserIcon, Mail, Building2 } from 'lucide-react';
import Header from '@/components/Header';

interface UserData {
    firstName: string;
    lastName: string;
    email: string;
}

export default function ProfilePage() {
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

    const handleLogout = () => {
        localStorage.removeItem('user');
        router.push('/login');
    };

    if (!user) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: 'var(--text-muted)' }}>
            Loading...
        </div>
    );

    const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();

    return (
        <div style={{ padding: '0 40px 40px', minHeight: '100vh' }}>
            <Header pageName="User Profile" />

            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <div className="premium-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '40px' }}>
                        <div className="avatar-circle" style={{ width: '80px', height: '80px', fontSize: '28px', backgroundColor: '#f0f4f9', color: 'var(--primary-color)', border: 'none' }}>
                            {initials}
                        </div>
                        <div>
                            <h2 style={{ fontSize: '20px', fontWeight: 600 }}>{user.firstName} {user.lastName}</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Free Plan Account</p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '32px' }}>
                        <div>
                            <label className="form-label">Full Name</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <UserIcon size={18} color="var(--text-muted)" />
                                <span style={{ fontSize: '15px' }}>{user.firstName} {user.lastName}</span>
                            </div>
                        </div>
                        <div>
                            <label className="form-label">Company Email</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <Mail size={18} color="var(--text-muted)" />
                                <span style={{ fontSize: '15px' }}>{user.email}</span>
                            </div>
                        </div>
                        <div>
                            <label className="form-label">Organization</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <Building2 size={18} color="var(--text-muted)" />
                                <span style={{ fontSize: '15px' }}>MetricGraph Internal</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
