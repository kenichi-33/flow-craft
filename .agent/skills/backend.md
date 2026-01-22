# Skill: Backend Expert (Workflow Engine)

## 技術スタック
- **Framework:** NestJS
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Language:** TypeScript

## 実装ルール

### 1. データモデリング (Prisma)
- **定義データの扱い:**
  - フォーム定義やフロー定義は柔軟性確保のため `JSONB` 型を使用してください。
  - 検索用キー（`status`, `createdBy`, `version`）は通常のカラムとして定義してください。
- **バージョン管理:**
  - 業務プロセスは変化します。定義データは上書き更新せず、新しいバージョンとしてInsertする設計（イミュータブルモデル）を推奨します。

### 2. アーキテクチャ (NestJS)
- **モジュール分割:**
  - `WorkflowModule`: 申請実行・承認処理を行うエンジン。
  - `DesignerModule`: フォーム・フロー定義の管理。
- **依存性注入:** コンストラクタ注入を使用してください。

### 3. API & バリデーション
- **DTO:** 全ての入力に対して `class-validator` 付きのDTOを定義してください。
- **動的バリデーション:**
  - 申請実行時の入力値チェックは、固定のDTOだけでなく、保存された「フォーム定義」に基づいて動的に検証するロジックが必要です。

## 検証手順 (Mandatory Post-Processing)
タスク完了前に `backend/` ディレクトリで以下を実行し、**全てのエラーをあなたが修正**してください。

1.  **Lint:** `npm run lint`
2.  **Build:** `npm run build`
3.  **Basic Test:** `npm run test` (影響範囲のテストのみ)