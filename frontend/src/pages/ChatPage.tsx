import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { Card } from '@/components/ui/card';
import { MessageCircle, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

export default function ChatPage() {
  const { flowId, sessionId } = useParams<{ flowId?: string; sessionId?: string }>();

  // FlowDefinition取得
  const { data: flowDef, isLoading: isFlowLoading, error } = useQuery<any>({
    queryKey: ['flows', flowId],
    queryFn: () => api.get(`/flows/${flowId}`),
    enabled: !!flowId,
  });

  // Session取得 (親子関係確認用)
  const { data: session } = useQuery({
    queryKey: ['ai-session', sessionId],
    queryFn: () => api.get<any>(`/ai/chat/${sessionId}`),
    enabled: !!sessionId,
  });

  // Parent Application取得
  const parentAppId = session?.applicationId;
  const { data: parentApp } = useQuery({
    queryKey: ['application', parentAppId],
    queryFn: () => api.get<any>(`/applications/${parentAppId}`),
    enabled: !!parentAppId,
  });

  if (!flowId) {
    return (
      <div className="container mx-auto p-8">
        <Card className="p-12 text-center">
          <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">フローIDが指定されていません</h2>
          <p className="text-muted-foreground">
            正しいURLからアクセスしてください。
          </p>
        </Card>
      </div>
    );
  }

  if (isFlowLoading) {
    return (
      <div className="container mx-auto p-8">
        <Card className="p-12 text-center">
          <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
          <p className="text-muted-foreground">読み込み中...</p>
        </Card>
      </div>
    );
  }

  if (error || !flowDef) {
    return (
      <div className="container mx-auto p-8">
        <Card className="p-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">フローが見つかりません</h2>
          <p className="text-muted-foreground">
            指定されたフローIDが存在しないか、アクセス権限がありません。
          </p>
        </Card>
      </div>
    );
  }

  // AI Start Nodeを検索
  const aiStartNode = flowDef.nodes?.find((n: any) => n.type === 'aiStart');

  if (!aiStartNode) {
    return (
      <div className="container mx-auto p-8">
        <Card className="p-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">AIチャット未対応</h2>
          <p className="text-muted-foreground">
            このフローはAIチャットに対応していません。
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 h-[calc(100vh-4rem)]">
      <ChatInterface 
        flowId={flowId} 
        sessionId={sessionId}
        agentName={aiStartNode.data?.agentName}
        systemPrompt={aiStartNode.data?.systemPrompt}
        allowedApps={aiStartNode.data?.allowedApps}
        appName={parentApp?.title}
      />
    </div>
  );
}
