import { useState } from 'react';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, AlertTriangle, AlertCircle } from 'lucide-react';
// import { ScrollArea } from "@/components/ui/scroll-area";
import type { FormField, ValidationRule, RuleCondition } from './types';
import { getAllFieldsFlattened } from './utils';

// Helper component for editing a single rule
const RuleEditor = ({ 
    rule, 
    fields, 
    nodes,
    onSave, 
    onCancel 
}: { 
    rule?: ValidationRule, 
    fields: FormField[], 
    nodes?: any[], // Flow Nodes
    onSave: (rule: ValidationRule) => void, 
    onCancel: () => void 
}) => {
    const [targetFieldId, setTargetFieldId] = useState(rule?.targetFieldId || '');
    const [type, setType] = useState<'required' | 'constraint'>(rule?.type || 'constraint');
    const [severity, setSeverity] = useState<'error' | 'warning'>(rule?.severity || 'error');
    const [message, setMessage] = useState(rule?.message || '');
    const [conditions, setConditions] = useState<RuleCondition[]>(rule?.conditions || [{ fieldId: '', operator: 'eq', value: '' }]);
    const [logic, setLogic] = useState<'AND' | 'OR'>(rule?.logic || 'AND');
    const [applyToTasks, setApplyToTasks] = useState<string[]>(rule?.applyToTasks || []);

    const allFields = getAllFieldsFlattened(fields);

    const handleSave = () => {
        if (!targetFieldId) return;
        onSave({
            id: rule?.id || crypto.randomUUID(),
            targetFieldId,
            type,
            severity,
            message,
            conditions,
            logic,
            applyToTasks
        });
    };

    const addCondition = () => {
        setConditions([...conditions, { fieldId: '', operator: 'eq', value: '', valueType: 'const' }]);
    };

    const updateCondition = (index: number, updates: Partial<RuleCondition>) => {
        const newConditions = [...conditions];
        newConditions[index] = { ...newConditions[index], ...updates };
        setConditions(newConditions);
    };

    const removeCondition = (index: number) => {
        setConditions(conditions.filter((_, i) => i !== index));
    };

    const toggleTask = (nodeId: string) => {
        setApplyToTasks(prev => 
            prev.includes(nodeId) 
                ? prev.filter(id => id !== nodeId) 
                : [...prev, nodeId]
        );
    };

    return (
        <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                        対象フィールド
                        <span className="text-[10px] text-muted-foreground font-normal ml-1">
                            (エラー/マークが表示される場所)
                        </span>
                    </Label>
                    <Select value={targetFieldId} onValueChange={setTargetFieldId}>
                        <SelectTrigger><SelectValue placeholder="フィールドを選択" /></SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                            {allFields.map(f => (
                                <SelectItem key={f.id} value={f.id}>{f.label} ({f.id})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                 </div>
                <div className="space-y-2">
                    <Label>ルールタイプ</Label>
                    <Select value={type} onValueChange={(v: any) => setType(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="required">
                                <span>必須化</span>
                                <span className="block text-[10px] text-muted-foreground">条件合致で必須マーク(*)を表示</span>
                            </SelectItem>
                            <SelectItem value="constraint">
                                <span>制約チェック</span>
                                <span className="block text-[10px] text-muted-foreground">値が条件違反ならエラー表示</span>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>条件設定</Label>
                    <div className="flex items-center gap-2">
                         <Select value={logic} onValueChange={(v: any) => setLogic(v)}>
                            <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="AND">AND</SelectItem>
                                <SelectItem value="OR">OR</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={addCondition}><Plus className="h-3 w-3 mr-1" /> 条件追加</Button>
                    </div>
                </div>
                <div className="space-y-2 bg-muted/30 p-3 rounded-md border">
                    {conditions.map((cond, idx) => (
                        <div key={idx} className="flex gap-2 items-start">
                            <Select value={cond.fieldId} onValueChange={(v) => updateCondition(idx, { fieldId: v })}>
                                <SelectTrigger className="w-[140px]"><SelectValue placeholder="フィールド" /></SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                    {allFields.map(f => (
                                        <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                             <Select value={cond.operator} onValueChange={(v: any) => updateCondition(idx, { operator: v as any })}>
                                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="eq">等しい (=)</SelectItem>
                                    <SelectItem value="neq">等しくない (!=)</SelectItem>
                                    <SelectItem value="contains">含む</SelectItem>
                                    <SelectItem value="not_contains">含まない</SelectItem>
                                    <SelectItem value="empty">空である</SelectItem>
                                    <SelectItem value="not_empty">空でない</SelectItem>
                                    <SelectItem value="gt">より大きい (&gt;)</SelectItem>
                                    <SelectItem value="gte">以上 (&gt;=)</SelectItem>
                                    <SelectItem value="lt">より小さい (&lt;)</SelectItem>
                                    <SelectItem value="lte">以下 (&lt;=)</SelectItem>
                                </SelectContent>
                            </Select>
                            {!['empty', 'not_empty'].includes(cond.operator) && (
                                <Input 
                                    value={cond.value} 
                                    onChange={(e) => updateCondition(idx, { value: e.target.value })}
                                    placeholder="値"
                                    className="flex-1 min-w-[100px]"
                                />
                            )}
                            <Button variant="ghost" size="icon" onClick={() => removeCondition(idx)} className="text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>重要度</Label>
                    <Select value={severity} onValueChange={(v: any) => setSeverity(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="error">エラー (送信不可)</SelectItem>
                            <SelectItem value="warning">警告 (送信可)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>エラーメッセージ</Label>
                    <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="例: 金額が大きすぎます" />
                </div>
            </div>

            <div className="space-y-2">
                <Label>適用するタスク (空の場合は全てに適用)</Label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-md min-h-[60px] max-h-[120px] overflow-y-auto">
                    {nodes?.map(node => {
                        if (node.type === 'start' || node.type === 'approval' || node.type === 'input') {
                            const isSelected = applyToTasks.includes(node.id);
                            return (
                                <Badge 
                                    key={node.id} 
                                    variant={isSelected ? "default" : "outline"}
                                    className="cursor-pointer select-none"
                                    onClick={() => toggleTask(node.id)}
                                >
                                    {node.data?.label || node.id}
                                    {isSelected && <span className="ml-1 text-xs">✓</span>}
                                </Badge>
                            );
                        }
                        return null;
                    })}
                    {!nodes || nodes.length === 0 && <span className="text-muted-foreground text-sm">フロー定義が見つかりません</span>}
                </div>
                <p className="text-xs text-muted-foreground">※ 選択しない場合は、すべてのタスクでこのルールが適用されます。</p>
            </div>

             <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onCancel}>キャンセル</Button>
                <Button onClick={handleSave} disabled={!targetFieldId}>保存</Button>
            </div>
        </div>
    );
};


interface GlobalValidationRulesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rules: ValidationRule[];
    onRulesChange: (rules: ValidationRule[]) => void;
    fields: FormField[];
    nodes?: any[];
}

export default function GlobalValidationRulesDialog({
    open,
    onOpenChange,
    rules,
    onRulesChange,
    fields,
    nodes
}: GlobalValidationRulesDialogProps) {
    const [editingRule, setEditingRule] = useState<ValidationRule | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const handleSaveRule = (rule: ValidationRule) => {
        if (editingRule) {
            onRulesChange(rules.map(r => r.id === rule.id ? rule : r));
            setEditingRule(null);
        } else {
            onRulesChange([...rules, rule]);
            setIsCreating(false);
        }
    };

    const handleDeleteRule = (id: string) => {
        onRulesChange(rules.filter(r => r.id !== id));
    };

    const getFieldLabel = (id: string) => {
        const field = getAllFieldsFlattened(fields).find(f => f.id === id);
        return field ? field.label : id;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{isCreating || editingRule ? 'バリデーションルールの設定' : 'バリデーションルール一覧'}</DialogTitle>
                    <DialogDescription>
                        {isCreating || editingRule ? '条件満たした場合の挙動を設定します。' : 'フォーム全体の入力規則を管理します。'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-1">
                    {isCreating || editingRule ? (
                        <RuleEditor 
                            rule={editingRule || undefined} 
                            fields={fields} 
                            nodes={nodes}
                            onSave={handleSaveRule} 
                            onCancel={() => { setIsCreating(false); setEditingRule(null); }} 
                        />
                    ) : (
                        <div className="space-y-4">
                            {rules.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                                    ルールが設定されていません
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {rules.map(rule => (
                                        <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={rule.severity === 'error' ? 'destructive' : 'secondary'} className="text-[10px] px-1 py-0 h-5">
                                                        {rule.severity === 'error' ? <AlertCircle className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                                                        {rule.severity.toUpperCase()}
                                                    </Badge>
                                                    <span className="font-bold text-sm">{getFieldLabel(rule.targetFieldId)}</span>
                                                    <span className="text-xs text-muted-foreground">に</span>
                                                    <Badge variant="outline" className="text-[10px]">{rule.type === 'required' ? '必須化' : '制約'}</Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground line-clamp-1">
                                                    条件: {rule.conditions.length}件 ({rule.logic}) — {rule.message}
                                                </p>
                                                {rule.applyToTasks && rule.applyToTasks.length > 0 && (
                                                    <p className="text-[10px] text-muted-foreground">
                                                        対象タスク: {rule.applyToTasks.length}件
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => setEditingRule(rule)}>
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteRule(rule.id)} className="text-destructive hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <Button className="w-full" onClick={() => setIsCreating(true)} variant="outline">
                                <Plus className="h-4 w-4 mr-2" /> 新しいルールを追加
                            </Button>
                        </div>
                    )}
                </div>

                {!isCreating && !editingRule && (
                    <DialogFooter>
                        <Button onClick={() => onOpenChange(false)}>閉じる</Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
