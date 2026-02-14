import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { UserDisplay } from '@/components/common/UserDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Clock, User, FileText, CheckCircle, XCircle, AlertCircle, GitFork, RotateCcw, Lock, Shield, Edit, FileX, Bot } from 'lucide-react';
import DynamicFormRenderer from '@/components/model/form/renderer/DynamicFormRenderer';
import ApprovalHistory from '@/components/model/application/ApprovalHistory';
import TaskList from '@/components/model/application/TaskList';
import FlowVisualization from '@/components/designer/flow/FlowVisualization';
import { PerformanceTimeline } from '@/features/applications/components/PerformanceTimeline';
import { useAuthStore } from '@/stores/useAuthStore';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ApplicationDetail {
    id: string;
    applicationNumber: number;
    title: string;
    status: string;
    inputData: Record<string, any>;
    createdAt: string;
    updatedAt: string;
    applicantId: string;
    applicantInfo?: any;
    currentNodeId?: string;
    completedStepIds?: string[];
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
        name?: string;
        appName: string;
        description?: string;
    };
    workflowTasks?: {
        id: string;
        stepId: string;
        type: string;
        status: string;
        assignedTo?: string;
        assignedToDisplay?: string;
        assignedToInfo?: any;
        claimedBy?: string;
        claimedAt?: string;
        claimedByInfo?: any;
        result?: any;
        error?: string;
        createdAt: string;
        updatedAt?: string;
        completedAt?: string;
        history?: {
            id: string;
            status: string;
            error?: string;
            executedAt: string;
        }[];
    }[];
    flowNodes?: any[];
    flowEdges?: any[];
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
    childApplications?: any[];
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
    DRAFT: { label: '下書き', variant: 'outline', icon: FileText },
    IN_PROGRESS: { label: '進行中', variant: 'secondary', icon: Clock },
    APPROVED: { label: '完了', variant: 'default', icon: CheckCircle },
    REJECTED: { label: '却下', variant: 'destructive', icon: XCircle },
    REMANDED: { label: '差戻し', variant: 'destructive', icon: AlertCircle },
    CANCELED: { label: '取下げ', variant: 'outline', icon: XCircle },
    COMPLETED: { label: '完了', variant: 'default', icon: CheckCircle },
};

