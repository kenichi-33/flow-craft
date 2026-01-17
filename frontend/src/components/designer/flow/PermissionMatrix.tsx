import { useState, useEffect } from 'react';
import type { Node } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface PermissionMatrixProps {
    nodes: Node[];
    onSave: (updatedNodes: Node[]) => void;
    onCancel: () => void;
    formFields: { id: string; label: string; type: string }[];
}

type PermissionType = 'editable' | 'readonly' | 'hidden';

export interface NodePermissionData {
    nodeId: string;
    nodeLabel: string;
    permissions: Record<string, PermissionType>; // fieldId -> permission
}

export default function PermissionMatrix({ nodes, onSave, onCancel, formFields }: PermissionMatrixProps) {
    const [matrix, setMatrix] = useState<NodePermissionData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Initialize matrix from nodes
        // Only target ApprovalNodes and InputNodes (if they support permissions - InputNode currently doesn't, so focusing on Approval)
        // Also APICall/LLMCall might use fields, but permissions are usually for Human Tasks.
        // Let's target 'approval' nodes for now as per user request/context.
        
        const targetNodes = nodes.filter(n => n.type === 'approval');
        
        const initialData: NodePermissionData[] = targetNodes.map(node => {
            return {
                nodeId: node.id,
                nodeLabel: node.data.label as string || node.id,
                permissions: (node.data.fieldPermissions as Record<string, PermissionType>) || {}
            };
        });

        setMatrix(initialData);
        setIsLoading(false);
    }, [nodes]);

    const handlePermissionChange = (nodeId: string, fieldId: string, value: PermissionType) => {
        setMatrix(prev => prev.map(item => {
            if (item.nodeId === nodeId) {
                return {
                    ...item,
                    permissions: {
                        ...item.permissions,
                        [fieldId]: value
                    }
                };
            }
            return item;
        }));
    };

    const handleBatchChange = (nodeId: string, value: PermissionType) => {
        setMatrix(prev => prev.map(item => {
            if (item.nodeId === nodeId) {
                const newPerms: Record<string, PermissionType> = {};
                formFields.forEach(f => newPerms[f.id] = value);
                return {
                    ...item,
                    permissions: newPerms
                };
            }
            return item;
        }));
    };

    const handleSave = () => {
        // Map matrix back to nodes
        const updatedNodes = nodes.map(node => {
            const matrixData = matrix.find(m => m.nodeId === node.id);
            if (matrixData) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        fieldPermissions: matrixData.permissions
                    }
                };
            }
            return node;
        });
        onSave(updatedNodes);
    };

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

    if (matrix.length === 0) {
        return (
            <div className="text-center p-8 space-y-4">
                <p className="text-muted-foreground">承認ノードが見つかりません。フローに「承認ステップ」を追加してください。</p>
                <Button onClick={onCancel}>閉じる</Button>
            </div>
        );
    }

    if (formFields.length === 0) {
         return (
            <div className="text-center p-8 space-y-4">
                <p className="text-muted-foreground">フォーム定義がありません。アプリ設定でフォームを作成してください。</p>
                <Button onClick={onCancel}>閉じる</Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full max-h-[80vh]">
            <div className="p-4 border-b">
                <h2 className="text-lg font-semibold mb-1">フィールド権限マトリクス</h2>
                <p className="text-sm text-muted-foreground">承認ステップごとのフィールド表示権限を一括設定できます。</p>
            </div>
            
            <div className="flex-1 overflow-auto">
                <div className="p-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px] bg-background sticky top-0 z-10">フィールド / ステップ</TableHead>
                                {matrix.map(col => (
                                    <TableHead key={col.nodeId} className="min-w-[140px] text-center bg-background sticky top-0 z-10">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="font-bold text-foreground">{col.nodeLabel}</span>
                                            {/* Batch Actions for Column */}
                                            <Select onValueChange={(v) => handleBatchChange(col.nodeId, v as PermissionType)}>
                                                <SelectTrigger className="h-6 w-[100px] text-xs">
                                                    <SelectValue placeholder="一括設定" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="editable">全て編集可</SelectItem>
                                                    <SelectItem value="readonly">全て読取</SelectItem>
                                                    <SelectItem value="hidden">全て非表示</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {formFields.map(field => (
                                <TableRow key={field.id}>
                                    <TableCell className="font-medium bg-background sticky left-0 z-10">
                                        <div className="flex flex-col">
                                            <span>{field.label}</span>
                                            <span className="text-xs text-muted-foreground font-mono">{field.id}</span>
                                        </div>
                                    </TableCell>
                                    {matrix.map(col => {
                                        const perm = col.permissions[field.id] || 'editable';
                                        return (
                                            <TableCell key={`${col.nodeId}-${field.id}`} className="text-center p-2">
                                                <div className="flex justify-center">
                                                    <Select value={perm} onValueChange={(v) => handlePermissionChange(col.nodeId, field.id, v as PermissionType)}>
                                                        <SelectTrigger 
                                                            className={`h-8 w-[110px] text-xs ${
                                                                perm === 'editable' ? 'bg-sky-50 border-sky-200 text-sky-700' :
                                                                perm === 'readonly' ? 'bg-gray-50 border-gray-200 text-gray-700' :
                                                                'bg-red-50 border-red-200 text-red-700 opacity-60'
                                                            }`}
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="editable">編集可能</SelectItem>
                                                            <SelectItem value="readonly">読み取り</SelectItem>
                                                            <SelectItem value="hidden">非表示</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <div className="p-4 border-t flex justify-end gap-2 bg-background">
                <Button variant="outline" onClick={onCancel}>キャンセル</Button>
                <Button onClick={handleSave}>適用して保存</Button>
            </div>
        </div>
    );
}
