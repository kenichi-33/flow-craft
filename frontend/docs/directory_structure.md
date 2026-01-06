# フロントエンド ディレクトリ構成

Next.js (App Router) プロジェクトの構成です。

```
frontend/
├── src/
│   ├── app/                    # ページコンポーネント (App Router)
│   │   ├── layout.tsx          # グローバルレイアウト (Navbar等)
│   │   ├── page.tsx            # トップページ (ダッシュボード)
│   │   ├── applications/       # 申請関連ページ ([id]/page.tsx など)
│   │   ├── tasks/              # タスク関連ページ
│   │   ├── designer/           # フォーム・フローデザイナー
│   │   └── admin/              # 管理画面
│   ├── components/             # UIコンポーネント
│   │   ├── application/        # 申請表示・フォームレンダラー (DynamicFormRenderer)
│   │   ├── flow-designer/      # フロー図エディタ・可視化 (FlowDesigner)
│   │   ├── ui/                 # 汎用UIパーツ (Button, TextFieldラッパー等)
│   │   └── ...                 # その他 (TaskList, UserDisplay等)
│   ├── lib/                    # ユーティリティ
│   │   ├── api.ts              # Axios APIクライアント
│   │   └── theme.ts            # MUIテーマ設定
│   ├── providers/              # Context Providers
│   │   ├── AuthProvider.tsx    # 認証状態管理
│   │   └── QueryProvider.tsx   # React Query設定
│   └── types/                  # TypeScript型定義
├── public/                     # 静的ファイル (画像など)
├── .next/                      # ビルド成果物 (git対象外)
├── node_modules/               # 依存パッケージ (git対象外)
├── next.config.mjs             # Next.js設定
├── package.json                # パッケージ定義
├── tsconfig.json               # TypeScript設定
└── .env.local                  # 環境変数 (git対象外)
```
