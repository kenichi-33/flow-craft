'use client';

import React, { useMemo } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import ReactFlow, { MarkerType, Background, Handle, Position, Controls } from 'reactflow';
import 'reactflow/dist/style.css';

// 共通のハンドル設定（BPMN標準の左→右接続）
const CommonHandles = () => (
    <>
        <Handle type="target" position={Position.Left} id="input" style={{ opacity: 0, pointerEvents: 'none' }} />
        <Handle type="source" position={Position.Right} id="output" style={{ opacity: 0, pointerEvents: 'none' }} />
        <Handle type="source" position={Position.Right} id="yes" style={{ opacity: 0, top: '30%', pointerEvents: 'none' }} />
        <Handle type="source" position={Position.Right} id="no" style={{ opacity: 0, top: '70%', pointerEvents: 'none' }} />
    </>
);

// 承認ノード：担当者表示あり
const ApprovalNode = ({ data }: { data: any }) => (
    <Box sx={{ 
        p: 1, 
        textAlign: 'center', 
        position: 'relative', 
        minWidth: 120, 
        minHeight: 60,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
    }}>
        <CommonHandles />
        <Typography variant="body2" fontWeight="bold">{data?.label || '承認'}</Typography>
        {data?.assigneeDisplay ? (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.7rem' }}>
                {data.assigneeDisplay}
            </Typography>
        ) : (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.7rem' }}>
                未割当
            </Typography>
        )}
        {data?.isCurrent && (
            <Chip label="現在" size="small" color="primary" sx={{ mt: 0.5, height: 18, fontSize: 10 }} />
        )}
        {data?.isCompleted && !data?.isCurrent && (
            <Chip label="完了" size="small" color="success" sx={{ mt: 0.5, height: 18, fontSize: 10 }} />
        )}
    </Box>
);

// 開始・終了ノード：丸型
const CycleNode = ({ data }: { data: any }) => (
    <Box sx={{ 
        width: 40,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        position: 'relative',
    }}>
        <CommonHandles />
        <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.7rem' }}>
            {data?.label}
        </Typography>
    </Box>
);

// ゲートウェイノード：菱形（CSSで表現）
// ゲートウェイノード：菱形（CSSで表現）
const GatewayNode = ({ data }: { data: any }) => (
    <Box sx={{ 
        width: 40,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: 'rotate(45deg)', // 菱形にする
        backgroundColor: data?.bgColor || '#f5f5f5',
        border: `2px solid ${data?.borderColor || '#ccc'}`,
        borderRadius: '4px',
    }}>
        <CommonHandles />
        <Typography 
            variant="caption" 
            fontWeight="bold" 
            sx={{ 
                transform: 'rotate(-45deg)', // 文字は戻す
                fontSize: '0.7rem'
            }}
        >
            {data?.label || '?'}
        </Typography>
    </Box>
);

// その他のシンプルノード
const SimpleNode = ({ data }: { data: any }) => (
    <Box sx={{ p: 1, textAlign: 'center', position: 'relative', minWidth: 60, minHeight: 30 }}>
        <CommonHandles />
        {data?.label || ''}
    </Box>
);

// スイムレーンノード：描画はFlowVisualization内のrendererで行うが、念のため
// スイムレーンノード
const SwimlaneNode = ({ data }: { data: any }) => (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
        {data?.label}
    </Box>
);

// nodeTypesの定義
const nodeTypes = {
    approval: ApprovalNode,
    apiCall: SimpleNode,
    llmCall: SimpleNode,
    start: CycleNode,
    end: CycleNode,
    parallel: GatewayNode,
    join: GatewayNode,
    branch: GatewayNode,
    swimlane: SwimlaneNode,
};

interface FlowVisualizationProps {
    nodes: any[];
    edges: any[];
    currentNodeId?: string | string[] | null; // 配列も許容
    completedStepIds?: Set<string> | string[];
    height?: number;
    showBackground?: boolean;
}

