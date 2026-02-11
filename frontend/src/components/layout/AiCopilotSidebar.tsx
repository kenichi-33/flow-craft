import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUiStore } from '@/stores/useUiStore';
import { useAiCopilot } from '@/hooks/useAiCopilot';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, User, Bot, Loader2, Paperclip, File as FileIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useFileUpload } from '@/hooks/useFileUpload';

export function AiCopilotSidebar() {
  const { isCopilotOpen, toggleCopilot } = useUiStore();
  const { messages, isLoading, sendMessage, startSession, sessionId } = useAiCopilot();
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const { uploadFile, isUploading: isFileUploading } = useFileUpload();

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isFileUploading]);

  // Initial session start
  useEffect(() => {
    if (isCopilotOpen && !sessionId && !isInitializing) {
      const init = async () => {
        setIsInitializing(true);
        try {
          await startSession();
        } finally {
          setIsInitializing(false);
        }
      };
      init();
    }
  }, [isCopilotOpen, sessionId, isInitializing, startSession]);

  // Action Handling
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.action) {
      const { type, payload } = lastMessage.action;
      console.log('Executing AI Action:', type, payload);

      if (type === 'NAVIGATE' && payload.path) {
        navigate(payload.path);
        toast.info(`ページを移動しました: ${payload.path}`);
      } else if (type === 'FILL_FORM' && payload.data) {
        // Dispatch event for form page to catch
        window.dispatchEvent(new CustomEvent('ai-fill-form', { detail: payload.data }));
        toast.success('フォームに入力データを送信しました');
      } else if (type === 'FILTER_LIST') {
        // Dispatch filter event for list pages
        window.dispatchEvent(new CustomEvent('ai-filter-list', { detail: payload }));
        toast.success('一覧を絞り込みました');
      } else if (type === 'SHOW_ALERT' && payload.message) {
        if (payload.type === 'error') {
            toast.error(payload.message);
        } else if (payload.type === 'warning') {
            toast.warning(payload.message);
        } else {
            toast.info(payload.message);
        }
      }
    }
  }, [messages, navigate]);

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || isLoading || isFileUploading) return;
    
    const message = input;
    const file = selectedFile;
    
    setInput('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    try {
      let finalMessage = message;

      if (file) {
        try {
          const result = await uploadFile(file);
          const fileMsg = `ファイルをアップロードしました: ${result.filename} (ID: ${result.fileId})`;
          finalMessage = finalMessage ? `${fileMsg}\n\n${finalMessage}` : fileMsg;
        } catch (error) {
          console.error('File upload failed', error);
          // Restore input on failure
          setInput(message);
          setSelectedFile(file);
          return;
        }
      }

      // Get context from current page
      const context = {
        path: window.location.pathname,
        // Potentially add more context about the current view here in the future
      };
      await sendMessage(finalMessage, context);
    } catch (error) {
      console.error(error);
      toast.error('メッセージ送信に失敗しました');
    }
  };



  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSelectedFile(file);
    e.target.value = '';
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // IME入力中は送信しない
    if (e.nativeEvent.isComposing || (e.nativeEvent as any).isComposing) {
        return;
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={cn(
        "fixed right-0 top-0 h-screen w-80 bg-background border-l shadow-xl transform transition-transform duration-300 z-50 flex flex-col",
        isCopilotOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          AI Copilot
        </h3>
        <div className="flex items-center gap-1">
          {selectedFile && (
             <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md max-w-[120px]">
                <FileIcon className="h-3 w-3 text-blue-500 shrink-0" />
                <span className="text-xs truncate">{selectedFile.name}</span>
                <Button variant="ghost" size="icon" className="h-4 w-4 rounded-full p-0" onClick={handleRemoveFile}>
                  <X className="h-3 w-3" />
                </Button>
             </div>
          )}
          <Button variant="ghost" size="icon" onClick={toggleCopilot}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-muted-foreground mt-10">
            <p>こんにちは！何かお手伝いしましょうか？</p>
            <p className="text-xs mt-2">画面の案内やフォームの入力をサポートします。</p>
          </div>
        )}
        
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex items-start gap-2 text-sm",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div
                className={cn(
                  "p-3 rounded-lg max-w-[85%]",
                  msg.role === 'user' 
                    ? "bg-primary text-primary-foreground rounded-br-none" 
                    : "bg-muted rounded-bl-none"
                )}
              >
                <div className="whitespace-pre-wrap break-words">
                  {msg.content}
                </div>
                {msg.action && (
                  <div className="mt-2 p-2 bg-background/50 rounded text-xs font-mono border">
                    Action: {msg.action.type}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm pl-10">
              <Loader2 className="h-4 w-4 animate-spin" />
              考え中...
            </div>
          )}
          {isFileUploading && (
             <div className="flex items-center gap-2 text-muted-foreground text-sm pl-10">
               <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
               ファイルをアップロード中...
             </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-muted/10">
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileChange} 
        />
        <div className="flex gap-2 items-end">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleFileClick} 
            disabled={isLoading || isFileUploading}
            className="mb-0.5 text-muted-foreground hover:text-foreground shrink-0"
            title="ファイルを添付"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          <Textarea
            value={input}
            onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力..."
            disabled={isLoading || isFileUploading}
            className="flex-1 min-h-[40px] max-h-[120px] resize-none overflow-y-auto py-2 px-3 text-sm"
            rows={1}
          />
          <Button size="icon" onClick={handleSend} disabled={isLoading || isFileUploading || (!input.trim() && !selectedFile)} className="shrink-0 mb-0.5">
            {isLoading || isFileUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
