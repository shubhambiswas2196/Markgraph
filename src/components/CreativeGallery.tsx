'use client';

import React, { useState } from 'react';
import { Play, Image as ImageIcon, Maximize2, X } from 'lucide-react';

interface Creative {
    url: string;
    name: string;
    format: string; // 'video' | 'image' | 'carousel'
    metrics?: {
        ctr?: string;
        cpc?: string;
        spend?: string;
    };
}

interface CreativeGalleryProps {
    creatives: Creative[];
}

export default function CreativeGallery({ creatives }: CreativeGalleryProps) {
    const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null);

    // If only one, show large
    // If multiple, show grid

    return (
        <div className="creative-gallery-container" style={{ margin: '20px 0' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Ad Creatives ({creatives.length})
            </h3>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '12px',
            }}>
                {creatives.map((c, idx) => (
                    <div
                        key={idx}
                        onClick={() => setSelectedCreative(c)}
                        style={{
                            position: 'relative',
                            aspectRatio: '1', // Square for grid consistency
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            backgroundColor: '#f8fafc',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                        }}
                        className="creative-card-hover"
                    >
                        {/* Media Thumbnail */}
                        {c.format?.toLowerCase().includes('video') ? (
                            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                                <video
                                    src={c.url}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    muted
                                    playsInline
                                />
                                <div style={{
                                    position: 'absolute',
                                    top: '50%', left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: '40px', height: '40px',
                                    borderRadius: '50%',
                                    background: 'rgba(0,0,0,0.5)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    backdropFilter: 'blur(4px)'
                                }}>
                                    <Play size={18} color="white" fill="white" />
                                </div>
                            </div>
                        ) : (
                            <img
                                src={c.url}
                                alt={c.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        )}

                        {/* Overlay Info */}
                        <div style={{
                            position: 'absolute',
                            bottom: 0, left: 0, right: 0,
                            padding: '8px 12px',
                            background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 500
                        }}>
                            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {c.name || 'Ad Creative'}
                            </div>
                        </div>

                        {/* Format Badge */}
                        <div style={{
                            position: 'absolute',
                            top: '8px', right: '8px',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            background: 'rgba(0,0,0,0.6)',
                            backdropFilter: 'blur(4px)',
                            color: 'white',
                            fontSize: '10px',
                            fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '4px'
                        }}>
                            {c.format?.toLowerCase().includes('video') ? <Play size={10} /> : <ImageIcon size={10} />}
                            {c.format}
                        </div>
                    </div>
                ))}
            </div>

            {/* Lightbox Modal */}
            {selectedCreative && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 9999,
                    background: 'rgba(0,0,0,0.9)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    animation: 'fadeIn 0.2s ease-out'
                }} onClick={() => setSelectedCreative(null)}>

                    <button
                        onClick={() => setSelectedCreative(null)}
                        style={{
                            position: 'absolute',
                            top: '20px', right: '20px',
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '40px', height: '40px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'white'
                        }}
                    >
                        <X size={24} />
                    </button>

                    <div style={{
                        maxWidth: '900px',
                        maxHeight: '90vh',
                        width: '100%',
                        position: 'relative',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }} onClick={e => e.stopPropagation()}>
                        {selectedCreative.format?.toLowerCase().includes('video') ? (
                            <video
                                src={selectedCreative.url}
                                controls
                                autoPlay
                                style={{ width: '100%', maxHeight: '80vh', display: 'block', background: 'black' }}
                            />
                        ) : (
                            <img
                                src={selectedCreative.url}
                                alt={selectedCreative.name}
                                style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block', background: 'black' }}
                            />
                        )}
                        <div style={{
                            padding: '16px 24px',
                            background: '#1e293b',
                            color: 'white',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{selectedCreative.name}</h4>
                                <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.7 }}>{selectedCreative.format}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <style jsx>{`
                .creative-card-hover:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 20px rgba(0,0,0,0.1);
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
}
