'use client';

import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Node,
    Edge,
    ReactFlowProvider,
    Panel,
    useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Box, Button, TextField, Alert, Typography, Paper, IconButton, Tooltip } from '@mui/material';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import Link from 'next/link';

import StartNode from '@/components/flow-designer/nodes/StartNode';
import ApprovalNode from '@/components/flow-designer/nodes/ApprovalNode';
import EndNode from '@/components/flow-designer/nodes/EndNode';
import BranchNode from '@/components/flow-designer/nodes/BranchNode';
import APICallNode from '@/components/flow-designer/nodes/APICallNode';
import LLMCallNode from '@/components/flow-designer/nodes/LLMCallNode';
import ParallelGatewayNode from '@/components/flow-designer/nodes/ParallelGatewayNode';
import JoinGatewayNode from '@/components/flow-designer/nodes/JoinGatewayNode';

const nodeTypes = {
    start: StartNode,
    approval: ApprovalNode,
    end: EndNode,
    branch: BranchNode,
    apiCall: APICallNode,
    llmCall: LLMCallNode,
    parallel: ParallelGatewayNode,
    join: JoinGatewayNode,
};

// BPMN.io style toolbox groups
const TOOLBOX_GROUPS = [
    {
        name: 'イベント',
        items: [
            { type: 'end', label: '終了', color: '#ef5350', icon: '●' },
        ],
    },
    {
        name: 'アクティビティ',
        items: [
            { type: 'approval', label: '承認タスク', color: '#42a5f5', icon: '□' },
        ],
    },
    {
        name: 'サービスタスク',
        items: [
            { type: 'apiCall', label: 'API呼び出し', color: '#7e57c2', icon: '↔' },
            { type: 'llmCall', label: 'LLM呼び出し', color: '#26a69a', icon: '🤖' },
        ],
    },
    {
        name: 'ゲートウェイ',
        items: [
            { type: 'branch', label: '分岐 (XOR)', color: '#ffca28', icon: '◇' },
            { type: 'parallel', label: '並行 (AND)', color: '#ffeb3b', icon: '+' },
            { type: 'join', label: '合流', color: '#ffeb3b', icon: '><' },
        ],
    },
];

// Validation rule definitions
interface ValidationRule {
    id: string;
    name: string;
    description: string;
    category: 'structure' | 'connectivity' | 'path';
    check: (nodes: Node[], edges: Edge[]) => string | null;
}

