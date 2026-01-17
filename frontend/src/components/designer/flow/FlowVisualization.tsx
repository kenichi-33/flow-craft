// FlowVisualization - Converted from MUI to shadcn/ui with @xyflow/react v12
import { useMemo } from 'react';
import { ReactFlow, MarkerType, Background, Handle, Position, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Badge } from '@/components/ui/badge';

// Common handles (invisible) for BPMN left-to-right connection
const CommonHandles = () => (
    <>
        <Handle type="target" position={Position.Left} id="input" className="!opacity-0 !pointer-events-none" />
        <Handle type="source" position={Position.Right} id="output" className="!opacity-0 !pointer-events-none" />
        <Handle type="source" position={Position.Right} id="yes" className="!opacity-0 !pointer-events-none" style={{ top: '30%' }} />
        <Handle type="source" position={Position.Right} id="no" className="!opacity-0 !pointer-events-none" style={{ top: '70%' }} />
    </>
);

// Approval node with assignee display
const ApprovalNode = ({ data }: { data: any }) => (
    <div className="p-2 text-center min-w-[120px] min-h-[60px] flex flex-col items-center justify-center relative">
        <CommonHandles />
        <span className="text-sm font-bold">{data?.label || '承認'}</span>
        <span className="text-xs text-muted-foreground mt-0.5">{data?.assigneeDisplay || '未割当'}</span>
        {data?.isCurrent && <Badge className="mt-1 h-4 text-[10px] px-1.5">現在</Badge>}
        {data?.isCompleted && !data?.isCurrent && <Badge variant="secondary" className="mt-1 h-4 text-[10px] px-1.5 bg-emerald-100 text-emerald-700">完了</Badge>}
    </div>
);

// Cycle node (start/end) - circular
const CycleNode = ({ data }: { data: any }) => (
    <div className="w-10 h-10 flex items-center justify-center rounded-full relative">
        <CommonHandles />
        <span className="text-xs font-bold">{data?.label}</span>
    </div>
);

// Gateway node - diamond shape
const GatewayNode = ({ data }: { data: any }) => (
    <div className="w-10 h-10 flex items-center justify-center rotate-45 rounded border-2" style={{ backgroundColor: data?.bgColor || '#f5f5f5', borderColor: data?.borderColor || '#ccc' }}>
        <CommonHandles />
        <span className="text-xs font-bold -rotate-45">{data?.label || '?'}</span>
    </div>
);

// Simple node for API/LLM calls
const SimpleNode = ({ data }: { data: any }) => (
    <div className="p-2 text-center min-w-[60px] min-h-[30px] relative">
        <CommonHandles />
        <span className="text-xs">{data?.label || ''}</span>
    </div>
);

// Swimlane node
const SwimlaneNode = ({ data }: { data: any }) => (
    <div className="relative w-full h-full">
        <div className="absolute left-0 top-0 bottom-0 w-9 bg-white/40 border-r border-blue-300 flex items-center justify-center" style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}>
            <span className="text-sm font-bold text-blue-700 tracking-widest">{data?.label || 'レーン'}</span>
        </div>
    </div>
);

interface FlowVisualizationProps {
    nodes: any[];
    edges: any[];
    currentNodeId?: string | string[] | null;
    completedStepIds?: Set<string> | string[];
    height?: number;
    showBackground?: boolean;
    onNodeClick?: (event: React.MouseEvent, node: any) => void;
}

