import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TruncatedCellProps {
  text: string | null | undefined;
  maxWidth?: string | number;
  className?: string;
}

export const TruncatedCell: React.FC<TruncatedCellProps> = ({ 
  text, 
  maxWidth = '200px', 
  className = '' 
}) => {
  if (!text) return <span>-</span>;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`truncate cursor-help ${className}`} 
            style={{ maxWidth }}
          >
            {text}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-[400px] break-words">
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
