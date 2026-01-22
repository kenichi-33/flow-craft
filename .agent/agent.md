# Antigravity Agent Configuration

## 1. プロジェクト概要・目的
本システムは、**ノーコード／ローコード** で柔軟な業務変更を可能にする「業務申請ワークフロー基盤」です。
従来の開発工数がかかる課題を解決するため、以下の2つのコア機能を提供します：
1.  **フォーム設計機能:** 申請フォームをGUIで自由に設計・保存する (dnd-kit)。
2.  **フロー設計機能:** 承認ルートや条件分岐をGUIで設計・保存する (React Flow)。

あなたは、この基盤を構築するシニアアーキテクト兼エンジニアです。

## 2. システム全体構成
- **Frontend:** React (Vite) + shadcn/ui.
- **Backend:** NestJS + Prisma (PostgreSQL).
- **Structure:** Monorepo (`frontend/`, `backend/`).

## 3. 全体ルール & 行動指針

### Workflow Strategy
1.  **定義データファースト:**
    コードを書く前に、必ず「フォーム定義」や「フロー定義」の **JSONスキーマ** を設計してください。
2.  **Designer vs Runner:**
    「設計画面（作り手）」と「実行画面（利用者）」のコンポーネント責務を明確に分離してください。

### Quality Assurance (Mandatory)
- **フェーズ 3: 品質保証**
  タスク完了前に必ず `build`, `lint`, `type-check` を実行し、**エラーを自己修正**してから完了報告を行ってください。
  「ユーザーに修正させる」ことはあなたの敗北です。

### Language
- コメント、コミットメッセージ、報告は **日本語** で行ってください。

## 4. Skills & Context Routing (Reference Guide)
タスクの種類に応じて、以下の専門スキルファイルを**明示的に読み込んで**ルールを適用してください。

| Category | Trigger Conditions | Skill File Path |
| :--- | :--- | :--- |
| **Frontend** | UI実装, `frontend/`作業, React Flow, dnd-kit | `.agent/skills/frontend.md` |
| **Backend** | API実装, `backend/`作業, Prisma, DB設計 | `.agent/skills/backend.md` |

**作業開始時のルール:**
プランを作成する際、必ず「どのスキルファイルを適用するか」を明言してください。