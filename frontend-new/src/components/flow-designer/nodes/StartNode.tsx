// StartNode - Converted from MUI to Tailwind
import { Handle, Position } from '@xyflow/react';

export default function StartNode({ data }: { data: any }) {
    return (
        <div className="w-[60px] h-[60px] rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center shadow-lg border-[3px] border-white">
            <span className="text-xs text-white font-bold drop-shadow-sm">
                {data.label || '開始'}
            </span>
            <Handle
                type="source"
                position={Position.Right}
                className="!bg-green-700 !w-2.5 !h-2.5 !border-2 !border-white"
            />
        </div>
    );
}
