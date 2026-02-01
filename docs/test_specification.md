# 試験仕様書 (Test Specification)

## 1. 概要
本ドキュメントは、Flow CraftプロジェクトにおけるFrontendおよびBackendの単体テストに関する仕様、方針、および完了条件を定義します。

## 2. テストフレームワーク

### 2.1 Backend
- **Framework**: Jest (NestJSデフォルト)
- **Runner**: `npm run test`
- **Configuration**: `backend/package.json` (jest config), `backend/test/jest-e2e.json` (E2E)

### 2.2 Frontend
- **Framework**: Vitest (Viteとの親和性のため採用)
- **Runner**: `npm run test` (予定)
- **Configuration**: `frontend/vite.config.ts` にテスト設定を追加

## 3. テスト範囲 (Scope)

### 3.1 Backend
- **Unit Tests**:
    - **Services**: ビジネスロジックの検証。DBアクセスはMock化する。
    - **Controllers**: ルーティングとHTTPレスポンスの検証。ServiceはMock化する。
    - **Utils/Helpers**: 独立した関数・クラスの動作検証。
- **Exclusion**:
    - DTO (ロジックを持たない場合)
    - Configuration files

### 3.2 Frontend
- **Unit Tests**:
    - **Components**: UIロジック、Propsのハンドリング、イベント発火の検証。
    - **Hooks**: カスタムフックの状態遷移、副作用の検証。
    - **Utils**: ヘルパー関数のロジック検証。
- **Exclusion**:
    - 単純な表示のみのコンポーネント (Snapshotテストで代替可だが、今回は必須としない)

## 4. 目標指標 (Metrics & Targets)

### 4.1 カバレッジ目標
各モジュール（Frontend/Backend）において、以下のカバレッジラインを完了条件とします。

- **Statement Coverage**: **80% 以上**
- **Branch Coverage**: **70% 以上** (推奨)

### 4.2 完了条件 define
1.  全テストケースがPassedであること。
2.  目標カバレッジ(80%)を達成していること。
3.  Lintエラーが存在しないこと。

## 5. ディレクトリ構成
- **Backend**: `src/` 配下の各機能ディレクトリ内に `*.spec.ts` を配置、または `test/` ディレクトリ（E2Eなど）。
- **Frontend**: `src/` 配下の各コンポーネント・機能ディレクトリ内に `*.test.tsx` または `*.spec.ts` を配置することを推奨（コロケーション）。 `__tests__` ディレクトリの使用も許容する。
