
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus, Trash2 } from 'lucide-react';

export interface SearchCriterion { operator: string; value: any; }

const OPERATORS = [
    { value: 'equals', label: '等しい (=)' },
    { value: 'contains', label: '含む' },
    { value: 'gt', label: 'より大きい (>)' },
    { value: 'lt', label: 'より小さい (<)' },
    { value: 'gte', label: '以上 (>=)' },
    { value: 'lte', label: '以下 (<=)' },
];

const NON_INPUT_TYPES = ['label', 'group', 'divider', 'spacer', 'paragraph', 'html', 'button', 'section'];

interface DynamicSearchFormProps {
    schema: any;
    criteria?: Record<string, SearchCriterion>;
    onChange: (criteria: Record<string, SearchCriterion>) => void;
    className?: string;
}

export function DynamicSearchForm({ schema, onChange, className }: DynamicSearchFormProps) {
    const { register, unregister, setValue, watch, reset, getValues } = useForm();
    const [activeFilters, setActiveFilters] = useState<string[]>([]);
    const [selectedFieldToAdd, setSelectedFieldToAdd] = useState<string>('');

    const formattedSchema = schema || {};
    const allFields = formattedSchema.properties
        ? Object.entries(formattedSchema.properties)
            .map(([id, config]: [string, any]) => ({ id, ...config }))
            .filter((f) => !NON_INPUT_TYPES.includes(f.type))
        : [];
    
    // Helper to calculate criteria from values
    const calculateCriteria = (values: any, filters: string[]) => {
        const newCriteria: Record<string, SearchCriterion> = {};
        filters.forEach((fieldId) => {
            const field = allFields.find((f) => f.id === fieldId);
            if (!field) return;
            const operator = values[`${fieldId}_operator`];
            const val = values[`${fieldId}_value`];
            if (val !== undefined && val !== '' && val !== null) {
                newCriteria[fieldId] = { operator: operator || 'equals', value: field.type === 'number' ? Number(val) : val };
            }
        });
        return newCriteria;
    };

    // 1. Subscription for Value Changes
    useEffect(() => {
        const subscription = watch((value) => {
            onChange(calculateCriteria(value, activeFilters));
        });
        return () => subscription.unsubscribe();
    }, [watch, activeFilters, onChange]);

    // 2. Effect for Filter Structure Changes (Add/Remove)
    // When activeFilters changes, we need to re-emit criteria based on current values.
    // However, the watch subscription above is re-created on activeFilters change too.
    // Does re-creating subscription trigger a callback? No.
    // So we must manually check.
    useEffect(() => {
        const currentValues = getValues();
        onChange(calculateCriteria(currentValues, activeFilters));
    }, [activeFilters]); // eslint-disable-line react-hooks/exhaustive-deps
    
    const availableFields = allFields.filter((f) => !activeFilters.includes(f.id));

    const handleAddField = () => {
        if (selectedFieldToAdd) {
            setActiveFilters([...activeFilters, selectedFieldToAdd]);
            setSelectedFieldToAdd('');
        }
    };

    const handleRemoveField = (fieldId: string) => {
        setActiveFilters(activeFilters.filter((id) => id !== fieldId));
        unregister(`${fieldId}_operator`);
        unregister(`${fieldId}_value`);
    };

    const clearAll = () => {
        setActiveFilters([]);
        reset();
    };

    if (!schema?.properties) return null;

    return (
        <div className={className}>
            <div className="space-y-4">
                {/* Active Filters List */}
                {activeFilters.length > 0 && (
                    <div className="grid gap-3 p-1">
                        {activeFilters.map((fieldId) => {
                            const field = allFields.find((f) => f.id === fieldId);
                            if (!field) return null;
                            return (
                                <div key={fieldId} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-muted/40 p-2 rounded-md border text-sm">
                                    <div className="font-medium min-w-[120px] px-2 flex items-center gap-2">
                                        <button type="button" onClick={() => handleRemoveField(fieldId)} className="text-muted-foreground hover:text-destructive">
                                            <X className="h-4 w-4" />
                                        </button>
                                        {field.title || field.label || field.id}
                                    </div>
                                    
                                    <div className="flex-1 flex gap-2 w-full">
                                        <div className="w-[100px] shrink-0">
                                            <Select defaultValue={field.type === 'string' ? 'contains' : 'equals'} onValueChange={(v) => setValue(`${field.id}_operator`, v)}>
                                                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {OPERATORS.map((op) => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex-1">
                                            {['select', 'radio', 'checkbox'].includes(field.type) ? (
                                                    <Select onValueChange={(v) => setValue(`${field.id}_value`, v === '__all__' ? '' : v)}>
                                                    <SelectTrigger className="h-8"><SelectValue placeholder="選択..." /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__all__">Any</SelectItem>
                                                        {field.options?.map((opt: any) => {
                                                            const val = typeof opt === 'string' ? opt : opt.value;
                                                            const lbl = typeof opt === 'string' ? opt : opt.label;
                                                            return <SelectItem key={val} value={val}>{lbl}</SelectItem>;
                                                        })}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <Input 
                                                    className="h-8"
                                                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} 
                                                    placeholder="値を入力" 
                                                    {...register(`${field.id}_value`)} 
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Add Filter Bar */}
                <div className="flex flex-col sm:flex-row gap-2 items-center justify-between bg-muted/20 p-2 rounded-lg border border-dashed">
                    <div className="flex gap-2 items-center w-full sm:w-auto">
                        <Select value={selectedFieldToAdd} onValueChange={setSelectedFieldToAdd}>
                            <SelectTrigger className="w-full sm:w-[200px] h-9"><SelectValue placeholder="詳細条件を追加..." /></SelectTrigger>
                            <SelectContent>
                                {availableFields.length === 0 ? (
                                    <SelectItem value="__empty__" disabled>全ての項目を追加済み</SelectItem>
                                ) : (
                                    availableFields.map((field) => <SelectItem key={field.id} value={field.id}>{field.title || field.label || field.id}</SelectItem>)
                                )}
                            </SelectContent>
                        </Select>
                        <Button type="button" variant="ghost" size="sm" onClick={handleAddField} disabled={!selectedFieldToAdd}>
                            <Plus className="h-4 w-4 mr-1" />追加
                        </Button>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                        {activeFilters.length > 0 && (
                            <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
                                <Trash2 className="h-4 w-4 mr-1" />クリア
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
