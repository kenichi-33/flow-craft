# バックエンド アーキテクチャ概要

Flow Craftのバックエンドは、NestJSフレームワークを採用したモジュラーモノリス構成となっています。

## 技術スタック

- **Framework**: [NestJS](https://nestjs.com/) (Node.js)
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Queue**: pg-boss (PostgreSQLベースのジョブキュー)
- **Authentication**: Keycloak (OIDC/OAuth2)

## モジュール構成

アプリケーションは機能単位でモジュールに分割されています。

### Core Modules
- **AppModule**: ルートモジュール。全体の構成とグローバル設定を管理。
- **PrismaModule**: データベース接続管理。
- **QueueModule**: 非同期ジョブキュー機能を提供。`pg-boss` を使用し、透過的な `IQueueAdapter` インターフェースを提供。
- **NotificationsModule**: メール送信などの通知機能。

### Feature Modules
- **WorkflowEngineModule**: ワークフローのコアロジック（状態遷移、タスク生成、自動処理）を担当。
- **ApplicationsModule**: 申請データのCRUD操作。
- **TasksModule**: 承認タスクの管理。
- **UsersModule**: Keycloakと連携したユーザー情報の取得。

## 非同期ワークフロー処理 (Async Workflow)

スケーラビリティと耐障害性を向上させるため、ワークフローのノード遷移処理は非同期メッセージキューを用いて実装されています。

### 処理フロー
1. **申請/承認アクション**: ユーザーがAPI経由で申請や承認を行う。
2. **状態更新**: DB上の申請ステータスを更新。
3. **ジョブエンキュー**: 次のステップへの遷移処理を `WORKFLOW_NODE_PROCESS` ジョブとしてキューに登録。
4. **即時レスポンス**: ユーザーには即座に成功レスポンスを返す（処理待ち状態）。
5. **ジョブ処理 (Worker)**:
   - バックグラウンドでWorker（`WorkflowEngineService`内）がジョブを取得。
   - 最新の申請データをDBから取得 (`Always-Fetch-Latest` パターン)。
   - ビジネスロジック（次ノード判定、タスク生成、メール送信、APIコール等）を実行。

これにより、重い処理（外部API連携やメール送信）によるレスポンス遅延を防ぎ、システム全体の応答性を高めています。

## エラーハンドリング

- **Web API**: NestJSのExceptionFilterにより、標準化されたJSONエラーレスポンスを返却。
- **Worker**: ジョブ処理失敗時は `pg-boss` のリトライ機能により自動再試行。最終的に失敗した場合は `failed_jobs` として記録され、手動での再実行が可能。
