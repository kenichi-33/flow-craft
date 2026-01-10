// EndNode - Converted from MUI to Tailwind
import { Handle, Position } from '@xyflow/react';

export default function EndNode({ data }: { data: any }) {
    return (
        <div className="w-[60px] h-[60px] rounded-full bg-gradient-to-br from-red-400 to-red-700 flex items-center justify-center shadow-lg border-[3px] border-white">
            <Handle
                type="target"
                position={Position.Left}
                className="!bg-red-700 !w-2.5 !h-2.5 !border-2 !border-white"
            />
            <span className="text-xs text-white font-bold drop-shadow-sm">
                {data.label || '終了'}
            </span>
        </div>
    );
}
