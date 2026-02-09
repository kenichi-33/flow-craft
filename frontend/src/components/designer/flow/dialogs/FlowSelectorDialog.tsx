import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import { api } from '@/lib/api';

interface Flow {
  id: string;
  name: string;
}

interface FlowSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFlowIds: string[];
  onSave: (flowIds: string[]) => void;
  mode?: 'flow' | 'app'; // 新規: フロー選択かアプリ選択か
}

export function FlowSelectorDialog({
  open,
  onOpenChange,
  selectedFlowIds,
  onSave,
  mode = 'flow', // デフォルトはフロー選択
}: FlowSelectorDialogProps) {
  const [selected, setSelected] = useState<string[]>(selectedFlowIds);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: flows, isLoading, error } = useQuery<Flow[]>({
    queryKey: mode === 'app' ? ['application-definitions'] : ['flows'],
    queryFn: () => api.get(mode === 'app' ? '/application-definitions' : '/flows'),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setSelected(selectedFlowIds);
      setSearchQuery('');
    }
  }, [open, selectedFlowIds]);

  const handleToggle = (flowId: string) => {
    setSelected((prev) =>
      prev.includes(flowId)
        ? prev.filter((id) => id !== flowId)
        : [...prev, flowId]
    );
  };

  const handleSave = () => {
    onSave(selected);
    onOpenChange(false);
  };

  const filteredFlows = flows?.filter((flow) =>
    flow.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{mode === 'app' ? '許可アプリを選択' : '許可フローを選択'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={mode === 'app' ? 'アプリ名で検索...' : 'フロー名で検索...'}
              className="pl-9"
            />
          </div>

          {/* Flow List */}
          <div className="flex-1 overflow-y-auto border rounded-md p-3 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredFlows && filteredFlows.length > 0 ? (
              filteredFlows.map((flow) => (
                <div
                  key={flow.id}
                  className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded cursor-pointer"
                  onClick={() => handleToggle(flow.id)}
                >
                  <Checkbox
                    checked={selected.includes(flow.id)}
                    onCheckedChange={() => handleToggle(flow.id)}
                  />
                  <Label className="flex-1 cursor-pointer">{flow.name}</Label>
                  <span className="text-xs text-muted-foreground">ID: {flow.id}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? '検索結果がありません' : mode === 'app' ? 'アプリがありません' : 'フローがありません'}
              </div>
            )}
          </div>

          {/* Selection Count */}
          <div className="text-sm text-muted-foreground">
            {selected.length} 個の{mode === 'app' ? 'アプリ' : 'フロー'}を選択中
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
