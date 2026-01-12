'use client';

import React, { useState, useCallback } from 'react';
import ReactFlow, {
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Node,
    ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Box, Button, TextField, Paper, Typography, Drawer, List, ListItem, ListItemButton, ListItemText } from '@mui/material';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

import StartNode from '@/components/flow-designer/nodes/StartNode';
import ApprovalNode from '@/components/flow-designer/nodes/ApprovalNode';

const nodeTypes = {
    start: StartNode,
    approval: ApprovalNode,
};

const INITIAL_NODES: Node[] = [
    { id: '1', type: 'start', position: { x: 250, y: 50 }, data: { label: 'Start' } },
];

export default function FlowEditorContent() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => {
            let label = '';
            if (params.sourceHandle === 'yes') label = 'Yes';
            else if (params.sourceHandle === 'no') label = 'No';
            
            // エッジにラベルとスタイルを適用して追加
            return addEdge({ ...params, label }, eds);
        }),
        [setEdges],
    );

    const addNode = (type: string) => {
        const id = `${type}_${Date.now()}`;
        const newNode: Node = {
            id,
            type,
            position: { x: 250, y: nodes.length * 100 + 100 },
            data: { label: `New ${type}`, assignee: 'Admin' },
        };
        setNodes((nds) => nds.concat(newNode));
    };

    const handleSave = async () => {
        try {
            await api.post('/flows', { name, nodes, edges });
            router.push('/designer/flows');
        } catch (e) {
            alert('Failed to save flow');
        }
    };

    return (
        <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                    label="Flow Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    size="small"
                    sx={{ width: 300 }}
                />
                <Button variant="contained" onClick={handleSave} disabled={!name}>
                    Save Flow
                </Button>
                <Button variant="outlined" onClick={() => addNode('approval')}>
                    Add Approval Step
                </Button>
            </Box>

            <Box sx={{ flexGrow: 1, border: '1px solid #ddd' }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    fitView
                >
                    <Controls />
                    <MiniMap />
                    <Background gap={12} size={1} />
                </ReactFlow>
            </Box>
        </Box>
    );
}

export const FlowEditorPage = () => (
    <ReactFlowProvider>
        <FlowEditorContent />
    </ReactFlowProvider>
);
