# Flow Craft Backend

Flow Craft のバックエンド API アプリケーションです。NestJS を使用して構築されています。

## 目次

- [技術スタック](#技術スタック)
- [セットアップ](#セットアップ)
- [環境変数](#環境変数)
- [モジュール構成](#モジュール構成)
- [テスト](#テスト)
- [設計ドキュメント](#設計ドキュメント)

## 設計ドキュメント

詳細な設計書は `docs/` ディレクトリに格納されています。

- **[API インターフェース](./docs/api_interface.md)**: API エンドポイントとリクエスト/レスポンス仕様
- **[アーキテクチャ](./docs/architecture.md)**: バックエンドのアーキテクチャ設計
- **[認証・認可](./docs/authentication.md)**: 認証フローと権限管理の仕組み
- **[データベーススキーマ](./docs/database_schema.md)**: ER図とテーブル定義
- **[ディレクトリ構成](./docs/directory_structure.md)**: バックエンドの詳細なディレクトリ構造
- **[シーケンス図](./docs/sequence_diagrams.md)**: 主要な処理のシーケンス図
- **[バージョニング](./docs/versioning.md)**: APIとアプリケーションのバージョン管理方針

## 技術スタック

- **Framework**: [NestJS 11](https://nestjs.com/)
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: [Prisma](https://www.prisma.io/)
- **Auth**: Passport, JWT (Keycloak連携)
- **Mail**: Nodemailer

## セットアップ

### 前提条件

- Node.js (v20以上推奨)
- Docker (PostgreSQL, Keycloak, Mailpit用)

### インストール

依存パッケージをインストールします。

```bash
npm install
```

### データベースと依存サービスの起動

Docker Compose を使用して、PostgreSQL, Keycloak, Mailpit を起動します。

```bash
docker-compose up -d postgres keycloak mailpit
```

### データベースマイグレーション

Prisma を使用してデータベーススキーマを適用します。

```bash
npx prisma migrate dev
```

### 開発サーバーの起動

```bash
npm run start:dev
```

APIサーバーは [http://localhost:8080](http://localhost:8080) で起動します。

## 環境変数

`.env` ファイルで以下の環境変数を設定します（`docker-compose` で起動する場合は `docker-compose.yml` 内の設定が優先される場合がありますが、ローカル実行時は `.env` ファイルが必要です）。

| 変数名 | 説明 | 例 |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL接続URL | `postgres://workflow:workflow@localhost:5432/workflow` |
| `KEYCLOAK_URL` | KeycloakサーバーのURL (内部通信用) | `http://localhost:8081` |
| `KEYCLOAK_ISSUER_URL` | トークン検証用発行者URL | `http://localhost:8081/realms/workflow` |
| `KEYCLOAK_REALM` | Realm名 | `workflow` |
| `KEYCLOAK_ADMIN_CLIENT_ID` | 管理用クライアントID | `admin-cli` |
| `KEYCLOAK_ADMIN_CLIENT_SECRET` | 管理用クライアントシークレット | (任意) |
| `KEYCLOAK_ADMIN_USER` | 管理ユーザー名 | `admin` |
| `KEYCLOAK_ADMIN_PASSWORD` | 管理パスワード | `admin` |
| `MAIL_HOST` | SMTPサーバーホスト | `localhost` (Mailpit利用時) |
| `MAIL_PORT` | SMTPサーバーポート | `1025` |
| `MAIL_USER` | SMTPユーザー | `user` |
| `MAIL_PASSWORD` | SMTPパスワード | `password` |
| `MAIL_FROM` | 送信元メールアドレス | `noreply@flowcraft.local` |
| `OLLAMA_BASE_URL` | Ollama API URL | `http://host.docker.internal:11434` |
| `OPENAI_API_KEY` | OpenAI API Key | `sk-...` (Optional) |
| `PORT` | アプリケーションポート | `8080` (デフォルトは3000ですがdocker-composeでは8080) |

## モジュール構成

- `src/modules/applications`: 申請データ管理
- `src/modules/forms`: フォーム定義管理
- `src/modules/workflows`: ワークフロー定義管理・実行エンジン
- `src/modules/tasks`: 承認タスク管理
- `src/modules/auth`: 認証・認可
- `src/modules/notifications`: メール通知等
- `src/modules/master-connectors`: 外部データ連携コネクタ管理
- `src/modules/ai-core`: AI生成・分岐ロジック (LLM Gateway, Generator, Branch Service)

## テスト

```bash
# 単体テスト
npm run test

# e2eテスト
npm run test:e2e
```
