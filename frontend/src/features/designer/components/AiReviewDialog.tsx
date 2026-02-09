import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info, CheckCircle, AlertOctagon, ThumbsUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface AiReviewResult {
  score: number;
  issues: Array<{ severity: 'critical' | 'warning' | 'info'; message: string }>;
  suggestions: string[];
  summary: string;
}

interface AiReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: AiReviewResult | null;
  isLoading: boolean;
}

export function AiReviewDialog({ open, onOpenChange, result, isLoading }: AiReviewDialogProps) {
  
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertOctagon className="h-5 w-5 text-destructive" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'info': return <Info className="h-5 w-5 text-blue-500" />;
      default: return <Info className="h-5 w-5" />;
    }
  };

  const getSeverityColor = (severity: string) => {
      switch (severity) {
          case 'critical': return 'destructive';
          case 'warning': return 'warning'; // Custom or default variant? 'secondary' maybe
          case 'info': return 'secondary';
          default: return 'outline';
      }
  };

  if (!result && !isLoading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
             <CheckCircle className="h-5 w-5 text-purple-600" />
             AIレビュー結果
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                    <p className="text-muted-foreground">AIが定義を分析中...</p>
                </div>
            ) : result ? (
                <div className="space-y-6 py-2">
                    {/* Score Section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="p-4 flex flex-col items-center justify-center bg-slate-50">
                            <span className="text-sm text-muted-foreground mb-1">総合スコア</span>
                            <span className={`text-4xl font-bold ${result.score >= 80 ? 'text-green-600' : result.score >= 50 ? 'text-orange-500' : 'text-red-500'}`}>
                                {result.score}
                            </span>
                            <Progress value={result.score} className="w-full mt-2 h-2" />
                        </Card>
                        <Card className="p-4 col-span-2 bg-slate-50">
                             <span className="text-sm text-muted-foreground block mb-1">サマリー</span>
                             <p className="text-sm leading-relaxed">{result.summary}</p>
                        </Card>
                    </div>

                    {/* Issues Section */}
                    <div>
                        <h3 className="font-semibold mb-3 flex items-center">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            検出された課題 ({result.issues.length})
                        </h3>
                        {result.issues.length === 0 ? (
                            <div className="p-4 border rounded-md bg-green-50 text-green-700 text-sm flex items-center">
                                <CheckCircle className="h-4 w-4 mr-2" />
                                課題は見つかりませんでした。素晴らしい設計です！
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {result.issues.map((issue, idx) => (
                                    <div key={idx} className="p-3 border rounded-md flex items-start gap-3 bg-white shadow-sm">
                                        <div className="mt-0.5 shrink-0">
                                            {getSeverityIcon(issue.severity)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant={issue.severity === 'critical' ? 'destructive' : 'secondary'}>
                                                    {issue.severity.toUpperCase()}
                                                </Badge>
                                            </div>
                                            <p className="text-sm">{issue.message}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Suggestions Section */}
                    <div>
                        <h3 className="font-semibold mb-3 flex items-center">
                            <ThumbsUp className="h-4 w-4 mr-2" />
                            改善提案
                        </h3>
                         {result.suggestions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">提案事項はありません。</p>
                        ) : (
                            <ul className="list-disc pl-5 space-y-1 text-sm bg-blue-50/50 p-4 rounded-md border border-blue-100">
                                {result.suggestions.map((suggestion, idx) => (
                                    <li key={idx} className="text-slate-700">{suggestion}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            ) : null}
        </ScrollArea>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>閉じる</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
