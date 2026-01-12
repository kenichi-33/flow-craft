import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface ApprovalActionProps {
    onApprove: (comment: string) => void;
    onReject: (comment: string) => void;
    onRemand: (comment: string) => void;
    isPending: boolean;
}

export default function ApprovalAction({ onApprove, onReject, onRemand, isPending }: ApprovalActionProps) {
    const [comment, setComment] = useState('');

    return (
        <Card className="border-2 border-primary/20 shadow-md">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    承認アクション
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="comment">コメント (任意)</Label>
                    <Textarea 
                        id="comment" 
                        placeholder="承認または却下の理由を入力..." 
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="min-h-[100px]"
                    />
                </div>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-3 justify-end pt-2 pb-6">
                <Button 
                    variant="outline" 
                    className="border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700" 
                    onClick={() => onRemand(comment)}
                    disabled={isPending}
                >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertCircle className="h-4 w-4 mr-2" />}
                    差戻し
                </Button>
                <Button 
                    variant="destructive" 
                    onClick={() => onReject(comment)}
                    disabled={isPending}
                >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                    却下
                </Button>
                <Button 
                    className="bg-primary hover:bg-primary/90" 
                    onClick={() => onApprove(comment)}
                    disabled={isPending}
                >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                    承認する
                </Button>
            </CardFooter>
        </Card>
    );
}
