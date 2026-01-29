import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Clock, User, CheckCircle, XCircle, AlertCircle, GitFork } from 'lucide-react';
import DynamicFormRenderer from '@/components/model/form/renderer/DynamicFormRenderer';
import ApprovalHistory from '@/components/model/application/ApprovalHistory';
import FlowVisualization from '@/components/designer/flow/FlowVisualization';
import { UserDisplay } from '@/components/common/UserDisplay';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TaskDetail {
    id: string;
    type: string;
    taskType: string;
    status: string;
    stepId: string;
    assigneeType: string;
    assigneeId: string;
    createdAt: string;
    nodeName?: string;
    application: {
        id: string;
        applicationNumber: number;
        title: string;
        status: string;
        inputData: Record<string, any>;
        createdAt: string;
        applicantId: string;
        applicantInfo?: any;
        currentNodeId?: string;
        completedStepIds?: string[];
        // Direct relations from backend
        formDefinition?: {
            id: string;
            name: string;
            schema: any;
        };
        flowDefinition?: { 
            id: string;
            name: string;
            nodes: any[]; 
            edges: any[]; 
        };
        applicationDefinition: {
            id: number;
            appName: string;
        };
        history?: {
            id: string;
            action: string;
            comment?: string;
            actorId: string;
            actorInfo?: any;
            createdAt: string;
            actedAt?: string;
            nodeName?: string;
            stepId?: string;
        }[];
    };
}

const taskStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    PENDING: { label: '未処理', variant: 'secondary' },
    COMPLETED: { label: '完了', variant: 'default' },
};

