# データベーススキーマ

主要なエンティティの関係図 (ER図) です。
(Legacy: ApprovalTask/ServiceTask は WorkflowTask に統合されました)

```mermaid
erDiagram
    ApplicationDefinition ||--o{ Application : "has many"
    ApplicationDefinition ||--o{ AppVersion : "has history"
    FormDefinition ||--o{ Application : "used by"
    FlowDefinition ||--o{ Application : "used by"
    
    Application ||--o{ WorkflowTask : "has tasks"
    Application ||--o{ ApprovalHistory : "has history"
    
    WorkflowTask ||--o{ WorkflowTaskHistory : "has execution logs"

    ApplicationDefinition {
        string id PK
        string name
        string status
        int version
    }

    Application {
        string id PK
        int applicationNumber
        string status
        json inputData
        string currentNodeId
    }

    WorkflowTask {
        string id PK
        string type "approval, apiCall, llmCall"
        string status "PENDING, COMPLETED, FAILED"
        string stepId
        string assignedTo
        json result
        json config
    }

    WorkflowTaskHistory {
        string id PK
        string taskId FK
        string status
        date executedAt
    }

    ApprovalHistory {
        string id PK
        string actorId
        string action "APPROVE, REJECT..."
        string stepId
    }

    MasterConnector ||--o{ MasterDataItem : "has items"
    MasterConnector ||--o{ ApplicationDefinition : "used by"

    MasterConnector {
        string id PK
        string name
        string type "rest, sql, csv"
        boolean isShared
    }

    MasterDataItem {
        string id PK
        string connectorId FK
        json data
    }
```

## テーブル概要

| テーブル名 | 説明 |
| --- | --- |
| **application_definitions** | 申請アプリの定義（メタデータ）。 |
| **applications** | 個別の申請インスタンス。入力データ(`input_data`)と現在の状態を保持。 |
| **workflow_tasks** | フロー実行タスクの統合テーブル。承認タスク(`approval`)とシステムタスク(`apiCall`, `llmCall`等)を一元管理。 |
| **workflow_task_histories** | システムタスクの再試行履歴や実行ログ。 |
| **approval_histories** | ユーザーによる承認・却下のアクション履歴（監査ログ的役割）。 |
| **form_definitions** | フォームのスキーマ定義 (RJSF形式)。 |
| **flow_definitions** | フローのノード・エッジ定義 (ReactFlow形式)。 |
| **master_connectors** | 外部システム連携設定。`isShared`による共有設定や、作成・更新者の監査情報(`createdBy`, `updatedBy`)を保持。 |
| **master_data_items** | CSV連携タイプの場合のインポートデータレコード。 |

## スナップショット機能

`applications` テーブルは、申請時点のフォーム定義(`form_schema`)やフロー定義(`flow_nodes`)をスナップショットとして保持します。
これにより、アプリケーション定義が更新されても、過去の申請は作成時点の状態を忠実に再現して表示することが可能です。
