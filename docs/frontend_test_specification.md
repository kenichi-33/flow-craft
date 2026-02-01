# Frontend Test Specification (試験仕様書)

## 1. 概要
本ドキュメントは、Flow Craftプロジェクトにおける **Frontend** の単体テストに関する仕様、方針、および完了条件を定義します。

## 2. テストフレームワーク
- **Framework**: Vitest (Vite互換)
- **Libraries**: React Testing Library, Jest DOM
- **Runner**: `npm run test`
- **Configuration**: `frontend/vitest.config.ts`

## 3. テスト範囲 (Scope)
- **Unit Tests**:
    - **Components**: UIロジック、Propsのハンドリング、条件付きレンダリング、イベントハンドラの検証。
    - **Custom Hooks**: 状態管理ロジック、副作用の検証。
    - **Utils/Helpers**: 純粋関数のロジック検証。
- **Exclusion**:
    - 単純な表示のみのコンポーネント（Storybook等での確認を推奨）。
    - 外部ライブラリのラッパーでロジックを含まないもの。

## 4. 目標指標 (Metrics & Targets)
- **Statement Coverage**: **80% 以上**
- **Branch Coverage**: **70% 以上**

## 5. 完了条件
1.  全テストケースがPassedであること。
2.  目標カバレッジ(80%)を達成していること。
3.  Lintエラーが存在しないこと。

## 6. ディレクトリ構成
- `src/` 配下の各コンポーネント・機能ディレクトリ内に `*.test.tsx` または `*.spec.ts` を配置する（Colocation）。
