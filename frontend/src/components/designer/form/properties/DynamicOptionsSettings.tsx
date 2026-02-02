import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowRight } from 'lucide-react';
import type { FormField } from '../types';

export function DynamicOptionsSettings({
    field,
    fields,
    onUpdate,
    readOnly
}: {
    field: FormField;
    fields: FormField[];
    onUpdate: (id: string, updates: Partial<FormField>) => void;
    readOnly?: boolean;
}) {
    // Find potential trigger fields (Select, Radio)
    // Exclude self, exclude complex types
    const triggerCandidates = fields.filter(f => 
        f.id !== field.id && 
        ['select', 'radio'].includes(f.type)
    );

    const currentTriggerId = field.conditionalOptions?.triggerFieldId;
    const currentTriggerField = triggerCandidates.find(f => f.id === currentTriggerId);

    // Get options of the trigger field to build the mapping UI
    // Include both static options and potentially dynamic options defined in its own conditionalOptions
    const triggerOptions = (() => {
        if (!currentTriggerField) return [];
        
        const allOptions: any[] = [];
        const seenValues = new Set<string>();

        // Helper to add unique options
        const addOptions = (opts: any[]) => {
            opts.forEach(o => {
                const val = typeof o === 'string' ? o : o.value;
                const label = typeof o === 'string' ? o : o.label;
                if (!seenValues.has(val)) {
                    seenValues.add(val);
                    allOptions.push({ label, value: val });
                }
            });
        };

        // 1. Static options
        addOptions(currentTriggerField.options || []);

        // 2. Dynamic options from its mapping
        if (currentTriggerField.conditionalOptions?.mapping) {
            Object.values(currentTriggerField.conditionalOptions.mapping).forEach(mappedOpts => {
                addOptions(mappedOpts);
            });
        }

        return allOptions;
    })();

    const handleTriggerChange = (triggerId: string) => {
        if (triggerId === 'none') {
            onUpdate(field.id, { conditionalOptions: undefined });
        } else {
            // Initialize with empty mapping
            onUpdate(field.id, { 
                conditionalOptions: {
                    triggerFieldId: triggerId,
                    mapping: {}
                }
            });
        }
    };

    const handleMappingUpdate = (triggerValue: string, newOptions: any[]) => {
        if (!field.conditionalOptions) return;
        
        const newMapping = { ...field.conditionalOptions.mapping };
        newMapping[triggerValue] = newOptions;
        
        onUpdate(field.id, { 
            conditionalOptions: {
                ...field.conditionalOptions,
                mapping: newMapping
            }
        });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label className="text-xs">トリガーフィールド</Label>
                <Select 
                    value={currentTriggerId || 'none'} 
                    onValueChange={handleTriggerChange}
                    disabled={readOnly}
                >
                    <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="連動元を選択" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none" className="text-xs text-muted-foreground">(連動しない)</SelectItem>
                        {triggerCandidates.map(f => (
                            <SelectItem key={f.id} value={f.id} className="text-xs">
                                {f.label} ({f.id})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                    このフィールドの値によって選択肢を切り替えます
                </p>
            </div>

            {currentTriggerId && currentTriggerField && (
                <div className="space-y-3 pl-2 border-l-2 border-muted">
                    <Label className="text-xs text-muted-foreground">マッピング設定</Label>
                    
                    {/* Warning if no static options defined in the current field */}
                    {(field.options || []).length === 0 && (
                        <div className="text-[10px] text-yellow-600 mb-2 border border-yellow-200 bg-yellow-50 p-2 rounded">
                            このフィールドの固定選択肢が設定されていません。
                            連動設定を行う前に、まず固定選択肢にすべての候補を登録してください。
                        </div>
                    )}

                    {triggerOptions.length === 0 && (
                        <div className="text-[10px] text-yellow-600">
                            トリガーフィールドに選択肢が設定されていません
                        </div>
                    )}
                    
                    {/* Default (when trigger is unselected) */}
                    <div className="space-y-2 pb-2 border-b">
                         <div className="text-[11px] font-medium flex items-center gap-2">
                            <span className="text-muted-foreground">●</span>
                            <span>トリガー未選択時（デフォルト）:</span>
                        </div>
                        <div className="pl-4 space-y-1">
                            {(field.options || []).map((staticOpt: any, sIdx: number) => {
                                const sVal = typeof staticOpt === 'string' ? staticOpt : staticOpt.value;
                                const sLabel = typeof staticOpt === 'string' ? staticOpt : staticOpt.label;
                                // Default mapped options
                                const mappedOptions = field.conditionalOptions?.defaultOptions || field.options || [];
                                const mappedValues = mappedOptions.map((o: any) => typeof o === 'string' ? o : o.value);
                                const isChecked = mappedValues.includes(sVal);

                                return (
                                    <div key={sIdx} className="flex items-center gap-2">
                                        <Checkbox 
                                            id={`map-default-${sIdx}`}
                                            checked={isChecked}
                                            onCheckedChange={(checked) => {
                                                const currentDefaults = field.conditionalOptions?.defaultOptions || (field.options || []).map((o: any) => typeof o === 'string' ? { label: o, value: o } : o);
                                                let newOpts = [...currentDefaults];
                                                if (checked) {
                                                    // Add option
                                                     if (!newOpts.some((o: any) => (typeof o === 'string' ? o : o.value) === sVal)) {
                                                        newOpts.push({ label: sLabel, value: sVal });
                                                     }
                                                } else {
                                                    // Remove option
                                                    newOpts = newOpts.filter((o: any) => (typeof o === 'string' ? o : o.value) !== sVal);
                                                }
                                                
                                                onUpdate(field.id, { 
                                                    conditionalOptions: {
                                                        ...field.conditionalOptions!,
                                                        defaultOptions: newOpts
                                                    }
                                                });
                                            }}
                                            disabled={readOnly}
                                            className="h-3.5 w-3.5"
                                        />
                                        <Label htmlFor={`map-default-${sIdx}`} className="text-[10px] font-normal cursor-pointer">
                                            {sLabel}
                                        </Label>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    
                    {triggerOptions.map((tOpt: any, idx: number) => {
                        const tVal = typeof tOpt === 'string' ? tOpt : tOpt.value;
                        const tLabel = typeof tOpt === 'string' ? tOpt : tOpt.label;
                        
                        // Current mapped options for this trigger value
                        const mappedOptions = field.conditionalOptions?.mapping?.[tVal] || [];
                        const mappedValues = mappedOptions.map((o: any) => typeof o === 'string' ? o : o.value);

                        return (
                            <div key={idx} className="space-y-2 pb-2 border-b last:border-0">
                                <div className="text-[11px] font-medium flex items-center gap-2">
                                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                    <span>{tLabel} ({tVal}) の場合:</span>
                                </div>
                                
                                <div className="pl-4 space-y-1">
                                    {(field.options || []).map((staticOpt: any, sIdx: number) => {
                                        const sVal = typeof staticOpt === 'string' ? staticOpt : staticOpt.value;
                                        const sLabel = typeof staticOpt === 'string' ? staticOpt : staticOpt.label;
                                        const isChecked = mappedValues.includes(sVal);

                                        return (
                                            <div key={sIdx} className="flex items-center gap-2">
                                                <Checkbox 
                                                    id={`map-${idx}-${sIdx}`}
                                                    checked={isChecked}
                                                    onCheckedChange={(checked) => {
                                                        let newOpts = [...mappedOptions];
                                                        if (checked) {
                                                            // Add option (full object copy)
                                                            newOpts.push({ label: sLabel, value: sVal });
                                                        } else {
                                                            // Remove option
                                                            newOpts = newOpts.filter((o: any) => (typeof o === 'string' ? o : o.value) !== sVal);
                                                        }
                                                        handleMappingUpdate(tVal, newOpts);
                                                    }}
                                                    disabled={readOnly}
                                                    className="h-3.5 w-3.5"
                                                />
                                                <Label htmlFor={`map-${idx}-${sIdx}`} className="text-[10px] font-normal cursor-pointer">
                                                    {sLabel}
                                                </Label>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
