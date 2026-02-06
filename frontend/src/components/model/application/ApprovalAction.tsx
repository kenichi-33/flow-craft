import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, CornerDownLeft } from 'lucide-react';

export interface ApprovalActionProps {
    taskType: string; // 'approval' | 'input' | 'userInput'
    allowRemand?: boolean;
    actionInProgress?: string | null; // 'APPROVE' | 'REJECT' | 'REMAND' | 'SUBMIT' | null
    onAction: (action: string, comment: string) => void;
    onRemand?: () => void; // Opens remand dialog
    disabled?: boolean;
}

export default function ApprovalAction({ 
    taskType, 
    allowRemand, 
    actionInProgress, 
    onAction,
    onRemand,
    disabled = false
}: ApprovalActionProps) {
    const [comment, setComment] = useState('');

    const isInputType = ['input', 'userInput'].includes(taskType);
    const isPending = !!actionInProgress || disabled;

    const handleApproveOrSubmit = () => {
        if (disabled) return;
        onAction(isInputType ? 'SUBMIT' : 'APPROVE', comment);
    };

    const handleReject = () => {
        if (disabled) return;
        onAction('REJECT', comment);
    };

    const handleRemand = () => {
        if (onRemand && !disabled) {
            onRemand();
        }
    };

    return (
        <Card className={`border-0 shadow-md ${disabled ? 'bg-muted/50 opacity-80' : 'bg-muted/30'}`}>
            <CardHeader>
                <CardTitle className="text-lg">アクション {disabled && <span className="text-sm font-normal text-muted-foreground ml-2">(着手が必要です)</span>}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label htmlFor="approval-comment">コメント</Label>
                    <Textarea
                        id="approval-comment"
                        placeholder={disabled ? "タスクを着手すると入力できます" : (isInputType ? "コメントを入力（任意）" : "コメントを入力（却下の場合は必須）")}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="mt-2"
                        rows={3}
                        disabled={disabled || !!actionInProgress}
                    />
                </div>
                <div className="flex gap-3 justify-center pt-4">
                    {!isInputType && (
                        <>
                            <Button
                                variant="destructive"
                                onClick={handleReject}
                                disabled={isPending}
                            >
                                {actionInProgress === 'REJECT' ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <XCircle className="h-4 w-4 mr-2" />
                                )}
                                却下
                            </Button>
                            {allowRemand && onRemand && (
                                <Button
                                    variant="outline"
                                    onClick={handleRemand}
                                    disabled={isPending}
                                >
                                    {actionInProgress === 'REMAND' ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <CornerDownLeft className="h-4 w-4 mr-2" />
                                    )}
                                    差し戻し
                                </Button>
                            )}
                        </>
                    )}
                    <Button
                        onClick={handleApproveOrSubmit}
                        disabled={isPending}
                        className={isInputType ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700"}
                    >
                        {actionInProgress === 'APPROVE' || actionInProgress === 'SUBMIT' ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        {isInputType ? '完了' : '承認'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
