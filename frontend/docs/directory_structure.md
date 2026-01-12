# フロントエンド ディレクトリ構成

flow-craft フロントエンドのディレクトリ構成は、機能ごとの凝集度を高めつつ、作成（Designer）と利用（Runtime）の責務を明確に分離するように設計されています。

## ディレクトリ概観

```
src/
├── components/          # 共通コンポーネント (Atomic Designではない、機能的な分類)
│   ├── common/          # アプリ全般で使われる汎用UI (UserDisplay, Layoutなど)
│   ├── designer/        # [Writer] アプリケーション作成・編集機能用
│   │   ├── flow/        # フローエディタ (ReactFlow関連)
│   │   └── form/        # フォームエディタ (DndKit関連)
│   ├── model/           # [Reader] アプリケーション利用・実行機能用
│   │   ├── application/ # 申請・承認・タスク一覧表示など
│   │   └── form/        # フォームレンダリング (DynamicFormRenderer)
│   └── ui/              # shadcn/ui ベースの基本パーツ (Button, Inputなど)
│
├── features/            # 機能単位のモジュール (Pageコンポーネントを含む)
│   ├── admin/           # 管理画面機能
│   ├── applications/    # 申請者向け機能 (一覧, 詳細, 新規作成)
│   │   └── pages/       # ページコンポーネント (*Page.tsx)
│   ├── dashboard/       # ダッシュボード
│   ├── designer/        # デザイナー機能 (アプリ管理, バージョン管理, エディタ)
│   │   └── pages/       # ページコンポーネント (FlowEditorPage, FormEditorPageなど)
│   └── tasks/           # タスク（承認）機能
│       └── pages/       # ページコンポーネント (TaskDetailPageなど)
│
├── hooks/               # 汎用Hooks
├── lib/                 # ユーティリティ, APIクライアント
├── stores/              # グローバルステート (Zustand)
├── types/               # 型定義
└── routes.tsx           # ルーティング定義
```

## 主要なディレクトリの役割

### 1. `src/components/designer` vs `src/components/model`

この分離は、アプリケーションの「定義時（Build-time）」と「実行時（Run-time）」の責務を分けるために重要です。

- **components/designer**: 
  - **役割**: 管理者がフォームやフローを「作成・編集」するためのコンポーネント群。
  - **特徴**: ドラッグ＆ドロップ、プロパティ編集、ノード追加などの編集操作を含みます。
  - **例**: `FormDesigner`, `FlowDesigner`, `FormEditorCanvas`

- **components/model**:
  - **役割**: 一般ユーザーが作成された定義に基づいてデータを「閲覧・入力」するためのコンポーネント群。
  - **特徴**: 定義データ（Schema/Flow Definition）を受け取り、UIを描画します。原則として編集機能は持ちません（入力フォームとしての機能は持つ）。
  - **例**: `DynamicFormRenderer` (JSON Schemaからフォーム生成), `FlowVisualization` (フローの進捗表示), `ApprovalHistory`

### 2. `src/features/*/pages`

各機能モジュール（Feature）内のページコンポーネントは、`pages/` ディレクトリに集約されています。

- **役割**: ルーティングの終端となるページコンポーネント。
- **責務**:
  - URLパラメータの取得 (`useParams`)
  - データのフェッチ (`useQuery`)
  - データの保存 (`useMutation`)
  - 適切なUIコンポーネント (`components/**`) の組み合わせと配置
  - ロジックは可能な限りカスタムフックや下層のコンポーネント（`Designer`など）に委譲し、Thin Wrapperであることを目指します。
