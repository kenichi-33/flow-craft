import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Clock, User, XCircle, GitFork, CornerDownLeft, Lock, Unlock } from 'lucide-react';
import DynamicFormRenderer from '@/components/model/form/renderer/DynamicFormRenderer';
import ApprovalHistory from '@/components/model/application/ApprovalHistory';
import ApprovalAction from '@/components/model/application/ApprovalAction';
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuthStore } from '@/stores/useAuthStore';

interface TaskDetail {
    id: string;
    type: string;
    taskType: string;
    status: string;
    stepId: string;
    assigneeType: string;
    assigneeId: string;
    createdAt: string;
    claimedBy?: string;
    claimedAt?: string;
    claimedByInfo?: any;
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
        workflowTasks?: {
            id: string;
            stepId: string;
            status: string;
            assignedTo?: string;
            assignedToDisplay?: string;
        }[];
        formSchema?: any; // Snapshot
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
    INVALIDATED: { label: '無効', variant: 'outline' },
};

interface RemandableStep {
    stepId: string;
    label: string;
    type: string;
    completedAt: string;
}

export default function TaskDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const [actionInProgress, setActionInProgress] = useState<string | null>(null);
    const [errorDialogOpen, setErrorDialogOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [errorDetail, setErrorDetail] = useState('');
    const [pendingAction, setPendingAction] = useState<{ action: string; inputData: any } | null>(null);
    
    // Remand dialog state
    const [remandDialogOpen, setRemandDialogOpen] = useState(false);
    const [selectedRemandStepId, setSelectedRemandStepId] = useState<string>('');
    
    // Ref to capture form data
    const formMethodsRef = useRef<any>(null);

    const { data: task, isLoading, error } = useQuery<TaskDetail>({
        queryKey: ['task', id],
        queryFn: () => api.get<TaskDetail>(`/tasks/${id}`),
        enabled: !!id,
    });

    // Fetch remandable steps when task is loaded
    const { data: remandableSteps = [] } = useQuery<RemandableStep[]>({
        queryKey: ['remandable-steps', task?.application?.id, id],
        queryFn: () => api.get<RemandableStep[]>(`/workflow/applications/${task?.application?.id}/remandable-steps?taskId=${id}`),
        enabled: !!task?.application?.id && !!id && (task as any)?.config?.allowRemand === true,
    });

    const actionMutation = useMutation({
        mutationFn: (data: { action: string; comment?: string; inputData?: any; remandTargetStepId?: string }) =>
            api.post(`/workflow/tasks/${id}/complete`, { 
                action: data.action, 
                comment: data.comment,
                inputData: data.inputData,
                remandTargetStepId: data.remandTargetStepId,
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

    const claimMutation = useMutation({
        mutationFn: () => api.post(`/tasks/${id}/claim`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['task', id] });
            toast.success('タスクを着手しました');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || '着手に失敗しました');
        }
    });

    const releaseMutation = useMutation({
        mutationFn: () => api.post(`/tasks/${id}/release`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['task', id] });
            toast.success('着手を解除しました');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || '解除に失敗しました');
        }
    });

    const handleAction = async (action: string, actionComment?: string) => {
        const commentToUse = actionComment ?? '';
        if (action === 'REJECT' && !commentToUse.trim()) {
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
        actionMutation.mutate({ action, comment: commentToUse.trim() || undefined, inputData });
    };
    // Handle remand with selected step
    const handleRemandWithStep = () => {
        setRemandDialogOpen(false);
        setActionInProgress('REMAND');
        
        // Handle special '__previous__' value
        let targetStepId = selectedRemandStepId;
        if (targetStepId === '__previous__') {
            targetStepId = getPreviousStepId() || '';
        }
        
        actionMutation.mutate({ 
            action: 'REMAND', 
            comment: undefined, 
            remandTargetStepId: targetStepId || undefined 
        });
    };

    // Get previous step ID from history
    const getPreviousStepId = (): string | undefined => {
        // Find the latest completed task before current step
        if (remandableSteps.length > 0) {
            return remandableSteps[remandableSteps.length - 1].stepId;
        }
        return undefined;
    };

    // Open remand dialog or execute direct remand based on config
    const openRemandDialog = () => {
        const taskConfig = (task as any).config;
        const remandDestination = taskConfig?.remandDestination || 'applicant';
        
        if (remandDestination === 'applicant') {
            // Direct remand to applicant
            setActionInProgress('REMAND');
            actionMutation.mutate({ 
                action: 'REMAND', 
                comment: undefined 
            });
        } else if (remandDestination === 'previous') {
            // Direct remand to previous step
            const previousStepId = getPreviousStepId();
            setActionInProgress('REMAND');
            actionMutation.mutate({ 
                action: 'REMAND', 
                comment: undefined,
                remandTargetStepId: previousStepId 
            });
        } else {
            // 'select' - show dialog
            setSelectedRemandStepId(''); // default to applicant
            setRemandDialogOpen(true);
        }
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

    // Claim Status Logic
    const isClaimedByMe = task.claimedBy === user?.username;
    const isClaimedByOther = task.claimedBy && !isClaimedByMe;
    const isUnclaimed = !task.claimedBy;
    
    // Read-only if claimed by other OR not pending
    const isReadOnly = !isPending || !!isClaimedByOther;

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
                {/* Claim Actions */}
                {isPending && (
                    <div className="flex items-center gap-2">
                        {isUnclaimed && (
                            <Button 
                                onClick={() => claimMutation.mutate()} 
                                disabled={claimMutation.isPending}
                                className="gap-2"
                                variant="outline"
                            >
                                {claimMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Lock className="h-4 w-4"/>}
                                着手する
                            </Button>
                        )}
                        {isClaimedByMe && (
                            <Button 
                                onClick={() => releaseMutation.mutate()} 
                                disabled={releaseMutation.isPending}
                                className="gap-2"
                                variant="secondary"
                            >
                                {releaseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Unlock className="h-4 w-4"/>}
                                着手を解除
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Locked Alert */}
            {isPending && isClaimedByOther && (
                 <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md flex items-center gap-2">
                     <Lock className="h-4 w-4" />
                     <div className="font-medium flex items-center gap-1">
                        現在、他の担当者 (<UserDisplay user={task.claimedByInfo} fallback={task.claimedBy} />) が作業中です。このタスクはロックされています。
                     </div>
                 </div>
            )}
            {/* Self Claimed Alert */}
            {isPending && isClaimedByMe && (
                 <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-md flex items-center gap-2">
                     <Lock className="h-4 w-4" />
                     <span className="font-medium">あなたが着手中です。</span>
                 </div>
            )}


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
                            nodes={(() => {
                                const flowNodes = application.flowDefinition.nodes || [];
                                // Create a map of stepId -> latest task for merging assignee info
                                const latestTaskByStepId = new Map<string, any>();
                                application.workflowTasks?.forEach((t: any) => {
                                    if (!latestTaskByStepId.has(t.stepId)) {
                                        latestTaskByStepId.set(t.stepId, t);
                                    }
                                });
                                // Merge task assignee info into flow nodes
                                return flowNodes.map((node: any) => {
                                    const taskForNode = latestTaskByStepId.get(node.id);
                                    if (taskForNode && taskForNode.assignedToDisplay) {
                                        return {
                                            ...node,
                                            data: {
                                                ...node.data,
                                                assigneeDisplay: taskForNode.assignedToDisplay,
                                            }
                                        };
                                    }
                                    return node;
                                });
                            })()}
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
                    {application.formSchema || application.formDefinition?.schema ? (
                        <DynamicFormRenderer
                            schema={application.formSchema || application.formDefinition?.schema}
                            layouts={application.formSchema?.['x-layout'] || application.formDefinition?.schema?.['x-layout']}
                            defaultValues={application.inputData}
                            readOnly={isReadOnly}
                            fieldPermissions={fieldPermissions}
                            currentStepId={task.stepId}
                            onConfirmWarnings={(inputData) => {
                                // Process pending action after user confirms warnings
                                if (pendingAction) {
                                    setActionInProgress(pendingAction.action);
                                    actionMutation.mutate({ 
                                        action: pendingAction.action, 
                                        comment: undefined, 
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
            {isPending && !isClaimedByOther && (
                <ApprovalAction
                    taskType={task.type}
                    allowRemand={(task as any).config?.allowRemand === true}
                    actionInProgress={actionInProgress}
                    onAction={handleAction}
                    onRemand={openRemandDialog}
                />
            )}

            {/* Remand Step Selection Dialog */}
            <Dialog open={remandDialogOpen} onOpenChange={setRemandDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>差し戻し先を選択</DialogTitle>
                        <DialogDescription>
                            差し戻し先のステップを選択してください。
                        </DialogDescription>
                    </DialogHeader>
                    <RadioGroup value={selectedRemandStepId} onValueChange={setSelectedRemandStepId} className="space-y-3">
                        <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                            <RadioGroupItem value="" id="applicant" />
                            <Label htmlFor="applicant" className="flex-1 cursor-pointer">
                                <span className="font-medium">申請者に差し戻す（最初から）</span>
                                <p className="text-sm text-muted-foreground">申請者が内容を修正して再送信します</p>
                            </Label>
                        </div>
                        {remandableSteps.length > 0 && (
                            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer border-blue-200 bg-blue-50/50">
                                <RadioGroupItem value="__previous__" id="previous" />
                                <Label htmlFor="previous" className="flex-1 cursor-pointer">
                                    <span className="font-medium text-blue-700">一つ前のステップに差し戻す</span>
                                    <p className="text-sm text-blue-600/70">
                                        {remandableSteps[remandableSteps.length - 1]?.label || '前のステップ'}へ戻します
                                    </p>
                                </Label>
                            </div>
                        )}
                        {remandableSteps.map(step => (
                            <div key={step.stepId} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                                <RadioGroupItem value={step.stepId} id={step.stepId} />
                                <Label htmlFor={step.stepId} className="flex-1 cursor-pointer">
                                    <span className="font-medium">{step.label}</span>
                                    <p className="text-sm text-muted-foreground">
                                        {step.type === 'approval' ? '承認タスク' : '入力タスク'} ・ 
                                        {new Date(step.completedAt).toLocaleString('ja-JP')}
                                    </p>
                                </Label>
                            </div>
                        ))}
                    </RadioGroup>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRemandDialogOpen(false)}>キャンセル</Button>
                        <Button onClick={handleRemandWithStep}>
                            <CornerDownLeft className="h-4 w-4 mr-2" />
                            差し戻す
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
