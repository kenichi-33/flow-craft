# Flow Craft Frontend

Flow Craft のフロントエンドアプリケーションです。Next.js と React を使用して構築されています。

## 目次

- [技術スタック](#技術スタック)
- [セットアップ](#セットアップ)
- [環境変数](#環境変数)
- [ディレクトリ構成](#ディレクトリ構成)
- [設計ドキュメント](#設計ドキュメント)

## 設計ドキュメント

詳細な設計書は `docs/` ディレクトリに格納されています。

- **[アプリケーション管理フロー](./docs/app_management_flow.md)**: アプリケーション管理の画面遷移図とフロー
- **[コンポーネント設計](./docs/component_design.md)**: UIコンポーネントの設計方針
- **[ディレクトリ構成](./docs/directory_structure.md)**: フロントエンドの詳細なディレクトリ構造
- **[画面遷移](./docs/screen_transitions.md)**: 画面遷移図とルーティング設計

## 技術スタック

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **UI Library**: [Material UI (MUI)](https://mui.com/), [Emotion](https://emotion.sh/)
- **State Management**: React Hooks, React Query
- **Workflow / Form**: [React Flow](https://reactflow.dev/), [@rjsf/core](https://rjsf-team.github.io/react-jsonschema-form/)
- **Auth**: Keycloak JS

## セットアップ

### 前提条件

- Node.js (v20以上推奨)
- npm

### インストール

依存パッケージをインストールします。

```bash
npm install
```

### 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) にアクセスしてください。

## 環境変数

`.env` または `.env.local` ファイルで以下の環境変数を設定します（デフォルト値は `docker-compose` 環境に合わせてあります）。

| 変数名 | 説明 | デフォルト値 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | バックエンドAPIのベースURL | `http://localhost:8080` |
| `NEXT_PUBLIC_KEYCLOAK_URL` | KeycloakサーバーのURL | `http://localhost:8081` |
| `NEXT_PUBLIC_KEYCLOAK_REALM` | KeycloakのRealm名 | `workflow` |
| `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` | KeycloakのClient ID | `workflow-app` |

## ディレクトリ構成

- `src/app`: Next.js App Router ページコンポーネント
- `src/components`: UIコンポーネント
  - `form-designer`: フォーム作成画面用コンポーネント
  - `flow-designer`: ワークフロー設計画面用コンポーネント
- `src/lib`: ユーティリティ関数、APIクライアントなど
- `src/providers`: React Context Providers (Auth, Theme, Query, etc.)
