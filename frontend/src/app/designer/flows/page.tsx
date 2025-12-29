'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Box,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import Link from 'next/link';

interface FlowDefinition {
    id: string;
    name: string;
    version: number;
    createdAt: string;
}

export default function FlowsListPage() {
    const { data: flows, isLoading } = useQuery<FlowDefinition[]>({
        queryKey: ['flows'],
        queryFn: () => api.get('/flows'),
    });

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4">Flow Definitions</Typography>
                <Button
                    variant="contained"
                    component={Link}
                    href="/designer/flows/new"
                >
                    Create New Flow
                </Button>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Version</TableCell>
                            <TableCell>Created At</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={4}>Loading...</TableCell>
                            </TableRow>
                        ) : flows?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4}>No flows found.</TableCell>
                            </TableRow>
                        ) : (
                            flows?.map((flow) => (
                                <TableRow key={flow.id}>
                                    <TableCell>{flow.name}</TableCell>
                                    <TableCell>{flow.version}</TableCell>
                                    <TableCell>{new Date(flow.createdAt).toLocaleString()}</TableCell>
                                    <TableCell>
                                        <Button
                                            size="small"
                                            component={Link}
                                            href={`/designer/flows/${flow.id}`}
                                        >
                                            Edit
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}
