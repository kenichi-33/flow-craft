# バックエンド ディレクトリ構成

NestJS (Modular Monolith) の標準的な構成に基づいています。

```
backend/
├── src/
│   ├── app.controller.ts       # ヘルスチェック用コントローラー
│   ├── app.module.ts           # ルートモジュール
│   ├── app.service.ts          # ヘルスチェック用サービス
│   ├── main.ts                 # アプリケーションエントリーポイント
│   ├── prisma/                 # Prisma関連
│   │   ├── prisma.service.ts   # DB接続サービス
│   │   └── prisma.module.ts    # DBモジュール
│   ├── common/                 # 共通機能
│   │   ├── decorators/         # カスタムデコレーター (@User()など)
│   │   └── guards/             # 認証ガード (JwtAuthGuardなど)
│   ├── modules/                # 機能モジュール
│   │   ├── applications/       # [申請管理] 申請データのCRUD
│   │   ├── workflow-engine/    # [WFエンジン] フロー実行、状態遷移、Worker
│   │   ├── queue/              # [キュー] 非機同期処理基盤 (pg-boss adapter)
│   │   ├── tasks/              # [タスク] 承認タスク管理
│   │   ├── auth/               # [認証] Keycloak連携、JWT検証
│   │   ├── users/              # [ユーザー] ユーザー情報取得
│   │   └── notifications/      # [通知] メール送信
│   └── strategies/             # Passport認証ストラテジー (JwtStrategy)
├── prisma/
│   ├── schema.prisma           # データベーススキーマ定義
│   └── migrations/             # マイグレーション履歴
├── test/                       # E2Eテスト
├── dist/                       # ビルド成果物 (git対象外)
├── node_modules/               # 依存パッケージ (git対象外)
├── docker-compose.yml          # コンテナ構成
├── Dockerfile                  # ビルド定義
├── package.json                # パッケージ定義
├── tsconfig.json               # TypeScript設定
└── .env                        # 環境変数 (git対象外)
```
