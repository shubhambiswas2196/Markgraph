"use client"

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Toast from '@/components/Toast';

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
    });
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const router = useRouter();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setToast(null);

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (res.ok) {
                setToast({ message: 'Registration successful! Redirecting...', type: 'success' });
                setTimeout(() => router.push('/login'), 2000);
            } else {
                setToast({ message: data.error || 'Something went wrong', type: 'error' });
            }
        } catch {
            setToast({ message: 'Failed to connect to server', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-color)' }}>
            <div className="premium-card" style={{ maxWidth: '450px', width: '100%', padding: '40px', margin: '20px' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-main)' }}>Create Account</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>Join MetricGraph and start visualizing your success</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <label className="form-label">First Name</label>
                            <input
                                type="text"
                                name="firstName"
                                placeholder="John"
                                className="input-field"
                                required
                                value={formData.firstName}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label className="form-label">Last Name</label>
                            <input
                                type="text"
                                name="lastName"
                                placeholder="Doe"
                                className="input-field"
                                required
                                value={formData.lastName}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="form-label">Company Email</label>
                        <input
                            type="email"
                            name="email"
                            placeholder="john@company.com"
                            className="input-field"
                            required
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            name="password"
                            placeholder="••••••••"
                            className="input-field"
                            required
                            value={formData.password}
                            onChange={handleChange}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={loading}
                        style={{ marginTop: '8px' }}
                    >
                        {loading ? 'Creating Account...' : 'Sign Up'}
                    </button>
                </form>

                <p style={{ marginTop: '32px', textAlign: 'center', fontSize: '14px', color: 'var(--text-muted)' }}>
                    Already have an account? <Link href="/login" style={{ color: 'var(--primary-color)', fontWeight: 500 }}>Sign In</Link>
                </p>
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
