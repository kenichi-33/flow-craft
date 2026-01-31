import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';

export default function DesignerNewAppPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState<string | null>(null);

    const createMutation = useMutation({
        mutationFn: (data: { name: string; description?: string }) =>
            api.post('/application-definitions', data),
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['application-definitions'] });
            navigate(`/designer/apps/${data.id}`);
        },
        onError: (err: any) => {
            setError(err.message || 'アプリの作成に失敗しました');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Prevent duplicate submissions
        if (createMutation.isPending) return;
        
        setError(null);
        if (!name.trim()) {
            setError('アプリ名は必須です');
            return;
        }
        createMutation.mutate({
            name: name.trim(),
            description: description.trim() || undefined,
        });
    };

    return (
        <div className="max-w-2xl mx-auto p-6">
            <Button variant="ghost" asChild className="mb-6">
                <Link to="/designer/apps"><ArrowLeft className="h-4 w-4 mr-2" />アプリ一覧に戻る</Link>
            </Button>

            <div className="mb-8">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Sparkles className="h-8 w-8 text-primary" />
                    新規アプリ作成
                </h1>
                <p className="text-muted-foreground mt-2">
                    まずアプリの基本情報を入力してください。フォームとフローは作成後に設定できます。
                </p>
            </div>

            <Card className="border-0 shadow-lg">
                <CardHeader>
                    <CardTitle>基本情報</CardTitle>
                    <CardDescription>アプリ名と説明を入力してください</CardDescription>
                </CardHeader>
                <CardContent>
                    {error && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="name">アプリ名 *</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="例: 休暇申請"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">説明</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="例: 有給休暇・特別休暇の申請用アプリ"
                                rows={3}
                            />
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button type="button" variant="outline" asChild>
                                <Link to="/designer/apps">キャンセル</Link>
                            </Button>
                            <Button type="submit" disabled={createMutation.isPending}>
                                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                {createMutation.isPending ? '作成中...' : '作成してフォーム設定へ'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
