import { useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from "@/components/ui/select"
import { Checkbox } from '@/components/ui/checkbox';
import type { FormField } from '../../features/designer/editor/types';

// Simplified field definition for columns
export interface GridColumn extends FormField {
    key: string; // The property key in the row object
}

interface DataGridFieldProps {
    columns: GridColumn[];
    value?: any[];
    onChange: (value: any[]) => void;
    readOnly?: boolean;
    fieldId: string;
}

export default function DataGridField({
    columns = [],
    value = [],
    onChange,
    readOnly = false,
    // fieldId // Reserved for ID-based key generation or validation
}: DataGridFieldProps) {
    // Ensure value is an array
    const rows = Array.isArray(value) ? value : [];

    const handleAddRow = useCallback(() => {
        const newRow: any = {};
        columns.forEach(col => {
            // Set default values if any
            if (col.defaultValue !== undefined) {
                newRow[col.key] = col.defaultValue;
            } else {
                 newRow[col.key] = ''; // Default to empty string
            }
        });
        // Generate a temporary ID for key if needed, or just rely on index.
        // For React keys, we might want a persistent ID but index is okay for simple cases if no reordering.
        onChange([...rows, newRow]);
    }, [columns, rows, onChange]);

    const handleRemoveRow = useCallback((index: number) => {
        const newRows = [...rows];
        newRows.splice(index, 1);
        onChange(newRows);
    }, [rows, onChange]);

    const handleCellChange = useCallback((rowIndex: number, key: string, newValue: any) => {
        const newRows = [...rows];
        newRows[rowIndex] = { ...newRows[rowIndex], [key]: newValue };
        onChange(newRows);
    }, [rows, onChange]);

    const renderCellInput = (col: GridColumn, rowValue: any, rowIndex: number) => {
        const cellValue = rowValue[col.key];

        if (readOnly) {
             if (col.type === 'checkbox') {
                 return cellValue ? 'はい' : 'いいえ';
             }
             if (col.type === 'select') {
                 const option = (col.options as any[])?.find((o: any) => 
                     typeof o === 'string' ? o === cellValue : o.value === cellValue
                 );
                 return option ? (option.label || option.value || option) : cellValue;
             }
             return cellValue;
        }

        switch (col.type) {
            case 'number':
                return (
                    <Input
                        type="number"
                        value={cellValue || ''}
                        onChange={(e) => handleCellChange(rowIndex, col.key, e.target.valueAsNumber || 0)}
                        className="h-8"
                    />
                );
            case 'date':
                return (
                    <Input
                        type="date"
                        value={cellValue || ''}
                        onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
                        className="h-8"
                    />
                );
            case 'select':
                 return (
                    <Select
                        value={cellValue}
                        onValueChange={(val) => handleCellChange(rowIndex, col.key, val)}
                    >
                        <SelectTrigger className="h-8 w-full">
                            <SelectValue placeholder="選択..." />
                        </SelectTrigger>
                        <SelectContent>
                             {(col.options || []).map((opt: any, idx: number) => {
                                 const o = typeof opt === 'string' ? { label: opt, value: opt } : opt;
                                 return (
                                     <SelectItem key={idx} value={o.value}>{o.label}</SelectItem>
                                 );
                             })}
                        </SelectContent>
                    </Select>
                 );
             case 'checkbox':
                 return (
                     <div className="flex justify-center">
                         <Checkbox
                             checked={!!cellValue}
                             onCheckedChange={(checked) => handleCellChange(rowIndex, col.key, !!checked)}
                         />
                     </div>
                 );
            case 'text':
            default:
                return (
                    <Input
                        value={cellValue || ''}
                        onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
                        className="h-8"
                    />
                );
        }
    };

    return (
        <div className="space-y-2 border rounded-md overflow-hidden bg-background">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-[50px] text-center">#</TableHead>
                            {columns.map((col) => (
                                <TableHead key={col.key} className="min-w-[120px]">
                                    {col.label}
                                    {col.required && <span className="text-destructive ml-1">*</span>}
                                </TableHead>
                            ))}
                            {!readOnly && <TableHead className="w-[50px]"></TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row, rowIndex) => (
                            <TableRow key={rowIndex}>
                                <TableCell className="text-center text-muted-foreground text-xs">
                                    {rowIndex + 1}
                                </TableCell>
                                {columns.map((col) => (
                                    <TableCell key={col.key} className="p-2">
                                        {renderCellInput(col, row, rowIndex)}
                                    </TableCell>
                                ))}
                                {!readOnly && (
                                    <TableCell>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRemoveRow(rowIndex)}
                                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                        {rows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={columns.length + (readOnly ? 1 : 2)} className="h-24 text-center text-muted-foreground text-sm">
                                    データがありません
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            {!readOnly && (
                <div className="p-2 border-t bg-muted/10">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddRow}
                        className="w-full sm:w-auto"
                    >
                        <Plus className="h-3 w-3 mr-2" />
                        行を追加
                    </Button>
                </div>
            )}
        </div>
    );
}
