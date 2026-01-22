# Skill: Frontend Expert (Workflow Platform)

## 技術スタック
- **Build:** Vite
- **Framework:** React (Functional Components)
- **UI:** shadcn/ui (Radix UI + Tailwind CSS)
- **State:** Zustand (Client) + TanStack Query (Server)
- **Visual:** React Flow + dnd-kit

## 実装ルール: 機能別ガイドライン

### 1. Form Builder (申請フォーム設計)
- **Library:** `dnd-kit` を使用。
- **Designer (設計画面):**
  - `MouseSensor` と `TouchSensor` を適切に設定し、ドラッグ操作の競合を防いでください。
  - ドラッグ中のオーバーレイ (`DragOverlay`) を実装し、UXを向上させてください。
- **Runner (申請実行画面):**
  - JSON定義 (`FormSchema`) を受け取り、動的にフォームをレンダリングしてください。
  - Runner側では `dnd-kit` は使用せず、軽量なレンダリングを心がけてください。

### 2. Flow Designer (承認フロー設計)
- **Library:** `React Flow` を使用。
- **Custom Nodes:**
  - `StartNode`, `ApprovalNode`, `ConditionNode` 等のカスタムノードを作成してください。
  - **重要:** 全てのカスタムノードは `React.memo` でラップし、再レンダリングを最適化してください。
- **Validation:**
  - 「エンドノードに到達しないパス」などを検知するバリデーションロジックを実装してください。

### 3. State Management & Architecture
- **shadcn/ui:** 既存コンポーネント (`components/ui`) を優先利用。
- **TanStack Query (v5):**
  - 非同期データ（定義の保存・取得）は全てこれで管理。`useEffect` でのデータ取得は禁止。
- **Zustand:**
  - 複雑なGUI状態（現在選択中のノード、ドラッグ中のアイテム情報など）の管理に使用。

## 検証手順 (Mandatory Post-Processing)
タスク完了前に `frontend/` ディレクトリで以下を実行し、**全てのエラーをあなたが修正**してください。

1.  **型チェック:** `npm run type-check` (または `tsc --noEmit`)
    - `any` の使用は厳禁です。
2.  **Lint:** `npm run lint`
3.  **Build:** `npm run build`