export default function TaskDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [comment, setComment] = useState('');
    const [actionInProgress, setActionInProgress] = useState<string | null>(null);
    const [errorDialogOpen, setErrorDialogOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [errorDetail, setErrorDetail] = useState('');
    const [pendingAction, setPendingAction] = useState<{ action: string; inputData: any } | null>(null);
    
    // Ref to capture form data
    const formMethodsRef = useRef<any>(null);

    const { data: task, isLoading, error } = useQuery<TaskDetail>({
        queryKey: ['task', id],
        queryFn: () => api.get<TaskDetail>(`/tasks/${id}`),
        enabled: !!id,
    });

    const actionMutation = useMutation({
        mutationFn: (data: { action: string; comment?: string; inputData?: any }) =>
            api.post(`/workflow/tasks/${id}/complete`, { 
                action: data.action, 
                comment: data.comment,
                inputData: data.inputData
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['task', id] });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            toast.success('タスクを完了しました');
            navigate('/tasks');
        },
        onError: (error: any) => {
            console.error('Action failed:', error);
            const message = error?.response?.data?.message || error?.message || '不明なエラーが発生しました';
            setErrorMessage('処理に失敗しました');
            setErrorDetail(message);
            setErrorDialogOpen(true);
            setActionInProgress(null);
        },
    });

    const handleAction = async (action: string) => {
        if (action === 'REJECT' && !comment.trim()) {
            setErrorMessage('入力エラー');
            setErrorDetail('却下の場合はコメントを入力してください');
            setErrorDialogOpen(true);
            return;
        }

        // Capture current form data if available
        let inputData = undefined;
        if (formMethodsRef.current) {
            // Trigger react-hook-form validation first
            const isValid = await formMethodsRef.current.trigger();
            if (!isValid) {
                setErrorMessage('入力エラー');
                setErrorDetail('入力内容に問題があります。赤字の項目を確認してください。');
                setErrorDialogOpen(true);
                return;
            }
            
            inputData = formMethodsRef.current.getValues();
            
            // Run custom global validation rules
            if (formMethodsRef.current.validateGlobalRules) {
                const result = formMethodsRef.current.validateGlobalRules(inputData);
                if (result.hasErrors) {
                    setErrorMessage('入力エラー');
                    setErrorDetail('入力内容に問題があります。赤字の項目を確認してください。');
                    setErrorDialogOpen(true);
                    return;
                }
                if (result.warnings.length > 0) {
                    // Show warning dialog and wait for confirmation
                    formMethodsRef.current.showWarningDialog(result.warnings, inputData);
                    // Store action for after confirmation
                    setPendingAction({ action, inputData });
                    return;
                }
            }
            
            console.log('Submitting with data:', inputData);
        }

        setActionInProgress(action);
        actionMutation.mutate({ action, comment: comment.trim() || undefined, inputData });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error || !task) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <p className="text-destructive">タスク情報の取得に失敗しました</p>
                <Button variant="outline" onClick={() => navigate(-1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    戻る
                </Button>
            </div>
        );
    }

    const application = task.application;
    const isPending = task.status === 'PENDING';
    const statusConfig = taskStatusConfig[task.status] || { label: task.status, variant: 'outline' as const };

    // Identify current node and permissions
    const currentNode = application.flowDefinition?.nodes?.find((n: any) => n.id === task.stepId);
    const fieldPermissions = currentNode?.data?.fieldPermissions;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <Badge variant={statusConfig.variant} className="text-sm">
                            {statusConfig.label}
                        </Badge>
                        <Badge variant="outline">
                            {task.taskType === 'APPROVAL' ? '承認タスク' : task.taskType}
                        </Badge>
                        <span className="text-muted-foreground">#{application.applicationNumber}</span>
                    </div>
                    <h1 className="text-2xl font-bold">{application.title}</h1>
                    <p className="text-muted-foreground">{application.applicationDefinition?.appName}</p>
                </div>
            </div>

            {/* Info Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <User className="h-4 w-4" />
                            申請者
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <UserDisplay user={application.applicantInfo} fallback={application.applicantId} />
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            申請日時
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="font-medium">
                            {new Date(application.createdAt).toLocaleString('ja-JP')}
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            タスク発生日
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="font-medium">
                            {new Date(task.createdAt).toLocaleString('ja-JP')}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Flow Progress */}
            {application.flowDefinition && (
                <Card className="border-0 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <GitFork className="h-5 w-5" />
                            フロー進捗
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <FlowVisualization
                            nodes={application.flowDefinition.nodes || []}
                            edges={application.flowDefinition.edges || []}
                            currentNodeId={task.status === 'PENDING' ? task.stepId : application.currentNodeId}
                            completedStepIds={application.history?.filter((h: any) => h.action !== 'REMAND').map((h: any) => h.stepId) || []}
                            height={250}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Approval History */}
            {application.history && application.history.length > 0 && (
                <Card className="border-0 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-lg">承認履歴</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ApprovalHistory history={application.history} />
                    </CardContent>
                </Card>
            )}

            {/* Form Content */}
            <Card className="border-0 shadow-md">
                <CardHeader>
                    <CardTitle className="text-lg">申請内容</CardTitle>
                </CardHeader>
                <CardContent>
                    {application.formDefinition?.schema ? (
                        <DynamicFormRenderer
                            schema={application.formDefinition.schema}
                            layouts={application.formDefinition.schema?.['x-layout']}
                            defaultValues={application.inputData}
                            readOnly={!isPending}
                            fieldPermissions={fieldPermissions}
                            currentStepId={task.stepId}
                            onConfirmWarnings={(inputData) => {
                                // Process pending action after user confirms warnings
                                if (pendingAction) {
                                    setActionInProgress(pendingAction.action);
                                    actionMutation.mutate({ 
                                        action: pendingAction.action, 
                                        comment: comment.trim() || undefined, 
                                        inputData 
                                    });
                                    setPendingAction(null);
                                }
                            }}
                            renderActions={(methods) => {
                                formMethodsRef.current = methods;
                                return null;
                            }}
                        />
                    ) : (
                        <div className="space-y-2">
                            {Object.entries(application.inputData || {}).map(([key, value]) => (
                                <div key={key} className="flex gap-4 py-2 border-b last:border-0">
                                    <span className="font-medium text-muted-foreground min-w-32">{key}</span>
                                    <span>{String(value)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Action Area */}
            {isPending && (
                <Card className="border-0 shadow-md bg-muted/30">
                    <CardHeader>
                        <CardTitle className="text-lg">アクション</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="comment">コメント</Label>
                            <Textarea
                                id="comment"
                                placeholder={['input', 'userInput'].includes(task.type) ? "コメントを入力（任意）" : "コメントを入力（却下の場合は必須）"}
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                className="mt-2"
                                rows={3}
                            />
                        </div>
                        <div className="flex gap-3 justify-center pt-4">
                            {!['input', 'userInput'].includes(task.type) && (
                                <>
                                    <Button
                                        variant="destructive"
                                        onClick={() => handleAction('REJECT')}
                                        disabled={!!actionInProgress}
                                    >
                                        {actionInProgress === 'REJECT' ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <XCircle className="h-4 w-4 mr-2" />
                                        )}
                                        却下
                                    </Button>
                                    {(task as any).config?.allowRemand === true && (
                                        <Button
                                            variant="outline"
                                            onClick={() => handleAction('REMAND')}
                                            disabled={!!actionInProgress}
                                        >
                                            {actionInProgress === 'REMAND' ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <AlertCircle className="h-4 w-4 mr-2" />
                                            )}
                                            差戻し
                                        </Button>
                                    )}
                                </>
                            )}
                            <Button
                                onClick={() => handleAction(['input', 'userInput'].includes(task.type) ? 'SUBMIT' : 'APPROVE')}
                                disabled={!!actionInProgress}
                                className={['input', 'userInput'].includes(task.type) ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700"}
                            >
                                {actionInProgress === 'APPROVE' || actionInProgress === 'SUBMIT' ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                )}
                                {['input', 'userInput'].includes(task.type) ? '完了' : '承認'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Error Dialog */}
            <AlertDialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <XCircle className="h-5 w-5" />
                            {errorMessage}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-left whitespace-pre-wrap">
                            {errorDetail}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setErrorDialogOpen(false)}>
                            閉じる
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