const VALIDATION_RULES: ValidationRule[] = [
    {
        id: 'single-start',
        name: '開始イベント',
        description: '開始イベントは1つだけ必要です',
        category: 'structure',
        check: (nodes) => {
            const startNodes = nodes.filter(n => n.type === 'start');
            if (startNodes.length === 0) return '開始イベントがありません';
            if (startNodes.length > 1) return '開始イベントは1つだけにしてください';
            return null;
        }
    },
    {
        id: 'has-end',
        name: '終了イベント',
        description: '終了イベントが1つ以上必要です',
        category: 'structure',
        check: (nodes) => {
            const endNodes = nodes.filter(n => n.type === 'end');
            if (endNodes.length === 0) return '終了イベントがありません';
            return null;
        }
    },
    {
        id: 'start-connected',
        name: '開始接続',
        description: '開始イベントから出力接続が必要です',
        category: 'connectivity',
        check: (nodes, edges) => {
            const startNode = nodes.find(n => n.type === 'start');
            if (startNode && !edges.some(e => e.source === startNode.id)) {
                return '開始イベントから接続がありません';
            }
            return null;
        }
    },
    {
        id: 'end-connected',
        name: '終了接続',
        description: '終了イベントへの入力接続が必要です',
        category: 'connectivity',
        check: (nodes, edges) => {
            const endNodes = nodes.filter(n => n.type === 'end');
            for (const endNode of endNodes) {
                if (!edges.some(e => e.target === endNode.id)) {
                    return `終了イベント "${endNode.data?.label || endNode.id}" への接続がありません`;
                }
            }
            return null;
        }
    },
    {
        id: 'gateway-connections',
        name: 'ゲートウェイ接続',
        description: 'ゲートウェイは1入力・2出力が必要です',
        category: 'connectivity',
        check: (nodes, edges) => {
            for (const n of nodes) {
                if (n.type === 'branch') {
                    const inEdges = edges.filter(e => e.target === n.id);
                    const outEdges = edges.filter(e => e.source === n.id);
                    if (inEdges.length === 0) {
                        return `ゲートウェイ "${n.data?.label || '分岐'}" への入力がありません`;
                    }
                    if (outEdges.length < 2) {
                        return `ゲートウェイ "${n.data?.label || '分岐'}" には2つの出力が必要です`;
                    }
                }
            }
            return null;
        }
    },
    {
        id: 'activity-input',
        name: 'アクティビティ入力',
        description: '全アクティビティに入力接続が必要です',
        category: 'connectivity',
        check: (nodes, edges) => {
            for (const n of nodes) {
                if (!['start', 'end', 'branch'].includes(n.type || '')) {
                    if (!edges.some(e => e.target === n.id)) {
                        return `"${n.data?.label || n.id}" への入力接続がありません`;
                    }
                }
            }
            return null;
        }
    },
    {
        id: 'activity-output',
        name: 'アクティビティ出力',
        description: '全アクティビティに出力接続が必要です',
        category: 'connectivity',
        check: (nodes, edges) => {
            for (const n of nodes) {
                if (!['start', 'end', 'branch'].includes(n.type || '')) {
                    if (!edges.some(e => e.source === n.id)) {
                        return `"${n.data?.label || n.id}" からの出力接続がありません`;
                    }
                }
            }
            return null;
        }
    },
    {
        id: 'path-reachable',
        name: 'パス到達性',
        description: '開始から終了へ到達可能なパスが必要です',
        category: 'path',
        check: (nodes, edges) => {
            const startNodes = nodes.filter(n => n.type === 'start');
            const endNodes = nodes.filter(n => n.type === 'end');
            if (startNodes.length === 0 || endNodes.length === 0) return null;

            const reachable = new Set<string>();
            const queue = [startNodes[0].id];
            while (queue.length > 0) {
                const current = queue.shift()!;
                if (reachable.has(current)) continue;
                reachable.add(current);
                edges.filter(e => e.source === current).forEach(e => queue.push(e.target));
            }
            const reachableEnd = endNodes.some(en => reachable.has(en.id));
            if (!reachableEnd) {
                return '開始から終了へ到達可能なパスがありません';
            }
            return null;
        }
    },
    {
        id: 'single-output',
        name: '単一出力原則',
        description: '分岐・並行以外のノードからは1つの出力のみ許可されます',
        category: 'connectivity',
        check: (nodes, edges) => {
            for (const n of nodes) {
                if (n.type === 'parallel') continue;

                if (n.type === 'branch') {
                    // Branch: Check per handle
                    const outEdges = edges.filter(e => e.source === n.id);
                    const yesEdges = outEdges.filter(e => e.sourceHandle === 'yes');
                    const noEdges = outEdges.filter(e => e.sourceHandle === 'no');

                    if (yesEdges.length > 1) {
                        return `分岐 "${n.data?.label || '分岐'}" の「はい」から複数の接続が出ています`;
                    }
                    if (noEdges.length > 1) {
                        return `分岐 "${n.data?.label || '分岐'}" の「いいえ」から複数の接続が出ています`;
                    }
                } else {
                    // Other nodes: Max 1 output total
                    const outEdges = edges.filter(e => e.source === n.id);
                    if (outEdges.length > 1) {
                        return `"${n.data?.label || n.id}" からの出力は1つしか許可されていません`;
                    }
                }
            }
            return null;
        }
    },
    {
        id: 'parallel-convergence',
        name: '並行合流チェック',
        description: '並行ゲートウェイからのパスは合流ゲートウェイで統合される必要があります',
        category: 'structure',
        check: (nodes, edges) => {
            const parallelNodes = nodes.filter(n => n.type === 'parallel');
            for (const pNode of parallelNodes) {
                // Find paths from Parallel that reach End WITHOUT hitting a Join
                const visited = new Set<string>();
                const queue = [pNode.id];
                let hasUnmergedPath = false;

                while (queue.length > 0) {
                    const currentId = queue.shift()!;
                    if (visited.has(currentId)) continue;
                    visited.add(currentId);

                    const node = nodes.find(n => n.id === currentId);
                    if (!node) continue;

                    // If we hit END, it's an unmerged path
                    if (node.type === 'end') {
                        hasUnmergedPath = true;
                        break;
                    }

                    // If we hit JOIN, we stop traversing this path (it's merged)
                    if (node.type === 'join' && node.id !== pNode.id) {
                        continue;
                    }

                    // Traverse neighbors
                    const outEdges = edges.filter(e => e.source === currentId);
                    outEdges.forEach(e => queue.push(e.target));
                }

                if (hasUnmergedPath) {
                    return `並行ゲートウェイ "${pNode.data?.label || pNode.id}" から合流せずに終了するパスがあります`;
                }
            }
            return null;
        }
    },
    {
        id: 'no-self-loop',
        name: '自己ループ禁止',
        description: 'ノードは自分自身への接続を持てません',
        category: 'connectivity',
        check: (nodes, edges) => {
            for (const e of edges) {
                if (e.source === e.target) {
                    const node = nodes.find(n => n.id === e.source);
                    return `"${node?.data?.label || e.source}" に自己ループがあります`;
                }
            }
            return null;
        }
    },
];