export default function FlowVisualization({
    nodes: rawNodes,
    edges: rawEdges,
    currentNodeId,
    completedStepIds: completedStepIdsInput = [],
    height = 280,
    showBackground = false,
}: FlowVisualizationProps) {
    const completedStepIds = completedStepIdsInput instanceof Set 
        ? completedStepIdsInput 
        : new Set(completedStepIdsInput);

    // currentNodeIdを正規化してSetにする（複数現在地対応）
    const currentStepIds = useMemo(() => {
        if (!currentNodeId) return new Set<string>();
        if (Array.isArray(currentNodeId)) return new Set(currentNodeId);
        return new Set([currentNodeId as string]);
    }, [currentNodeId]);

    const { displayNodes, displayEdges } = useMemo(() => {
        const displayNodes = rawNodes.map((node: any) => {
            // スイムレーン
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
                                bgcolor: 'rgba(255,255,255,0.4)',
                                borderRight: '1px solid #90caf9',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                writingMode: 'vertical-rl',
                                textOrientation: 'upright',
                            }}>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontWeight: 'bold',
                                        fontSize: '0.85rem',
                                        color: '#1565c0',
                                        letterSpacing: 2,
                                    }}
                                >
                                    {node.data?.label || 'レーン'}
                                </Typography>
                            </Box>
                        ),
                    },
                };
            }

            const isCurrent = currentStepIds.has(node.id);
            const isStart = node.type === 'start';
            const isEnd = node.type === 'end';
            const isGateway = ['parallel', 'join', 'branch'].includes(node.type);

            // 修正: 完了判定。ただし、現在地が開始ノード（つまり差し戻し中）の場合、開始ノード以外は完了とみなさない
            // または、ゲートウェイの場合、通過済みフラグだけでは不十分（差し戻しで戻ってきた場合）。
            // currentStepIdsに開始ノードが含まれている(=差し戻し状態)なら、開始ノード以外の完了フラグは無視する戦略をとる。
            const isBackToStart = currentStepIds.size > 0 && Array.from(currentStepIds).some(id => {
                const n = rawNodes.find((rn: any) => rn.id === id);
                return n?.type === 'start';
            });

            let isCompleted = completedStepIds.has(node.id);

            // ゲートウェイ（特にJoin）は履歴に残らないことが多いため、
            // 「自分の下流にあるノードが完了済み」または「自分が現在地より前にある」場合に完了とみなす推論ロジックを追加。
            if (!isCompleted && isGateway) {
                // 簡易判定: 出力先エッジのターゲットがcompletedStepIdsまたはcurrentStepIdsに含まれているか
                const outgoingEdges = rawEdges.filter((e: any) => e.source === node.id);
                const isPassed = outgoingEdges.some((e: any) => {
                    return completedStepIds.has(e.target) || currentStepIds.has(e.target);
                });
                if (isPassed) {
                    isCompleted = true;
                }
            }

            if (isBackToStart && !isStart) {
                isCompleted = false;
            }

            let bgColor = '#f5f5f5';
            let borderColor = '#ccc';
            let color = '#333';

            // ロジック修正: 差し戻し等の場合、完了していても現在地なら現在地の色（青）を優先
            if (isCurrent) {
                bgColor = '#e3f2fd';
                borderColor = '#2196f3';
                color = '#0d47a1';
            } else if (isStart) {
                // 開始ノード: 現在地でなければ完了済み（緑）か通常
                 if (isCompleted) {
                    bgColor = '#e8f5e9';
                    borderColor = '#4caf50';
                }
            } else if (isEnd) {
                bgColor = '#ffebee';
                borderColor = '#f44336';
            } else if (isCompleted) {
                bgColor = '#e8f5e9';
                borderColor = '#4caf50';
            }

            // 形状ごとのスタイル調整
            let nodeStyle: any = {
                background: bgColor,
                border: `2px solid ${borderColor}`,
                color: color,
            };

            if (isStart || isEnd) {
                nodeStyle = {
                    ...nodeStyle,
                    borderRadius: '50%',
                    width: 40,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    // 開始ノードは常に緑色（完了扱い）
                    ...(isStart ? {
                        background: '#e8f5e9',
                        border: '2px solid #4caf50',
                    } : {}),
                };
            } else if (isGateway) {
                 // Gatewayはコンポーネント側で回転させるため、親divは透明にする
                 nodeStyle = {
                     background: 'transparent',
                     border: 'none',
                     width: 50,
                     height: 50,
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                 };
                 // 内部コンポーネントに色情報を渡す
                 node.data = { ...node.data, bgColor, borderColor };
            } else {
                // 通常ノード（承認など）
                nodeStyle = {
                    ...nodeStyle,
                    borderRadius: 8,
                    padding: 0, // パディングは内部コンポーネントで制御
                    minWidth: 100,
                };
            }

            return {
                ...node,
                zIndex: 1,
                style: nodeStyle,
                data: {
                    ...node.data,
                    // 担当者をflowDefinitionから解決する必要があるが、
                    // 現状のprops.nodesにはassigneeDisplayが含まれていない可能性がある。
                    // flow-designerのApprovalNodeではdata.assigneeDisplayを持っている。
                    // アプリケーション詳細ではflowDefinition.nodesを渡している。
                    // backend/src/modules/applications/applications.service.tsでtasksのassignedToDisplayは解決しているが、
                    // flowNodesのdataには反映されていないかもしれない。
                    // 一旦そのまま表示する。
                    bgColor,
                    borderColor,
                    isCurrent,
                    isCompleted,
                },
            };
        });


        const displayEdges = rawEdges.map((edge: any) => {
            const sourceCompleted = completedStepIds.has(edge.source) || edge.source === 'start';
            const targetCompleted = completedStepIds.has(edge.target);
            const targetIsCurrent = currentStepIds.has(edge.target);
            
            // 差し戻し状態で開始に戻っている場合、エッジもリセット
            const isBackToStart = currentStepIds.size > 0 && Array.from(currentStepIds).some(id => {
                const n = rawNodes.find((rn: any) => rn.id === id);
                return n?.type === 'start';
            });
            
            let isTraversed = sourceCompleted && (targetCompleted || targetIsCurrent);
            if (isBackToStart) {
                isTraversed = false;
            }

            const leadsToTarget = sourceCompleted && targetIsCurrent;

            let label = edge.label;
            // ラベルがなく、ソースハンドルがある場合（分岐など）、ノードの設定やデフォルトから推論
            if (!label && edge.sourceHandle) {
                const sourceNode = rawNodes.find((n: any) => n.id === edge.source);
                if (sourceNode?.type === 'branch') {
                    if (edge.sourceHandle === 'yes') {
                        label = sourceNode.data?.yesLabel || 'Yes';
                    } else if (edge.sourceHandle === 'no') {
                        label = sourceNode.data?.noLabel || 'No';
                    }
                } else {
                    // その他のノード（デフォルト）
                    if (edge.sourceHandle === 'yes') label = 'Yes';
                    if (edge.sourceHandle === 'no') label = 'No';
                }
            }

            return {
                ...edge,
                label, // ラベルを設定
                labelStyle: { fill: '#333', fontWeight: 700 }, // ラベルの視認性を向上 
                labelBgStyle: { fill: 'rgba(255, 255, 255, 0.8)' },
                markerEnd: { type: MarkerType.ArrowClosed, color: isTraversed ? (leadsToTarget ? '#2196f3' : '#4caf50') : '#999' },
                style: {
                    strokeWidth: isTraversed ? 3 : 2,
                    stroke: isTraversed ? (leadsToTarget ? '#2196f3' : '#4caf50') : '#999',
                },
                animated: leadsToTarget,
            };
        });

        return { displayNodes, displayEdges };
    }, [rawNodes, rawEdges, currentStepIds, completedStepIds]);

    const nodeTypesMemo = useMemo(() => ({
        approval: ApprovalNode,
        apiCall: SimpleNode,
        llmCall: SimpleNode,
        start: CycleNode,
        end: CycleNode,
        parallel: GatewayNode,
        join: GatewayNode,
        branch: GatewayNode,
        swimlane: SwimlaneNode,
    }), []);

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
                nodeTypes={nodeTypesMemo}
                fitView
                fitViewOptions={{ 
                    padding: 0.2,
                    maxZoom: 1,
                    minZoom: 0.3,
                }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag={true}
                zoomOnScroll={false}
            >
                {showBackground && <Background />}
                <Controls />
            </ReactFlow>
        </Box>
    );
}
