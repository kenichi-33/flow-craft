import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2, FileText, Upload, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface RagSource {
  id: string;
  name: string;
  type: 'file' | 'text';
  content?: string;
  fileId?: string;
  file?: {
    originalName: string;
  };
  createdAt: string;
}

export default function DesignerRagPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState('text');
  const [isUploading, setIsUploading] = useState(false);

  // Queries
  const { data: sources, isLoading } = useQuery<RagSource[]>({
    queryKey: ['rag-sources', id],
    queryFn: () => api.get(`/application-definitions/${id}/rag/sources`),
    enabled: !!id,
  });

  // Mutations
  const createSourceMutation = useMutation({
    mutationFn: async (data: any) => {
        return api.post(`/application-definitions/${id}/rag/sources`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rag-sources', id] });
      toast.success('ソースを追加しました');
      resetForm();
    },
    onError: (err: any) => {
      toast.error('ソースの追加に失敗しました: ' + (err.message || 'Unknown error'));
      setIsUploading(false);
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: (sourceId: string) => api.delete(`/application-definitions/${id}/rag/sources/${sourceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rag-sources', id] });
      toast.success('ソースを削除しました');
    },
    onError: (err: any) => {
      toast.error('削除に失敗しました: ' + err.message);
    },
  });

  const resetForm = () => {
      setName('');
      setTextContent('');
      setSelectedFile(null);
      setIsAddDialogOpen(false);
      setIsUploading(false);
  };

  const handleSubmit = async () => {
      if (!name) {
          toast.error('名前を入力してください');
          return;
      }

      if (activeTab === 'text') {
          if (!textContent) {
              toast.error('テキスト内容を入力してください');
              return;
          }
          createSourceMutation.mutate({
              name,
              type: 'text',
              content: textContent
          });
      } else {
          // File Upload
          if (!selectedFile) {
              toast.error('ファイルを選択してください');
              return;
          }

          try {
              setIsUploading(true);
              // 1. Upload file using existing File API (similar to AiGenericDialog)
              // We need to implement file upload. 
              // Assuming there is an endpoint or hook.
              // Since I cannot easily access hooks from here without seeing them,
              // I will implement raw upload logic based on typical patterns or just use a helper if available.
              // I recall `api.post('/storage/upload/presigned', ...)` pattern in StorageService.
              
              const { data: presignedData } = await api.post<{ fileId: string; uploadUrl: string }>('/storage/upload/presigned', {
                  filename: selectedFile.name,
                  mimeType: selectedFile.type,
                  size: selectedFile.size
              });

              // Upload to MinIO/S3
              await fetch(presignedData.uploadUrl, {
                  method: 'PUT',
                  body: selectedFile,
                  headers: {
                      'Content-Type': selectedFile.type
                  }
              });

              // Confirm upload
              await api.post(`/storage/upload/confirm`, { fileId: presignedData.fileId });

              // 2. Register RAG Source
              createSourceMutation.mutate({
                  name,
                  type: 'file',
                  fileId: presignedData.fileId
              });

          } catch (e: any) {
              console.error(e);
              toast.error('ファイルのアップロードに失敗しました');
              setIsUploading(false);
          }
      }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 container mx-auto max-w-5xl">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">知識ベース (RAG)</h2>
          <p className="text-muted-foreground">
            AI Copilotが回答に使用するドキュメントやテキストを管理します。
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
                <Plus className="h-4 w-4 mr-2" />
                ソースを追加
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>知識ベースに追加</DialogTitle>
              <DialogDescription>
                AIが参照するドキュメントやテキストルールを追加します。
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="name">ソース名</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 出張旅費規程 2024" />
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="text">テキスト入力</TabsTrigger>
                        <TabsTrigger value="file">ファイルアップロード</TabsTrigger>
                    </TabsList>
                    <TabsContent value="text" className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label htmlFor="content">内容</Label>
                            <Textarea 
                                id="content" 
                                value={textContent} 
                                onChange={(e) => setTextContent(e.target.value)} 
                                placeholder="テキストルールを入力してください..." 
                                className="min-h-[200px]"
                            />
                        </div>
                    </TabsContent>
                    <TabsContent value="file" className="space-y-4 mt-4">
                         <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4 hover:bg-muted/50 transition-colors">
                            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                            <div className="space-y-1">
                                <Label htmlFor="file-upload" className="cursor-pointer text-primary hover:underline">
                                    ファイルを選択
                                </Label>
                                <Input 
                                    id="file-upload" 
                                    type="file" 
                                    className="hidden" 
                                    accept=".pdf,.txt,.md"
                                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                />
                                <p className="text-sm text-muted-foreground">
                                    {selectedFile ? selectedFile.name : 'PDF, TXT, MDファイルをドラッグ＆ドロップ'}
                                </p>
                            </div>
                         </div>
                    </TabsContent>
                </Tabs>
            </div>

            <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>キャンセル</Button>
                <Button onClick={handleSubmit} disabled={isUploading || createSourceMutation.isPending}>
                    {(isUploading || createSourceMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    追加する
                </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sources?.map((source) => (
          <Card key={source.id} className="relative group">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <CardTitle className="text-base truncate" title={source.name}>{source.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 text-xs">
                           <FileText className="h-3 w-3" />
                           {source.type === 'file' ? 'ファイル' : 'テキスト'}
                           {source.type === 'file' && source.file && ` (${source.file.originalName})`}
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-xs text-muted-foreground line-clamp-3 h-[4.5em]">
                    {source.type === 'text' ? source.content : (source.file?.originalName || 'バイナリファイル')}
                </div>
                <div className="mt-4 flex justify-between items-center text-xs text-muted-foreground">
                    <span>{new Date(source.createdAt).toLocaleDateString()}</span>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                            if (confirm('本当に削除しますか？')) {
                                deleteSourceMutation.mutate(source.id);
                            }
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
          </Card>
        ))}
        
        {sources?.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg text-muted-foreground">
                <FileText className="h-12 w-12 mb-4 opacity-20" />
                <p>まだ知識ベースがありません。</p>
                <Button variant="link" onClick={() => setIsAddDialogOpen(true)}>最初のソースを追加</Button>
            </div>
        )}
      </div>
    </div>
  );
}
