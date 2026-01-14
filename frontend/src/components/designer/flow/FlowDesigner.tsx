import React, { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Panel,
    useReactFlow,
    type Connection,
    type Node,
    type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import StartNode from './nodes/StartNode';
import ApprovalNode from './nodes/ApprovalNode';
import EndNode from './nodes/EndNode';
import BranchNode from './nodes/BranchNode';
import APICallNode from './nodes/APICallNode';
import LLMCallNode from './nodes/LLMCallNode';
import ParallelGatewayNode from './nodes/ParallelGatewayNode';
import JoinGatewayNode from './nodes/JoinGatewayNode';
import SwimLaneNode from './nodes/SwimLaneNode';

const nodeTypes = {
    start: StartNode,
    approval: ApprovalNode,
    end: EndNode,
    branch: BranchNode,
    apiCall: APICallNode,
    llmCall: LLMCallNode,
    parallel: ParallelGatewayNode,
    join: JoinGatewayNode,
    swimlane: SwimLaneNode,
};

// BPMN-style toolbox groups
const TOOLBOX_GROUPS = [
    { name: 'スイムレーン', items: [{ type: 'swimlane', label: 'レーン', color: '#90caf9', icon: '═' }] },
    { name: 'イベント', items: [{ type: 'end', label: '終了', color: '#ef5350', icon: '●' }] },
    { name: 'アクティビティ', items: [{ type: 'approval', label: '承認タスク', color: '#42a5f5', icon: '□' }] },
    { name: 'サービスタスク', items: [{ type: 'apiCall', label: 'API呼び出し', color: '#7e57c2', icon: '↔' }, { type: 'llmCall', label: 'LLM呼び出し', color: '#26a69a', icon: '🤖' }] },
    { name: 'ゲートウェイ', items: [{ type: 'branch', label: '分岐 (XOR)', color: '#ffca28', icon: '◇' }, { type: 'parallel', label: '並行 (AND)', color: '#ffeb3b', icon: '+' }, { type: 'join', label: '合流', color: '#ffeb3b', icon: '><' }] },
];

// --- Validation Rules ---
interface ValidationRule { id: string; name: string; description: string; category: 'structure' | 'connectivity' | 'path'; check: (nodes: Node[], edges: Edge[]) => string | null; }

const VALIDATION_RULES: ValidationRule[] = [
    { id: 'single-start', name: '開始イベント', description: '開始イベントは1つだけ必要です', category: 'structure', check: (nodes) => { const starts = nodes.filter(n => n.type === 'start'); if (starts.length === 0) return '開始イベントがありません'; if (starts.length > 1) return '開始イベントは1つだけにしてください'; return null; } },
    { id: 'has-end', name: '終了イベント', description: '終了イベントが1つ以上必要です', category: 'structure', check: (nodes) => nodes.filter(n => n.type === 'end').length === 0 ? '終了イベントがありません' : null },
    { id: 'start-connected', name: '開始接続', description: '開始イベントから出力接続が必要です', category: 'connectivity', check: (nodes, edges) => { const start = nodes.find(n => n.type === 'start'); return start && !edges.some(e => e.source === start.id) ? '開始イベントから接続がありません' : null; } },
    { id: 'end-connected', name: '終了接続', description: '終了イベントへの入力接続が必要です', category: 'connectivity', check: (nodes, edges) => { for (const end of nodes.filter(n => n.type === 'end')) { if (!edges.some(e => e.target === end.id)) return `終了イベント "${end.data?.label || end.id}" への接続がありません`; } return null; } },
    { id: 'gateway-connections', name: 'ゲートウェイ接続', description: 'ゲートウェイは1入力・2出力が必要です', category: 'connectivity', check: (nodes, edges) => { for (const n of nodes.filter(nd => nd.type === 'branch')) { if (!edges.some(e => e.target === n.id)) return `ゲートウェイ "${n.data?.label || '分岐'}" への入力がありません`; if (edges.filter(e => e.source === n.id).length < 2) return `ゲートウェイ "${n.data?.label || '分岐'}" には2つの出力が必要です`; } return null; } },
    { id: 'path-reachable', name: 'パス到達性', description: '開始から終了へ到達可能なパスが必要です', category: 'path', check: (nodes, edges) => { const start = nodes.find(n => n.type === 'start'); const ends = nodes.filter(n => n.type === 'end'); if (!start || ends.length === 0) return null; const reachable = new Set<string>(); const queue = [start.id]; while (queue.length) { const cur = queue.shift()!; if (reachable.has(cur)) continue; reachable.add(cur); edges.filter(e => e.source === cur).forEach(e => queue.push(e.target)); } return ends.some(e => reachable.has(e.id)) ? null : '開始から終了へ到達可能なパスがありません'; } },
    { id: 'node-connectivity', name: 'ノード接続', description: '全てのノード（終了以外）は次のノードに接続されている必要があります', category: 'connectivity', check: (nodes, edges) => { const brokenNodes = nodes.filter(n => n.type !== 'end' && !edges.some(e => e.source === n.id)); if (brokenNodes.length > 0) return `次のノードに接続されていないノードがあります: ${brokenNodes.map(n => n.data?.label || n.id).join(', ')}`; return null; } },
];

function validateFlow(nodes: Node[], edges: Edge[]) {
    const errors = VALIDATION_RULES.map(r => r.check(nodes, edges)).filter(Boolean) as string[];
    return { valid: errors.length === 0, errors };
}

const DEFAULT_NODES: Node[] = [{ id: 'start', type: 'start', position: { x: 250, y: 50 }, data: { label: '開始' } }];

export default function FlowDesigner({ appId }: { appId: string }) {
    const { versionId } = useParams();
    const isReadOnly = !!versionId;
    const queryClient = useQueryClient();
    const [flowName, setFlowName] = useState('');
    const [nodes, setNodes, onNodesChange] = useNodesState(DEFAULT_NODES);
    const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
    const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
    const [selectedEdges, setSelectedEdges] = useState<string[]>([]);

    const { data: app, isLoading } = useQuery({ queryKey: ['apps', appId], queryFn: () => api.get(`/application-definitions/${appId}`), enabled: !!appId });
    
    // Fetch versions if in read-only mode
    const { data: versions } = useQuery({
        queryKey: ['app-versions', appId],
        queryFn: () => api.get<any[]>(`/application-definitions/${appId}/versions`),
        enabled: !!versionId && !!appId,
    });

    const formFields = React.useMemo(() => {
        const schema = (app as any)?.formDefinition?.schema;
        if (!schema?.properties) return [];
        return Object.entries(schema.properties).map(([id, prop]: [string, any]) => ({ id, label: prop.title || id, type: prop.type }));
    }, [app]);

    useEffect(() => {
        if (versionId && versions) {
            const version = versions.find((v: any) => String(v.id) === String(versionId));
            if (version && version.flowNodes) {
                setFlowName(`v${version.version} フロー (読み取り専用)`);
                setNodes(version.flowNodes.map((n: any) => ({ 
                    ...n, 
                    draggable: false, 
                    deletable: false,
                    data: { ...n.data, readOnly: true } // Inject readOnly flag for node components
                })));
                setEdges(version.flowEdges.map((e: any) => ({ ...e, deletable: false })));
            }
        } else if ((app as any)?.flowDefinition) {
            setFlowName((app as any).flowDefinition.name || '');
            const flow = (app as any).flowDefinition;
            if (flow.nodes?.length) {
                const nodesWithFields = flow.nodes.map((n: any) => ['branch', 'apiCall', 'llmCall'].includes(n.type) ? { ...n, data: { ...n.data, formFields } } : n);
                setNodes(nodesWithFields);
            }
            if (flow.edges?.length) setEdges(flow.edges);
        } else if (app) {
            setFlowName(`${(app as any).name}フロー`);
        }
    }, [app, setNodes, setEdges, formFields, versionId, versions]);

    const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);
    const onSelectionChange = useCallback(({ nodes: sel, edges: selE }: { nodes: Node[]; edges: Edge[] }) => { setSelectedNodes(sel.map(n => n.id)); setSelectedEdges(selE.map(e => e.id)); }, []);

    const deleteSelected = useCallback(() => {
        if (selectedEdges.length) { setEdges(eds => eds.filter(e => !selectedEdges.includes(e.id))); setSelectedEdges([]); }
        const toDelete = selectedNodes.filter(id => id !== 'start');
        if (toDelete.length) { setNodes(nds => nds.filter(n => !toDelete.includes(n.id))); setEdges(eds => eds.filter(e => !toDelete.includes(e.source) && !toDelete.includes(e.target))); setSelectedNodes([]); }
    }, [selectedNodes, selectedEdges, setNodes, setEdges]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (isReadOnly) return;
            if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedNodes.length || selectedEdges.length)) {
                if (['INPUT', 'TEXTAREA'].includes((document.activeElement?.tagName || ''))) return;
                deleteSelected();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selectedNodes, selectedEdges, deleteSelected]);

    const { screenToFlowPosition } = useReactFlow();
    const onDrop = useCallback((event: React.DragEvent) => {
        if (isReadOnly) return;
        event.preventDefault();
        const type = event.dataTransfer.getData('application/reactflow');
        if (!type) return;
        const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const id = `${type}_${Date.now()}`;
        const labelMap: Record<string, string> = { approval: '承認', branch: '条件分岐', end: '終了', swimlane: 'レーン' };
        const newNode: Node = {
            id, type, position,
            data: { 
                label: labelMap[type] || type, 
                assignee: type === 'approval' ? 'role:wf_approver' : undefined,
                assigneeType: type === 'approval' ? 'role' : undefined,
                assigneeRole: type === 'approval' ? 'wf_approver' : undefined,
                formFields: type === 'branch' ? formFields : undefined, 
                ...(type === 'swimlane' && { width: 800, height: 200, color: '#e3f2fd' }) 
            },
            ...(type === 'swimlane' && { style: { width: 800, height: 200 }, zIndex: -100 }),
        };
        setNodes(nds => nds.concat(newNode));
    }, [setNodes, screenToFlowPosition, formFields]);

    const onDragOver = useCallback((event: React.DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }, []);
    const handleDragStart = (event: React.DragEvent, nodeType: string) => { event.dataTransfer.setData('application/reactflow', nodeType); event.dataTransfer.effectAllowed = 'move'; };

    const saveMutation = useMutation({
        mutationFn: async (flowData: { name: string; nodes: any; edges: any }) => {
            let flowDefId = (app as any)?.flowDefinitionId;
            if (flowDefId) await api.put(`/flows/${flowDefId}`, flowData);
            else { const newFlow = await api.post('/flows', flowData) as any; flowDefId = newFlow.id; await api.put(`/application-definitions/${appId}`, { flowDefinitionId: flowDefId }); }
            return flowDefId;
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['apps', appId] }); toast.success('フローを保存しました'); },
        onError: (err: any) => toast.error(err.message || '保存に失敗しました'),
    });

    const handleSave = () => {
        if (!flowName.trim()) { toast.error('フロー名を入力してください'); return; }
        const validation = validateFlow(nodes, edges);
        if (!validation.valid) { toast.error('フローエラー: ' + validation.errors.join(', ')); return; }
        saveMutation.mutate({ name: flowName, nodes, edges });
    };

    if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <div className="flex flex-col h-[calc(100vh-120px)]">
            <div className="flex flex-1 gap-2 p-2 overflow-hidden">
                {/* Toolbox */}
                {!isReadOnly && (
                <Card className="w-48 p-3 shrink-0 overflow-y-auto">
                    <p className="text-sm font-semibold mb-1">ツールボックス</p>
                    <p className="text-xs text-muted-foreground mb-3">ドラッグしてキャンバスにドロップ</p>
                    {TOOLBOX_GROUPS.map((group) => (
                        <div key={group.name} className="mb-3">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">{group.name}</p>
                            {group.items.map((item) => (
                                <div
                                    key={item.type}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, item.type)}
                                    className="p-2 mb-1 flex items-center gap-2 rounded border-2 cursor-grab bg-background hover:scale-[1.02] transition-all"
                                    style={{ borderColor: item.color }}
                                >
                                    <span className="w-6 h-6 flex items-center justify-center font-bold" style={{ color: item.color }}>{item.icon}</span>
                                    <span className="text-xs font-medium">{item.label}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                    {(selectedNodes.length > 0 || selectedEdges.length > 0) && (
                        <Button variant="destructive" size="sm" className="w-full mt-2" onClick={deleteSelected}>
                            <Trash2 className="h-4 w-4 mr-1" />削除 ({selectedNodes.length + selectedEdges.length})
                        </Button>
                    )}
                </Card>
                )}

                {/* Canvas */}
                <div className="flex-1 border rounded-lg overflow-hidden bg-background">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={isReadOnly ? undefined : onConnect}
                        onSelectionChange={onSelectionChange}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        nodeTypes={nodeTypes}
                        fitView
                        deleteKeyCode={isReadOnly ? null : ['Backspace', 'Delete']}
                        selectionOnDrag={!isReadOnly}
                        selectNodesOnDrag={!isReadOnly}
                        nodesDraggable={!isReadOnly}
                        nodesConnectable={!isReadOnly}
                        elementsSelectable={true}
                    >
                        <Controls />
                        <MiniMap />
                        <Background gap={12} size={1} />
                        <Panel position="top-right">
                            <Card className="flex items-center gap-2 p-2">
                                <Input 
                                    value={flowName} 
                                    onChange={(e) => setFlowName(e.target.value)} 
                                    placeholder="フロー名" 
                                    className="w-48" 
                                    disabled={isReadOnly}
                                />
                                {!isReadOnly && (
                                <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                                    {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                                    下書き保存
                                </Button>
                                )}
                            </Card>
                            {(app as any)?.flowDefinition?.updatedAt && (
                                <p className="text-xs text-muted-foreground text-right mt-1 bg-background/80 px-2 py-0.5 rounded">
                                    最終保存: {new Date((app as any).flowDefinition.updatedAt).toLocaleString('ja-JP')}
                                </p>
                            )}
                        </Panel>
                    </ReactFlow>
                </div>
            </div>
        </div>
    );
}
