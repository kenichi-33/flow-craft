import { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FlowSelectorDialog } from '../dialogs/FlowSelectorDialog';

export default function AiStartNode({ id, data }: { id: string, data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [flowSelectorOpen, setFlowSelectorOpen] = useState(false);
    const [agentName, setAgentName] = useState<string>(data.agentName || 'AIアシスタント');
    const [systemPrompt, setSystemPrompt] = useState<string>(data.systemPrompt || '');
    const [allowedApps, setAllowedApps] = useState<string[]>(data.allowedApps || []);
    const { setNodes } = useReactFlow();
    const isReadOnly = data.readOnly === true;

    useEffect(() => {
        if (dialogOpen) {
            setAgentName(data.agentName || 'AIアシスタント');
            setSystemPrompt(data.systemPrompt || '');
            setAllowedApps(data.allowedApps || []);
        }
    }, [dialogOpen, data.agentName, data.systemPrompt, data.allowedApps]);

    const handleSave = () => {
        if (isReadOnly) { setDialogOpen(false); return; }
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? {
                        ...node,
                        data: { 
                            ...node.data, 
                            agentName,
                            systemPrompt,
                            allowedApps,
                        },
                    }
                    : node
            )
        );
        setDialogOpen(false);
    };

    return (
        <>
            <div 
                className={`w-[60px] h-[60px] rounded-full flex flex-col items-center justify-center shadow-lg border-[3px] relative group transition-all duration-300
                    ${data.isFailed ? 'bg-red-50 border-red-500' :
                      data.isCurrent ? 'bg-gradient-to-br from-purple-500 to-purple-700 border-yellow-400 ring-4 ring-yellow-400/30' :
                      'bg-gradient-to-br from-purple-500 to-purple-700 border-white'}
                `}
                style={{ cursor: 'pointer' }}
                onClick={() => setDialogOpen(true)}
            >
                {data.isCurrent && !data.isFailed && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-purple-600 border-white hover:bg-purple-600 z-50 shadow-sm whitespace-nowrap">現在</Badge>}
                <MessageCircle className="h-6 w-6 text-white" />
                {!isReadOnly && (
                    <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="bg-white rounded-full p-1 shadow-sm border">
                            <Pencil className="h-3 w-3 text-gray-500" />
                        </div>
                    </div>
                )}
                <Handle
                    type="source"
                    position={Position.Right}
                    className="!bg-purple-700 !w-2.5 !h-2.5 !border-2 !border-white !rounded-full"
                />
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>AI Startノード設定</DialogTitle></DialogHeader>
                    
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>エージェント名</Label>
                            <Input 
                                value={agentName} 
                                onChange={(e) => setAgentName(e.target.value)} 
                                placeholder="総務ボット" 
                                disabled={isReadOnly}
                            />
                            <p className="text-xs text-muted-foreground">チャット画面に表示される名前</p>
                        </div>

                        <div className="space-y-2">
                            <Label>システムプロンプト</Label>
                            <Textarea 
                                value={systemPrompt} 
                                onChange={(e) => setSystemPrompt(e.target.value)} 
                                placeholder="あなたは親切な総務担当AIです。ユーザーの申請をサポートします。" 
                                disabled={isReadOnly}
                                rows={4}
                            />
                            <p className="text-xs text-muted-foreground">AIの役割や振る舞いを定義</p>
                        </div>

                        <div className="space-y-2">
                            <Label>許可アプリ</Label>
                            <div className="text-xs text-muted-foreground mb-2">
                                このAIが実行できるアプリケーションを選択
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setFlowSelectorOpen(true)}
                                disabled={isReadOnly}
                                className="w-full"
                            >
                                アプリを選択 ({allowedApps.length}個選択中)
                            </Button>
                            {allowedApps.length > 0 && (
                                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                                    選択中: {allowedApps.length}個のアプリ
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        {isReadOnly ? (
                            <Button onClick={() => setDialogOpen(false)}>閉じる</Button>
                        ) : (
                            <>
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
                                <Button onClick={handleSave}>保存</Button>
                            </>
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
