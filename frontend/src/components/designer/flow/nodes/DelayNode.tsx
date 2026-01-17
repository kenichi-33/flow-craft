import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Clock, Pencil, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DelayNode = ({ data }: any) => {
    const [open, setOpen] = React.useState(false);
    const [config, setConfig] = React.useState({
        delayType: data.delayType || 'duration', // duration | fixed
        value: data.value || '5',
        unit: data.unit || 'minutes', // minutes | hours | days
    });

    const handleSave = () => {
        data.delayType = config.delayType;
        data.unit = config.unit;
        
        let minutes = parseInt(config.value, 10);
        if (config.unit === 'hours') minutes *= 60;
        if (config.unit === 'days') minutes *= 60 * 24;
        
        data.displayValue = config.value;
        data.value = minutes.toString(); 
        
        setOpen(false);
    };

    const { readOnly } = data;

    return (
        <>
            <div
                className="min-w-[140px] min-h-[60px] px-4 py-2 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 flex flex-col items-center justify-center shadow-lg border-2 border-white/50 relative"
                style={{ cursor: readOnly ? 'pointer' : 'default' }}
                onClick={readOnly ? () => setOpen(true) : undefined}
            >
                <Handle type="target" position={Position.Left} className="!bg-yellow-700 !w-2.5 !h-2.5 !border-2 !border-white" />
                <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-white" />
                    <span className="text-sm text-white font-bold drop-shadow-sm">待機 (タイマー)</span>
                    {!readOnly && (
                        <button className="p-0.5 text-white hover:bg-white/20 rounded ml-1" onClick={() => setOpen(true)} onMouseDown={(e) => e.stopPropagation()}>
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                <div className="text-[9px] text-white/90 mt-1 truncate max-w-[120px]">
                    {config.delayType === 'fixed' 
                        ? `指定時刻: ${config.value}` 
                        : `${data.displayValue || '5'} ${data.unit === 'hours' ? '時間' : data.unit === 'days' ? '日' : '分'}`}
                </div>
                <Handle type="source" position={Position.Right} className="!bg-yellow-700 !w-2.5 !h-2.5 !border-2 !border-white" />
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>待機設定 {readOnly && <span className="text-xs font-normal text-muted-foreground ml-2">(読み取り専用)</span>}</DialogTitle>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                        <RadioGroup 
                            value={config.delayType} 
                            onValueChange={(val) => setConfig({...config, delayType: val})}
                            className="grid grid-cols-2 gap-4"
                            disabled={readOnly}
                        >
                            <div className="relative">
                                <RadioGroupItem value="duration" id="duration" className="peer sr-only" />
                                <Label
                                    htmlFor="duration"
                                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-blue-50/50 [&:has([data-state=checked])]:border-primary transition-all cursor-pointer"
                                >
                                    <Clock className="mb-3 h-6 w-6 text-primary" />
                                    期間を指定
                                    <div className="hidden peer-data-[state=checked]:block absolute top-2 right-2 text-primary">
                                        <Check className="h-4 w-4" />
                                    </div>
                                </Label>
                            </div>
                            <div className="relative">
                                <RadioGroupItem value="fixed" id="fixed" className="peer sr-only" disabled />
                                <Label
                                    htmlFor="fixed"
                                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 opacity-50 cursor-not-allowed"
                                >
                                    <Check className="mb-3 h-6 w-6" />
                                    日時を指定
                                    <span className="text-[10px] text-muted-foreground mt-1">(開発中)</span>
                                </Label>
                            </div>
                        </RadioGroup>

                        {config.delayType === 'duration' && (
                            <div className="flex gap-2 items-end">
                                <div className="grid gap-1.5 flex-1">
                                    <Label htmlFor="value">値</Label>
                                    <Input 
                                        id="value" 
                                        type="number" 
                                        min="1"
                                        value={config.value} 
                                        onChange={(e) => setConfig({...config, value: e.target.value})} 
                                        disabled={readOnly}
                                    />
                                </div>
                                <div className="grid gap-1.5 w-24">
                                    <Label htmlFor="unit">単位</Label>
                                    <Select 
                                        value={config.unit} 
                                        onValueChange={(val) => setConfig({...config, unit: val})}
                                        disabled={readOnly}
                                    >
                                        <SelectTrigger id="unit">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="minutes">分</SelectItem>
                                            <SelectItem value="hours">時間</SelectItem>
                                            <SelectItem value="days">日</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>閉じる</Button>
                        {!readOnly && <Button onClick={handleSave}>保存</Button>}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default memo(DelayNode);
