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

interface FormDefinition {
    id: string;
    name: string;
    version: number;
    createdAt: string;
}

export default function FormsListPage() {
    const { data: forms, isLoading } = useQuery<FormDefinition[]>({
        queryKey: ['forms'],
        queryFn: () => api.get('/forms'),
    });

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4">Form Definitions</Typography>
                <Button
                    variant="contained"
                    component={Link}
                    href="/designer/forms/new"
                >
                    Create New Form
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
                        ) : forms?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4}>No forms found.</TableCell>
                            </TableRow>
                        ) : (
                            forms?.map((form) => (
                                <TableRow key={form.id}>
                                    <TableCell>{form.name}</TableCell>
                                    <TableCell>{form.version}</TableCell>
                                    <TableCell>{new Date(form.createdAt).toLocaleString()}</TableCell>
                                    <TableCell>
                                        <Button
                                            size="small"
                                            component={Link}
                                            href={`/designer/forms/${form.id}`}
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
