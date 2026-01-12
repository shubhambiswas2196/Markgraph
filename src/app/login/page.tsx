"use client"

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Toast from '@/components/Toast';
import { Sparkles, Mail, Lock, ArrowRight } from 'lucide-react';

export default function LoginPage() {
    const [formData, setFormData] = useState({
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
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (res.ok) {
                setToast({ message: 'Login successful! Redirecting...', type: 'success' });
                localStorage.setItem('user', JSON.stringify(data.user));
                setTimeout(() => router.push('/nexus'), 1500);
            } else {
                setToast({ message: data.error || 'Invalid credentials', type: 'error' });
            }
        } catch {
            setToast({ message: 'Failed to connect to server', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            height: '100vh',
            width: '100vw',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F8FAFC', // Very light slate background
            fontFamily: '"Google Sans Flex", var(--font-sans), sans-serif',
        }}>
            <div style={{
                width: '100%',
                maxWidth: '440px',
                padding: '48px',
                backgroundColor: 'white',
                borderRadius: '24px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.04)',
                border: '1px solid rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                animation: 'fadeIn 0.6s ease-out'
            }}>
                {/* Brand Logo & Title */}
                <div style={{ marginBottom: '40px', textAlign: 'center' }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, var(--primary-color) 0%, #00a8cc 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 16px rgba(0, 98, 117, 0.15)',
                        margin: '0 auto 24px'
                    }}>
                        <Sparkles size={28} color="white" />
                    </div>
                    <h1 style={{
                        fontSize: '32px',
                        fontWeight: 700,
                        color: '#1e293b',
                        marginBottom: '8px',
                        letterSpacing: '-0.03em'
                    }}>
                        MetricGraph
                    </h1>
                    <p style={{
                        color: '#64748b',
                        fontSize: '16px',
                        fontWeight: 400
                    }}>
                        AI-Powered Marketing Intelligence
                    </p>
                </div>

                {/* Form Section */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Email Field */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            color: '#475569',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            Email Address
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Mail
                                size={18}
                                style={{
                                    position: 'absolute',
                                    left: '16px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: '#cbd5e1'
                                }}
                            />
                            <input
                                type="email"
                                name="email"
                                placeholder="name@company.com"
                                required
                                value={formData.email}
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: '16px 16px 16px 48px',
                                    fontSize: '15px',
                                    fontFamily: 'inherit',
                                    border: '1.5px solid #f1f5f9',
                                    borderRadius: '16px',
                                    backgroundColor: '#f8fafc',
                                    transition: 'all 0.2s',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    color: '#1e293b'
                                }}
                                onFocus={(e) => {
                                    const input = e.target as HTMLInputElement;
                                    input.style.borderColor = 'var(--primary-color)';
                                    input.style.backgroundColor = 'white';
                                    input.style.boxShadow = '0 0 0 4px rgba(0, 98, 117, 0.08)';
                                }}
                                onBlur={(e) => {
                                    const input = e.target as HTMLInputElement;
                                    input.style.borderColor = '#f1f5f9';
                                    input.style.backgroundColor = '#f8fafc';
                                    input.style.boxShadow = 'none';
                                }}
                            />
                        </div>
                    </div>

                    {/* Password Field */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{
                                fontSize: '13px',
                                fontWeight: 700,
                                color: '#475569',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                Password
                            </label>
                            <Link href="#" style={{
                                fontSize: '13px',
                                color: 'var(--primary-color)',
                                fontWeight: 700,
                                textDecoration: 'none'
                            }}>
                                Forgot?
                            </Link>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <Lock
                                size={18}
                                style={{
                                    position: 'absolute',
                                    left: '16px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: '#cbd5e1'
                                }}
                            />
                            <input
                                type="password"
                                name="password"
                                placeholder="••••••••"
                                required
                                value={formData.password}
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: '16px 16px 16px 48px',
                                    fontSize: '15px',
                                    fontFamily: 'inherit',
                                    border: '1.5px solid #f1f5f9',
                                    borderRadius: '16px',
                                    backgroundColor: '#f8fafc',
                                    transition: 'all 0.2s',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    color: '#1e293b'
                                }}
                                onFocus={(e) => {
                                    const input = e.target as HTMLInputElement;
                                    input.style.borderColor = 'var(--primary-color)';
                                    input.style.backgroundColor = 'white';
                                    input.style.boxShadow = '0 0 0 4px rgba(0, 98, 117, 0.08)';
                                }}
                                onBlur={(e) => {
                                    const input = e.target as HTMLInputElement;
                                    input.style.borderColor = '#f1f5f9';
                                    input.style.backgroundColor = '#f8fafc';
                                    input.style.boxShadow = 'none';
                                }}
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '18px',
                            fontSize: '16px',
                            fontWeight: 700,
                            color: 'white',
                            backgroundColor: loading ? '#94a3b8' : 'var(--primary-color)',
                            border: 'none',
                            borderRadius: '16px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: loading ? 'none' : '0 10px 20px -5px rgba(0, 98, 117, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            marginTop: '8px'
                        }}
                        onMouseEnter={(e) => {
                            if (!loading) {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 15px 25px -5px rgba(0, 98, 117, 0.35)';
                                e.currentTarget.style.filter = 'brightness(1.05)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!loading) {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 10px 20px -5px rgba(0, 98, 117, 0.25)';
                                e.currentTarget.style.filter = 'none';
                            }
                        }}
                    >
                        {loading ? 'Signing In...' : 'Sign In'}
                        {!loading && <ArrowRight size={20} />}
                    </button>
                </form>

                {/* Registration Link */}
                <div style={{
                    marginTop: '40px',
                    textAlign: 'center',
                    fontSize: '15px',
                    color: '#64748b'
                }}>
                    Don’t have an account?{' '}
                    <Link href="/register" style={{
                        color: 'var(--primary-color)',
                        fontWeight: 700,
                        textDecoration: 'none'
                    }}>
                        Get Started
                    </Link>
                </div>
            </div>

            {/* Toast Section */}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
