/**
 * タスクハンドラーインターフェース
 * 各タスク種別（API呼び出し、LLM呼び出し、承認タスク等）の実装基盤
 */

/**
 * タスク実行コンテキスト
 * Workerからハンドラーに渡される情報
 */
export interface TaskContext {
  /** サービスタスクID */
  taskId: string;
  /** 申請ID */
  applicationId: string;
  /** フローノードID */
  nodeId: string;
  /** ノードタイプ (apiCall, llmCall, approval等) */
  nodeType: string;
  /** ノード設定データ */
  nodeData: any;
  /** 申請入力データ */
  inputData: Record<string, any>;
  /** 申請者ID */
  applicantId: string;
}

/**
 * タスク実行結果
 */
export interface TaskResult {
  /** 成功/失敗 */
  success: boolean;
  /** 出力データ（inputDataにマージされる） */
  outputData?: Record<string, any>;
  /** エラーメッセージ */
  error?: string;
  /** 次のノードへ自動的に進むか（デフォルト: true） */
  shouldAdvance?: boolean;
  /** 手動で遷移を制御したか（trueの場合、shouldAdvance=falseでもCOMPLETEDにする） */
  manualAdvance?: boolean;
  /** 実行ログ (console.log収集) */
  logs?: string[];
}

/**
 * タスクハンドラーインターフェース
 */
export interface ITaskHandler {
  /** 対応するタスクタイプ */
  readonly taskType: string;

  /**
   * タスクを実行
   * @param context 実行コンテキスト
   * @returns 実行結果
   */
  execute(context: TaskContext): Promise<TaskResult>;
}

/**
 * タスク実行ジョブペイロード
 * キューに送信されるデータ構造
 */
export interface TaskExecuteJob {
  taskId: string;
  applicationId: string;
  nodeId: string;
  nodeType: string;
  nodeData: any;
  inputData: Record<string, any>;
  applicantId: string;
}

/**
 * タスク完了通知ペイロード
 * Worker → Executor へ送信
 */
export interface TaskCompleteJob {
  taskId: string;
  applicationId: string;
  nodeId: string;
  success: boolean;
  outputData?: Record<string, any>;
  error?: string;
  shouldAdvance: boolean;
  logs?: string[];
}
