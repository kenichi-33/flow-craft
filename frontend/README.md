
# Flow Craft Frontend

**Flow Craft** のフロントエンドアプリケーションです。
React, Vite, Shadcn UI を使用して構築されており、直感的なフォームデザイナーとフローデザイナーを提供します。
**AI自動生成機能** により、自然言語でのプロンプトからフォームやフロー定義を自動作成可能です。

## 🛠 技術スタック

- **Build Tool**: [Vite](https://vitejs.dev/)
- **Framework**: [React](https://react.dev/) (TypeScript)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI + Tailwind CSS)
- **State Management**: 
  - [Zustand](https://github.com/pmndrs/zustand) (クライアント状態)
  - [TanStack Query](https://tanstack.com/query/latest) (サーバー状態)
- **Visual Editors**: 
  - [React Flow](https://reactflow.dev/) (ワークフロー図の編集)
  - [dnd-kit](https://dndkit.com/) (フォームのドラッグ&ドロップ配置)
- **Rich Text Editor**: [Tiptap](https://tiptap.dev/)
- **Forms**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)

## 🤖 AI機能
- **AI Start Node**: 自然言語での対話による申請作成機能 (`/ai/start`)
- **App Generation**: プロンプトからフォーム・フローを自動生成

## 🚀 ディレクトリ構成

- `src/components`: 再利用可能なUIコンポーネント
  - `ui/`: shadcn/ui コンポーネント
  - `common/`: アプリケーション固有の共通コンポーネント
  - `designer/`: フロー/フォームデザイナー関連の複雑なコンポーネント
- `src/features`: 機能ごとのページ・ロジック (Admin, Application, Tasks, etc.)
- `src/lib`: ユーティリティ、APIクライアント
- `src/hooks`: カスタムフック

## 🏁 開発の始め方

### インストール

```bash
npm install
```

### 開発サーバー起動

```bash
npm run dev
```
http://localhost:3000 で起動します。

### ビルド

```bash
npm run build
```

## 🧪 Lint & Format

```bash
npm run lint
```
