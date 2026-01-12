# フロントエンド アーキテクチャ

## 設計原則

### 1. Designer (Writer) と Runtime (Reader) の分離

ワークフローアプリケーション構築プラットフォームという特性上、「アプリケーションを作る機能」と「アプリケーションを使う機能」は要件が大きく異なります。これらを明確に分離することで、複雑性を管理しています。

- **Designer (Writer)**:
  - 複雑なState管理が必要（Undo/Redo, ドラッグ＆ドロップ, バリデーション）
  - `src/components/designer` に集約
  - 主に管理者・アプリ作成者が利用
  
- **Runtime (Reader)**:
  - パフォーマンスと堅牢性が重要
  - JSON形式の定義データ（Schema/Flow）を入力として、動的にUIを生成
  - `src/components/model` に集約
  - 全ユーザーが利用

### 2. コンポーネント設計

- **UI Components (`src/components/ui`)**:
  - shadcn/ui をベースとした、スタイルのみに関心を持つ純粋なUIパーツ。
  - ロジックは持たせない。

- **Feature Components**:
  - 特定のビジネスロジックと結びついたコンポーネント。
  - データの取得や更新の責任を持つ場合があるが、可能な限りContainer/Presentationalパターンを意識し、ロジックと表示を分離する。

- **Page Components (`src/features/*/pages`)**:
  - ルーティングに対応する最上位コンポーネント。
  - データのフェッチ、グローバルステートへのアクセス、ルーティング遷移などを制御する「Container」としての役割を担う。

## 技術スタック

- **Framework**: React, Vite
- **Language**: TypeScript
- **Routing**: React Router v7
- **State Management**: Zustand (Global), React Context (Local)
- **Data Fetching**: TanStack Query (React Query)
- **Form**: React Hook Form, Zod
- **UI Library**: shadcn/ui (Tailwind CSS)
- **Editor**:
  - **Flow**: React Flow (@xyflow/react)
  - **Form**: dnd-kit

## フォーム/フロー定義のデータ構造

Designerで作成されたデータは、以下の標準に基づいたJSONとして保存され、Runtimeで解釈されます。

- **フォーム**: JSON Schema (RJSF互換) に独自拡張 (`x-layout`など) を加えたもの。
- **フロー**: React Flowのデータ構造 (Nodes, Edges) をベースに、承認者割り当てルールなどを付与したもの。
