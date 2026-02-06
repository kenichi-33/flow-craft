import { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Pencil, Plus, Trash2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { v4 as uuidv4 } from 'uuid';

interface AiRule {
    id: string;
    label: string;
    aiCondition: string;
}

export default function AiBranchNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [rules, setRules] = useState<AiRule[]>(data.rules || []);
    const [defaultLabel, setDefaultLabel] = useState(data.defaultLabel || 'その他 (Default)');

    // LLM Config
    const [provider, setProvider] = useState(data.provider || 'ollama'); // Default to ollama to match existing behavior
    const [apiKey, setApiKey] = useState(data.apiKey || '');
    const [baseUrl, setBaseUrl] = useState(data.baseUrl || 'http://host.docker.internal:11434');

    const { setNodes } = useReactFlow();
    const isReadOnly = data.readOnly === true;

    useEffect(() => {
        if (dialogOpen) {
            let initialRules = data.rules;
            if (!initialRules || initialRules.length === 0) {
                initialRules = [{
                    id: uuidv4(),
                    label: '承認ルート',
                    aiCondition: '金額が10万円以上の場合',
                }];
            }
            setRules(initialRules);
            setDefaultLabel(data.defaultLabel || 'その他 (Default)');
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
                            rules, 
                            defaultLabel,
                            provider,
                            apiKey,
                            baseUrl
                        } 
                    }
                    : node
            )
        );
        setDialogOpen(false);
    };

    const addRule = () => {
        setRules([...rules, {
            id: uuidv4(),
            label: `条件 ${rules.length + 1}`,
            aiCondition: '',
        }]);
    };

    const removeRule = (index: number) => {
        const newRules = rules.filter((_, i) => i !== index);
        setRules(newRules);
    };

    const updateRule = (index: number, key: keyof AiRule, val: string) => {
        const newRules = [...rules];
        newRules[index] = { ...newRules[index], [key]: val };
        setRules(newRules);
    };

    return (
        <>
            <div className={`relative min-w-[120px] min-h-[80px] px-3 py-2 rounded flex flex-col items-center justify-center shadow-md transition-all duration-300
                ${data.isFailed ? 'bg-red-50 border-red-500 shadow-red-200 border-2' : 
                  data.isCurrent ? 'bg-purple-100 border-purple-400 ring-4 ring-purple-400/30 border-2' : 
                  'bg-purple-100 border-purple-500 border-2'}
                `}>
                {data.isCurrent && !data.isFailed && <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-purple-600 border-white hover:bg-purple-600 z-50 shadow-sm whitespace-nowrap">現在</Badge>}
                {data.isFailed && <Badge variant="destructive" className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 border-white z-50 shadow-sm whitespace-nowrap">失敗</Badge>}
                {data.isCompleted && !data.isCurrent && !data.isFailed && <Badge variant="secondary" className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-emerald-100 text-emerald-700 border-emerald-200 border hover:bg-emerald-100 z-50 shadow-sm whitespace-nowrap">完了</Badge>}
                
                <Handle 
                    type="target" 
                    position={Position.Left} 
                    isConnectableStart={false}
                    className="!bg-white !border-2 !border-purple-600 !w-3 !h-3 !rounded-none" 
                />
                
                <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    <span className="font-bold text-sm text-purple-800">AI分岐</span>
                     {!isReadOnly && (
                        <button className="p-1 hover:bg-purple-200 rounded-full" onClick={() => setDialogOpen(true)} onMouseDown={(e) => e.stopPropagation()}>
                            <Pencil className="h-3 w-3 text-purple-600" />
                        </button>
                    )}
                </div>

                <div className="flex flex-col gap-2 w-full items-end">
                    {/* Dynamic Handles */}
                    {rules.map((rule) => (
                        <div key={rule.id} className="relative w-full text-right h-5 flex items-center justify-end pr-2 group">
                             <span className="text-[10px] text-purple-700 font-medium truncate max-w-[90px] mr-1" title={rule.label}>{rule.label}</span>
                             <div className="w-2 h-[2px] bg-purple-400 mr-[1px]"></div>
                             <Handle 
                                type="source" 
                                position={Position.Right} 
                                id={rule.id} 
                                style={{ top: '50%', right: '-13px' }}
                                className="!bg-purple-500 !w-2.5 !h-2.5 !border-1 !border-white !rounded-full"
                             />
                        </div>
                    ))}
                    
                    {/* Default Handle */}
                    <div className="relative w-full text-right h-5 flex items-center justify-end pr-2 border-t border-purple-200 pt-1 mt-1">
                         <span className="text-[9px] text-gray-500 truncate max-w-[90px] mr-1">{defaultLabel}</span>
                         <div className="w-2 h-[2px] bg-gray-300 mr-[1px]"></div>
                         <Handle 
                            type="source" 
                            position={Position.Right} 
                            id="default" 
                            style={{ top: '50%', right: '-13px' }}
                            className="!bg-gray-500 !w-2.5 !h-2.5 !border-1 !border-white !rounded-full"
                         />
                    </div>
                </div>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-purple-600" />
                            {isReadOnly ? 'AI分岐条件 (読取専用)' : 'AI分岐ルール設定 (自然言語)'}
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-6 py-4">
                        <div className="bg-purple-50 p-4 rounded-md text-sm text-purple-800 mb-4">
                            AIがフォームの内容と以下のルールを照らし合わせ、最適なルートを自動選択します。
                            各ルールの条件は自然言語で記述してください。
                        </div>

                        <div className="space-y-4">
                            {rules.map((rule, ruleIndex) => (
                                <div key={rule.id} className="border rounded-lg p-4 bg-muted/20 relative">
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center gap-4">
                                            <div className="grid gap-1.5 flex-1">
                                                <Label className="text-xs">ルール名 (分岐ラベル)</Label>
                                                <Input value={rule.label} onChange={(e) => updateRule(ruleIndex, 'label', e.target.value)} disabled={isReadOnly} placeholder="例: 部長承認ルート" />
                                            </div>
                                            {!isReadOnly && (
                                                <Button variant="ghost" size="icon" className="text-destructive mt-4" onClick={() => removeRule(ruleIndex)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                        <div className="grid gap-1.5">
                                             <Label className="text-xs">AIへの指示 (条件)</Label>
                                             <Textarea 
                                                value={rule.aiCondition} 
                                                onChange={(e) => updateRule(ruleIndex, 'aiCondition', e.target.value)} 
                                                disabled={isReadOnly} 
                                                placeholder="例: 金額が100万円以上、かつ「緊急」フラグがONの場合"
                                                className="min-h-[60px]"
                                             />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {!isReadOnly && (
                                <Button onClick={addRule} variant="outline" className="w-full border-dashed">
                                    <Plus className="h-4 w-4 mr-2" /> 新しいAI判定ルールを追加
                                </Button>
                            )}
                        </div>

                        <Separator />

                        <div className="space-y-2">
                             <Label>デフォルトルート (AIが判断できない、または条件に合わない場合)</Label>
                             <div className="flex items-center gap-4">
                                <div className="border h-10 w-1 bg-gray-300"></div>
                                <Input value={defaultLabel} onChange={(e) => setDefaultLabel(e.target.value)} disabled={isReadOnly} className="max-w-[300px]" />
                                <span className="text-xs text-muted-foreground">(Handle ID: default)</span>
                             </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h4 className="font-medium text-sm flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-purple-600" />
                                LLM設定 (高度な設定)
                            </h4>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="grid gap-1.5">
                                    <Label className="text-xs">プロバイダー</Label>
                                    <Select value={provider} onValueChange={(val) => {
                                        setProvider(val);
                                        // Reset defaults
                                        if (val === 'openai') { setBaseUrl(''); }
                                        else if (val === 'ollama') { setBaseUrl('http://host.docker.internal:11434'); }
                                        // Update immediate state for visual feedback if needed, but save handles persistent
                                        setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, provider: val }} : n));
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
                                            onChange={(e) => {
                                                setApiKey(e.target.value);
                                                setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, apiKey: e.target.value }} : n));
                                            }}
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
                                            onChange={(e) => {
                                                setBaseUrl(e.target.value);
                                                setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, baseUrl: e.target.value }} : n));
                                            }}
                                            placeholder="http://host.docker.internal:11434" 
                                            disabled={isReadOnly} 
                                            className="h-9"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-1.5">
                                    <Label className="text-xs">モデル (Ollama Model / OpenAI Model)</Label>
                                    <Input 
                                        value={data.model || ''} 
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, model: val }} : n));
                                        }} 
                                        disabled={isReadOnly} 
                                        placeholder="例: qwen2.5-coder:14b / gpt-4o" 
                                    />
                                    <p className="text-[10px] text-muted-foreground">空欄の場合はデフォルトを使用します</p>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label className="text-xs">Temperature (0.0 - 1.0)</Label>
                                    <Input 
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="1"
                                        value={data.temperature ?? ''} 
                                        onChange={(e) => {
                                            const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                            setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, temperature: val }} : n));
                                        }} 
                                        disabled={isReadOnly} 
                                        placeholder="0.1 (デフォルト)" 
                                    />
                                </div>
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
        </>
    );
}
