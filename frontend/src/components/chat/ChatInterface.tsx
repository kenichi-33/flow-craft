import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, CheckCircle, FileText, Play, Paperclip, X, File as FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { useAiConversation, type Message } from '@/hooks/useAiConversation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useFileUpload } from '@/hooks/useFileUpload';
import { toast } from 'sonner';

interface ChatInterfaceProps {
  flowId: string;
  sessionId?: string;
  agentName?: string;
  systemPrompt?: string;
  allowedApps?: string[];
  appName?: string;
}

export function ChatInterface({ 
  flowId, 
  sessionId: initialSessionId, 
  agentName: initialAgentName = 'AIアシスタント',
  systemPrompt: _initialSystemPrompt,
  allowedApps: _initialAllowedApps,
  appName: externalAppName,
}: ChatInterfaceProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  
  const {
    sessionId,
    messages,
    isLoading,
    agentName,
    sessionStatus,
    detectedApps,
    collectedSlots,
    executionResult,
    startConversation,
    sendMessage,
    loadSession,
  } = useAiConversation(flowId, {
    agentName: initialAgentName,
    systemPrompt: _initialSystemPrompt,
    allowedApps: _initialAllowedApps,
  });

  const { uploadFile, isUploading: isFileUploading } = useFileUpload();

  // 親Application取得 (セッションから)
  const { data: sessionData } = useQuery({
    queryKey: ['ai-session-for-app', sessionId],
    queryFn: () => api.get<any>(`/ai/chat/${sessionId}`),
    enabled: !!sessionId,
  });
  
  const parentAppId = sessionData?.applicationId;
  const { data: parentApp } = useQuery({
    queryKey: ['application-for-chat', parentAppId],
    queryFn: () => api.get<any>(`/applications/${parentAppId}`),
    enabled: !!parentAppId,
  });
  
  const displayAppName = externalAppName || parentApp?.applicationDefinition?.appName || parentApp?.applicationDefinition?.name;
  
  // 初期化: セッション開始または既存セッション読み込み
  useEffect(() => {
    const init = async () => {
      if (initialSessionId) {
        await loadSession(initialSessionId);
      } else {
        await startConversation();
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionId]); // initialSessionIdの変更時のみ実行

  // 自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if ((!inputMessage.trim() && !selectedFile) || isLoading || isFileUploading) return;

    const currentMessage = inputMessage;
    const currentFile = selectedFile;
    
    setInputMessage('');
    setSelectedFile(null);

    try {
      let finalMessage = currentMessage;

      if (currentFile) {
        try {
          const result = await uploadFile(currentFile);
          const fileMsg = `ファイルをアップロードしました: ${result.filename} (ID: ${result.fileId})`;
          finalMessage = finalMessage ? `${fileMsg}\n\n${finalMessage}` : fileMsg;
        } catch (error) {
          console.error('File upload failed', error);
          toast.error('ファイルのアップロードに失敗しました');
          setInputMessage(currentMessage);
          setSelectedFile(currentFile);
          return;
        }
      }

      await sendMessage(finalMessage);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('メッセージの送信に失敗しました');
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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
    <Card className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-purple-50 to-indigo-50">
        <Avatar>
          <AvatarFallback className="bg-purple-600 text-white">AI</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="font-semibold text-lg">{agentName || initialAgentName}</h2>
          <p className="text-xs text-muted-foreground">{displayAppName ? `対象: ${displayAppName}` : 'AIチャットボット'}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 検出されたアプリ表示 */}
        {detectedApps.length > 0 && (
          <Card className="p-4 bg-blue-50 border-blue-200">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              検出されたアプリケーション
            </h3>
            <div className="space-y-2">
              {detectedApps.map((app) => (
                <div key={app.appId} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium">{app.appName}</span>
                    <p className="text-muted-foreground text-xs">{app.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 情報収集進捗 */}
        {sessionStatus === 'COLLECTING' && detectedApps.length > 0 && (
          <Card className="p-4 bg-amber-50 border-amber-200">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Play className="h-4 w-4 text-amber-600" />
              情報収集中
            </h3>
            {detectedApps.map((app) => {
              const appSlots = collectedSlots[app.appId] || {};
              const filledCount = Object.keys(appSlots).length;
             
              return (
                <div key={app.appId} className="mb-3 last:mb-0">
                  <p className="text-sm font-medium mb-1">{app.appName}</p>
                  <Progress value={filledCount > 0 ? 50 : 0} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {filledCount > 0 ? '情報収集中...' : '待機中'}
                  </p>
                </div>
              );
            })}
          </Card>
        )}

        {/* 実行完了 */}
        {executionResult && (
          <Card className="p-4 bg-green-50 border-green-200">
            <h3 className="font-semibold mb-2 flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              実行完了
            </h3>
            <p className="text-sm mb-3">
              {executionResult.childApplicationIds.length}件のアプリケーションを実行しました。
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/applications/${executionResult.parentApplicationId}`)}
              className="w-full"
            >
              詳細を見る
            </Button>
          </Card>
        )}

        {messages.length === 0 && !isLoading && (
          <div className="text-center text-muted-foreground py-12">
            <p>こんにちは!何かお手伝いできることはありますか?</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} agentName={agentName} />
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{agentName}が入力中...</span>
          </div>
        )}
        
        {isFileUploading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-sm">ファイルをアップロード中...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-muted/20">
        {selectedFile && (
          <div className="mb-2 px-2">
            <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-md w-fit border border-slate-200">
               <FileIcon className="h-4 w-4 text-blue-500" />
               <span className="text-sm truncate max-w-[200px]">{selectedFile.name}</span>
               <Button variant="ghost" size="icon" onClick={handleRemoveFile} className="h-5 w-5 rounded-full hover:bg-slate-200">
                 <X className="h-3 w-3 text-slate-500" />
               </Button>
            </div>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileChange} 
          />
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleFileClick} 
            disabled={isLoading || isFileUploading}
            className="mb-0.5 text-muted-foreground hover:text-foreground"
            title="ファイルを添付"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          <Textarea
            value={inputMessage}
            onChange={(e) => {
              setInputMessage(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
            }}
            onKeyDown={handleKeyPress}
            placeholder="メッセージを入力... (Shift+Enter で改行)"
            disabled={isLoading || isFileUploading}
            className="flex-1 min-h-[40px] max-h-[200px] resize-none overflow-y-auto"
            rows={1}
          />
          <Button onClick={handleSend} disabled={isLoading || isFileUploading || (!inputMessage.trim() && !selectedFile)}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function MessageBubble({ message, agentName }: { message: Message; agentName: string }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar className="h-8 w-8">
        <AvatarFallback className={isUser ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'}>
          {isUser ? 'U' : 'AI'}
        </AvatarFallback>
      </Avatar>

      <div className={`flex flex-col gap-1 max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}>
        <span className="text-xs text-muted-foreground">
          {isUser ? 'あなた' : agentName}
        </span>
        <div
          className={`px-4 py-2 rounded-lg ${
            isUser
              ? 'bg-blue-600 text-white'
              : 'bg-muted border'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {message.timestamp.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}
