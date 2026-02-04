// FlowVisualization - Converted from MUI to shadcn/ui with @xyflow/react v12
import { useMemo } from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Import actual designer nodes
import StartNode from './nodes/StartNode';
import ApprovalNode from './nodes/ApprovalNode';
import EndNode from './nodes/EndNode';
import BranchNode from './nodes/BranchNode';
import APICallNode from './nodes/APICallNode';
import LLMCallNode from './nodes/LLMCallNode';
import ParallelGatewayNode from './nodes/ParallelGatewayNode';
import JoinGatewayNode from './nodes/JoinGatewayNode';
import SwimLaneNode from './nodes/SwimLaneNode';
import SendEmailNode from './nodes/SendEmailNode';
import DelayNode from './nodes/DelayNode';
import UserInputNode from './nodes/UserInputNode';
import UpdateRecordNode from './nodes/UpdateRecordNode';
import SetVariableNode from './nodes/SetVariableNode';
import SubProcessNode from './nodes/SubProcessNode';
import SlackNode from './nodes/SlackNode';
import ScriptNode from './nodes/ScriptNode';
import GraphQLNode from './nodes/GraphQLNode';
import ForEachNode from './nodes/ForEachNode';

interface FlowVisualizationProps {
    nodes: any[];
    edges: any[];
    currentNodeId?: string | string[] | null;
    completedStepIds?: Set<string> | string[];
    failedStepIds?: Set<string> | string[];
    height?: number;
    showBackground?: boolean;
    onNodeClick?: (event: React.MouseEvent, node: any) => void;
}

export default function FlowVisualization({
    nodes: rawNodes,
    edges: rawEdges,
    currentNodeId,
    completedStepIds: completedStepIdsInput = [],
    failedStepIds: failedStepIdsInput = [],
    height = 280,
    showBackground = false,
    onNodeClick,
}: FlowVisualizationProps) {
    const completedStepIds = useMemo(() => 
        completedStepIdsInput instanceof Set ? completedStepIdsInput : new Set(completedStepIdsInput),
    [completedStepIdsInput]);

    const failedStepIds = useMemo(() => 
        failedStepIdsInput instanceof Set ? failedStepIdsInput : new Set(failedStepIdsInput),
    [failedStepIdsInput]);

    const currentStepIds = useMemo(() => {
        if (!currentNodeId) return new Set<string>();
        return new Set(Array.isArray(currentNodeId) ? currentNodeId : [currentNodeId]);
    }, [currentNodeId]);

    const nodeTypes = useMemo(() => ({
        start: StartNode,
        approval: ApprovalNode,
        end: EndNode,
        branch: BranchNode,
        apiCall: APICallNode,
        llmCall: LLMCallNode,
        parallel: ParallelGatewayNode,
        join: JoinGatewayNode,
        swimlane: SwimLaneNode,
        sendEmail: SendEmailNode,
        delay: DelayNode,
        userInput: UserInputNode,
        updateRecord: UpdateRecordNode,
        setVariable: SetVariableNode,
        subProcess: SubProcessNode,
        slack: SlackNode,
        script: ScriptNode,
        graphql: GraphQLNode,
        foreach: ForEachNode,
        // Backward compatibility mapping
        input: UserInputNode, 
    }), []);

    const { nodes, edges } = useMemo(() => {
        const processedNodes = rawNodes.map((node: any) => {
            const isCurrent = currentStepIds.has(node.id);
            const isFailed = failedStepIds.has(node.id);
            const isCompleted = completedStepIds.has(node.id);
            
            // Fallback for visual completion on gateways/events if not explicitly tracked
            // (Gateway/Start/End often don't have explicit step execution records in some simple runners, 
            // but we can infer them from connectivity if needed. For now, we rely on passed props mostly.)
            // We'll keep it simple: pass the flags.

            return {
                ...node,
                draggable: false,
                connectable: false,
                selectable: !!onNodeClick,
                data: {
                    ...node.data,
                    readOnly: true, // Force read-only mode for all nodes
                    isCurrent,
                    isCompleted,
                    isFailed,
                },
                // Ensure zIndex for swimlanes
                zIndex: node.type === 'swimlane' ? -100 : (node.zIndex || 1),
            };
        });

        const processedEdges = rawEdges.map((edge: any) => ({
             ...edge,
             // Animate only the active path (from completed node to current node)
             animated: completedStepIds.has(edge.source) && currentStepIds.has(edge.target),
             style: { 
                 ...edge.style, 
                 // Color edges that have been traversed (source is completed)
                 stroke: completedStepIds.has(edge.source) ? '#2563eb' : '#94a3b8',
                 strokeWidth: 2 
             },
        }));

        return { nodes: processedNodes, edges: processedEdges };
    }, [rawNodes, rawEdges, currentStepIds, completedStepIds, failedStepIds, onNodeClick]);

    if (!nodes || nodes.length === 0) {
        return (
            <div className="flex items-center justify-center bg-muted/30 rounded-lg" style={{ height }}>
                <span className="text-muted-foreground">フロー情報がありません</span>
            </div>
        );
    }

    return (
        <div className="bg-muted/30 rounded-lg border overflow-hidden" style={{ height }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2, maxZoom: 1, minZoom: 0.3 }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={!!onNodeClick}
                onNodeClick={onNodeClick}
                panOnDrag={true}
                zoomOnScroll={false}
                proOptions={{ hideAttribution: true }}
            >
                {showBackground && <Background gap={12} size={1} />}
                <Controls />
            </ReactFlow>
        </div>
    );
}