export default function ApplicationDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const [retryDialogOpen, setRetryDialogOpen] = useState(false);
    const [retryTargetId, setRetryTargetId] = useState<string | null>(null);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);

    const { data: application, isLoading, error } = useQuery<ApplicationDetail>({
        queryKey: ['application', id],
        queryFn: () => api.get<ApplicationDetail>(`/applications/${id}`),
        enabled: !!id,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error || !application) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <p className="text-destructive">申請情報の取得に失敗しました</p>
                <Button variant="outline" onClick={() => navigate(-1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    戻る
                </Button>
            </div>
        );
    }

    const status = statusConfig[application.status] || { label: application.status, variant: 'outline' as const, icon: FileText };
    const StatusIcon = status.icon;






    const handleRetry = (taskId: string) => {
        setRetryTargetId(taskId);
        setRetryDialogOpen(true);
    };

    const confirmRetry = async () => {
        if (!retryTargetId) return;
        try {
            await api.post(`/workflow/tasks/${retryTargetId}/retry`, {});
            queryClient.invalidateQueries({ queryKey: ['application', id] });
            toast.success('再実行リクエストを送信しました');
        } catch (e) {
            console.error(e);
            toast.error('再実行に失敗しました');
        } finally {
            setRetryDialogOpen(false);
            setRetryTargetId(null);
        }
    };

    const confirmCancel = async () => {
        try {
            await api.post(`/applications/${id}/cancel`, {});
            queryClient.invalidateQueries({ queryKey: ['application', id] });
            toast.success('申請を取り下げました');
        } catch (e) {
            console.error(e);
            toast.error('取下げに失敗しました');
        } finally {
            setCancelDialogOpen(false);
        }
    };



    const confirmWithdraw = async () => {
        try {
            await api.post(`/applications/${id}/withdraw`, {});
            queryClient.invalidateQueries({ queryKey: ['application', id] });
            toast.success('申請を引き戻しました');
        } catch (e) {
            console.error(e);
            toast.error('引き戻しに失敗しました');
        } finally {
            setWithdrawDialogOpen(false);
        }
    };

    const handleRelease = async (taskId: string) => {
        try {
            await api.post(`/tasks/${taskId}/release`, {});
            queryClient.invalidateQueries({ queryKey: ['application', id] });
            toast.success('タスクの担当を解除しました');
        } catch (e: any) {
            console.error(e);
            toast.error(e?.response?.data?.message || '解除に失敗しました');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <Badge variant={status.variant} className="text-sm">
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {status.label}
                        </Badge>
                        <Badge variant="outline" className="text-sm bg-muted/50">
                            アプリ: {application.applicationDefinition?.appName || application.applicationDefinition?.name}
                        </Badge>
                        <span className="text-muted-foreground text-sm">#{application.applicationNumber}</span>
                    </div>
                    <h1 className="text-2xl font-bold">{application.title}</h1>
                </div>
                {user?.username === application.applicantId && application.status === 'IN_PROGRESS' && (
                    <div className="flex gap-2">
                         <Button variant="outline" size="sm" onClick={() => setWithdrawDialogOpen(true)}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            引き戻し
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setCancelDialogOpen(true)}>
                            <FileX className="mr-2 h-4 w-4" />
                            取下げ
                        </Button>
                    </div>
                )}
                {user?.username === application.applicantId && application.status === 'DRAFT' && (
                    <Button variant="default" size="sm" onClick={() => {
                        const conversationId = application.inputData?.__conversationId;
                        const flowId = application.flowDefinition?.id;
                        if (conversationId && flowId) {
                             navigate(`/chat/${flowId}/${conversationId}`);
                        } else {
                             navigate(`/applications/${id}/edit`);
                        }
                    }}>
                        <Edit className="mr-2 h-4 w-4" />
                        編集する
                    </Button>
                )}
            </div>

            {/* Pending Tasks Section (Legacy Style) */}
            {application.workflowTasks?.some(t => ['approval', 'input', 'userInput'].includes(t.type) && t.status === 'PENDING') && (
                <Card className="border-l-4 border-l-blue-500 shadow-md">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-500" />
                            現在対応待ちのタスク
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {application.workflowTasks.filter(t => ['approval', 'input', 'userInput'].includes(t.type) && t.status === 'PENDING').map(task => {
                            // Backend now provides isExecutable flag based on reliable permission checks
                            const isAssigned = (task as any).isExecutable;
                            
                            const stepNode = application.flowDefinition?.nodes?.find((n: any) => n.id === task.stepId);
                            // UserInputNode uses 'title' in data, not 'label'. Fallback to type-based name.
                            const stepLabel = stepNode?.data?.label || stepNode?.data?.title || (['input', 'userInput'].includes(task.type) ? '入力タスク' : task.stepId);
                            const isInput = ['input', 'userInput'].includes(task.type);
                            const isClaimedByMe = task.claimedBy === user?.username;
                            const isClaimedByOther = task.claimedBy && !isClaimedByMe;
                            
                            return (
                                <div key={task.id} className="flex items-center justify-between p-3 bg-background rounded-lg border shadow-sm">
                                    <div>
                                        <div className="font-semibold text-sm">ステップ: {stepLabel}</div>
                                        <div className="text-xs text-muted-foreground mt-1">

                                            担当者: {task.claimedBy ? (
                                                <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                                                    <Shield className="h-3 w-3" /> 
                                                    <UserDisplay user={task.claimedByInfo} fallback={task.claimedBy} />
                                                </span>
                                            ) : task.assignedToInfo ? (
                                                <UserDisplay user={task.assignedToInfo} fallback={task.assignedToDisplay} />
                                            ) : (
                                                task.assignedTo?.split(',').map(s => {
                                                    const t = s.trim();
                                                    if (t.startsWith('user:')) return t.substring(5);
                                                    if (t.startsWith('role:')) return `ロール: ${t.substring(5)}`;
                                                    if (t.startsWith('group:')) return `グループ: ${t.substring(6)}`;
                                                    if (t === 'applicant') return '申請者';
                                                    return t;
                                                }).join(', ') || '未指定'
                                            )}
                                        </div>
                                    </div>
                                    {isAssigned && (
                                        isClaimedByOther ? (
                                            <Button disabled className="gap-2 opacity-70" variant="outline" size="sm">
                                                <Lock className="h-3 w-3" /> ロック中
                                            </Button>
                                        ) : isClaimedByMe ? (
                                            <div className="flex gap-2">
                                                <Button 
                                                    onClick={() => handleRelease(task.id)}
                                                    variant="outline"
                                                    size="sm"
                                                    title="担当を解除して他の人が着手できるようにします"
                                                >
                                                    解除
                                                </Button>
                                                <Button 
                                                    onClick={() => navigate(`/tasks/${task.id}`)}
                                                    className="gap-2"
                                                    size="sm"
                                                    variant="secondary"
                                                >
                                                    <Edit className="h-3 w-3" />
                                                    再開する
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button 
                                                onClick={() => navigate(`/tasks/${task.id}`)}
                                                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm gap-2"
                                                size="sm"
                                                variant="default"
                                            >
                                                {isInput ? '入力画面へ' : '承認画面へ'}
                                            </Button>
                                        )
                                    )}
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {/* Info Cards */}


            {/* Child Applications Section */}
            {/* ... (existing child app section) ... */}

            {application.childApplications && application.childApplications.length > 0 && (
                <div className="space-y-4">
                     {/* ... (existing child app code) ... */}
                </div>
            )}
            
            {/* Chat History Section */}
            {application.inputData && application.inputData.__conversationId && (
                <ChatHistorySection conversationId={application.inputData.__conversationId} />
            )}

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
                            更新日時
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="font-medium">
                            {new Date(application.updatedAt).toLocaleString('ja-JP')}
                        </p>
                    </CardContent>
                </Card>
            </div>



            {/* Flow Progress */}
            {(application.flowNodes || application.flowDefinition) && (
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
                                const flowNodes = application.flowNodes || application.flowDefinition?.nodes || [];
                                // Create a map of stepId -> latest task for merging assignee info
                                const latestTaskByStepId = new Map<string, any>();
                                application.workflowTasks?.forEach((t: any) => {
                                    if (!latestTaskByStepId.has(t.stepId)) {
                                        latestTaskByStepId.set(t.stepId, t);
                                    }
                                });
                                // Merge task assignee info into flow nodes
                                return flowNodes.map((node: any) => {
                                    const task = latestTaskByStepId.get(node.id);
                                    if (task && task.assignedToDisplay) {
                                        return {
                                            ...node,
                                            data: {
                                                ...node.data,
                                                assigneeDisplay: task.assignedToDisplay,
                                            }
                                        };
                                    }
                                    return node;
                                });
                            })()}
                            edges={application.flowEdges || application.flowDefinition?.edges || []}
                            currentNodeId={
                                (() => {
                                    // Group tasks by stepId to find the latest one
                                    const latestTasks = new Map<string, any>();
                                    // tasks are ordered by desc, so first one is latest
                                    application.workflowTasks?.forEach((t: any) => {
                                        if (!latestTasks.has(t.stepId)) latestTasks.set(t.stepId, t);
                                    });

                                    // If latest task is PENDING, it's a current node
                                    const pendingStepIds = Array.from(latestTasks.values())
                                        .filter(t => ['approval', 'input', 'userInput'].includes(t.type) && t.status === 'PENDING')
                                        .map(t => t.stepId);
                                    
                                    // Also consider application.currentNodeId (mostly for non-task nodes or initial state)
                                    // But if we have tasks, they prioritize.
                                    if (pendingStepIds.length > 0) return pendingStepIds;
                                    return application.currentNodeId ? [application.currentNodeId] : [];
                                })()
                            }
                            completedStepIds={(() => {
                                const completedTasks = application.workflowTasks?.filter(t => t.status === 'COMPLETED').map(t => t.stepId) || [];
                                const historySteps = application.history?.filter(h => h.stepId).map(h => h.stepId!) || [];
                                
                                const startNode = (application.flowNodes || application.flowDefinition?.nodes || []).find((n: any) => n.type === 'start');
                                
                                if (application.status === 'DRAFT') {
                                    return [];
                                }
                                
                                // Merge tasks and history (Branch/Parallel use history)
                                const allCompleted = new Set([...completedTasks, ...historySteps]);

                                // Include start node if not draft
                                if (startNode) {
                                  allCompleted.add(startNode.id);
                                }
                                return Array.from(allCompleted);
                            })()}
                            failedStepIds={
                                (() => {
                                    const latestTasks = new Map<string, any>();
                                    application.workflowTasks?.forEach((t: any) => {
                                        if (!latestTasks.has(t.stepId)) latestTasks.set(t.stepId, t);
                                    });
                                    // If latest task is FAILED, mark as failed step
                                    return Array.from(latestTasks.values())
                                        .filter(t => t.status === 'FAILED')
                                        .map(t => t.stepId);
                                })()
                            }
                            height={250}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Performance Timeline */}
            {application.workflowTasks && application.workflowTasks.length > 0 && (
                <PerformanceTimeline 
                    tasks={application.workflowTasks} 
                    flowNodes={application.flowNodes || application.flowDefinition?.nodes}
                />
            )}

            {/* Task List */}
            <Card className="border-0 shadow-md">
                <CardHeader>
                    <CardTitle className="text-lg">タスク一覧</CardTitle>
                </CardHeader>
                <CardContent>
                    <TaskList 
                        workflowTasks={application.workflowTasks}
                        flowNodes={application.flowNodes || application.flowDefinition?.nodes}
                        flowEdges={application.flowEdges || application.flowDefinition?.edges}
                        applicationInfo={application as any}
                        history={application.history}
                    />
                </CardContent>
            </Card>

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

            {/* System History */}
            {application.workflowTasks && application.workflowTasks.filter(t => !['approval', 'input', 'userInput', 'start', 'end', 'branch', 'parallel', 'join', 'delay'].includes(t.type)).length > 0 && (
                <Card className="border-0 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-lg">システム処理履歴</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {application.workflowTasks.filter(t => !['approval', 'input', 'userInput', 'start', 'end', 'branch', 'parallel', 'join', 'delay'].includes(t.type)).map((task) => (
                            <div key={task.id} className={`p-4 rounded-lg border ${task.status === 'FAILED' ? 'bg-red-50/50 border-red-100' : 'bg-green-50/50 border-green-100'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="font-semibold text-sm">
                                        {task.type === 'apiCall' ? 'API実行' : 
                                         task.type === 'llmCall' ? 'AI処理' : 
                                         task.type === 'sendEmail' ? 'メール送信' : 
                                         task.type === 'slack' ? 'Slack通知' : 
                                         task.type === 'updateRecord' ? 'レコード更新' : 
                                         task.type === 'setVariable' ? '変数設定' : 
                                         task.type}
                                    </div>
                                    <Badge variant={task.status === 'COMPLETED' ? 'default' : task.status === 'FAILED' ? 'destructive' : 'secondary'}>
                                        {task.status === 'COMPLETED' ? '成功' : task.status === 'FAILED' ? '失敗' : task.status}
                                    </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground mb-2">
                                    実行日時: {new Date(task.createdAt).toLocaleString('ja-JP')}
                                </div>
                                {task.error && (
                                    <div className="mt-2 p-2 bg-red-100/50 rounded text-xs text-red-600 break-all">
                                        {task.error}
                                    </div>
                                )}
                                {task.result && (
                                    <div className="mt-2 p-2 bg-blue-50/50 rounded text-xs">
                                        <div className="font-semibold mb-1">レスポンス:</div>
                                        <pre className="whitespace-pre-wrap font-mono max-h-40 overflow-auto">
                                            {JSON.stringify(task.result, null, 2)}
                                        </pre>
                                    </div>
                                )}
                                
                                {task.status === 'FAILED' && (
                                    <div className="mt-2 flex justify-end">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleRetry(task.id)}
                                            className="text-xs h-8"
                                            color="destructive"
                                        >
                                            <RotateCcw className="h-3 w-3 mr-1" />
                                            再実行
                                        </Button>
                                    </div>
                                )}

                                {task.history && task.history.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                                        <div className="text-xs font-semibold mb-2">再試行履歴 ({task.history.length}件)</div>
                                        <div className="space-y-2">
                                            {task.history.map((h) => (
                                                <div key={h.id} className="flex items-center gap-2 text-xs">
                                                    <Badge variant={h.status === 'COMPLETED' ? 'default' : 'destructive'} className="text-[10px] h-5 px-1">
                                                        {h.status === 'COMPLETED' ? '成功' : '失敗'}
                                                    </Badge>
                                                    <span className="text-muted-foreground">
                                                        {new Date(h.executedAt).toLocaleString('ja-JP')}
                                                    </span>
                                                    {h.error && <span className="text-red-500 truncate max-w-[200px]">{h.error}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
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
                            readOnly={true}
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
            {/* Retry Confirmation Dialog */}
            <AlertDialog open={retryDialogOpen} onOpenChange={setRetryDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>システムタスクの再実行</AlertDialogTitle>
                        <AlertDialogDescription>
                            このタスクを再実行してもよろしいですか？
                            <br />
                            <span className="text-xs text-muted-foreground">※ 以前の実行結果は履歴として保持されます。</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmRetry}>再実行する</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Cancel Confirmation Dialog */}
            <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>申請の取下げ</AlertDialogTitle>
                        <AlertDialogDescription>
                            この申請を取り下げますか？この操作は取り消せません。
                            <br />
                            <span className="text-xs text-muted-foreground">※ ステータスが「取下げ」となります。</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmCancel} className="bg-destructive hover:bg-destructive/90">取り下げる</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Withdraw Confirmation Dialog */}
            <AlertDialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>申請の引き戻し</AlertDialogTitle>
                        <AlertDialogDescription>
                            申請を下書きに戻しますか？
                            <br />
                            <span className="text-xs text-muted-foreground">
                                ※ 進行中のタスクはキャンセルされ、既存の承認履歴は無効になります。<br/>
                                ※ 下書きに戻り、再編集・再申請が可能になります。
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmWithdraw}>引き戻す</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

import { MessageBubble } from '@/components/chat/ChatInterface';
import type { Message } from '@/hooks/useAiConversation';

function ChatHistorySection({ conversationId }: { conversationId: string }) {
    const { data: session, isLoading } = useQuery({
        queryKey: ['chatSession', conversationId],
        queryFn: () => api.get<any>(`/ai/chat/${conversationId}`),
    });

    if (isLoading) return <div className="text-sm text-muted-foreground p-4">チャット履歴を読み込み中...</div>;
    if (!session || !session.history) return null;

    const messages = (session.history as any[]).map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
    }));

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    チャット履歴
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto pr-2">
                    {messages.map((msg: Message) => (
                        <MessageBubble key={msg.id} message={msg} agentName={session.agentName || 'AIアシスタント'} />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
