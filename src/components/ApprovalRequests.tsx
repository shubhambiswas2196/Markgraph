
import React from 'react';
import { CheckCircle2, XCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { motion } from 'framer-motion';

interface ApprovalRequestProps {
    approvalId: string;
    description: string;
    dataSummary?: string;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
}

export const ApprovalRequest: React.FC<ApprovalRequestProps> = ({ approvalId, description, dataSummary, onApprove, onReject }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="approval-card"
        >
            <div className="approval-content">
                <div className="approval-icon">
                    <AlertCircle size={24} />
                </div>
                <div className="approval-details">
                    <h3 className="approval-title">Approval Required</h3>
                    <p className="approval-desc">{description}</p>

                    {dataSummary && (
                        <div className="data-summary">
                            {dataSummary}
                        </div>
                    )}

                    <div className="approval-actions">
                        <button
                            onClick={() => onApprove(approvalId)}
                            className="action-btn approve"
                        >
                            <CheckCircle2 size={16} />
                            Approve
                        </button>
                        <button
                            onClick={() => onReject(approvalId)}
                            className="action-btn reject"
                        >
                            <XCircle size={16} />
                            Reject
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .approval-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 20px;
                    margin: 16px 0;
                    box-shadow: var(--shadow-lg);
                }

                .approval-content {
                    display: flex;
                    align-items: flex-start;
                    gap: 16px;
                }

                .approval-icon {
                    background: rgba(168, 85, 247, 0.1);
                    padding: 8px;
                    border-radius: 8px;
                    color: var(--accent-color);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .approval-details {
                    flex: 1;
                }

                .approval-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: var(--text-main);
                    margin-bottom: 4px;
                }

                .approval-desc {
                    color: var(--text-muted);
                    font-size: 14px;
                    margin-bottom: 12px;
                    line-height: 1.5;
                }

                .data-summary {
                    background: var(--bg-hover);
                    border-radius: 6px;
                    padding: 12px;
                    margin-bottom: 16px;
                    font-size: 13px;
                    font-family: monospace;
                    color: var(--text-main);
                    border-left: 3px solid var(--accent-color);
                }

                .approval-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 16px;
                }

                .action-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-weight: 500;
                    font-size: 14px;
                    transition: all 0.2s;
                    border: none;
                    cursor: pointer;
                }

                .action-btn.approve {
                    background: var(--success-color);
                    color: white;
                }

                .action-btn.approve:hover {
                    opacity: 0.9;
                }

                .action-btn.reject {
                    background: rgba(239, 68, 68, 0.1);
                    color: var(--error-color);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                }

                .action-btn.reject:hover {
                    background: rgba(239, 68, 68, 0.2);
                }
            `}</style>
        </motion.div>
    );
};
