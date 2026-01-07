'use client';

import React, { useState, useMemo } from 'react';
import ReactFlow, {
    MiniMap,
    Controls,
    Background,
    Node,
    Edge,
    ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Box,
    Paper,
    Typography,
    CircularProgress,
    Alert,
} from '@mui/material';
import { useParams } from 'next/navigation';

import StartNode from '@/components/flow-designer/nodes/StartNode';
import ApprovalNode from '@/components/flow-designer/nodes/ApprovalNode';
import EndNode from '@/components/flow-designer/nodes/EndNode';
import BranchNode from '@/components/flow-designer/nodes/BranchNode';
import APICallNode from '@/components/flow-designer/nodes/APICallNode';
import LLMCallNode from '@/components/flow-designer/nodes/LLMCallNode';
import ParallelGatewayNode from '@/components/flow-designer/nodes/ParallelGatewayNode';
import JoinGatewayNode from '@/components/flow-designer/nodes/JoinGatewayNode';
import SwimLaneNode from '@/components/flow-designer/nodes/SwimLaneNode';

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

interface AppVersion {
    id: string;
    version: number;
    publishedAt: string;
    publishedBy: string | null;
    formSchema: any;
    flowNodes: any;
    flowEdges: any;
}

function FlowContent({ nodes, edges }: { nodes: Node[], edges: Edge[] }) {
    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
            panOnDrag={true}
            zoomOnScroll={true}
        >
            <Controls />
            <MiniMap />
            <Background />
        </ReactFlow>
    );
}

export default function VersionFlowPage() {
    const params = useParams();
    const appId = params.id as string;
    const versionId = params.versionId as string;

    const { data: versions, isLoading } = useQuery<AppVersion[]>({
        queryKey: ['app-versions', appId],
        queryFn: () => api.get(`/application-definitions/${appId}/versions`),
        enabled: !!appId,
    });

    const version = versions?.find(v => v.id === versionId);

    // Add readOnly flag to all nodes
    const readOnlyNodes = useMemo(() => {
        if (!version?.flowNodes) return [];
        return version.flowNodes.map((node: Node) => ({
            ...node,
            data: {
                ...node.data,
                readOnly: true,
            },
            draggable: false,
        }));
    }, [version]);

    const edges = useMemo(() => {
        if (!version?.flowEdges) return [];
        return version.flowEdges;
    }, [version]);

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!version) {
        return <Alert severity="error">バージョンが見つかりません</Alert>;
    }

    return (
        <Box sx={{ height: 'calc(100vh - 120px)' }}>
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
                フロー定義 (v{version.version})
            </Typography>

            <Alert severity="info" sx={{ mb: 2 }}>
                読み取り専用モードです。ノードをクリックすると設定を確認できます。
            </Alert>

            <Paper variant="outlined" sx={{ height: 'calc(100% - 100px)', bgcolor: 'white' }}>
                {readOnlyNodes.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <Typography color="text.secondary">
                            このバージョンにはフローノードが定義されていません
                        </Typography>
                    </Box>
                ) : (
                    <ReactFlowProvider>
                        <FlowContent nodes={readOnlyNodes} edges={edges} />
                    </ReactFlowProvider>
                )}
            </Paper>
        </Box>
    );
}
