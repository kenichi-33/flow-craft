// ApprovalHistory - Shared component for displaying workflow history
import { UserDisplay, type UserSnapshot } from '@/components/common/UserDisplay';
import { CheckCircle, XCircle, RotateCcw, GitBranch, Settings, Check, Info, Play, CheckCheck, UserCog } from 'lucide-react';

export interface HistoryItem {
    id: string;
    action: string;
    actorId: string;
    actorInfo?: UserSnapshot;
    comment?: string;
    stepId?: string;
    nodeName?: string;
    actedAt?: string;
    createdAt?: string;
    isProxy?: boolean;
    originalActorId?: string;
}

interface ApprovalHistoryProps {
    history: HistoryItem[];
}

const getIcon = (action: string) => {
    const iconClass = 'h-5 w-5';
    switch (action) {
        case 'START': case 'SUBMIT': return <Play className={`${iconClass} text-blue-500`} />;
        case 'APPROVE': return <CheckCircle className={`${iconClass} text-emerald-500`} />;
        case 'REJECT': return <XCircle className={`${iconClass} text-red-500`} />;
        case 'REMAND': return <RotateCcw className={`${iconClass} text-orange-500`} />;
        case 'BRANCH': return <GitBranch className={`${iconClass} text-purple-500`} />;
        case 'SERVICE_TASK': return <Settings className={`${iconClass} text-slate-500`} />;
        case 'SERVICE_TASK_COMPLETE': return <Check className={`${iconClass} text-emerald-500`} />;
        case 'APPLICATION_COMPLETE': return <CheckCheck className={`${iconClass} text-emerald-500`} />;
        case 'CHANGE_ASSIGNEE': return <UserCog className={`${iconClass} text-yellow-600`} />;
        case 'CANCEL': return <XCircle className={`${iconClass} text-muted-foreground`} />;
        default: return <Info className={`${iconClass} text-muted-foreground`} />;
    }
};

const getLabel = (action: string) => {
    switch (action) {
        case 'START': return '申請開始';
        case 'SUBMIT': return '申請';
        case 'APPROVE': return '承認';
        case 'REJECT': return '却下';
        case 'REMAND': return '差戻し';
        case 'BRANCH': return '条件分岐';
        case 'SERVICE_TASK': return 'システム処理開始';
        case 'SERVICE_TASK_COMPLETE': return 'システム処理完了';
        case 'APPLICATION_COMPLETE': return '申請完了';
        case 'CANCEL': return '取下げ';
        case 'CHANGE_ASSIGNEE': return '担当変更';
        default: return action;
    }
};

const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('ja-JP');
};

export default function ApprovalHistory({ history }: ApprovalHistoryProps) {
    if (!history || history.length === 0) {
        return <p className="text-sm text-muted-foreground">まだ履歴がありません</p>;
    }

    return (
        <div className="flex flex-col gap-2">
            {history.map((h) => (
                <div
                    key={h.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border hover:bg-muted/50 transition-colors"
                >
                    {getIcon(h.action)}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{getLabel(h.action)}</span>
                            {h.nodeName && (
                                <span className="text-xs px-2 py-0.5 bg-muted rounded-full">{h.nodeName}</span>
                            )}
                            {h.isProxy && (
                                <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded border border-amber-200">
                                    代行
                                </span>
                            )}
                        </div>
                        {h.comment && (
                            <p className="text-sm text-muted-foreground mt-1 truncate">{h.comment}</p>
                        )}
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                            {h.actorId === 'SYSTEM' ? (
                                'システム'
                            ) : (
                                <div className="flex items-center gap-1">
                                    <UserDisplay user={h.actorInfo} fallback={h.actorId} />
                                    {h.isProxy && h.originalActorId && (
                                        <span className="text-muted-foreground/70 flex items-center gap-1">
                                            (本来: <UserDisplay user={undefined} fallback={h.originalActorId} />)
                                        </span>
                                    )}
                                </div>
                            )}
                            <span className="mx-1">•</span>
                            {formatDate(h.actedAt || h.createdAt)}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
