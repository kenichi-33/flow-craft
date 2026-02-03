import { useState } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { RotateCw, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

type ForEachNodeData = {
    label?: string;
    items?: string;
    itemVariable?: string;
    indexVariable?: string;
    readOnly?: boolean;
    statCount?: number;
    isCurrent?: boolean;
    isFailed?: boolean;
    isCompleted?: boolean;
};

export default function ForEachNode({ id, data, selected, isConnectable }: NodeProps) {
    const nodeData = data as ForEachNodeData;
    const [dialogOpen, setDialogOpen] = useState(false);
    
    // Local state for dialog editing
    const [items, setItems] = useState(nodeData.items || '');
    const [itemVariable, setItemVariable] = useState(nodeData.itemVariable || 'item');
    const [indexVariable, setIndexVariable] = useState(nodeData.indexVariable || 'index');

    const { setNodes } = useReactFlow();
    const isReadOnly = nodeData.readOnly === true;

    const handleSave = () => {
        if (isReadOnly) { setDialogOpen(false); return; }
        setNodes((nds) => nds.map((node) => node.id === id ? { 
            ...node, 
            data: { 
                ...node.data, 
                items,
                itemVariable,
                indexVariable
            } 
        } : node));
        setDialogOpen(false);
    };

    return (
        <div className={`px-2 py-1 shadow-md rounded-md bg-white border-2 w-40 relative transition-all duration-300
            ${nodeData.isFailed ? 'border-red-500 shadow-red-200' : 
              nodeData.isCurrent ? 'border-indigo-500 ring-4 ring-indigo-500/30' : 
              selected ? 'border-indigo-500' : 'border-indigo-200'}
        `}>
            {nodeData.isCurrent && !nodeData.isFailed && <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-indigo-600 border-white hover:bg-indigo-600 z-50 shadow-sm whitespace-nowrap">現在</Badge>}
            {nodeData.isFailed && <Badge variant="destructive" className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 border-white z-50 shadow-sm whitespace-nowrap">失敗</Badge>}
            {nodeData.isCompleted && !nodeData.isCurrent && !nodeData.isFailed && <Badge variant="secondary" className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-emerald-100 text-emerald-700 border-emerald-200 border hover:bg-emerald-100 z-50 shadow-sm whitespace-nowrap">完了</Badge>}
            <div className="flex items-center mb-1">
                <div className="rounded-full w-6 h-6 flex justify-center items-center bg-indigo-100 shrink-0">
                    <RotateCw className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div className="ml-2 flex flex-1 items-center justify-between overflow-hidden">
                    <div className="truncate">
                        <div className="text-xs font-bold text-gray-700 truncate" title={nodeData.label}>{nodeData.label || '繰り返し'}</div>
                    </div>
                    {!isReadOnly && (
                        <button className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 shrink-0" onClick={() => setDialogOpen(true)} onMouseDown={(e) => e.stopPropagation()}>
                            <Pencil className="h-3 w-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            {/* Main Content */}
            <div className="text-[10px] text-gray-500 bg-gray-50 p-1.5 rounded relative min-h-[40px]">
                 {/* Standard Input Handle (Left) - Target - Hollow/Square */}
                <Handle 
                    type="target" 
                    position={Position.Left} 
                    isConnectable={isConnectable} 
                    isConnectableStart={false}
                    className="!bg-white !border-2 !border-gray-400 !w-2.5 !h-2.5 !rounded-none" 
                />
                
                <div className="font-semibold text-indigo-700 mb-0.5 text-[10px]">Items</div>
                <div className="text-[9px] text-indigo-600/80 mb-4 truncate" title={nodeData.items}>
                     {nodeData.items ? nodeData.items : <span className="text-gray-400 italic">例: {'{{users}}'}</span>}
                </div>

                {/* --- Handles & Labels --- */}

                {/* Loop Handle (Output) - Bottom Left (25%) - Filled (Source) */}
                <Handle 
                    type="source" 
                    position={Position.Bottom} 
                    id="loop" 
                    isConnectable={isConnectable}
                    className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white !rounded-full z-10"
                    style={{ left: '25%', bottom: 0, transform: 'translate(-50%, 50%)' }}
                />
                <div className="absolute bottom-3 left-1/4 -translate-x-1/2 text-[8px] font-bold text-indigo-700 pointer-events-none leading-none">Loop</div>

                {/* Return Handle (Input) - Bottom Right (75%) - Hollow (Target) */}
                <Handle 
                    type="target" 
                    position={Position.Bottom} 
                    id="loop-return" 
                    isConnectable={isConnectable}
                    isConnectableStart={false}
                    className="!w-4 !h-4 !bg-white !border-2 !border-indigo-500 !rounded-full !flex !items-center !justify-center !p-0 z-10"
                    style={{ left: '75%', bottom: 0, transform: 'translate(-50%, 50%)' }}
                >
                    <span className="text-[8px] text-indigo-700 font-bold pointer-events-none -mt-0.5">↩</span>
                </Handle>
                <div className="absolute bottom-3 left-3/4 -translate-x-1/2 text-[8px] font-bold text-indigo-700 pointer-events-none leading-none">Return</div>

                {/* End Handle (Output) - Right Side - Filled (Source) */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
                     <Handle 
                        type="source" 
                        position={Position.Right} 
                        id="completed" 
                        isConnectable={isConnectable}
                        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white !relative !transform-none !left-0 !top-0" 
                    />
                </div>
                <span className="text-[9px] font-bold text-indigo-700 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none leading-none pr-1">End</span>

                {typeof nodeData.statCount === 'number' && nodeData.statCount > 0 && (
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1 border border-white shadow-sm z-30">
                        {nodeData.statCount}
                    </div>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{isReadOnly ? '繰り返し設定 (読取専用)' : '繰り返し (ForEach) 設定'}</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>繰り返すリスト (変数)</Label>
                            <Input value={items} onChange={(e) => setItems(e.target.value)} placeholder="{{list}}" disabled={isReadOnly} />
                            <p className="text-xs text-muted-foreground">配列が格納されている変数を指定してください。</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>現在のアイテム変数名</Label>
                                <Input value={itemVariable} onChange={(e) => setItemVariable(e.target.value)} placeholder="item" disabled={isReadOnly} />
                            </div>
                            <div className="space-y-2">
                                <Label>インデックス変数名</Label>
                                <Input value={indexVariable} onChange={(e) => setIndexVariable(e.target.value)} placeholder="index" disabled={isReadOnly} />
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
        </div>
    );
}
