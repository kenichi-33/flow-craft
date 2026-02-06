import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface AiGenericDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: (data: any) => void;
  type: 'form' | 'flow';
}

interface AiGenerationResponse {
  reasoning?: string;
  data: any;
}

export default function AiGenericDialog({ open, onOpenChange, onGenerated, type }: AiGenericDialogProps) {
  /* Animation messages */
  const LOADING_MESSAGES = [
    "要件を分析しています...",
    "全体の構成を設計中...",
    "詳細なパラメータを調整中...",
    "JSONデータを生成しています...",
  ];

  /* State */
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [generatedResult, setGeneratedResult] = useState<{ reasoning: string, data: any } | null>(null);

  /* Animation Effect */
  useEffect(() => {
    let interval: any;
    if (loading) {
      let index = 0;
      setLoadingMessage(LOADING_MESSAGES[0]);
      interval = setInterval(() => {
        index = (index + 1) % LOADING_MESSAGES.length;
        setLoadingMessage(LOADING_MESSAGES[index]);
      }, 3000); // Switch every 3 seconds
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setGeneratedResult(null);
    try {
      const result = await api.post<AiGenerationResponse | any>('/ai/generate', { prompt, type });
      // Expecting result to have { reasoning, data } structure now
      // Fallback for legacy format if data is direct
        if (result.reasoning && result.data) {
            setGeneratedResult(result);
            toast.success('生成案が完成しました');
        } else {
             // Fallback: direct data
             setGeneratedResult({ reasoning: "自動生成が完了しました。", data: result });
             toast.success('生成しました');
        }
    } catch (error) {
      console.error(error);
      toast.error('AI生成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
      if (generatedResult) {
          onGenerated(generatedResult.data);
          onOpenChange(false);
          setPrompt('');
          setGeneratedResult(null);
      }
  }

  // Close handler to reset state
  const handleOpenChange = (newOpen: boolean) => {
      if (!newOpen) {
          setGeneratedResult(null);
          setLoading(false);
      }
      onOpenChange(newOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI自動生成 ({type === 'form' ? 'フォーム' : 'フロー'})
          </DialogTitle>
          <DialogDescription>
            {type === 'form' 
              ? 'どのようなフォームを作成したいか記述してください。' 
              : 'どのようなワークフローを作成したいか記述してください。'}
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
                        <Sparkles className="h-4 w-4" /> 生成AIからの提案
                    </h4>
                    <p className="text-sm text-purple-800 whitespace-pre-wrap leading-relaxed">
                        {generatedResult.reasoning}
                    </p>
                </div>
                <div className="text-xs text-muted-foreground text-center">
                    上記の内容でエディタに反映しますか？
                </div>
            </div>
        ) : (
             <div className="py-4 font-mono font-medium">
                <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={type === 'form' ? "例: 交通費精算申請。日付、訪問先、金額、領収書添付が必要。" : "例: 2段階承認フロー。課長承認のあとに部長承認。"}
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
