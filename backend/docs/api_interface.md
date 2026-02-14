# バックエンド API インターフェース

現在、Swagger (OpenAPI) は自動生成されていませんが、以下のエンドポイントが定義されています。

## API 一覧

全てのAPIはベースURL `/` (または設定されたプレフィックス) から始まります。

### アプリケーション定義 (Application Definitions)
- `POST /application-definitions`: 申請アプリ定義の作成
- `GET /application-definitions`: 申請アプリ定義一覧取得 (検索・ソート・ページング可)
- `GET /application-definitions/active`: 公開中のアクティブな定義一覧取得
- `GET /application-definitions/:id`: 定義詳細取得
- `PUT /application-definitions/:id`: 定義更新
- `DELETE /application-definitions/:id`: 定義削除
- `POST /application-definitions/:id/publish`: 定義の公開
- `GET /application-definitions/:id/versions`: バージョン履歴取得
- `POST /application-definitions/:id/restore/:version`: 特定バージョンの復元

### 知識ベース (RAG)
- `GET /application-definitions/:id/rag/sources`: 登録済みソース一覧取得
- `POST /application-definitions/:id/rag/sources`: テキストソースの作成
- `POST /application-definitions/:id/rag/sources/upload`: ファイルソースの作成
- `DELETE /application-definitions/:id/rag/sources/:sourceId`: ソースの削除

### 申請 (Applications)
- `POST /applications`: 新規申請（下書きまたは申請）
- `GET /applications`: 申請一覧取得 (検索・フィルタリング可)
- `GET /applications/:id`: 申請詳細取得
- `PUT /applications/:id`: 申請更新（入力データの更新）

### ワークフロー実行 (Workflow Engine)
これらのエンドポイントはワークフローの状態遷移やアクションに使用されます。
- `POST /workflow/start`: ワークフロー開始（新規申請提出）
- `POST /workflow/save-draft`: 下書き保存
- `POST /workflow/submit-draft/:id`: 下書きからの本申請
- `POST /workflow/applications/:id/resubmit`: 差戻し後の再申請
- `POST /workflow/tasks/:id/complete`: タスク完了（承認/却下/差戻し）
  - Body: `{ action: "APPROVE" | "REJECT" | "REMAND", comment: string }`
- `POST /workflow/tasks/:id/retry`: 失敗したサービスタスクの再実行
- `GET /workflow/applications/:id/status`: 申請の最新ステータスとフロー状態の取得

### タスク (Tasks)
- `GET /tasks`: 自身のタスク一覧取得
- `GET /tasks/:id`: タスク詳細取得

### フォーム (Forms)
- `GET /forms`: フォーム定義一覧
- `GET /forms/:id`: フォーム詳細
- `POST /forms`: フォーム定義作成
- `PUT /forms/:id`: フォーム定義更新

### フロー (Flows)
- `GET /flows`: フロー定義一覧
- `GET /flows/:id`: フロー詳細
- `POST /flows`: フロー定義作成
- `PUT /flows/:id`: フロー定義更新

### チーム (Teams)
- `GET /teams`: チーム一覧
- `GET /teams/:id`: チーム詳細
- `POST /teams`: チーム作成
- `PUT /teams/:id`: チーム更新
- `DELETE /teams/:id`: チーム削除
- `POST /teams/:id/members`: メンバー追加
- `DELETE /teams/:id/members/:memberId`: メンバー削除

### ユーザー (Users)
- `GET /users/search`: ユーザー検索 (Keycloak連携)
- `GET /users/departments`: 部署（グループ）一覧取得
- `GET /users/check-assignment`: 自身の担当タスクか確認
- `GET /users/resolve-display`: 担当者コード（user/role/group）の表示名解決

### その他
- `GET /`: ヘルスチェック
