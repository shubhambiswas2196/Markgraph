"use client"

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Toast from '@/components/Toast';
import { TrendingUp, BarChart3, Zap } from 'lucide-react';

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
                setTimeout(() => router.push('/romeo-charge'), 1500);
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
            position: 'fixed',
            inset: 0,
            display: 'flex',
            fontFamily: '"Google Sans Flex", var(--font-sans), sans-serif',
            overflow: 'hidden',
            backgroundColor: '#ffffff',
            zIndex: 9999 // Ensure it sits on top of everything
        }}>
            {/* Left Panel - Image/Branding (55% width) */}
            <div style={{
                width: '55%',
                background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '60px',
                position: 'relative',
                overflow: 'hidden',
                height: '100%'
            }}>
                {/* Animated Background Elements */}
                <div style={{
                    position: 'absolute',
                    top: '10%',
                    left: '10%',
                    width: '300px',
                    height: '300px',
                    background: 'radial-gradient(circle, rgba(0,98,117,0.15) 0%, transparent 70%)',
                    borderRadius: '50%',
                    filter: 'blur(40px)',
                    animation: 'float 6s ease-in-out infinite'
                }}></div>
                <div style={{
                    position: 'absolute',
                    bottom: '20%',
                    right: '15%',
                    width: '200px',
                    height: '200px',
                    background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
                    borderRadius: '50%',
                    filter: 'blur(40px)',
                    animation: 'float 8s ease-in-out infinite reverse'
                }}></div>

                <div style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}> {/* Left align content */}

                    {/* Branding Text */}
                    <h1 style={{
                        fontSize: '48px',
                        fontWeight: 800,
                        background: 'linear-gradient(to right, #ffffff, #00bcd4)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: '16px',
                        letterSpacing: '-0.04em',
                        textAlign: 'left',
                    }}>
                        Markgraph
                    </h1>
                    <p style={{
                        color: '#94a3b8',
                        fontSize: '18px',
                        fontWeight: 400,
                        textAlign: 'left',
                        lineHeight: '1.6',
                        marginBottom: '48px',
                        maxWidth: '90%'
                    }}>
                        Transform your marketing chaos into autonomous orchestration. Markgraph synchronizes multi-platform data and deploys specialized AI agents to optimize your growth.
                    </p>

                    {/* Feature List (Nexus & Sync Engine) */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '32px',
                        width: '100%',
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '16px',
                        }}>
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '8px',
                                background: 'rgba(0,188,212,0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginTop: '2px'
                            }}>
                                <Zap size={18} color="#00bcd4" />
                            </div>
                            <div>
                                <div style={{ color: '#ffffff', fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>Nexus Intelligence</div>
                                <div style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.5' }}>Autonomous multi-agent orchestration for Google, Meta, and beyond.</div>
                            </div>
                        </div>

                        <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '16px',
                        }}>
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '8px',
                                background: 'rgba(124,58,237,0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginTop: '2px'
                            }}>
                                <TrendingUp size={18} color="#7c3aed" />
                            </div>
                            <div>
                                <div style={{ color: '#ffffff', fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>Unified Sync Engine</div>
                                <div style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.5' }}>One-click integration for all your marketing sources with automated background sync.</div>
                            </div>
                        </div>

                        <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '16px',
                        }}>
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '8px',
                                background: 'rgba(16,185,129,0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginTop: '2px'
                            }}>
                                <BarChart3 size={18} color="#10b981" />
                            </div>
                            <div>
                                <div style={{ color: '#ffffff', fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>Narrative Reporting</div>
                                <div style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.5' }}>Get human-readable summaries and actionable insights instead of just tables.</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel - Sign In Form (45% width) */}
            <div style={{
                width: '45%',
                minWidth: '400px',
                backgroundColor: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '60px',
                height: '100%',
            }}>
                <div style={{ width: '100%', maxWidth: '380px' }}> {/* Container for form alignment */}
                    {/* Form Header */}
                    <div style={{ marginBottom: '32px' }}>
                        <h2 style={{
                            fontSize: '32px',
                            fontWeight: 700,
                            color: '#0f172a',
                            marginBottom: '10px',
                            letterSpacing: '-0.02em'
                        }}>
                            Sign In
                        </h2>
                        <p style={{
                            color: '#64748b',
                            fontSize: '15px',
                            fontWeight: 400
                        }}>
                            Welcome back to Markgraph
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Email Field */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{
                                fontSize: '13px',
                                fontWeight: 500,
                                color: '#334155',
                            }}>
                                Email address
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        fontSize: '14px',
                                        fontFamily: 'inherit',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '4px', // Sharper radius like Databricks
                                        backgroundColor: '#ffffff',
                                        transition: 'all 0.2s',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        color: '#0f172a',
                                        height: '40px'
                                    }}
                                    onFocus={(e) => {
                                        const input = e.target as HTMLInputElement;
                                        input.style.borderColor = 'var(--primary-color)';
                                        input.style.boxShadow = '0 0 0 1px var(--primary-color)';
                                    }}
                                    onBlur={(e) => {
                                        const input = e.target as HTMLInputElement;
                                        input.style.borderColor = '#cbd5e1';
                                        input.style.boxShadow = 'none';
                                    }}
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    color: '#334155',
                                }}>
                                    Password
                                </label>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="password"
                                    name="password"
                                    required
                                    value={formData.password}
                                    onChange={handleChange}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        fontSize: '14px',
                                        fontFamily: 'inherit',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '4px', // Sharper radius
                                        backgroundColor: '#ffffff',
                                        transition: 'all 0.2s',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        color: '#0f172a',
                                        height: '40px'
                                    }}
                                    onFocus={(e) => {
                                        const input = e.target as HTMLInputElement;
                                        input.style.borderColor = 'var(--primary-color)';
                                        input.style.boxShadow = '0 0 0 1px var(--primary-color)';
                                    }}
                                    onBlur={(e) => {
                                        const input = e.target as HTMLInputElement;
                                        input.style.borderColor = '#cbd5e1';
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
                                padding: '10px',
                                fontSize: '14px',
                                fontWeight: 600,
                                color: 'white',
                                backgroundColor: loading ? '#94a3b8' : 'var(--primary-color)',
                                border: 'none',
                                borderRadius: '4px', // Sharper radius
                                cursor: loading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.15s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                marginTop: '12px',
                                height: '40px'
                            }}
                            onMouseEnter={(e) => {
                                if (!loading) {
                                    e.currentTarget.style.filter = 'brightness(1.1)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!loading) {
                                    e.currentTarget.style.filter = 'none';
                                }
                            }}
                        >
                            {loading ? 'Signing In...' : 'Sign In'}
                        </button>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                            <Link href="/register" style={{
                                fontSize: '13px',
                                color: 'var(--primary-color)',
                                fontWeight: 500,
                                textDecoration: 'none'
                            }}>
                                Sign up
                            </Link>
                            <Link href="#" style={{
                                fontSize: '13px',
                                color: '#64748b',
                                fontWeight: 500,
                                textDecoration: 'none'
                            }}>
                                Forgot Password?
                            </Link>
                        </div>
                    </form>
                </div>
            </div>

            {/* Toast Section */}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <style jsx>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-10px); }
                }
                @media (max-width: 1024px) {
                    .left-panel { display: none; }
                }
            `}</style>
        </div>
    );
}
