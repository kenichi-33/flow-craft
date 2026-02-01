# Backend Test Specification (試験仕様書)

## 1. 概要
本ドキュメントは、Flow Craftプロジェクトにおける **Backend** の単体テストに関する仕様、方針、および完了条件を定義します。

## 2. テストフレームワーク
- **Framework**: Jest (NestJSデフォルト)
- **Runner**: `npm run test`
- **Configuration**: `backend/package.json` (jest config)

## 3. テスト範囲 (Scope)
- **Unit Tests**:
    - **Services**: ビジネスロジックの検証。Repositoryなどの依存はMock化する。
    - **Controllers**: ルーティング、バリデーション、HTTPレスポンスの検証。ServiceはMock化する。
    - **Utils/Helpers**: 独立した関数・クラスの動作検証。
- **Exclusion**:
    - DTO (ロジックを持たない場合)
    - Module定義ファイル
    - Configuration files
    - `main.ts`

## 4. 目標指標 (Metrics & Targets)
- **Statement Coverage**: **80% 以上**
- **Branch Coverage**: **70% 以上**

## 5. 完了条件
1.  全テストケースがPassedであること。
2.  目標カバレッジ(80%)を達成していること。
3.  Lintエラーが存在しないこと。

## 6. ディレクトリ構成
- `src/` 配下の各機能ディレクトリ内に `*.spec.ts` を配置する。
