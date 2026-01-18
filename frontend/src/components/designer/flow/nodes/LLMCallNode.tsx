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

export default function LLMCallNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [label, setLabel] = useState(data.label || 'LLM呼び出し');
    const [model, setModel] = useState(data.model || 'gpt-4');
    const [prompt, setPrompt] = useState(data.prompt || '');
    const [systemPrompt, setSystemPrompt] = useState(data.systemPrompt || '');
    const [temperature, setTemperature] = useState(data.temperature ?? 0.7);
    const [outputField, setOutputField] = useState(data.outputField || 'llmResponse');
    const { setNodes } = useReactFlow();
    const isReadOnly = data.readOnly === true;

    const handleSave = () => {
        if (isReadOnly) { setDialogOpen(false); return; }
        setNodes((nds) => nds.map((node) => node.id === id ? { ...node, data: { ...node.data, label, model, prompt, systemPrompt, temperature, outputField } } : node));
        setDialogOpen(false);
    };

    return (
        <>
            <div
                className="min-w-[140px] min-h-[60px] px-4 py-2 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex flex-col items-center justify-center shadow-lg border-2 border-white/50 relative"
                style={{ cursor: isReadOnly ? 'pointer' : 'default' }}
                onClick={isReadOnly ? () => setDialogOpen(true) : undefined}
            >
                <Handle type="target" position={Position.Left} className="!bg-teal-700 !w-2.5 !h-2.5 !border-2 !border-white" />
                <div className="flex items-center gap-1">
                    <Bot className="h-4 w-4 text-white" />
                    <span className="text-sm text-white font-bold drop-shadow-sm">{data.label || 'LLM呼び出し'}</span>
                    {!isReadOnly && (
                        <button className="p-0.5 text-white hover:bg-white/20 rounded" onClick={() => setDialogOpen(true)} onMouseDown={(e) => e.stopPropagation()}>
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                {data.model && <span className="text-[9px] text-white/80">{data.model}</span>}
                <Handle type="source" position={Position.Right} className="!bg-teal-700 !w-2.5 !h-2.5 !border-2 !border-white" />
                {data.statCount !== undefined && data.statCount > 0 && (
                    <div className="absolute -top-3 -right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full border border-white shadow-sm z-10 animate-pulse">
                        {data.statCount}
                    </div>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{isReadOnly ? 'LLM呼び出し (読取専用)' : 'LLM呼び出し設定'}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5"><Label>ステップ名</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} disabled={isReadOnly} /></div>
                        <div className="space-y-1.5">
                            <Label>モデル</Label>
                            <Select value={model} onValueChange={setModel} disabled={isReadOnly}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                                    <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                                    <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                                    <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Separator />
                        <div className="space-y-1.5"><Label>システムプロンプト</Label><Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={2} placeholder="あなたは○○のエキスパートです。" disabled={isReadOnly} /></div>
                        <div className="space-y-1.5">
                            <Label>プロンプト</Label>
                            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder={"{{formField}} の内容を分析してください。"} disabled={isReadOnly} />
                            <p className="text-xs text-muted-foreground">{"{{変数名}}"} でフォームデータを参照可能</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Temperature: {temperature}</Label>
                            <input type="range" min={0} max={2} step={0.1} value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} disabled={isReadOnly} className="w-full h-2 bg-muted rounded-lg cursor-pointer" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>出力フィールド名</Label>
                            <Input value={outputField} onChange={(e) => setOutputField(e.target.value)} placeholder="llmResponse" disabled={isReadOnly} />
                            <p className="text-xs text-muted-foreground">LLMの応答を保存するフィールド名</p>
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