export default function FlowVisualization({
    nodes: rawNodes,
    edges: rawEdges,
    currentNodeId,
    completedStepIds: completedStepIdsInput = [],
    height = 280,
    showBackground = false,
    onNodeClick,
}: FlowVisualizationProps) {
    const completedStepIds = completedStepIdsInput instanceof Set ? completedStepIdsInput : new Set(completedStepIdsInput);
    const currentStepIds = useMemo(() => {
        if (!currentNodeId) return new Set<string>();
        return new Set(Array.isArray(currentNodeId) ? currentNodeId : [currentNodeId]);
    }, [currentNodeId]);

    const { displayNodes, displayEdges } = useMemo(() => {
        const displayNodes = rawNodes.map((node: any) => {
            // Swimlane
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
                };
            }

            const isCurrent = currentStepIds.has(node.id);
            const isStart = node.type === 'start';
            const isEnd = node.type === 'end';
            const isGateway = ['parallel', 'join', 'branch'].includes(node.type);

            const isBackToStart = Array.from(currentStepIds).some((id) => {
                const n = rawNodes.find((rn: any) => rn.id === id);
                return n?.type === 'start';
            });

            let isCompleted = completedStepIds.has(node.id);

            // Infer completion for gateways/end nodes
            if (!isCompleted && (isGateway || isEnd)) {
                if (isEnd) {
                    const incomingEdges = rawEdges.filter((e: any) => e.target === node.id);
                    if (incomingEdges.some((e: any) => completedStepIds.has(e.source))) isCompleted = true;
                } else {
                    const outgoingEdges = rawEdges.filter((e: any) => e.source === node.id);
                    if (outgoingEdges.some((e: any) => completedStepIds.has(e.target) || currentStepIds.has(e.target))) isCompleted = true;
                }
            }
            if (isBackToStart && !isStart) isCompleted = false;

            // Colors
            let bgColor = '#f5f5f5', borderColor = '#ccc', color = '#333';
            if (isCurrent) { bgColor = '#e3f2fd'; borderColor = '#2196f3'; color = '#0d47a1'; }
            else if (isStart) { bgColor = isCompleted ? '#eceff1' : '#fff'; borderColor = isCompleted ? '#455a64' : '#607d8b'; }
            else if (isEnd) { bgColor = isCompleted ? '#ffebee' : '#fafafa'; borderColor = isCompleted ? '#d32f2f' : '#ef5350'; color = isCompleted ? '#b71c1c' : '#e53935'; }
            else if (isCompleted) { bgColor = '#e8f5e9'; borderColor = '#4caf50'; }

            let nodeStyle: any = { background: bgColor, border: `2px solid ${borderColor}`, color };
            if (isStart || isEnd) nodeStyle = { ...nodeStyle, borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' };
            else if (isGateway) { nodeStyle = { background: 'transparent', border: 'none', width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }; node.data = { ...node.data, bgColor, borderColor }; }
            else nodeStyle = { ...nodeStyle, borderRadius: 8, padding: 0, minWidth: 100 };

            return { ...node, zIndex: 1, style: nodeStyle, data: { ...node.data, bgColor, borderColor, isCurrent, isCompleted } };
        });

        const displayEdges = rawEdges.map((edge: any) => {
            const sourceCompleted = completedStepIds.has(edge.source) || edge.source === 'start';
            const targetCompleted = completedStepIds.has(edge.target);
            const targetIsCurrent = currentStepIds.has(edge.target);
            const isBackToStart = Array.from(currentStepIds).some((id) => rawNodes.find((n: any) => n.id === id)?.type === 'start');
            let isTraversed = sourceCompleted && (targetCompleted || targetIsCurrent);
            if (isBackToStart) isTraversed = false;
            const leadsToTarget = sourceCompleted && targetIsCurrent;

            let label = edge.label;
            if (!label && edge.sourceHandle) {
                const sn = rawNodes.find((n: any) => n.id === edge.source);
                if (sn?.type === 'branch') label = edge.sourceHandle === 'yes' ? (sn.data?.yesLabel || 'Yes') : edge.sourceHandle === 'no' ? (sn.data?.noLabel || 'No') : undefined;
                else { if (edge.sourceHandle === 'yes') label = 'Yes'; if (edge.sourceHandle === 'no') label = 'No'; }
            }

            return {
                ...edge,
                label,
                labelStyle: { fill: '#333', fontWeight: 700 },
                labelBgStyle: { fill: 'rgba(255,255,255,0.8)' },
                markerEnd: { type: MarkerType.ArrowClosed, color: isTraversed ? (leadsToTarget ? '#2196f3' : '#4caf50') : '#999' },
                style: { strokeWidth: isTraversed ? 3 : 2, stroke: isTraversed ? (leadsToTarget ? '#2196f3' : '#4caf50') : '#999' },
                animated: leadsToTarget,
            };
        });

        return { displayNodes, displayEdges };
    }, [rawNodes, rawEdges, currentStepIds, completedStepIds]);

    // Input node
    const UserInputNode = ({ data }: { data: any }) => (
        <div className="p-2 text-center min-w-[120px] min-h-[60px] flex flex-col items-center justify-center relative">
            <CommonHandles />
            <span className="text-sm font-bold">{data?.title || '入力'}</span>
            <span className="text-xs text-muted-foreground mt-0.5">{data?.assignedTo === 'applicant' ? '申請者' : (data?.assignedTo || '未割当')}</span>
            {data?.isCurrent && <Badge className="mt-1 h-4 text-[10px] px-1.5">現在</Badge>}
            {data?.isCompleted && !data?.isCurrent && <Badge variant="secondary" className="mt-1 h-4 text-[10px] px-1.5 bg-emerald-100 text-emerald-700">完了</Badge>}
        </div>
    );

    // Generic Action Node (for simple actions like SendEmail, UpdateRecord etc.)
    const ActionNode = ({ data, label, bgColor }: { data: any, label: string, bgColor?: string }) => (
        <div className="p-2 text-center min-w-[120px] min-h-[50px] flex flex-col items-center justify-center relative" style={{ backgroundColor: bgColor }}>
            <CommonHandles />
            <span className="text-xs font-bold">{label}</span>
            {data?.isCurrent && <Badge className="mt-1 h-4 text-[10px] px-1.5">現在</Badge>}
            {data?.isCompleted && !data?.isCurrent && <Badge variant="secondary" className="mt-1 h-4 text-[10px] px-1.5 bg-emerald-100 text-emerald-700">完了</Badge>}
        </div>
    );

    const nodeTypes = useMemo(() => ({
        approval: ApprovalNode,
        userInput: UserInputNode,
        input: UserInputNode, // Backward compatibility
        apiCall: SimpleNode,
        llmCall: SimpleNode,
        start: CycleNode,
        end: CycleNode,
        parallel: GatewayNode,
        join: GatewayNode,
        branch: GatewayNode,
        swimlane: SwimlaneNode,
        // Added missing nodes
        sendEmail: (props: any) => <ActionNode {...props} label="メール送信" />,
        slack: (props: any) => <ActionNode {...props} label="Slack通知" />,
        delay: (props: any) => <ActionNode {...props} label="待機" />,
        updateRecord: (props: any) => <ActionNode {...props} label="レコード更新" />,
        setVariable: (props: any) => <ActionNode {...props} label="変数設定" />,
        subProcess: (props: any) => <ActionNode {...props} label="サブプロセス" />,
    }), []);

    if (displayNodes.length === 0) {
        return (
            <div className="flex items-center justify-center bg-muted/30 rounded-lg" style={{ height }}>
                <span className="text-muted-foreground">フロー情報がありません</span>
            </div>
        );
    }

    return (
        <div className="bg-muted/30 rounded-lg" style={{ height }}>
            <ReactFlow
                nodes={displayNodes}
                edges={displayEdges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2, maxZoom: 1, minZoom: 0.3 }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={!!onNodeClick}
                onNodeClick={onNodeClick}
                panOnDrag={true}
                zoomOnScroll={false}
            >
                {showBackground && <Background />}
                <Controls />
            </ReactFlow>
        </div>
    );
}
