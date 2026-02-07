import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface AiFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFilled: (data: Record<string, any>, referencedHistoryId: string | null) => void;
  formSchema: any;
  currentUser: { id: string; name?: string; departmentName?: string };
}

interface AiFillResponse {
  data: Record<string, any>;
  referenced_history_id: string | null;
  reasoning: string;
}

export default function AiFormDialog({ open, onOpenChange, onFilled, formSchema, currentUser }: AiFormDialogProps) {
  /* Animation messages */
  const LOADING_MESSAGES = [
    "指示を解析中...",
    "過去の申請履歴を参照しています...",
    "フォームデータを生成中...",
    "内容を検証しています...",
  ];

  /* State */
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [generatedResult, setGeneratedResult] = useState<AiFillResponse | null>(null);

  /* Animation Effect */
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (loading) {
      let index = 0;
      setLoadingMessage(LOADING_MESSAGES[0]);
      interval = setInterval(() => {
        index = (index + 1) % LOADING_MESSAGES.length;
        setLoadingMessage(LOADING_MESSAGES[index]);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setGeneratedResult(null);
    try {
      const result = await api.post<AiFillResponse>('/ai/fill-form', { 
        prompt, 
        formSchema,
        currentUser 
      });
      setGeneratedResult(result);
      toast.success('入力案が作成されました');
    } catch (error) {
      console.error(error);
      toast.error('AI自動入力に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (generatedResult) {
      onFilled(generatedResult.data, generatedResult.referenced_history_id);
      onOpenChange(false);
      setPrompt('');
      setGeneratedResult(null);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setGeneratedResult(null);
      setLoading(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            ✨ AI自動入力
          </DialogTitle>
          <DialogDescription>
            申請内容を自然言語で入力してください。過去の申請履歴を参考に、フォームを自動で埋めます。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-500">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-4 border-purple-100 animate-pulse"></div>
              <Loader2 className="h-12 w-12 text-purple-600 animate-spin absolute top-0 left-0" />
            </div>
            <p className="text-purple-700 font-medium animate-pulse">{loadingMessage}</p>
          </div>
        ) : generatedResult ? (
          <div className="space-y-4 py-4 animate-in slide-in-from-bottom-5 fade-in duration-500">
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
              <h4 className="flex items-center gap-2 font-bold text-purple-800 mb-2">
                <Sparkles className="h-4 w-4" /> AIからの提案
              </h4>
              <p className="text-sm text-purple-800 whitespace-pre-wrap leading-relaxed">
                {generatedResult.reasoning}
              </p>
            </div>
            {generatedResult.referenced_history_id && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm text-blue-800">
                📝 過去の申請データを参照しました
              </div>
            )}
            <div className="text-xs text-muted-foreground text-center">
              上記の内容でフォームに反映しますか？
            </div>
          </div>
        ) : (
          <div className="py-4 font-mono font-medium">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例: 先月のAWSサーバー代の申請と同じで、金額は今月5,000円だった"
              rows={5}
              className="resize-none focus-visible:ring-purple-500"
            />
          </div>
        )}

        <DialogFooter>
          {generatedResult ? (
            <>
              <Button variant="ghost" onClick={() => setGeneratedResult(null)}>戻る</Button>
              <Button onClick={handleApply} className="bg-emerald-600 hover:bg-emerald-700">
                反映する
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>キャンセル</Button>
              <Button onClick={handleGenerate} disabled={loading || !prompt.trim()} className="bg-purple-600 hover:bg-purple-700">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {loading ? "生成中..." : "生成する"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
