// BranchNode - Refactored for Multi-Branch Support
import { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Pencil, Plus, Trash2, GitBranch } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { v4 as uuidv4 } from 'uuid';

interface Condition {
    field: string;
    operator: string;
    value: string;
}

interface Rule {
    id: string;
    label: string;
    conditions: Condition[];
    logic: 'and' | 'or';
}

export default function BranchNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    
    // New Data Structure: rules array
    const [rules, setRules] = useState<Rule[]>(data.rules || []);
    const [defaultLabel, setDefaultLabel] = useState(data.defaultLabel || 'その他 (Default)');

    const { setNodes } = useReactFlow();
    const isReadOnly = data.readOnly === true;
    const formFields = data.formFields || [];

    // Initialize with one rule if empty (or migration from legacy)
    useEffect(() => {
        if (dialogOpen) {
            let initialRules = data.rules;
            if (!initialRules || initialRules.length === 0) {
                // Check if legacy data exists
                if (data.conditions && data.conditions.length > 0) {
                     initialRules = [{
                        id: 'rule-1',
                        label: data.yesLabel || '条件一致',
                        conditions: data.conditions,
                        logic: data.conditionLogic || 'and'
                     }];
                } else if (data.conditionField) {
                     initialRules = [{
                        id: 'rule-1',
                        label: data.yesLabel || 'はい',
                        conditions: [{ field: data.conditionField, operator: data.conditionOperator || '==', value: data.conditionValue }],
                        logic: 'and'
                     }];
                } else {
                    initialRules = [{
                        id: uuidv4(),
                        label: '条件 1',
                        conditions: [{ field: '', operator: '==', value: '' }],
                        logic: 'and'
                    }];
                }
            }
            setRules(initialRules);
            setDefaultLabel(data.defaultLabel || data.noLabel || 'その他 (Default)');
        }
    }, [dialogOpen, data]);

    const handleSave = () => {
        if (isReadOnly) return;
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? { 
                        ...node, 
                        data: { 
                            ...node.data, 
                            rules, 
                            defaultLabel,
                            // Clear legacy to avoid confusion
                            conditions: undefined,
                            conditionLogic: undefined,
                            yesLabel: undefined,
                            noLabel: undefined
                        } 
                    }
                    : node
            )
        );
        setDialogOpen(false);
    };

    const addRule = () => {
        setRules([...rules, {
            id: uuidv4(),
            label: `条件 ${rules.length + 1}`,
            conditions: [{ field: '', operator: '==', value: '' }],
            logic: 'and'
        }]);
    };

    const removeRule = (index: number) => {
        const newRules = rules.filter((_, i) => i !== index);
        setRules(newRules);
    };

    const updateRule = (index: number, key: keyof Rule, val: any) => {
        const newRules = [...rules];
        newRules[index] = { ...newRules[index], [key]: val };
        setRules(newRules);
    };

    const updateRuleCondition = (ruleIndex: number, condIndex: number, key: keyof Condition, val: string) => {
        const newRules = [...rules];
        const newConds = [...newRules[ruleIndex].conditions];
        newConds[condIndex] = { ...newConds[condIndex], [key]: val };
        newRules[ruleIndex].conditions = newConds;
        setRules(newRules);
    };

    const addRuleCondition = (ruleIndex: number) => {
        const newRules = [...rules];
        newRules[ruleIndex].conditions.push({ field: '', operator: '==', value: '' });
        setRules(newRules);
    };

    const removeRuleCondition = (ruleIndex: number, condIndex: number) => {
        const newRules = [...rules];
        newRules[ruleIndex].conditions = newRules[ruleIndex].conditions.filter((_, i) => i !== condIndex);
        setRules(newRules);
    };

    return (
        <>
            <div className={`relative min-w-[100px] min-h-[80px] px-3 py-2 rounded flex flex-col items-center justify-center shadow-md transition-all duration-300
                ${data.isFailed ? 'bg-red-50 border-red-500 shadow-red-200 border-2' : 
                  data.isCurrent ? 'bg-orange-100 border-yellow-400 ring-4 ring-yellow-400/30 border-2' : 
                  'bg-orange-100 border-orange-500 border-2'}
                `}>
                {data.isCurrent && !data.isFailed && <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-orange-600 border-white hover:bg-orange-600 z-50 shadow-sm whitespace-nowrap">現在</Badge>}
                {data.isFailed && <Badge variant="destructive" className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 border-white z-50 shadow-sm whitespace-nowrap">失敗</Badge>}
                {data.isCompleted && !data.isCurrent && !data.isFailed && <Badge variant="secondary" className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-emerald-100 text-emerald-700 border-emerald-200 border hover:bg-emerald-100 z-50 shadow-sm whitespace-nowrap">完了</Badge>}
                <Handle 
                    type="target" 
                    position={Position.Left} 
                    isConnectableStart={false}
                    className="!bg-white !border-2 !border-orange-600 !w-3 !h-3 !rounded-none" 
                />
                
                <div className="flex items-center gap-2 mb-2">
                    <GitBranch className="h-5 w-5 text-orange-600" />
                    <span className="font-bold text-sm text-orange-800">分岐</span>
                     {!isReadOnly && (
                        <button className="p-1 hover:bg-orange-200 rounded-full" onClick={() => setDialogOpen(true)} onMouseDown={(e) => e.stopPropagation()}>
                            <Pencil className="h-3 w-3 text-orange-600" />
                        </button>
                    )}
                </div>

                <div className="flex flex-col gap-2 w-full items-end">
                    {/* Dynamic Handles */}
                    {rules.map((rule) => (
                        <div key={rule.id} className="relative w-full text-right h-5 flex items-center justify-end pr-2 group">
                             <span className="text-[10px] text-orange-700 font-medium truncate max-w-[80px] mr-1" title={rule.label}>{rule.label}</span>
                             <div className="w-2 h-[2px] bg-orange-400 mr-[1px]"></div>
                             <Handle 
                                type="source" 
                                position={Position.Right} 
                                id={rule.id} 
                                style={{ top: '50%', right: '-13px' }}
                                className="!bg-orange-500 !w-2.5 !h-2.5 !border-1 !border-white !rounded-full"
                             />
                        </div>
                    ))}
                    
                    {/* Default Handle */}
                    <div className="relative w-full text-right h-5 flex items-center justify-end pr-2 border-t border-orange-200 pt-1 mt-1">
                         <span className="text-[9px] text-gray-500 truncate max-w-[80px] mr-1">{defaultLabel}</span>
                         <div className="w-2 h-[2px] bg-gray-300 mr-[1px]"></div>
                         <Handle 
                            type="source" 
                            position={Position.Right} 
                            id="default" 
                            style={{ top: '50%', right: '-13px' }}
                            className="!bg-gray-500 !w-2.5 !h-2.5 !border-1 !border-white !rounded-full"
                         />
                    </div>
                </div>

                {data.statCount !== undefined && data.statCount > 0 && (
                    <div className="absolute -top-3 -right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full border border-white shadow-sm z-10 animate-pulse">
                        {data.statCount}
                    </div>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{isReadOnly ? '分岐条件 (読取専用)' : '分岐ルール設定'}</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-6 py-4">
                        <div className="space-y-4">
                            {rules.map((rule, ruleIndex) => (
                                <div key={rule.id} className="border rounded-lg p-4 bg-muted/20 relative">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="grid gap-1.5 flex-1">
                                            <Label className="text-xs">ルール名 (分岐ラベル)</Label>
                                            <Input value={rule.label} onChange={(e) => updateRule(ruleIndex, 'label', e.target.value)} disabled={isReadOnly} />
                                        </div>
                                        <div className="grid gap-1.5 w-[140px]">
                                             <Label className="text-xs">条件ロジック</Label>
                                             <Select value={rule.logic} onValueChange={(v) => updateRule(ruleIndex, 'logic', v)} disabled={isReadOnly}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="and">すべて一致 (AND)</SelectItem>
                                                    <SelectItem value="or">いずれか一致 (OR)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {!isReadOnly && (
                                            <Button variant="ghost" size="icon" className="text-destructive mt-4" onClick={() => removeRule(ruleIndex)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>

                                    <div className="space-y-2 pl-4 border-l-2 border-orange-200">
                                        {rule.conditions.map((cond, condIndex) => (
                                            <div key={condIndex} className="flex gap-2 items-center">
                                                <Select value={cond.field} onValueChange={(v) => updateRuleCondition(ruleIndex, condIndex, 'field', v)} disabled={isReadOnly}>
                                                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="フィールド" /></SelectTrigger>
                                                    <SelectContent>
                                                        {formFields.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <Select value={cond.operator} onValueChange={(v) => updateRuleCondition(ruleIndex, condIndex, 'operator', v)} disabled={isReadOnly}>
                                                    <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="==">=</SelectItem>
                                                        <SelectItem value="!=">≠</SelectItem>
                                                        <SelectItem value=">">&gt;</SelectItem>
                                                        <SelectItem value="<">&lt;</SelectItem>
                                                        <SelectItem value=">=">≥</SelectItem>
                                                        <SelectItem value="<=">≤</SelectItem>
                                                        <SelectItem value="contains">含む</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Input className="flex-1" value={cond.value} onChange={(e) => updateRuleCondition(ruleIndex, condIndex, 'value', e.target.value)} disabled={isReadOnly} />
                                                {!isReadOnly && (
                                                    <Button variant="ghost" size="icon" onClick={() => removeRuleCondition(ruleIndex, condIndex)}><Trash2 className="h-4 w-4" /></Button>
                                                )}
                                            </div>
                                        ))}
                                        {!isReadOnly && (
                                            <Button variant="link" size="sm" onClick={() => addRuleCondition(ruleIndex)} className="text-orange-600 px-0">
                                                <Plus className="h-3 w-3 mr-1" /> 条件追加
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {!isReadOnly && (
                                <Button onClick={addRule} variant="outline" className="w-full border-dashed">
                                    <Plus className="h-4 w-4 mr-2" /> 新しい分岐ルールを追加
                                </Button>
                            )}
                        </div>

                        <Separator />

                        <div className="space-y-2">
                             <Label>デフォルトルート (どの条件にも一致しない場合)</Label>
                             <div className="flex items-center gap-4">
                                <div className="border h-10 w-1 bg-gray-300"></div>
                                <Input value={defaultLabel} onChange={(e) => setDefaultLabel(e.target.value)} disabled={isReadOnly} className="max-w-[300px]" />
                                <span className="text-xs text-muted-foreground">このルートは常に有効です (Handle ID: default)</span>
                             </div>
                        </div>
                    </div>

                    <DialogFooter>
                        {isReadOnly ? <Button onClick={() => setDialogOpen(false)}>閉じる</Button> : (
                            <><Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button><Button onClick={handleSave}>保存</Button></>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
