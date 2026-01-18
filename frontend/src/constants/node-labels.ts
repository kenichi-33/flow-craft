
export const NODE_LABELS: Record<string, string> = {
    start: '開始',
    end: '完了',
    approval: '承認',
    input: '入力タスク',
    userInput: '入力タスク',
    apiCall: 'API実行',
    llmCall: 'AI処理',
    sendEmail: 'メール送信',
    slack: 'Slack通知',
    delay: '待機',
    updateRecord: 'レコード更新',
    setVariable: '変数設定',
    subProcess: 'サブプロセス',
    branch: '分岐',
    parallel: '並列',
    join: '合流',
    swimlane: 'スイムレーン',
};

export const getNodeLabel = (type: string, fallback?: string) => {
    return NODE_LABELS[type] || fallback || type;
};
