import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2, Play, CheckCircle2, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function MasterConnectorEditorPage() {
    const { id } = useParams();
    const isNew = !id;
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        type: 'rest',
        isShared: true,
        // Config
        config: {
            url: '',
            method: 'GET',
            authType: 'none', // none, basic, bearer, apikey
            authUsername: '',
            authPassword: '',
            authToken: '',
            authApiKeyName: '',
            authApiKeyValue: '',
            authApiKeyIn: 'header', // header, query
            headers: {} as Record<string, string>,
            queryParamName: 'q'
        },
        // Mapping
        mapping: {
            rootPath: '', // e.g. "data.items"
            label: 'name',
            value: 'id',
            metadata: [] as { key: string; path: string }[] 
        }
    });

    const [testQuery, setTestQuery] = useState('');
    const [testResult, setTestResult] = useState<any>(null);
    const [isTesting, setIsTesting] = useState(false);

    // Fetch existing data
    const { data: existingData, isLoading } = useQuery({
        queryKey: ['master-connector', id],
        queryFn: async () => {
            const res = await api.get<any>(`/master-connectors/${id}`);
            return res;
        },
        enabled: !isNew,
    });

    useEffect(() => {
        if (existingData) {
            // Transform metadata object to array for UI
            const metadataArray = Object.entries(existingData.mapping?.metadata || {}).map(([key, path]) => ({ key, path: path as string }));
            
            setFormData({
                name: existingData.name,
                description: existingData.description || '',
                type: existingData.type,
                isShared: existingData.isShared,
                config: {
                    ...formData.config,
                    ...existingData.config,
                    headers: existingData.config.headers || {}
                },
                mapping: {
                     ...formData.mapping,
                     ...existingData.mapping,
                     metadata: metadataArray
                }
            });
        }
    }, [existingData]);

    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const payload = {
                ...data,
                mapping: {
                    ...data.mapping,
                    // Transform metadata array back to object
                    metadata: data.mapping.metadata.reduce((acc: any, item: any) => {
                        if (item.key && item.path) acc[item.key] = item.path;
                        return acc;
                    }, {})
                }
            };

            if (isNew) {
                return api.post('/master-connectors', payload);
            } else {
                return api.patch(`/master-connectors/${id}`, payload);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['master-connectors'] });
            toast.success('保存しました');
            navigate('/admin/connectors');
        },
        onError: (err) => {
            console.error(err);
            toast.error('保存に失敗しました');
        }
    });

    const handleTest = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            // Always use dry-run test to check current settings (saved or unsaved)
            // Need to transform metadata array to object format expected by backend
            const mappingPayload = {
                ...formData.mapping,
                metadata: formData.mapping.metadata.reduce((acc: any, item: any) => {
                    if (item.key && item.path) acc[item.key] = item.path;
                    return acc;
                }, {})
            };
            
            const res = await api.post('/master-connectors/test', {
                config: formData.config,
                mapping: mappingPayload,
                query: testQuery
            });
            
            setTestResult({ success: true, data: res });
        } catch (e: any) {
            setTestResult({ success: false, error: e.message || 'Error occurred' });
        } finally {
            setIsTesting(false);
        }
    };

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

    const updateConfig = (key: string, value: any) => setFormData(prev => ({ ...prev, config: { ...prev.config, [key]: value } }));
    const updateMapping = (key: string, value: any) => setFormData(prev => ({ ...prev, mapping: { ...prev.mapping, [key]: value } }));

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-6 pb-20">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={() => navigate('/admin/connectors')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-xl font-bold">{isNew ? '新規コネクタ作成' : formData.name}</h1>
                    <p className="text-sm text-muted-foreground">{isNew ? '新しい外部データ連携設定を作成します' : '設定を編集します'}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending} className="gap-2">
                        {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        保存
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
                <div className="col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>基本設定</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>コネクタ名 *</Label>
                                    <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="例: 顧客検索API" />
                                </div>
                                <div className="space-y-2">
                                    <Label>タイプ</Label>
                                    <Select value={formData.type} onValueChange={(v) => setFormData({...formData, type: v})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="rest">REST API</SelectItem>
                                            <SelectItem value="sql" disabled>SQL Database (Coming Soon)</SelectItem>
                                            <SelectItem value="csv" disabled>CSV Upload (Coming Soon)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>説明</Label>
                                <Textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="用途や接続先の説明..." />
                            </div>
                            <div className="flex items-center gap-2">
                                <Checkbox id="isShared" checked={formData.isShared} onCheckedChange={(c) => setFormData({...formData, isShared: !!c})} />
                                <Label htmlFor="isShared">すべてのアプリ作成者に公開する</Label>
                            </div>
                        </CardContent>
                    </Card>

                    <Tabs defaultValue="connection">
                        <TabsList className="w-full justify-start">
                            <TabsTrigger value="connection">接続設定</TabsTrigger>
                            <TabsTrigger value="mapping">データマッピング</TabsTrigger>
                            <TabsTrigger value="test">テスト実行</TabsTrigger>
                        </TabsList>

                        <TabsContent value="connection" className="space-y-4 pt-4">
                            <Card>
                                <CardHeader><CardTitle>リクエスト設定</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                        <Select value={formData.config.method} onValueChange={(v) => updateConfig('method', v)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="GET">GET</SelectItem>
                                                <SelectItem value="POST">POST</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input value={formData.config.url} onChange={(e) => updateConfig('url', e.target.value)} placeholder="https://api.example.com/v1/customers" />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>検索クエリパラメータ名</Label>
                                        <Input value={formData.config.queryParamName} onChange={(e) => updateConfig('queryParamName', e.target.value)} placeholder="q (e.g. ?q=keyword)" />
                                        <p className="text-xs text-muted-foreground">入力されたキーワードを渡すパラメータ名。空文字の場合、パラメータ付与を行いません。</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader><CardTitle>認証設定</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>認証タイプ</Label>
                                        <Select value={formData.config.authType} onValueChange={(v) => updateConfig('authType', v)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">なし</SelectItem>
                                                <SelectItem value="basic">Basic Auth</SelectItem>
                                                <SelectItem value="bearer">Bearer Token</SelectItem>
                                                <SelectItem value="apikey">API Key</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {formData.config.authType === 'basic' && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Username</Label>
                                                <Input value={formData.config.authUsername} onChange={(e) => updateConfig('authUsername', e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Password</Label>
                                                <Input type="password" value={formData.config.authPassword} onChange={(e) => updateConfig('authPassword', e.target.value)} />
                                            </div>
                                        </div>
                                    )}

                                    {formData.config.authType === 'bearer' && (
                                        <div className="space-y-2">
                                            <Label>Token</Label>
                                            <Input type="password" value={formData.config.authToken} onChange={(e) => updateConfig('authToken', e.target.value)} />
                                        </div>
                                    )}

                                    {formData.config.authType === 'apikey' && (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Key Name</Label>
                                                    <Input value={formData.config.authApiKeyName} onChange={(e) => updateConfig('authApiKeyName', e.target.value)} placeholder="X-API-KEY" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Value</Label>
                                                    <Input type="password" value={formData.config.authApiKeyValue} onChange={(e) => updateConfig('authApiKeyValue', e.target.value)} />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Send In</Label>
                                                <Select value={formData.config.authApiKeyIn} onValueChange={(v) => updateConfig('authApiKeyIn', v)}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="header">Header</SelectItem>
                                                        <SelectItem value="query">Query Parameter</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="mapping" className="space-y-4 pt-4">
                             <Card>
                                <CardHeader>
                                    <CardTitle>レスポンス正規化設定</CardTitle>
                                    <CardDescription>
                                        APIレスポンスから必要なデータを抽出するための設定です。ドット記法（例: data.users）で指定してください。
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>ルートパス (Root Path)</Label>
                                        <Input value={formData.mapping.rootPath} onChange={(e) => updateMapping('rootPath', e.target.value)} placeholder="例: data.results (空欄の場合はルート)" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>ラベル (表示名) のキー</Label>
                                            <Input value={formData.mapping.label} onChange={(e) => updateMapping('label', e.target.value)} placeholder="name" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>値 (ID) のキー</Label>
                                            <Input value={formData.mapping.value} onChange={(e) => updateMapping('value', e.target.value)} placeholder="id" />
                                        </div>
                                    </div>
                                </CardContent>
                             </Card>
                             
                             <Card>
                                <CardHeader>
                                    <CardTitle>メタデータ (自動転記用データ)</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {formData.mapping.metadata.map((item, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <Input 
                                                value={item.key} 
                                                onChange={(e) => {
                                                    const newMeta = [...formData.mapping.metadata];
                                                    newMeta[idx].key = e.target.value;
                                                    updateMapping('metadata', newMeta);
                                                }}
                                                placeholder="キー (例: email)"
                                                className="flex-1"
                                            />
                                            <span className="text-muted-foreground">←</span>
                                            <Input 
                                                value={item.path} 
                                                onChange={(e) => {
                                                    const newMeta = [...formData.mapping.metadata];
                                                    newMeta[idx].path = e.target.value;
                                                    updateMapping('metadata', newMeta);
                                                }}
                                                placeholder="パス (例: contact.email)"
                                                className="flex-1"
                                            />
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => {
                                                    const newMeta = [...formData.mapping.metadata];
                                                    newMeta.splice(idx, 1);
                                                    updateMapping('metadata', newMeta);
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button 
                                        variant="outline" 
                                        onClick={() => {
                                            updateMapping('metadata', [...formData.mapping.metadata, { key: '', path: '' }]);
                                        }}
                                        className="gap-2"
                                    >
                                        <Plus className="h-4 w-4" />
                                        メタデータ追加
                                    </Button>
                                </CardContent>
                             </Card>
                        </TabsContent>

                        <TabsContent value="test" className="space-y-4 pt-4">
                            <Card>
                                <CardHeader><CardTitle>接続テスト</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex gap-2">
                                        <Input 
                                            value={testQuery} 
                                            onChange={(e) => setTestQuery(e.target.value)} 
                                            placeholder="検索キーワード..." 
                                        />
                                        <Button onClick={handleTest} disabled={isTesting}>
                                            {isTesting ? <Loader2 className="animate-spin" /> : <Play className="h-4 w-4" />}
                                        </Button>
                                    </div>

                                    {testResult && (
                                        <div className={`p-4 rounded border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                {testResult.success ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-red-600" />}
                                                <span className={`font-semibold ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                                                    {testResult.success ? '成功' : 'エラー'}
                                                </span>
                                            </div>
                                            <pre className="text-xs overflow-auto max-h-60 bg-white p-2 rounded">
                                                {JSON.stringify(testResult.data || testResult.error, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">ヘルプ</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-4 text-muted-foreground">
                            <p>
                                <strong>レスポンス正規化について</strong><br />
                                外部APIのレスポンス形式を、FlowCraftが扱える形式に変換します。
                            </p>
                            <p>
                                <strong>必須フィールド:</strong>
                                <ul className="list-disc pl-4 mt-1 space-y-1">
                                    <li>Label: 画面に表示される名称</li>
                                    <li>Value: システムに保存されるID</li>
                                </ul>
                            </p>
                            <p>
                                <strong>JSONPath (ドット記法):</strong><br />
                                配列やオブジェクトの中身を指定します。<br />
                                例: <code>data.results</code>
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
