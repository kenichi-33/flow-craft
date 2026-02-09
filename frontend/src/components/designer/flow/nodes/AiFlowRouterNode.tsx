import { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Pencil, Workflow, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FlowSelectorDialog } from '../dialogs/FlowSelectorDialog';

export default function AiFlowRouterNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [flowSelectorOpen, setFlowSelectorOpen] = useState(false);
    const [inputSource, setInputSource] = useState(data.inputSource || 'form.reason');
    const [allowedApps, setAllowedApps] = useState<string[]>(data.allowedApps || []);
    const [executionMode, setExecutionMode] = useState(data.executionMode || 'single'); // 'single' or 'all'
    const [confidenceThreshold, setConfidenceThreshold] = useState(data.confidenceThreshold || 0.7);
    const [onFailure, setOnFailure] = useState(data.onFailure || 'error');
    const [customPrompt, setCustomPrompt] = useState(data.customPrompt || '');
    const [returnMessage, setReturnMessage] = useState(data.returnMessage || '以下の情報が不足しています。追加でご入力ください。');
    
    // LLM Config
    const [provider, setProvider] = useState(data.provider || 'ollama');
    const [model, setModel] = useState(data.model || '');
    const [apiKey, setApiKey] = useState(data.apiKey || '');
    const [baseUrl, setBaseUrl] = useState(data.baseUrl || 'http://host.docker.internal:11434');

    const { setNodes } = useReactFlow();
    const isReadOnly = data.readOnly === true;

    useEffect(() => {
        if (dialogOpen) {
            setInputSource(data.inputSource || 'form.reason');
            setAllowedApps(data.allowedApps || []);
            setExecutionMode(data.executionMode || 'single');
            setConfidenceThreshold(data.confidenceThreshold || 0.7);
            setOnFailure(data.onFailure || 'error');
            setCustomPrompt(data.customPrompt || '');
            setReturnMessage(data.returnMessage || '以下の情報が不足しています。追加でご入力ください。');
        }
    }, [dialogOpen, data]);

    const handleSave = () => {
        if (isReadOnly) return;
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? { 
                        ...node, 
                        data: { 
                            ...node.data, 
                            inputSource,
                            allowedApps,
                            executionMode,
                            confidenceThreshold,
                            onFailure,
                            customPrompt,
                            returnMessage,
                            provider,
                            model,
                            apiKey,
                            baseUrl
                        } 
                    }
                    : node
            )
        );
        setDialogOpen(false);
    };

    return (
        <>
            <div className={`relative min-w-[140px] min-h-[80px] px-3 py-2 rounded flex flex-col items-center justify-center shadow-md transition-all duration-300
                ${data.isFailed ? 'bg-red-50 border-red-500 shadow-red-200 border-2' : 
                  data.isCurrent ? 'bg-indigo-100 border-indigo-400 ring-4 ring-indigo-400/30 border-2' : 
                  'bg-indigo-100 border-indigo-500 border-2'}
                `}>
                {data.isCurrent && !data.isFailed && <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-indigo-600 border-white hover:bg-indigo-600 z-50 shadow-sm whitespace-nowrap">現在</Badge>}
                {data.isFailed && <Badge variant="destructive" className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 border-white z-50 shadow-sm whitespace-nowrap">失敗</Badge>}
                {data.isCompleted && !data.isCurrent && !data.isFailed && <Badge variant="secondary" className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-emerald-100 text-emerald-700 border-emerald-200 border hover:bg-emerald-100 z-50 shadow-sm whitespace-nowrap">完了</Badge>}
                
                <Handle 
                    type="target" 
                    position={Position.Left} 
                    isConnectableStart={false}
                    className="!bg-white !border-2 !border-indigo-600 !w-3 !h-3 !rounded-none" 
                />
                
                <div className="flex items-center gap-2 mb-2">
                    <Workflow className="h-5 w-5 text-indigo-600" />
                    <span className="font-bold text-sm text-indigo-800">AIルーター</span>
                     {!isReadOnly && (
                        <button className="p-1 hover:bg-indigo-200 rounded-full" onClick={() => setDialogOpen(true)} onMouseDown={(e) => e.stopPropagation()}>
                            <Pencil className="h-3 w-3 text-indigo-600" />
                        </button>
                    )}
                </div>

                <div className="text-[10px] text-indigo-700 text-center w-full">
                    <div className="truncate" title={inputSource}>入力: {inputSource}</div>
                    <div className="text-indigo-500">→ サブフロー起動</div>
                </div>

                <Handle 
                    type="source" 
                    position={Position.Right} 
                    className="!bg-indigo-500 !w-2.5 !h-2.5 !border-2 !border-white !rounded-full"
                />
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Workflow className="h-5 w-5 text-indigo-600" />
                            {isReadOnly ? 'AIフロールーター設定 (読取専用)' : 'AIフロールーター設定'}
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-6 py-4">
                        <div className="bg-indigo-50 p-4 rounded-md text-sm text-indigo-800 mb-4">
                            AIがユーザーの入力内容を解析し、最適なサブフローへ自動ルーティングします。
                        </div>

                        <div className="space-y-4">
                            <div className="grid gap-1.5">
                                <Label className="text-xs">入力ソース (申請フォームフィールド)</Label>
                                <Select value={inputSource} onValueChange={setInputSource} disabled={isReadOnly}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="フィールドを選択" /></SelectTrigger>
                                    <SelectContent>
                                        {data.formFields?.map((field: any) => (
                                            <SelectItem key={field.id} value={`form.${field.id}`}>
                                                {field.label || field.id}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-muted-foreground">AI分析対象のフォームフィールドを選択</p>
                            </div>

                            <div className="grid gap-1.5">
                                <Label className="text-xs">カスタムプロンプト (任意)</Label>
                                <Textarea 
                                    value={customPrompt} 
                                    onChange={(e) => setCustomPrompt(e.target.value)} 
                                    disabled={isReadOnly} 
                                    placeholder="例: ユーザーの申請理由から、適切な承認フローを判定してください。" 
                                    rows={3}
                                />
                                <p className="text-[10px] text-muted-foreground">AIへの追加指示（空の場合はデフォルトプロンプトを使用）</p>
                            </div>

                            <div className="grid gap-1.5">
                                <Label className="text-xs">許可アプリ</Label>
                                <Button
                                    variant="outline"
                                    onClick={() => setFlowSelectorOpen(true)}
                                    disabled={isReadOnly}
                                    className="w-full justify-start"
                                >
                                    アプリを選択 ({allowedApps.length}個選択中)
                                </Button>
                                {allowedApps.length > 0 && (
                                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded max-h-20 overflow-y-auto">
                                        選択中: {allowedApps.length}個のアプリケーション
                                    </div>
                                )}
                                <p className="text-[10px] text-muted-foreground">AIが実行可能なアプリケーションを選択</p>
                            </div>

                            <div className="grid gap-1.5">
                                <Label className="text-xs">実行モード</Label>
                                <Select value={executionMode} onValueChange={setExecutionMode} disabled={isReadOnly}>
                                    <SelectTrigger className="h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="single">最も信頼度の高いアプリを1つ実行</SelectItem>
                                        <SelectItem value="all">検出された全てのアプリを実行</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-muted-foreground">複数のアプリが検出された場合の実行方法</p>
                            </div>

                            <div className="grid gap-1.5">
                                <Label className="text-xs">差し戻し時メッセージ</Label>
                                <Textarea 
                                    value={returnMessage} 
                                    onChange={(e) => setReturnMessage(e.target.value)} 
                                    disabled={isReadOnly} 
                                    placeholder="以下の情報が不足しています。追加でご入力ください。" 
                                    rows={2}
                                />
                                <p className="text-[10px] text-muted-foreground">AIが追加情報を要求する際にユーザーに表示するメッセージ</p>
                            </div>

                            <div className="grid gap-1.5">
                                <Label className="text-xs">信頼度しきい値 (0.0 - 1.0)</Label>
                                <Input 
                                    type="number" 
                                    value={confidenceThreshold} 
                                    onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value) || 0.7)} 
                                    min={0} 
                                    max={1} 
                                    step={0.05} 
                                    disabled={isReadOnly}
                                />
                                <p className="text-[10px] text-muted-foreground">AIの判定信頼度がこの値未満の場合、判定を保留します</p>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h4 className="font-medium text-sm flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-indigo-600" />
                                LLM設定
                            </h4>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-1.5">
                                    <Label className="text-xs">プロバイダー</Label>
                                    <Select value={provider} onValueChange={(val) => {
                                        setProvider(val);
                                        if (val === 'openai') { setBaseUrl(''); }
                                        else if (val === 'ollama') { setBaseUrl('http://host.docker.internal:11434'); }
                                    }} disabled={isReadOnly}>
                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ollama">Ollama (Local)</SelectItem>
                                            <SelectItem value="openai">OpenAI</SelectItem>
                                            <SelectItem value="anthropic">Anthropic</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {provider !== 'ollama' && (
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">API Key</Label>
                                        <Input 
                                            type="password"
                                            value={apiKey} 
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder="sk-..." 
                                            disabled={isReadOnly} 
                                            className="h-9"
                                        />
                                        <p className="text-[9px] text-muted-foreground">空の場合は環境変数を使用</p>
                                    </div>
                                )}
                                {provider === 'ollama' && (
                                     <div className="grid gap-1.5">
                                        <Label className="text-xs">Base URL</Label>
                                        <Input 
                                            value={baseUrl} 
                                            onChange={(e) => setBaseUrl(e.target.value)}
                                            placeholder="http://host.docker.internal:11434" 
                                            disabled={isReadOnly} 
                                            className="h-9"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="grid gap-1.5">
                                <Label className="text-xs">モデル (Ollama Model / OpenAI Model)</Label>
                                <Input 
                                    value={model} 
                                    onChange={(e) => setModel(e.target.value)} 
                                    disabled={isReadOnly} 
                                    placeholder="例: qwen2.5-coder:14b / gpt-4o" 
                                />
                                <p className="text-[10px] text-muted-foreground">空欄の場合はデフォルトを使用します</p>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        {isReadOnly ? <Button onClick={() => setDialogOpen(false)}>閉じる</Button> : (
                            <><Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button><Button onClick={handleSave}>保存</Button></>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <FlowSelectorDialog
                open={flowSelectorOpen}
                onOpenChange={setFlowSelectorOpen}
                selectedFlowIds={allowedApps}
                onSave={setAllowedApps}
                mode="app"
            />
        </>
    );
}
