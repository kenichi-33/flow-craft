import { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Globe, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Editor from '@monaco-editor/react';

// Key-Value Editor Component (Copied from APICallNode)
function KeyValueEditor({ value, onChange, placeholderKey, placeholderValue, disabled = false }: { value: string; onChange: (v: string) => void; placeholderKey: string; placeholderValue: string; disabled?: boolean }) {
    const [rows, setRows] = useState<{ key: string; value: string }[]>([]);

    useEffect(() => {
        try {
            if (!value) { setRows([]); return; }
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            setRows(Object.entries(parsed).map(([key, val]) => ({ key, value: String(val) })));
        } catch { setRows([]); }
    }, [value]);

    const updateRow = (index: number, field: 'key' | 'value', val: string) => {
        if (disabled) return;
        const newRows = [...rows];
        newRows[index] = { ...newRows[index], [field]: val };
        setRows(newRows);
        emitChange(newRows);
    };

    const addRow = () => { if (disabled) return; const newRows = [...rows, { key: '', value: '' }]; setRows(newRows); emitChange(newRows); };
    const removeRow = (index: number) => { if (disabled) return; const newRows = rows.filter((_, i) => i !== index); setRows(newRows); emitChange(newRows); };
    const emitChange = (currentRows: { key: string; value: string }[]) => {
        const obj = currentRows.reduce((acc, row) => { if (row.key) acc[row.key] = row.value; return acc; }, {} as Record<string, string>);
        onChange(JSON.stringify(obj, null, 2));
    };

    return (
        <div className="space-y-2">
            {rows.length === 0 && disabled && <p className="text-sm text-muted-foreground">設定なし</p>}
            {rows.map((row, index) => (
                <div key={index} className="flex gap-2 items-center">
                    <Input placeholder={placeholderKey} value={row.key} onChange={(e) => updateRow(index, 'key', e.target.value)} disabled={disabled} className="flex-1" />
                    <Input placeholder={placeholderValue} value={row.value} onChange={(e) => updateRow(index, 'value', e.target.value)} disabled={disabled} className="flex-1" />
                    {!disabled && <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRow(index)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
            ))}
            {!disabled && <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus className="h-4 w-4 mr-1" />項目を追加</Button>}
        </div>
    );
}

export default function GraphQLNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [label, setLabel] = useState(data.label || 'GraphQL呼び出し');
    const [endpoint, setEndpoint] = useState(data.endpoint || '');
    const [operation, setOperation] = useState(data.operation || 'query GetItems {\n  items {\n    id\n    name\n  }\n}');
    const [variables, setVariables] = useState(data.variables || '{}');
    const [headers, setHeaders] = useState(data.headers || '{}');
    const [responseMapping, setResponseMapping] = useState(data.responseMapping || '{}');

    // Auth Settings
    const [authType, setAuthType] = useState(data.authType || 'none');
    const [authUsername, setAuthUsername] = useState(data.authUsername || '');
    const [authPassword, setAuthPassword] = useState(data.authPassword || '');
    const [authToken, setAuthToken] = useState(data.authToken || '');
    const [authApiKeyName, setAuthApiKeyName] = useState(data.authApiKeyName || 'X-API-Key');
    const [authApiKeyValue, setAuthApiKeyValue] = useState(data.authApiKeyValue || '');
    const [authApiKeyIn, setAuthApiKeyIn] = useState(data.authApiKeyIn || 'header');

    // Retry and Timeout
    const [timeout, setTimeout] = useState(data.timeout || '5000');
    const [retryCount, setRetryCount] = useState(data.retryCount || '0');
    const [retryInterval, setRetryInterval] = useState(data.retryInterval || '1000');

    const { setNodes } = useReactFlow();
    const isReadOnly = data.readOnly === true;

    useEffect(() => {
        if (dialogOpen) {
            // Sync state with data when dialog opens
            setLabel(data.label || 'GraphQL呼び出し');
            setEndpoint(data.endpoint || '');
            setOperation(data.operation || 'query GetItems {\n  items {\n    id\n    name\n  }\n}');
            setVariables(data.variables || '{}');
            setHeaders(data.headers || '{}');
            setResponseMapping(data.responseMapping || '{}');
            setAuthType(data.authType || 'none');
            setAuthUsername(data.authUsername || '');
            setAuthPassword(data.authPassword || '');
            setAuthToken(data.authToken || '');
            setAuthApiKeyName(data.authApiKeyName || 'X-API-Key');
            setAuthApiKeyValue(data.authApiKeyValue || '');
            setAuthApiKeyIn(data.authApiKeyIn || 'header');
            setTimeout(data.timeout || '5000');
            setRetryCount(data.retryCount || '0');
            setRetryInterval(data.retryInterval || '1000');
        }
    }, [dialogOpen, data]);

    const handleSave = () => {
        if (isReadOnly) { setDialogOpen(false); return; }
        setNodes((nds) => nds.map((node) => node.id === id ? { 
            ...node, 
            data: { 
                ...node.data, 
                label, endpoint, operation, variables, headers, responseMapping,
                authType, authUsername, authPassword, authToken, authApiKeyName, authApiKeyValue, authApiKeyIn,
                timeout, retryCount, retryInterval
            } 
        } : node));
        setDialogOpen(false);
    };

    return (
        <>
            <div
                className={`min-w-[140px] min-h-[60px] px-4 py-2 rounded-lg flex flex-col items-center justify-center shadow-lg border-2 relative transition-all duration-300
                    ${data.isFailed ? 'bg-red-50 to-red-100 border-red-500 shadow-red-200' : 
                      data.isCurrent ? 'bg-gradient-to-br from-pink-500 to-pink-700 border-yellow-400 ring-4 ring-yellow-400/30' : 
                      'bg-gradient-to-br from-pink-500 to-pink-700 border-white/50'}
                `}
                style={{ cursor: isReadOnly ? 'pointer' : 'default' }}
                onClick={isReadOnly ? () => setDialogOpen(true) : undefined}
            >
                {data.isCurrent && !data.isFailed && <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-pink-600 border-white hover:bg-pink-600 z-50 shadow-sm whitespace-nowrap">現在</Badge>}
                {data.isFailed && <Badge variant="destructive" className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 border-white z-50 shadow-sm whitespace-nowrap">失敗</Badge>}
                {data.isCompleted && !data.isCurrent && !data.isFailed && <Badge variant="secondary" className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-emerald-100 text-emerald-700 border-emerald-200 border hover:bg-emerald-100 z-50 shadow-sm whitespace-nowrap">完了</Badge>}
                <Handle 
                    type="target" 
                    position={Position.Left} 
                    isConnectableStart={false}
                    className="!bg-white !border-2 !border-pink-800 !w-2.5 !h-2.5 !rounded-none" 
                />
                <div className="flex items-center gap-1">
                    <Globe className="h-4 w-4 text-white" />
                    <span className="text-sm text-white font-bold drop-shadow-sm">{data.label || 'GraphQL'}</span>
                    {!isReadOnly && (
                        <button className="p-0.5 text-white hover:bg-white/20 rounded" onClick={() => setDialogOpen(true)} onMouseDown={(e) => e.stopPropagation()}>
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                 {data.endpoint && <span className="text-[9px] text-white/80 max-w-[130px] truncate">{data.endpoint}</span>}
                <Handle 
                    type="source" 
                    position={Position.Right} 
                    className="!bg-pink-800 !w-2.5 !h-2.5 !border-2 !border-white !rounded-full" 
                />
                 {data.statCount !== undefined && data.statCount > 0 && (
                    <div className="absolute -top-3 -right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full border border-white shadow-sm z-10 animate-pulse">
                        {data.statCount}
                    </div>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
                    <DialogHeader><DialogTitle>{isReadOnly ? 'GraphQL (読取専用)' : 'GraphQL設定'}</DialogTitle></DialogHeader>
                    
                    <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="general">一般</TabsTrigger>
                            <TabsTrigger value="operation">クエリ/実行</TabsTrigger>
                            <TabsTrigger value="auth">認証</TabsTrigger>
                            <TabsTrigger value="advanced">詳細</TabsTrigger>
                        </TabsList>

                        <TabsContent value="general" className="space-y-4 pt-4 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>ステップ名</Label>
                                    <Input value={label} onChange={(e) => setLabel(e.target.value)} disabled={isReadOnly} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>エンドポイント URL</Label>
                                <Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://api.example.com/graphql" disabled={isReadOnly} />
                            </div>
                            <Separator className="my-2" />
                            <div className="space-y-2">
                                <Label>ヘッダー</Label>
                                <KeyValueEditor value={headers} onChange={setHeaders} placeholderKey="Header-Name" placeholderValue="Value" disabled={isReadOnly} />
                            </div>
                        </TabsContent>

                        <TabsContent value="operation" className="flex-1 flex flex-col gap-4 pt-4 overflow-hidden h-full">
                            <div className="h-[300px] flex flex-col">
                                <Label className="mb-2">Operation (Query / Mutation)</Label>
                                <div 
                                    className="border rounded-md overflow-hidden"
                                    style={{ height: '300px' }}
                                    onKeyDown={(e) => e.stopPropagation()}
                                >
                                     <Editor
                                        height="300px"
                                        defaultLanguage="graphql"
                                        value={operation}
                                        onChange={(value) => setOperation(value || '')}
                                        theme="vs-dark"
                                        options={{ minimap: { enabled: false }, fontSize: 13, readOnly: isReadOnly, fixedOverflowWidgets: true }}
                                    />
                                </div>
                            </div>
                            <div className="h-[200px] flex flex-col">
                                <Label className="mb-2">Variables (JSON)</Label>
                                <div 
                                    className="border rounded-md overflow-hidden"
                                    style={{ height: '200px' }}
                                    onKeyDown={(e) => e.stopPropagation()}
                                >
                                    <Editor
                                        height="200px"
                                        defaultLanguage="json"
                                        value={variables}
                                        onChange={(value) => setVariables(value || '')}
                                        theme="vs-dark"
                                        options={{ minimap: { enabled: false }, fontSize: 13, readOnly: isReadOnly, fixedOverflowWidgets: true }}
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="auth" className="space-y-4 pt-4 overflow-y-auto">
                             <div className="space-y-2">
                                <Label>認証タイプ</Label>
                                <Select value={authType} onValueChange={setAuthType} disabled={isReadOnly}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">なし</SelectItem>
                                        <SelectItem value="basic">Basic認証</SelectItem>
                                        <SelectItem value="bearer">Bearer Token (OAuth2)</SelectItem>
                                        <SelectItem value="apikey">API Key</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                             {authType === 'basic' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label>ユーザー名</Label><Input value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} disabled={isReadOnly} /></div>
                                    <div className="space-y-2"><Label>パスワード</Label><Input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} disabled={isReadOnly} /></div>
                                </div>
                            )}
                            {authType === 'bearer' && (
                                <div className="space-y-2"><Label>トークン</Label><Input type="password" value={authToken} onChange={(e) => setAuthToken(e.target.value)} disabled={isReadOnly} /></div>
                            )}
                            {authType === 'apikey' && (
                                <div className="space-y-4">
                                    <div className="space-y-2"><Label>挿入場所</Label><Select value={authApiKeyIn} onValueChange={setAuthApiKeyIn} disabled={isReadOnly}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="header">ヘッダー</SelectItem><SelectItem value="query">クエリパラメータ</SelectItem></SelectContent></Select></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label>キー名</Label><Input value={authApiKeyName} onChange={(e) => setAuthApiKeyName(e.target.value)} disabled={isReadOnly} /></div>
                                        <div className="space-y-2"><Label>値</Label><Input type="password" value={authApiKeyValue} onChange={(e) => setAuthApiKeyValue(e.target.value)} disabled={isReadOnly} /></div>
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="advanced" className="space-y-4 pt-4 overflow-y-auto">
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>タイムアウト (ms)</Label><Input type="number" value={timeout} onChange={(e) => setTimeout(e.target.value)} min="1000" disabled={isReadOnly} /></div>
                                <div className="space-y-2"><Label>リトライ回数</Label><Input type="number" value={retryCount} onChange={(e) => setRetryCount(e.target.value)} min="0" disabled={isReadOnly} /></div>
                             </div>
                             <div className="space-y-2">
                                <Label>レスポンスマッピング</Label>
                                <KeyValueEditor value={responseMapping} onChange={setResponseMapping} placeholderKey="JSONパス (例: data.items)" placeholderValue="保存先変数 (例: items)" disabled={isReadOnly} />
                            </div>
                        </TabsContent>
                    </Tabs>

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
