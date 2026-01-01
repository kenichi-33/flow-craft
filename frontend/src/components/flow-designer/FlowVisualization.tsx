'use client';

import React, { useMemo } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import ReactFlow, { MarkerType, Background } from 'reactflow';
import 'reactflow/dist/style.css';

interface FlowVisualizationProps {
    nodes: any[];
    edges: any[];
    currentNodeId?: string | null;
    completedStepIds?: Set<string>;
    height?: number;
    showBackground?: boolean;
}

/**
 * フロー可視化の共通コンポーネント
 * スイムレーン対応、現在ステップ・完了ステップの表示を含む
 */
export default function FlowVisualization({
    nodes: rawNodes,
    edges: rawEdges,
    currentNodeId,
    completedStepIds = new Set(),
    height = 280,
    showBackground = false,
}: FlowVisualizationProps) {
    const { displayNodes, displayEdges } = useMemo(() => {
        const displayNodes = rawNodes.map((node: any) => {
            // スイムレーンは背景として表示
            if (node.type === 'swimlane') {
                return {
                    ...node,
                    zIndex: -10,
                    style: {
                        background: node.data?.color || '#e3f2fd',
                        border: '2px solid #90caf9',
                        borderRadius: 4,
                        width: node.style?.width || node.data?.width || 800,
                        height: node.style?.height || node.data?.height || 200,
                    },
                    data: {
                        ...node.data,
                        label: (
                            <Box sx={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 36,
                                bgcolor: 'rgba(0,0,0,0.05)',
                                borderRight: '1px solid #90caf9',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                writingMode: 'vertical-rl',
                            }}>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontWeight: 'bold',
                                        transform: 'rotate(180deg)',
                                        fontSize: '0.75rem',
                                    }}
                                >
                                    {node.data?.label || 'レーン'}
                                </Typography>
                            </Box>
                        ),
                    },
                };
            }

            const isCurrent = node.id === currentNodeId;
            const isCompleted = completedStepIds.has(node.id);
            const isStart = node.type === 'start';
            const isEnd = node.type === 'end';

            let bgColor = '#f5f5f5';
            let borderColor = '#ccc';

            if (isStart) {
                bgColor = '#e8f5e9';
                borderColor = '#4caf50';
            } else if (isEnd) {
                bgColor = '#ffebee';
                borderColor = '#f44336';
            } else if (isCurrent) {
                bgColor = '#e3f2fd';
                borderColor = '#2196f3';
            } else if (isCompleted) {
                bgColor = '#e8f5e9';
                borderColor = '#4caf50';
            }

            return {
                ...node,
                zIndex: 1,
                style: {
                    background: bgColor,
                    border: `2px solid ${borderColor}`,
                    borderRadius: 8,
                    padding: 10,
                    minWidth: 100,
                },
                data: {
                    ...node.data,
                    label: (
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" fontWeight={isCurrent ? 'bold' : 'normal'}>
                                {node.data?.label || node.type}
                            </Typography>
                            {isCurrent && (
                                <Chip label="現在" size="small" color="primary" sx={{ mt: 0.5, height: 18, fontSize: 10 }} />
                            )}
                            {isCompleted && !isCurrent && (
                                <Chip label="完了" size="small" color="success" sx={{ mt: 0.5, height: 18, fontSize: 10 }} />
                            )}
                        </Box>
                    ),
                },
            };
        });

        const displayEdges = rawEdges.map((edge: any) => {
            const sourceCompleted = completedStepIds.has(edge.source) || edge.source === 'start';
            const targetCompleted = completedStepIds.has(edge.target);
            const targetIsCurrent = edge.target === currentNodeId;
            const isTraversed = sourceCompleted && (targetCompleted || targetIsCurrent);
            const leadsToTarget = sourceCompleted && targetIsCurrent;

            return {
                ...edge,
                markerEnd: { type: MarkerType.ArrowClosed, color: isTraversed ? (leadsToTarget ? '#2196f3' : '#4caf50') : '#999' },
                style: {
                    strokeWidth: isTraversed ? 3 : 2,
                    stroke: isTraversed ? (leadsToTarget ? '#2196f3' : '#4caf50') : '#999',
                },
                animated: leadsToTarget,
            };
        });

        return { displayNodes, displayEdges };
    }, [rawNodes, rawEdges, currentNodeId, completedStepIds]);

    if (displayNodes.length === 0) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height, bgcolor: '#fafafa', borderRadius: 2 }}>
                <Typography color="text.secondary">フロー情報がありません</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ height, bgcolor: '#fafafa', borderRadius: 2 }}>
            <ReactFlow
                nodes={displayNodes}
                edges={displayEdges}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag={false}
                zoomOnScroll={false}
            >
                {showBackground && <Background />}
            </ReactFlow>
        </Box>
    );
}
