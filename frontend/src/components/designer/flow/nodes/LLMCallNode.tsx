// LLMCallNode - Converted from MUI to shadcn/ui
import { useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Pencil, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function LLMCallNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [provider, setProvider] = useState(data.provider || 'openai');
    const [apiKey, setApiKey] = useState(data.apiKey || '');
    const [baseUrl, setBaseUrl] = useState(data.baseUrl || '');
    const [label, setLabel] = useState(data.label || 'LLM呼び出し');
    const [model, setModel] = useState(data.model || 'gpt-4o');
    const [prompt, setPrompt] = useState(data.prompt || '');
    const [systemPrompt, setSystemPrompt] = useState(data.systemPrompt || '');
    const [temperature, setTemperature] = useState(data.temperature ?? 0.7);
    const [outputField, setOutputField] = useState(data.outputField || 'llmResponse');
    
    // Reset defaults when provider changes
    const handleProviderChange = (val: string) => {
        setProvider(val);
        if (val === 'openai') { setBaseUrl(''); setModel('gpt-4o'); }
        else if (val === 'anthropic') { setBaseUrl(''); setModel('claude-3-5-sonnet-20240620'); }
        else if (val === 'ollama') { setBaseUrl('http://host.docker.internal:11434'); setModel('llama3'); }
    };

    const { setNodes } = useReactFlow();
    const isReadOnly = data.readOnly === true;

    const handleSave = () => {
        if (isReadOnly) { setDialogOpen(false); return; }
        setNodes((nds) => nds.map((node) => node.id === id ? { 
            ...node, 
            data: { 
                ...node.data, 
                label, 
                provider,
                apiKey,
                baseUrl,
                model, 
                prompt, 
                systemPrompt, 
                temperature, 
                outputField 
            } 
        } : node));
        setDialogOpen(false);
    };

    return (
        <>
            <div
                className={`min-w-[140px] min-h-[60px] px-4 py-2 rounded-lg flex flex-col items-center justify-center shadow-lg border-2 relative transition-all duration-300
                    ${data.isFailed ? 'bg-red-50 to-red-100 border-red-500 shadow-red-200' : 
                      data.isCurrent ? 'bg-gradient-to-br from-teal-400 to-teal-600 border-yellow-400 ring-4 ring-yellow-400/30' : 
                      'bg-gradient-to-br from-teal-400 to-teal-600 border-white/50'}
                `}
                style={{ cursor: isReadOnly ? 'pointer' : 'default' }}
                onClick={isReadOnly ? () => setDialogOpen(true) : undefined}
            >
                {data.isCurrent && !data.isFailed && <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-teal-600 border-white hover:bg-teal-600 z-50 shadow-sm whitespace-nowrap">現在</Badge>}
                {data.isFailed && <Badge variant="destructive" className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 border-white z-50 shadow-sm whitespace-nowrap">失敗</Badge>}
                {data.isCompleted && !data.isCurrent && !data.isFailed && <Badge variant="secondary" className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-emerald-100 text-emerald-700 border-emerald-200 border hover:bg-emerald-100 z-50 shadow-sm whitespace-nowrap">完了</Badge>}
                <Handle 
                    type="target" 
                    position={Position.Left} 
                    isConnectableStart={false}
                    className="!bg-white !border-2 !border-teal-700 !w-2.5 !h-2.5 !rounded-none" 
                />
                <div className="flex items-center gap-1">
                    <Bot className="h-4 w-4 text-white" />
                    <span className="text-sm text-white font-bold drop-shadow-sm">{data.label || 'LLM呼び出し'}</span>
                    {!isReadOnly && (
                        <button className="p-0.5 text-white hover:bg-white/20 rounded" onClick={() => setDialogOpen(true)} onMouseDown={(e) => e.stopPropagation()}>
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                {data.model && <span className="text-[9px] text-white/80">{data.provider === 'ollama' ? 'Ollama' : data.model}</span>}
                <Handle 
                    type="source" 
                    position={Position.Right} 
                    className="!bg-teal-700 !w-2.5 !h-2.5 !border-2 !border-white !rounded-full" 
                />
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
                <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{isReadOnly ? 'LLM呼び出し (読取専用)' : 'LLM呼び出し設定'}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5"><Label>ステップ名</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} disabled={isReadOnly} /></div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>プロバイダー</Label>
                                <Select value={provider} onValueChange={handleProviderChange} disabled={isReadOnly}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="openai">OpenAI</SelectItem>
                                        <SelectItem value="anthropic">Anthropic</SelectItem>
                                        <SelectItem value="ollama">Ollama (Local)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>モデル名</Label>
                                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model ID" disabled={isReadOnly} />
                            </div>
                        </div>

                        {provider !== 'ollama' && (
                            <div className="space-y-1.5">
                                <Label>API Key</Label>
                                <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." disabled={isReadOnly} />
                                <p className="text-xs text-muted-foreground">空の場合は環境変数を使用します</p>
                            </div>
                        )}

                        {provider === 'ollama' && (
                             <div className="space-y-1.5">
                                <Label>Base URL</Label>
                                <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://host.docker.internal:11434" disabled={isReadOnly} />
                            </div>
                        )}

                        <Separator />
                        <div className="space-y-1.5"><Label>システムプロンプト</Label><Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={2} placeholder="あなたは有能なアシスタントです。" disabled={isReadOnly} /></div>
                        <div className="space-y-1.5">
                            <Label>プロンプト</Label>
                            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder={"{{summary}} を要約してください。"} disabled={isReadOnly} />
                            <p className="text-xs text-muted-foreground">{"{{変数}}"} でフォームデータを参照可能</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Temperature: {temperature}</Label>
                            <input type="range" min={0} max={2} step={0.1} value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} disabled={isReadOnly} className="w-full h-2 bg-muted rounded-lg cursor-pointer" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>出力フィールド名</Label>
                            <Input value={outputField} onChange={(e) => setOutputField(e.target.value)} placeholder="llmResponse" disabled={isReadOnly} />
                        </div>
                    </div>
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
