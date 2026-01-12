# コンポーネント設計

フロントエンドの主要なコンポーネントとその責務について記述します。

## 全体構成

Next.js (App Router) を採用し、Material UI (MUI) をデザインシステムとして使用しています。状態管理には React Query を全面的に採用し、サーバー状態のキャッシュと同期を効率化しています。

## 主要コンポーネント

### 1. DynamicFormRenderer
**パス**: `src/components/application/DynamicFormRenderer.tsx`

JSON Schema (RJSF - React JSON Schema Form) に基づいて、動的にフォームを生成するコンポーネントです。
- **入力モード**: 新規申請時や編集時に使用。バリデーションを実行。
- **読取専用モード**: 申請詳細画面などで入力内容を表示するために使用。

### 2. FlowVisualization / FlowDesigner
**パス**: `src/components/flow-designer/`

[React Flow](https://reactflow.dev/) ベースのフロー図描画コンポーネントです。
- **FlowDesigner**: ノードの追加・削除・接続、プロパティ設定が可能。DndKitを使用したドラッグ＆ドロップインタフェースを提供。
- **FlowVisualization**: 申請詳細画面で、現在の進捗状況（通過済みルート、現在位置）を可視化。

### 3. TaskList
**パス**: `src/components/TaskList.tsx`

承認タスクと自動処理タスク（Service Task）を統合してリスト表示するコンポーネント。
- フロー定義上のステップ順序を計算してソート表示。
- 担当者の解決（ユーザーID、ロール、グループ名などの表示変換）を担当。
- ステータス（PENDING, COMPLETED, FAILED 等）のチップ表示。

### 4. ApplicationDetailPage
**パス**: `src/app/applications/[id]/page.tsx`

申請の詳細情報を集約表示するページコンポーネント。
- **ヘッダー**: 申請番号、ステータス、申請者情報。
- **フロー進捗**: `FlowVisualization` を埋め込み表示。
- **申請内容**: `DynamicFormRenderer` (ReadOnly) を使用。
- **タスク一覧**: `TaskList` を使用。
- **承認履歴**: アクション履歴を時系列で表示。

## データフェッチ戦略 (React Query)

- **useQuery**: データの取得とキャッシュ。`queryKey` により、タスク実行後などに `invalidateQueries` を呼ぶことで自動的に最新データを再取得し、画面を更新します。
- **Optimistic Updates**: 必要に応じて、APIレスポンスを待たずにUIを更新し、体感速度を向上させます。
