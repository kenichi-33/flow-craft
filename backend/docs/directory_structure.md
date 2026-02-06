# バックエンド ディレクトリ構成

NestJS (Modular Monolith) の標準的な構成に基づき、機能モジュールごとに分離されています。

```
backend/
├── src/
│   ├── app.module.ts           # ルートモジュール (条件付きインポート定義)
│   ├── app.module.ts           # ルートモジュール
│   ├── app.controller.ts       # ヘルスチェック用コントローラー
│   ├── app.service.ts          # ヘルスチェック用サービス
│   ├── main.ts                 # アプリケーションエントリーポイント
│   ├── prisma/                 # Prisma関連
│   │   ├── prisma.service.ts   # DB接続サービス
│   │   └── prisma.module.ts    # DBモジュール
│   ├── auth/                   # [認証] Keycloak連携、JWT検証
│   │   ├── auth.module.ts
│   │   ├── guards/             # 認証ガード (JwtAuthGuardなど)
│   │   └── strategies/         # Passport認証ストラテジー (JwtStrategy)
│   ├── modules/                # 機能モジュール
│   │   ├── applications/       # [申請管理] 申請データのCRUD
│   │   ├── ai-core/            # [AI基盤] LLM連携機能
│   │   │   ├── llm-gateway/    # LLMプロバイダー抽象化 (Ollama, OpenAI)
│   │   │   └── services/       # AIサービス (Generator, Branch)
│   │   ├── workflow-engine/    # [WFエンジン] フロー実行、状態遷移、Worker
│   │   │   ├── workflow-engine.module.ts    # APIコントローラー定義
│   │   │   ├── workflow-core.module.ts      # 共通サービス定義
│   │   │   ├── config/                      # 設定定義
│   │   │   ├── executors/                   # [Executor] 進行役
│   │   │   │   ├── workflow-executor.module.ts
│   │   │   │   ├── processors/              # ノードプロセッサ
│   │   │   │   └── workflow-executor.service.ts
│   │   │   └── workers/                     # [Worker] 作業者
│   │   │   │   ├── workflow-worker.module.ts
│   │   │   │   ├── handlers/                # タスクハンドラ
│   │   │   │   └── generic.worker.ts
│   │   ├── queue/              # [キュー] 非同期処理基盤 (pg-boss adapter)
│   │   ├── tasks/              # [タスク] 承認タスク管理
│   │   ├── users/              # [ユーザー] ユーザー情報取得
│   │   └── notifications/      # [通知] メール送信
│   └── common/                 # 共通機能
├── scripts/                    # ユーティリティスクリプト
├── docs/                       # ドキュメント
└── test/                       # E2Eテスト
```
