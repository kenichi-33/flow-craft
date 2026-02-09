import { memo, useState } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { Card } from '@/components/ui/card';
import { ShieldCheck, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AiCheckNodeConfig from './AiCheckNodeConfig';

const AiCheckNode = ({ id, data, selected }: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const isReadOnly = data.readOnly === true;

  const handleSave = (newData: any) => {
      setNodes((nds) =>
          nds.map((node) =>
              node.id === id ? { ...node, data: { ...node.data, ...newData } } : node
          )
      );
      setDialogOpen(false);
  };
  
  return (
    <>
        <Card 
        className={`group min-w-[150px] p-2 flex items-center gap-2 border-2 transition-colors ${isReadOnly ? 'cursor-pointer' : 'cursor-default'} ${
            selected ? 'border-primary ring-2 ring-primary/20' : 'border-emerald-200 hover:border-emerald-300'
        } bg-emerald-50`}
        onClick={isReadOnly ? () => setDialogOpen(true) : undefined}
        >
        <Handle 
            type="target" 
            position={Position.Left} 
            className="!bg-white !border-2 !border-blue-700 !w-2.5 !h-2.5 !rounded-none" 
        />
        
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-emerald-100 text-emerald-600">
            <ShieldCheck className="h-5 w-5" />
        </div>
        
        <div className="flex flex-col flex-1 min-w-0">
            <span className="text-xs font-bold text-emerald-900 line-clamp-1">
                {String(data.label || 'AIチェック')}
            </span>
            <span className="text-[10px] text-emerald-700/80 line-clamp-1">
                {String(data.targetSource === 'form' ? 'フォーム全体' : data.targetSource || '項目未設定')}
            </span>
        </div>

        {!isReadOnly && (
            <div 
                className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-1 hover:bg-emerald-200/50 rounded" 
                onClick={(e) => { e.stopPropagation(); setDialogOpen(true); }}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <Pencil className="h-3 w-3 text-emerald-600" />
            </div>
        )}

        <Handle 
            type="source" 
            position={Position.Right} 
            className="!bg-blue-700 !w-2.5 !h-2.5 !border-2 !border-white !rounded-full" 
        />
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>AIチェック設定</DialogTitle>
                </DialogHeader>
                <AiCheckNodeConfig 
                    data={data} 
                    onSave={handleSave} 
                    onCancel={() => setDialogOpen(false)} 
                    isReadOnly={isReadOnly}
                />
            </DialogContent>
        </Dialog>
    </>
  );
};

export default memo(AiCheckNode);

