"use client"

import React, { useEffect, useRef } from 'react';

interface ChartData {
    labels: string[];
    datasets: Array<{
        label: string;
        data: number[];
        backgroundColor?: string | string[];
        borderColor?: string | string[];
        borderWidth?: number;
    }>;
}

interface ChartGeneratorProps {
    type: 'line' | 'bar' | 'pie' | 'doughnut';
    data: ChartData;
    title?: string;
    width?: number;
    height?: number;
}

export default function ChartGenerator({ type, data, title, width = 400, height = 300 }: ChartGeneratorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Set canvas size
        canvas.width = width;
        canvas.height = height;

        // Chart colors
        const colors = [
            '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
            '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280'
        ];

        const drawLineChart = () => {
            const { labels, datasets } = data;
            const padding = 60;
            const chartWidth = width - padding * 2;
            const chartHeight = height - padding * 2;

            // Find max value for scaling
            const maxValue = Math.max(...datasets[0].data) * 1.1;

            // Draw axes
            ctx.strokeStyle = '#E5E7EB';
            ctx.lineWidth = 1;

            // Y-axis
            ctx.beginPath();
            ctx.moveTo(padding, padding);
            ctx.lineTo(padding, height - padding);
            ctx.stroke();

            // X-axis
            ctx.beginPath();
            ctx.moveTo(padding, height - padding);
            ctx.lineTo(width - padding, height - padding);
            ctx.stroke();

            // Draw grid lines
            ctx.strokeStyle = '#F3F4F6';
            ctx.setLineDash([2, 2]);

            // Horizontal grid lines
            for (let i = 0; i <= 5; i++) {
                const y = padding + (chartHeight / 5) * i;
                ctx.beginPath();
                ctx.moveTo(padding, y);
                ctx.lineTo(width - padding, y);
                ctx.stroke();

                // Y-axis labels
                ctx.fillStyle = '#6B7280';
                ctx.font = '10px Arial';
                ctx.textAlign = 'right';
                ctx.fillText(Math.round((maxValue / 5) * (5 - i)).toString(), padding - 10, y + 3);
            }

            ctx.setLineDash([]);

            // Draw line
            const dataset = datasets[0];
            ctx.strokeStyle = colors[0];
            ctx.lineWidth = 3;
            ctx.beginPath();

            dataset.data.forEach((value, index) => {
                const x = padding + (chartWidth / (labels.length - 1)) * index;
                const y = height - padding - (value / maxValue) * chartHeight;

                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }

                // Draw point
                ctx.fillStyle = colors[0];
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();

                // Draw value label
                ctx.fillStyle = '#374151';
                ctx.font = '11px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(value.toString(), x, y - 10);
            });

            ctx.stroke();

            // X-axis labels
            labels.forEach((label, index) => {
                const x = padding + (chartWidth / (labels.length - 1)) * index;
                ctx.fillStyle = '#6B7280';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(label, x, height - padding + 15);
            });
        };

        const drawBarChart = () => {
            const { labels, datasets } = data;
            const padding = 60;
            const chartWidth = width - padding * 2;
            const chartHeight = height - padding * 2;
            const barWidth = chartWidth / labels.length / datasets.length;

            // Find max value for scaling
            const maxValue = Math.max(...datasets.flatMap(d => d.data)) * 1.1;

            datasets.forEach((dataset, datasetIndex) => {
                dataset.data.forEach((value, index) => {
                    const barHeight = (value / maxValue) * chartHeight;
                    const x = padding + (chartWidth / labels.length) * index + (barWidth * datasetIndex) + 10;
                    const y = height - padding - barHeight;

                    // Draw bar
                    ctx.fillStyle = colors[datasetIndex % colors.length];
                    ctx.fillRect(x, y, barWidth - 5, barHeight);

                    // Draw value label
                    ctx.fillStyle = '#374151';
                    ctx.font = '10px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(value.toString(), x + (barWidth - 5) / 2, y - 5);
                });
            });

            // X-axis labels
            labels.forEach((label, index) => {
                const x = padding + (chartWidth / labels.length) * index + (chartWidth / labels.length) / 2;
                ctx.fillStyle = '#6B7280';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(label, x, height - padding + 15);
            });

            // Y-axis labels
            for (let i = 0; i <= 5; i++) {
                const y = padding + (chartHeight / 5) * i;
                ctx.fillStyle = '#6B7280';
                ctx.font = '10px Arial';
                ctx.textAlign = 'right';
                ctx.fillText(Math.round((maxValue / 5) * (5 - i)).toString(), padding - 10, y + 3);
            }
        };

        const drawPieChart = () => {
            const { labels, datasets } = data;
            const centerX = width / 2;
            const centerY = height / 2;
            const radius = Math.min(width, height) / 2 - 40;

            const dataset = datasets[0];
            const total = dataset.data.reduce((sum, value) => sum + value, 0);
            let startAngle = 0;

            dataset.data.forEach((value, index) => {
                const sliceAngle = (value / total) * 2 * Math.PI;

                // Draw slice
                ctx.fillStyle = colors[index % colors.length];
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
                ctx.closePath();
                ctx.fill();

                // Draw label
                const labelAngle = startAngle + sliceAngle / 2;
                const labelX = centerX + Math.cos(labelAngle) * (radius + 20);
                const labelY = centerY + Math.sin(labelAngle) * (radius + 20);

                ctx.fillStyle = '#374151';
                ctx.font = '11px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`${labels[index]}: ${value}`, labelX, labelY);

                startAngle += sliceAngle;
            });
        };

        // Draw chart based on type
        switch (type) {
            case 'line':
                drawLineChart();
                break;
            case 'bar':
                drawBarChart();
                break;
            case 'pie':
            case 'doughnut':
                drawPieChart();
                break;
        }

        // Draw title
        if (title) {
            ctx.fillStyle = '#111827';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(title, width / 2, 25);
        }

    }, [type, data, title, width, height]);

    return (
        <div style={{ display: 'inline-block', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '16px', backgroundColor: 'white' }}>
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                style={{ display: 'block' }}
            />
        </div>
    );
}
