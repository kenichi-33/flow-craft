import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface AiCheckNodeConfigProps {
    data: any;
    onSave: (newData: any) => void;
    onCancel: () => void;
    isReadOnly?: boolean;
}

export default function AiCheckNodeConfig({ data, onSave, onCancel, isReadOnly }: AiCheckNodeConfigProps) {
    const [label, setLabel] = useState(data.label || 'AIチェック');
    const [targetSource, setTargetSource] = useState(data.targetSource || 'form');
    const [criteria, setCriteria] = useState(data.criteria || '');
    const [actionOnFail, setActionOnFail] = useState(data.actionOnFail || 'remand');
    const [remandTo, setRemandTo] = useState(data.remandTo || 'applicant');
    
    // Extract available fields from data.formFields
    const formFields = data.formFields || [];

    const handleSave = () => {
        onSave({
            ...data,
            label,
            targetSource,
            criteria,
            actionOnFail,
            remandTo: actionOnFail === 'remand' ? remandTo : undefined
        });
    };

    return (
        <div className="space-y-6 py-4">
            <div className="space-y-1.5">
                <Label>ノード名</Label>
                <Input 
                    value={label} 
                    onChange={(e) => setLabel(e.target.value)} 
                    placeholder="例: 見積内容チェック" 
                    disabled={isReadOnly}
                />
            </div>

            <div className="space-y-1.5">
                <Label>チェック対象</Label>
                <Select value={targetSource} onValueChange={setTargetSource} disabled={isReadOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="form">フォーム全体</SelectItem>
                        {formFields.map((field: any) => (
                            <SelectItem key={field.id} value={field.id}>{field.label} ({field.id})</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                    チェック対象とするデータを選択します。
                </p>
            </div>

            <div className="space-y-1.5">
                <Label>チェック基準 (プロンプト)</Label>
                <Textarea 
                    value={criteria} 
                    onChange={(e) => setCriteria(e.target.value)} 
                    placeholder="例: 金額が100万円を超える場合は、詳細な理由が記載されていること。添付ファイルがあること。" 
                    rows={6}
                    disabled={isReadOnly}
                />
                <p className="text-xs text-muted-foreground">
                    AIが判定するための基準を自然言語で記述してください。
                </p>
            </div>

            <div className="space-y-3 p-3 border rounded-md bg-slate-50">
                <div className="space-y-1.5">
                    <Label>チェック失敗時のアクション</Label>
                    <RadioGroup value={actionOnFail} onValueChange={setActionOnFail} className="flex gap-4" disabled={isReadOnly}>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="remand" id="r-remand" />
                            <Label htmlFor="r-remand" className="cursor-pointer">差し戻し (Remand)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="continue" id="r-continue" />
                            <Label htmlFor="r-continue" className="cursor-pointer">続行 (結果のみ記録)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="error" id="r-error" />
                            <Label htmlFor="r-error" className="cursor-pointer">エラー停止</Label>
                        </div>
                    </RadioGroup>
                </div>

                {actionOnFail === 'remand' && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                        <Label>差し戻し先</Label>
                        <Select value={remandTo} onValueChange={setRemandTo} disabled={isReadOnly}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="applicant">申請者 (Start)</SelectItem>
                                <SelectItem value="previous">一つ前のステップ</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            {remandTo === 'applicant' ? '最初（申請者）まで差し戻します。全タスクが無効化されます。' : '直前の完了済みタスクまで差し戻します。'}
                        </p>
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
                {isReadOnly ? (
                    <Button onClick={onCancel}>閉じる</Button>
                ) : (
                    <>
                        <Button variant="outline" onClick={onCancel}>キャンセル</Button>
                        <Button onClick={handleSave}>設定を保存</Button>
                    </>
                )}
            </div>
        </div>
    );
}
