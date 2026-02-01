import { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Pencil, Globe, Plus, Trash2, Key, Timer } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

// Key-Value Editor Component
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

export default function APICallNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [label, setLabel] = useState(data.label || 'API呼び出し');
    const [url, setUrl] = useState(data.url || '');
    const [method, setMethod] = useState(data.method || 'GET');
    const [headers, setHeaders] = useState(data.headers || '{}');
    const [body, setBody] = useState(data.body || '{}');
    const [successCodes, setSuccessCodes] = useState(data.successCodes || '200,201,204');
    const [errorBehavior, setErrorBehavior] = useState(data.errorBehavior || 'stop');
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
    const formFields = data.formFields || [];

    useEffect(() => {
        if (dialogOpen) {
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
                label, url, method, headers, body, 
                successCodes, errorBehavior, responseMapping,
                authType, authUsername, authPassword, authToken, authApiKeyName, authApiKeyValue, authApiKeyIn,
                timeout, retryCount, retryInterval
            } 
        } : node));
        setDialogOpen(false);
    };

    return (
        <>
            <div
                className="min-w-[140px] min-h-[60px] px-4 py-2 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex flex-col items-center justify-center shadow-lg border-2 border-white/50 relative"
                style={{ cursor: isReadOnly ? 'pointer' : 'default' }}
                onClick={isReadOnly ? () => setDialogOpen(true) : undefined}
            >
                <Handle type="target" position={Position.Left} className="!bg-purple-800 !w-2.5 !h-2.5 !border-2 !border-white" />
                <div className="flex items-center gap-1">
                    <Globe className="h-4 w-4 text-white" />
                    <span className="text-sm text-white font-bold drop-shadow-sm">{data.label || 'API呼び出し'}</span>
                    {!isReadOnly && (
                        <button className="p-0.5 text-white hover:bg-white/20 rounded" onClick={() => setDialogOpen(true)} onMouseDown={(e) => e.stopPropagation()}>
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                {data.url && <span className="text-[9px] text-white/80 max-w-[130px] truncate">{data.method} {data.url}</span>}
                <Handle type="source" position={Position.Right} className="!bg-purple-800 !w-2.5 !h-2.5 !border-2 !border-white" />
                {/* Stats Badge */}
                {(() => {
                    const stats = data.statCount;
                    if (!stats) return null;
                    const count = typeof stats === 'number' ? stats : stats.count;
                    if (!count) return null;
                    
                    return (
                        <div className="absolute -top-3 -right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full border border-white shadow-sm z-10 animate-pulse">
                            {count}
                        </div>
                    );
                })()}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{isReadOnly ? 'API呼び出し (読取専用)' : 'API呼び出し設定'}</DialogTitle></DialogHeader>
                    
                    <Tabs defaultValue="general">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="general">一般</TabsTrigger>
                            <TabsTrigger value="auth">認証</TabsTrigger>
                            <TabsTrigger value="body">リクエスト</TabsTrigger>
                            <TabsTrigger value="advanced">詳細</TabsTrigger>
                        </TabsList>

                        <TabsContent value="general" className="space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>ステップ名</Label>
                                    <Input value={label} onChange={(e) => setLabel(e.target.value)} disabled={isReadOnly} />
                                </div>
                                <div className="space-y-2">
                                    <Label>メソッド</Label>
                                    <Select value={method} onValueChange={setMethod} disabled={isReadOnly}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>URL</Label>
                                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/v1/..." disabled={isReadOnly} />
                            </div>
                            <Separator className="my-2" />
                            <div className="space-y-2">
                                <Label>ヘッダー</Label>
                                <KeyValueEditor value={headers} onChange={setHeaders} placeholderKey="Header-Name" placeholderValue="Value" disabled={isReadOnly} />
                            </div>
                            {!isReadOnly && formFields.length > 0 && (
                                <div className="p-2 bg-muted rounded-lg mt-2">
                                    <p className="text-xs text-muted-foreground font-semibold mb-1">使用可能な変数</p>
                                    <div className="flex flex-wrap gap-1">
                                        {formFields.map((f: any) => (
                                            <Badge key={f.id} variant="secondary" className="cursor-pointer text-xs" onClick={() => navigator.clipboard.writeText(`{{${f.id}}}`)}>{f.label}</Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="auth" className="space-y-4 pt-4">
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
                                    <div className="space-y-2">
                                        <Label>ユーザー名</Label>
                                        <Input value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} disabled={isReadOnly} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>パスワード</Label>
                                        <Input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} disabled={isReadOnly} />
                                    </div>
                                </div>
                            )}

                            {authType === 'bearer' && (
                                <div className="space-y-2">
                                    <Label>トークン</Label>
                                    <Input type="password" value={authToken} onChange={(e) => setAuthToken(e.target.value)} placeholder="eyOr..." disabled={isReadOnly} />
                                    <p className="text-xs text-muted-foreground">"Bearer " プレフィックスは自動的に付与されます。</p>
                                </div>
                            )}

                            {authType === 'apikey' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>挿入場所</Label>
                                        <Select value={authApiKeyIn} onValueChange={setAuthApiKeyIn} disabled={isReadOnly}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="header">ヘッダー</SelectItem>
                                                <SelectItem value="query">クエリパラメータ</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>キー名</Label>
                                            <Input value={authApiKeyName} onChange={(e) => setAuthApiKeyName(e.target.value)} placeholder="X-API-Key" disabled={isReadOnly} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>値</Label>
                                            <Input type="password" value={authApiKeyValue} onChange={(e) => setAuthApiKeyValue(e.target.value)} disabled={isReadOnly} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="body" className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>リクエストボディ</Label>
                                <Tabs defaultValue="kv">
                                    <TabsList className="mb-2"><TabsTrigger value="kv">キー/値</TabsTrigger><TabsTrigger value="raw">Raw JSON</TabsTrigger></TabsList>
                                    <TabsContent value="kv"><KeyValueEditor value={body} onChange={setBody} placeholderKey="Field" placeholderValue="Value ({{field}})" disabled={isReadOnly} /></TabsContent>
                                    <TabsContent value="raw"><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} placeholder='{"key":"value"}' disabled={isReadOnly} /></TabsContent>
                                </Tabs>
                            </div>
                        </TabsContent>

                        <TabsContent value="advanced" className="space-y-4 pt-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>成功ステータスコード</Label>
                                    <Input value={successCodes} onChange={(e) => setSuccessCodes(e.target.value)} placeholder="200,201,204" disabled={isReadOnly} />
                                    <p className="text-xs text-muted-foreground">カンマ区切りで複数を指定可能</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>エラー時の動作</Label>
                                    <Select value={errorBehavior} onValueChange={setErrorBehavior} disabled={isReadOnly}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="stop">フローを停止 (エラー)</SelectItem><SelectItem value="continue">次へ進む (無視)</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                
                                <Separator />
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>タイムアウト (ms)</Label>
                                        <Input type="number" value={timeout} onChange={(e) => setTimeout(e.target.value)} min="1000" step="1000" disabled={isReadOnly} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>リトライ回数</Label>
                                        <Input type="number" value={retryCount} onChange={(e) => setRetryCount(e.target.value)} min="0" max="10" disabled={isReadOnly} />
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <Label>リトライ間隔 (ms)</Label>
                                        <Input type="number" value={retryInterval} onChange={(e) => setRetryInterval(e.target.value)} min="1000" step="1000" disabled={isReadOnly} />
                                    </div>
                                </div>

                                <Separator />

                                <div className="space-y-2">
                                    <Label>レスポンスマッピング</Label>
                                    <KeyValueEditor value={responseMapping} onChange={setResponseMapping} placeholderKey="JSONパス (例: data.id)" placeholderValue="保存先変数 (例: outputId)" disabled={isReadOnly} />
                                </div>
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