// Run all validation rules
interface ValidationResult {
    valid: boolean;
    errors: string[];
    ruleResults: { rule: ValidationRule; error: string | null }[];
}

function validateFlow(nodes: Node[], edges: Edge[]): ValidationResult {
    const ruleResults = VALIDATION_RULES.map(rule => ({
        rule,
        error: rule.check(nodes, edges),
    }));

    const errors = ruleResults
        .filter(r => r.error !== null)
        .map(r => r.error!);

    return { valid: errors.length === 0, errors, ruleResults };
}

const DEFAULT_NODES: Node[] = [
    { id: 'start', type: 'start', position: { x: 250, y: 50 }, data: { label: '開始' } },
];

function FlowEditorContent({ appId }: { appId: string }) {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [flowName, setFlowName] = useState('');
    const [nodes, setNodes, onNodesChange] = useNodesState(DEFAULT_NODES);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
    const [selectedEdges, setSelectedEdges] = useState<string[]>([]);

    const { data: app } = useQuery({
        queryKey: ['apps', appId],
        queryFn: () => api.get(`/application-definitions/${appId}`),
        enabled: !!appId,
    });

    // Extract form fields for branch node conditions
    const formFields = React.useMemo(() => {
        const schema = (app as any)?.formDefinition?.schema;
        if (!schema?.properties) return [];
        return Object.entries(schema.properties).map(([id, prop]: [string, any]) => ({
            id,
            label: prop.title || id,
            type: prop.type,
        }));
    }, [app]);

    // Load existing flow if any
    useEffect(() => {
        if ((app as any)?.flowDefinition) {
            setFlowName((app as any).flowDefinition.name || '');
            if ((app as any).flowDefinition.nodes?.length > 0) {
                // Inject formFields into branch nodes
                const nodesWithFields = (app as any).flowDefinition.nodes.map((node: any) => {
                    if (['branch', 'apiCall', 'llmCall'].includes(node.type)) {
                        return { ...node, data: { ...node.data, formFields } };
                    }
                    return node;
                });
                setNodes(nodesWithFields);
            }
            if ((app as any).flowDefinition.edges?.length > 0) {
                setEdges((app as any).flowDefinition.edges);
            }
        } else if (app) {
            setFlowName(`${(app as any).name}フロー`);
        }
    }, [app, setNodes, setEdges]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    const onSelectionChange = useCallback(({ nodes: selectedNodeList, edges: selectedEdgeList }: { nodes: Node[], edges: Edge[] }) => {
        setSelectedNodes(selectedNodeList.map(n => n.id));
        setSelectedEdges(selectedEdgeList.map(e => e.id));
    }, []);

    const deleteSelected = useCallback(() => {
        // Delete selected edges
        if (selectedEdges.length > 0) {
            setEdges(eds => eds.filter(e => !selectedEdges.includes(e.id)));
            setSelectedEdges([]);
        }

        // Delete selected nodes (except start)
        if (selectedNodes.length > 0) {
            const nodesToDelete = selectedNodes.filter(id => id !== 'start');
            if (nodesToDelete.length > 0) {
                setNodes(nds => nds.filter(n => !nodesToDelete.includes(n.id)));
                setEdges(eds => eds.filter(e => !nodesToDelete.includes(e.source) && !nodesToDelete.includes(e.target)));
                setSelectedNodes([]);
            }
        }
    }, [selectedNodes, selectedEdges, setNodes, setEdges]);

    const deleteSelectedNodes = useCallback(() => {
        if (selectedNodes.length === 0) return;
        // Don't delete start node
        const nodesToDelete = selectedNodes.filter(id => id !== 'start');
        if (nodesToDelete.length === 0) return;

        setNodes(nds => nds.filter(n => !nodesToDelete.includes(n.id)));
        setEdges(eds => eds.filter(e => !nodesToDelete.includes(e.source) && !nodesToDelete.includes(e.target)));
        setSelectedNodes([]);
    }, [selectedNodes, setNodes, setEdges]);

    // Keyboard delete handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedNodes.length > 0 || selectedEdges.length > 0)) {
                // Don't delete if focused on an input
                if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
                deleteSelected();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNodes, selectedEdges, deleteSelected]);

    const addNode = (type: string) => {
        const id = `${type}_${Date.now()}`;
        const labelMap: Record<string, string> = {
            approval: '承認',
            branch: '条件分岐',
            remand: '差戻し',
            end: '終了',
        };
        const newNode: Node = {
            id,
            type,
            position: { x: 250, y: nodes.length * 120 + 100 },
            data: {
                label: labelMap[type] || type,
                assignee: type === 'approval' ? '承認者' : undefined,
                formFields: type === 'branch' ? formFields : undefined,
            },
        };
        setNodes((nds) => nds.concat(newNode));
    };

    const { screenToFlowPosition } = useReactFlow();

    const onDrop = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        const type = event.dataTransfer.getData('application/reactflow');
        if (!type) return;

        // Use screenToFlowPosition to correctly convert screen coordinates to flow coordinates
        const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
        });

        const id = `${type}_${Date.now()}`;
        const labelMap: Record<string, string> = {
            approval: '承認',
            branch: '条件分岐',
            remand: '差戻し',
            end: '終了',
        };

        const newNode: Node = {
            id,
            type,
            position,
            data: {
                label: labelMap[type] || type,
                assignee: type === 'approval' ? '承認者' : undefined,
                formFields: type === 'branch' ? formFields : undefined,
            },
        };
        setNodes((nds) => nds.concat(newNode));
    }, [setNodes, screenToFlowPosition, formFields]);

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const saveMutation = useMutation({
        mutationFn: async (flowData: { name: string; nodes: any; edges: any }) => {
            let flowDefId = (app as any)?.flowDefinitionId;

            if (flowDefId) {
                await api.put(`/flows/${flowDefId}`, flowData);
            } else {
                const newFlow = await api.post('/flows', flowData) as any;
                flowDefId = newFlow.id;
                await api.put(`/application-definitions/${appId}`, { flowDefinitionId: flowDefId });
            }
            return flowDefId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['apps', appId] });
            setSuccess('フローを保存しました');
            setTimeout(() => setSuccess(null), 3000);
        },
        onError: (err: any) => {
            setError(err.message || '保存に失敗しました');
        },
    });

    const handleSave = () => {
        if (!flowName.trim()) {
            setError('フロー名を入力してください');
            return;
        }

        // Validate flow
        const validation = validateFlow(nodes, edges);
        if (!validation.valid) {
            setError('フローエラー: ' + validation.errors.join(', '));
            return;
        }

        setError(null);
        saveMutation.mutate({ name: flowName, nodes, edges });
    };

    const handleDragStart = (event: React.DragEvent, nodeType: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button startIcon={<ArrowBackIcon />} component={Link} href={`/designer/apps/${appId}`}>
                    アプリに戻る
                </Button>
                <Typography variant="h5" sx={{ flexGrow: 1 }}>フロー編集: {(app as any)?.name}</Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mx: 2, mb: 1 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mx: 2, mb: 1 }}>{success}</Alert>}

            <Box sx={{ display: 'flex', flexGrow: 1, mx: 2, mb: 2, gap: 2 }}>
                {/* ツールボックス */}
                <Paper sx={{ width: 180, p: 2, flexShrink: 0, maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>ツールボックス</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                        ドラッグしてキャンバスにドロップ
                    </Typography>

                    {TOOLBOX_GROUPS.map((group, groupIdx) => (
                        <Box key={group.name} sx={{ mb: 2 }}>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    fontSize: 10,
                                    mb: 0.5,
                                    display: 'block',
                                }}
                            >
                                {group.name}
                            </Typography>
                            {group.items.map((item) => (
                                <Paper
                                    key={item.type}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, item.type)}
                                    sx={{
                                        p: 1,
                                        mb: 0.5,
                                        cursor: 'grab',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        border: `2px solid ${item.color}`,
                                        bgcolor: 'white',
                                        '&:hover': { bgcolor: `${item.color}15`, transform: 'scale(1.02)' },
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    <Box sx={{
                                        width: 24,
                                        height: 24,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: item.color,
                                        fontWeight: 'bold',
                                        fontSize: 16,
                                    }}>
                                        {item.icon}
                                    </Box>
                                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 12 }}>
                                        {item.label}
                                    </Typography>
                                </Paper>
                            ))}
                        </Box>
                    ))}

                    {(selectedNodes.length > 0 || selectedEdges.length > 0) && (
                        <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            fullWidth
                            startIcon={<DeleteIcon />}
                            onClick={deleteSelected}
                            sx={{ mt: 2 }}
                        >
                            削除 ({selectedNodes.length + selectedEdges.length})
                        </Button>
                    )}
                </Paper>

                {/* キャンバス */}
                <Box sx={{ flexGrow: 1, border: '1px solid #ddd', position: 'relative' }}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onSelectionChange={onSelectionChange}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        nodeTypes={nodeTypes}
                        fitView
                        deleteKeyCode={null}
                        selectionOnDrag
                        selectNodesOnDrag={false}
                    >
                        <Controls />
                        <MiniMap />
                        <Background gap={12} size={1} />
                        <Panel position="top-right">
                            <Box sx={{ display: 'flex', gap: 1, bgcolor: 'white', p: 1, borderRadius: 1 }}>
                                <TextField
                                    label="フロー名"
                                    value={flowName}
                                    onChange={(e) => setFlowName(e.target.value)}
                                    size="small"
                                    sx={{ width: 200 }}
                                />
                                <Button variant="contained" onClick={handleSave} disabled={saveMutation.isPending}>
                                    {saveMutation.isPending ? '保存中...' : '保存'}
                                </Button>
                            </Box>
                        </Panel>
                    </ReactFlow>
                </Box>
            </Box>
        </Box>
    );
}

export default function AppFlowEditorPage() {
    const params = useParams();
    const appId = params.id as string;

    return (
        <ReactFlowProvider>
            <FlowEditorContent appId={appId} />
        </ReactFlowProvider>
    );
}
