import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Database } from 'lucide-react';

export function ConnectorSelectionDialog({ 
    selectedId, 
    connectors, 
    onSelect, 
    disabled 
}: { 
    selectedId?: string; 
    connectors: any[]; 
    onSelect: (id: string) => void; 
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const selectedConnector = connectors.find(c => c.id === selectedId);
    
    // Filter connectors
    const filtered = connectors.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase()) || 
        (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
    );

    const handleSelect = (id: string) => {
        onSelect(id);
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button 
                    variant="outline" 
                    role="combobox" 
                    className="w-full justify-between h-auto min-h-[2rem] py-2 px-3 text-left font-normal"
                    disabled={disabled}
                >
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                        <span className={selectedConnector ? "text-foreground" : "text-muted-foreground"}>
                            {selectedConnector ? selectedConnector.name : "コネクタを選択してください"}
                        </span>
                        {selectedConnector && (
                            <span className="text-[10px] text-muted-foreground truncate">
                                {selectedConnector.description || '説明なし'}
                            </span>
                        )}
                    </div>
                    <Database className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-6">
                <DialogHeader>
                    <DialogTitle>マスターコネクタの選択</DialogTitle>
                    <DialogDescription>
                        フォームで使用する外部データソースを選択してください。
                    </DialogDescription>
                </DialogHeader>
                
                <div className="relative mb-2">
                    <Database className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="コネクタを検索..." 
                        className="pl-9" 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex-1 overflow-y-auto border rounded-md divide-y">
                    {filtered.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            見つかりませんでした
                        </div>
                    ) : (
                        filtered.map((connector) => (
                            <div 
                                key={connector.id} 
                                className={`
                                    p-4 cursor-pointer hover:bg-muted/50 transition-colors flex items-start gap-4
                                    ${selectedId === connector.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''}
                                `}
                                onClick={() => handleSelect(connector.id)}
                            >
                                <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${selectedId === connector.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                    <Database className="h-4 w-4" />
                                </div>
                                <div className="space-y-1 overflow-hidden">
                                    <h4 className="font-semibold text-sm flex items-center gap-2">
                                        {connector.name}
                                        <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                            {connector.type === 'rest' ? 'REST API' : connector.type}
                                        </span>
                                    </h4>
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        {connector.description || '説明がありません'}
                                    </p>
                                    <div className="text-[10px] text-muted-foreground/70 font-mono truncate">
                                        {connector.config?.url}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>キャンセル</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
