import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2, Edit2 } from 'lucide-react';
import type { FormField, ValidationRule, RuleCondition } from './types';

interface ValidationRulesEditorProps {
    field: FormField;
    fields: FormField[]; // All fields for dependency selection
    onUpdate: (rules: ValidationRule[]) => void;
    readOnly?: boolean;
}

export function ValidationRulesEditor({ field, fields, onUpdate, readOnly }: ValidationRulesEditorProps) {
    const rules = field.validationRules || [];
    const [editingRule, setEditingRule] = useState<ValidationRule | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const handleSaveRule = (rule: ValidationRule) => {
        const newRules = editingRule 
            ? rules.map(r => r.id === rule.id ? rule : r)
            : [...rules, rule];
        onUpdate(newRules);
        setIsDialogOpen(false);
        setEditingRule(null);
    };

    const handleDeleteRule = (ruleId: string) => {
        onUpdate(rules.filter(r => r.id !== ruleId));
    };

    const openNewRule = () => {
        setEditingRule({
            id: `rule_${Date.now()}`,
            type: 'required',
            conditions: [{ fieldId: '', operator: 'not_empty' }],
            logic: 'AND',
            message: '',
            severity: 'error'
        });
        setIsDialogOpen(true);
    };

    return (
        <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">バリデーションルール</Label>
                <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="h-6 text-[10px]" 
                    onClick={openNewRule}
                    disabled={readOnly}
                >
                    + ルール追加
                </Button>
            </div>

            <div className="space-y-2">
                {rules.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-2 bg-muted/30 rounded border border-dashed">
                        ルールは設定されていません
                    </div>
                )}
                {rules.map((rule, idx) => (
                    <div key={idx} className="bg-muted/20 border rounded p-2 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                                <Badge variant={rule.severity === 'error' ? 'destructive' : 'secondary'} className="h-4 px-1 text-[10px]">
                                    {rule.severity === 'error' ? 'Error' : 'Warn'}
                                </Badge>
                                <span className="font-semibold">{rule.type === 'required' ? '必須化' : '制約'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-5 w-5" 
                                    onClick={() => { setEditingRule(rule); setIsDialogOpen(true); }}
                                    disabled={readOnly}
                                >
                                    <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-5 w-5 text-destructive" 
                                    onClick={() => handleDeleteRule(rule.id)}
                                    disabled={readOnly}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                        <div className="text-muted-foreground truncate" title={rule.message}>
                            {rule.message || '(メッセージなし)'}
                        </div>
                        <div className="bg-background rounded px-1.5 py-1 font-mono text-[10px] text-muted-foreground">
                            {rule.conditions.length} condition(s)
                        </div>
                    </div>
                ))}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>バリデーションルールの設定</DialogTitle>
                    </DialogHeader>
                    {editingRule && (
                        <RuleEditor 
                            rule={editingRule} 
                            fields={fields.filter(f => f.id !== field.id)} 
                            onSave={handleSaveRule} 
                            onCancel={() => setIsDialogOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function RuleEditor({ rule, fields, onSave, onCancel }: { rule: ValidationRule, fields: FormField[], onSave: (r: ValidationRule) => void, onCancel: () => void }) {
    const [draft, setDraft] = useState<ValidationRule>({ ...rule });

    const updateDraft = (updates: Partial<ValidationRule>) => {
        setDraft(prev => ({ ...prev, ...updates }));
    };

    const updateCondition = (index: number, updates: Partial<RuleCondition>) => {
        const newConditions = [...draft.conditions];
        newConditions[index] = { ...newConditions[index], ...updates };
        updateDraft({ conditions: newConditions });
    };

    const addCondition = () => {
        updateDraft({ conditions: [...draft.conditions, { fieldId: '', operator: 'not_empty' }] });
    };

    const removeCondition = (index: number) => {
        updateDraft({ conditions: draft.conditions.filter((_, i) => i !== index) });
    };

    return (
        <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-xs">種別</Label>
                    <Select value={draft.type} onValueChange={(v: any) => updateDraft({ type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="required">条件合致で必須化</SelectItem>
                            <SelectItem value="constraint">条件合致でエラー/警告</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs">重大度</Label>
                    <Select value={draft.severity} onValueChange={(v: any) => updateDraft({ severity: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="error">Error (ブロック)</SelectItem>
                            <SelectItem value="warning">Warning (警告のみ)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2 border rounded-md p-3 bg-muted/10">
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">条件 ({draft.logic === 'AND' ? 'すべて満たす' : 'いずれかを満たす'})</Label>
                    <div className="flex items-center gap-2">
                         <Select value={draft.logic} onValueChange={(v: any) => updateDraft({ logic: v })}>
                            <SelectTrigger className="h-6 text-xs w-20"><SelectValue /></SelectTrigger>
                             <SelectContent>
                                <SelectItem value="AND">AND</SelectItem>
                                <SelectItem value="OR">OR</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="sm" className="h-6 text-[10px]" onClick={addCondition}>+ 追加</Button>
                    </div>
                </div>

                <div className="space-y-3">
                    {draft.conditions.map((cond, idx) => (
                        <div key={idx} className="space-y-2 border-b pb-2 last:border-0 last:pb-0">
                            <div className="flex items-center gap-2">
                                <Select value={cond.fieldId} onValueChange={(v) => updateCondition(idx, { fieldId: v })}>
                                    <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="フィールド選択" /></SelectTrigger>
                                    <SelectContent>
                                        {fields.map(f => (
                                            <SelectItem key={f.id} value={f.id}>{f.label} ({f.id})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => removeCondition(idx)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="flex items-center gap-2">
                                <Select value={cond.operator} onValueChange={(v: any) => updateCondition(idx, { operator: v })}>
                                    <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="not_empty">値がある</SelectItem>
                                        <SelectItem value="empty">値がない</SelectItem>
                                        <SelectItem value="eq">等しい (=)</SelectItem>
                                        <SelectItem value="neq">等しくない (!=)</SelectItem>
                                        <SelectItem value="contains">含む</SelectItem>
                                        <SelectItem value="not_contains">含まない</SelectItem>
                                        <SelectItem value="gt">より大きい (&gt;)</SelectItem>
                                        <SelectItem value="lt">より小さい (&lt;)</SelectItem>
                                        <SelectItem value="gte">以上 (&gt;=)</SelectItem>
                                        <SelectItem value="lte">以下 (&lt;=)</SelectItem>
                                    </SelectContent>
                                </Select>

                                {!['empty', 'not_empty'].includes(cond.operator) && (
                                    <div className="flex-1 flex gap-1">
                                         <Select 
                                            value={cond.valueType || 'const'} 
                                            onValueChange={(v: any) => updateCondition(idx, { valueType: v })}
                                        >
                                            <SelectTrigger className="h-8 text-xs w-[70px] bg-muted/50"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="const">定数</SelectItem>
                                                <SelectItem value="field">項目</SelectItem>
                                            </SelectContent>
                                        </Select>

                                        {cond.valueType === 'field' ? (
                                            <Select value={cond.value || ''} onValueChange={(v) => updateCondition(idx, { value: v })}>
                                                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="比較対象項目" /></SelectTrigger>
                                                <SelectContent>
                                                    {fields.filter(f => f.id !== cond.fieldId).map(f => (
                                                        <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input 
                                                value={cond.value || ''} 
                                                onChange={(e) => updateCondition(idx, { value: e.target.value })} 
                                                placeholder="値"
                                                className="h-8 text-xs flex-1"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs">エラーメッセージ</Label>
                <Input 
                    value={draft.message} 
                    onChange={(e) => updateDraft({ message: e.target.value })} 
                    placeholder="例: この条件のときは入力できません"
                />
            </div>

            <DialogFooter className="pt-2">
                <Button type="button" variant="ghost" onClick={onCancel}>キャンセル</Button>
                <Button type="button" onClick={() => onSave(draft)}>保存</Button>
            </DialogFooter>
        </div>
    );
}
