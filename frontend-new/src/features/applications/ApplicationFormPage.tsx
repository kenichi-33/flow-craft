import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import DynamicFormRenderer from '@/components/application/DynamicFormRenderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2, CheckCircle, GitFork } from 'lucide-react';
import { toast } from 'sonner';
import FlowVisualization from '@/components/flow-designer/FlowVisualization';
import { useAuthStore } from '@/stores/useAuthStore';

interface AppDefinition {
    id: string;
    name: string;
    description?: string;
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
}

export default function ApplicationFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuthStore();
    const [title, setTitle] = useState('');
    const [submitSuccess, setSubmitSuccess] = useState(false);
    
    // Determine mode based on URL and ID
    const isEditMode = location.pathname.endsWith('/edit');
    const definitionId = isEditMode ? undefined : id;
    const applicationId = isEditMode ? id : undefined;

    // Fetch published definition from API (New Mode)
    const { data: defFromId, isLoading: isDefLoading } = useQuery<AppDefinition>({
        queryKey: ['application-definition-published', definitionId],
        queryFn: () => api.get<AppDefinition>(`/application-definitions/${definitionId}/published`),
        enabled: !!definitionId,
    });

    // Fetch existing application (Edit Mode)
    const { data: existingApp, isLoading: isAppLoading } = useQuery<any>({
        queryKey: ['application', applicationId],
        queryFn: () => api.get<any>(`/applications/${applicationId}`),
        enabled: !!applicationId,
    });

    // Fetch definition from existing app (Edit Mode)
    const { data: defFromApp, isLoading: isDefFromAppLoading } = useQuery<AppDefinition>({
        queryKey: ['application-definition-published', existingApp?.applicationDefinitionId],
        queryFn: () => api.get<AppDefinition>(`/application-definitions/${existingApp.applicationDefinitionId}/published`),
        enabled: !!existingApp?.applicationDefinitionId,
    });

    const definition = isEditMode ? defFromApp : defFromId;
    const isLoading = isEditMode ? (isAppLoading || isDefFromAppLoading) : isDefLoading;
    const error = isEditMode ? (!existingApp || !defFromApp) : !defFromId;

    const [initialData, setInitialData] = useState<any>(null); // For DynamicForm
    const [dataLoaded, setDataLoaded] = useState(false);

    // Populate initial data when editing
    if (isEditMode && existingApp && !dataLoaded) {
        setTitle(existingApp.title);
        setInitialData(existingApp.inputData);
        setDataLoaded(true);
    }

    // Submit mutation
    const submitMutation = useMutation({
        mutationFn: async (data: { definitionId: string; title: string; inputData: any; formDefinitionId: string; flowDefinitionId: string; applicantId: string }) => {
            if (isEditMode && applicationId) {
                // 1. Update data first
                await api.put(`/applications/${applicationId}`, {
                    title: data.title,
                    inputData: data.inputData,
                });

                // 2. Trigger workflow action based on status
                if (existingApp?.status === 'DRAFT') {
                    // For Draft, explicitly submit to start the workflow
                    return api.post(`/workflow/submit-draft/${applicationId}`, {
                        inputData: data.inputData
                    });
                } else if (existingApp?.status === 'REMANDED') {
                    // For Remanded, use resubmit endpoint
                    return api.post(`/workflow/applications/${applicationId}/resubmit`, {
                        inputData: data.inputData
                    });
                } else {
                     // Normal update (already IN_PROGRESS)
                     return api.put(`/applications/${applicationId}`, {
                        title: data.title,
                        inputData: data.inputData,
                        status: 'IN_PROGRESS'
                     });
                }
            } else {
                return api.post('/workflow/start', {
                    applicationDefinitionId: data.definitionId,
                    title: data.title,
                    inputData: data.inputData
                });
            }
        },
        onSuccess: (result: any) => {
            setSubmitSuccess(true);
            setTimeout(() => {
                navigate(`/applications/${isEditMode ? applicationId : result.id}`);
            }, 2000);
        },
        onError: (error: any) => {
            console.error('Submit failed:', error);
            alert(`申請に失敗しました: ${error.message || '不明なエラー'}`);
        },
    });

    const saveDraftMutation = useMutation({
        mutationFn: (data: { definitionId: string; title: string; inputData: any; formDefinitionId: string; flowDefinitionId: string; applicantId: string }) => {
            if (isEditMode && applicationId) {
                // Update draft
                return api.put(`/applications/${applicationId}`, {
                    title: data.title,
                    inputData: data.inputData,
                    status: 'DRAFT'
                });
            } else {
                return api.post('/workflow/save-draft', {
                    applicationDefinitionId: data.definitionId,
                    title: data.title,
                    inputData: data.inputData,
                    applicantId: data.applicantId
                });
            }
        },
        onSuccess: (result: any) => {
             // Depending on backend response, result might have id
            toast.success('下書き保存しました');
            navigate(`/applications/${isEditMode ? applicationId : (result.id || '')}`);
        },
        onError: (error: any) => {
            console.error('Save draft failed:', error);
            toast.error(`保存に失敗しました: ${error.message || '不明なエラー'}`);
        },
    });

    const handleSaveDraft = (formData: any) => {
        if (!definition) return;
        
        // Title is optional for draft? Legacy implies it might be needed or defaults.
        // Legacy: const title = titleInput?.value || '無題';
        const draftTitle = title.trim() || '無題';

        if (!definition.formDefinition?.id || !definition.flowDefinition?.id) {
             alert('フォームまたはフロー定義が見つかりません');
             return;
        }

        saveDraftMutation.mutate({
            definitionId: definition.id,
            title: draftTitle,
            inputData: formData,
            formDefinitionId: definition.formDefinition.id,
            flowDefinitionId: definition.flowDefinition.id,
            applicantId: user?.username || 'anonymous',
        });
    };

    const handleSubmit = async (formData: any) => {
        if (!definition) return;
        if (!title.trim()) {
            alert('件名を入力してください');
            return;
        }
        
        if (!definition.formDefinition?.id || !definition.flowDefinition?.id) {
             alert('フォームまたはフロー定義が見つかりません');
             return;
        }

        submitMutation.mutate({
            definitionId: definition.id, // Pass as string (UUID)
            title: title.trim(),
            inputData: formData,
            formDefinitionId: definition.formDefinition.id,
            flowDefinitionId: definition.flowDefinition.id,
            applicantId: user?.username || 'anonymous',
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error || !definition) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <p className="text-destructive">アプリケーション定義の取得に失敗しました</p>
                <Button variant="outline" onClick={() => navigate(-1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    戻る
                </Button>
            </div>
        );
    }

    if (submitSuccess) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <CheckCircle className="h-16 w-16 text-emerald-500" />
                <h2 className="text-2xl font-bold">申請を送信しました</h2>
                <p className="text-muted-foreground">申請一覧ページに移動しています...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold">新規申請</h2>
                    <p className="text-muted-foreground">{definition.name}</p>
                </div>
            </div>

            {definition.description && (
                <Card className="border-0 shadow-sm bg-muted/30">
                    <CardContent className="py-4">
                        <p className="text-sm text-muted-foreground">{definition.description}</p>
                    </CardContent>
                </Card>
            )}

            {/* Flow Visualization */}
            {definition.flowDefinition && definition.flowDefinition.nodes?.length > 0 && (
                <Card className="border-0 shadow-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <GitFork className="h-5 w-5" />
                            ワークフロー
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <FlowVisualization
                            nodes={definition.flowDefinition.nodes}
                            edges={definition.flowDefinition.edges || []}
                            height={200}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Title Input */}
            <Card className="border-0 shadow-md">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg">件名</CardTitle>
                    <CardDescription>申請の件名を入力してください（必須）</CardDescription>
                </CardHeader>
                <CardContent>
                    <Input
                        placeholder="例: 2024年1月分 交通費精算"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="max-w-lg"
                    />
                </CardContent>
            </Card>

            {/* Dynamic Form */}
            <Card className="border-0 shadow-md">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg">申請内容</CardTitle>
                </CardHeader>
                <CardContent>
                    <DynamicFormRenderer 
                        schema={definition.formDefinition?.schema} 
                        layouts={definition.formDefinition?.schema?.['x-layout']}
                        defaultValues={initialData}
                        onSubmit={handleSubmit}
                        renderActions={(methods) => (
                            <div className="flex gap-4 justify-center pt-6">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={() => navigate(-1)}
                                    disabled={submitMutation.isPending || saveDraftMutation.isPending}
                                >
                                    キャンセル
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        const formData = (methods as any).getValues(); 
                                        handleSaveDraft(formData);
                                    }}
                                    disabled={submitMutation.isPending || saveDraftMutation.isPending}
                                >
                                    下書き保存
                                </Button>
                                <Button 
                                    type="submit" 
                                    size="lg" 
                                    className="px-8"
                                    disabled={submitMutation.isPending || saveDraftMutation.isPending}
                                >
                                    {submitMutation.isPending ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            送信中...
                                        </>
                                    ) : (
                                        '申請する'
                                    )}
                                </Button>
                            </div>
                        )}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
