# コンポーネント設計

フロントエンドの主要なコンポーネントとその責務について記述します。

## 全体構成

Next.js から移行し、現在は **Vite + React Router** を採用しています。
UIライブラリとして **shadcn/ui** (Tailwind CSS) を基盤とし、状態管理には **React Query** (サーバー状態) と **Zustand** (グローバルクライアント状態) を使用しています。

## 主要コンポーネント

Designer（作成）と Model（利用）の分離原則に基づき、主要なコンポーネントは `src/components/designer` と `src/components/model` に配置されています。

### 1. DynamicFormRenderer
**パス**: `src/components/model/form/renderer/DynamicFormRenderer.tsx`

JSON Schema (RJSF - React JSON Schema Form) に基づいて、動的にフォームを生成するコンポーネントです。
- **入力モード**: 新規申請時や編集時に使用。バリデーションを実行。
- **読取専用モード (`readOnly={true}`)**: 申請詳細画面などで入力内容を表示するために使用。
- **カスタマイズ**: `widgets` (入力パーツ) や `templates` (レイアウト) を shadcn/ui ベースで実装しています。

### 2. FormDesigner
**パス**: `src/components/designer/form/FormDesigner.tsx`

ドラッグ＆ドロップでフォームを構築するためのエディタコンポーネントです。
- **DndKit**: ドラッグ＆ドロップ操作の制御に使用。
- **FormEditorCanvas**: フィールドの配置エリア。
- **FormEditorToolbox**: 追加可能なフィールドのパレット。
- **FormEditorProperties**: 選択中フィールドの詳細設定（ラベル、必須、バリデーション等）。
- **責務**: エディタの状態管理（Undo/Redo含む）と、編集結果のJSON Schema変換。

### 3. FlowDesigner
**パス**: `src/components/designer/flow/FlowDesigner.tsx`

[React Flow](https://reactflow.dev/) ベースのワークフローエディタです。
- **ノード編集**: 承認ノード、条件分岐、APIタスクノードなどの配置・接続。
- **スイムレーン**: 承認者の役割分担を視覚化（オプション機能）。
- **責務**: フロー構造（Nodes/Edges）の構築とバリデーション。

### 4. FlowVisualization
**パス**: `src/components/designer/flow/FlowVisualization.tsx`

申請詳細画面等で、現在の進捗状況（通過済みルート、現在位置）を可視化・強調表示するためのコンポーネントです。
- `readOnly` モードの React Flow として動作します。
- `completedStepIds` や `currentNodeId` プロパティを受け取り、スタイルを動的に変更して進捗を表示します。

### 5. TaskList
**パス**: `src/components/model/application/TaskList.tsx`

承認タスクとシステムタスク（API Call, AI処理）を統合してリスト表示します。
- **データソース**: `Application` オブジェクト内の `workflowTasks` 配列。
- **表示内容**:
  - ステップ名（ノードラベル）
  - 担当者（ユーザー、グループ、ロール等を解決して表示）
  - ステータス（バッジ表示）
  - 実行日時 / 期限
- **操作**: ログインユーザーが担当者の場合、「タスク処理」ボタンを表示。

## データフェッチ戦略

### React Query
- サーバーデータの取得・キャッシュ・同期に使用します。
- `src/lib/api.ts` の Axios インスタンスを経由して API コールを行います。
- `queryKey` の管理は重要です。Factory パターンなどでキー生成を統一することを推奨します（現状は文字列リテラルベース）。

### Zustand
- アプリケーション全体で共有すべきクライアント状態（認証情報 `authStore`、UI設定など）を管理します。
