'use client';

import React, { useState } from 'react';
import { Trash2, MessageSquare, Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ConversationItemProps {
    id: number;
    title: string;
    updatedAt: Date;
    messageCount: number;
    isActive: boolean;
    onClick: () => void;
    onDelete: (id: number) => void;
}

export function ConversationItem({
    id,
    title,
    updatedAt,
    messageCount,
    isActive,
    onClick,
    onDelete
}: ConversationItemProps) {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (showDeleteConfirm) {
            onDelete(id);
            setShowDeleteConfirm(false);
        } else {
            setShowDeleteConfirm(true);
        }
    };

    const handleCancelDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowDeleteConfirm(false);
    };

    return (
        <div
            className={`conversation-item ${isActive ? 'active' : ''}`}
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                setShowDeleteConfirm(false);
            }}
        >
            <div className="conversation-content">
                <MessageSquare size={16} className="conversation-icon" />
                <div className="conversation-text">
                    <div className="conversation-title">{title}</div>
                    <div className="conversation-meta">
                        {messageCount} {messageCount === 1 ? 'message' : 'messages'} · {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
                    </div>
                </div>
            </div>

            {showDeleteConfirm ? (
                <div className="delete-confirm">
                    <button
                        className="confirm-btn delete"
                        onClick={handleDelete}
                        title="Confirm delete"
                    >
                        <Check size={14} />
                    </button>
                    <button
                        className="confirm-btn cancel"
                        onClick={handleCancelDelete}
                        title="Cancel"
                    >
                        <X size={14} />
                    </button>
                </div>
            ) : (
                (isHovered || isActive) && (
                    <button
                        className="delete-btn"
                        onClick={handleDelete}
                        title="Delete conversation"
                    >
                        <Trash2 size={14} />
                    </button>
                )
            )}

            <style jsx>{`
                .conversation-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
                    gap: 8px;
                    margin-bottom: 4px;
                    border: 1px solid transparent;
                    position: relative;
                }

                .conversation-item:hover {
                    background: rgba(0, 0, 0, 0.03);
                    border-color: rgba(0, 0, 0, 0.04);
                }

                .conversation-item.active {
                    background: rgba(37, 99, 235, 0.08);
                    border-color: rgba(37, 99, 235, 0.15);
                }

                .conversation-item.active:hover {
                    background: rgba(37, 99, 235, 0.12);
                }

                [data-theme='amoled'] .conversation-item:hover {
                    background: rgba(255, 255, 255, 0.05);
                }

                [data-theme='amoled'] .conversation-item.active {
                    background: rgba(59, 130, 246, 0.1);
                    border-color: rgba(59, 130, 246, 0.2);
                }

                .conversation-content {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    flex: 1;
                    min-width: 0;
                }

                .conversation-icon {
                    flex-shrink: 0;
                    margin-top: 2px;
                    opacity: 0.4;
                    color: var(--text-muted);
                    width: 14px;
                    height: 14px;
                    transition: all 0.15s ease;
                }

                .conversation-item:hover .conversation-icon {
                    opacity: 0.6;
                }

                .conversation-item.active .conversation-icon {
                    opacity: 1;
                    color: rgb(37, 99, 235);
                }

                .conversation-text {
                    flex: 1;
                    min-width: 0;
                }

                .conversation-title {
                    font-size: 13.5px;
                    font-weight: 500;
                    color: var(--text-main);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    margin-bottom: 3px;
                    line-height: 1.4;
                }

                .conversation-item.active .conversation-title {
                    font-weight: 600;
                    color: rgb(37, 99, 235);
                }

                .conversation-meta {
                    font-size: 11px;
                    color: var(--text-muted);
                    opacity: 0.7;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .conversation-item:hover .conversation-meta {
                    opacity: 0.85;
                }

                .delete-btn {
                    flex-shrink: 0;
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 6px;
                    background: transparent;
                    color: var(--text-muted);
                    opacity: 0;
                    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
                    transform: scale(0.9);
                }
                
                .conversation-item:hover .delete-btn,
                .conversation-item.active .delete-btn {
                    opacity: 1;
                    transform: scale(1);
                }

                .delete-btn:hover {
                    background: rgba(239, 68, 68, 0.1);
                    color: rgb(239, 68, 68);
                }

                .delete-confirm {
                    display: flex;
                    gap: 6px;
                }

                .confirm-btn {
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 6px;
                    transition: all 0.15s ease;
                }

                .confirm-btn.delete {
                    background: rgb(239, 68, 68);
                    color: white;
                }

                .confirm-btn.delete:hover {
                    background: rgb(220, 38, 38);
                }

                .confirm-btn.cancel {
                    background: rgba(0, 0, 0, 0.05);
                    color: var(--text-muted);
                }

                .confirm-btn.cancel:hover {
                    background: rgba(0, 0, 0, 0.1);
                    color: var(--text-main);
                }

                [data-theme='amoled'] .confirm-btn.cancel {
                    background: rgba(255, 255, 255, 0.1);
                }

                [data-theme='amoled'] .confirm-btn.cancel:hover {
                    background: rgba(255, 255, 255, 0.15);
                }
            `}</style>
        </div>
    );
}
