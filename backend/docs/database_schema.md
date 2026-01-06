# データベーススキーマ

主要なエンティティの関係図 (ER図) です。

```mermaid
erDiagram
    ApplicationDefinition ||--o{ Application : "has many"
    ApplicationDefinition ||--o{ AppVersion : "has history"
    FormDefinition ||--o{ Application : "used by"
    FlowDefinition ||--o{ Application : "used by"
    
    Application ||--o{ ApprovalTask : "has tasks"
    Application ||--o{ ServiceTask : "has service tasks"
    Application ||--o{ ApprovalHistory : "has history"
    
    ServiceTask ||--o{ ServiceTaskHistory : "has execution logs"

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

    ApprovalTask {
        string id PK
        string status "PENDING, COMPLETED..."
        string stepId
        string assignedTo
    }

    ServiceTask {
        string id PK
        string type "apiCall, llmCall..."
        string status
        json result
    }

    ApprovalHistory {
        string id PK
        string actorId
        string action "APPROVE, REJECT..."
        string stepId
    }
```

## テーブル概要

| テーブル名 | 説明 |
| --- | --- |
| **application_definitions** | 申請アプリの定義（メタデータ）。 |
| **applications** | 個別の申請インスタンス。入力データ(`input_data`)と現在の状態を保持。 |
| **approval_tasks** | ユーザーに割り当てられた承認タスク。 |
| **service_tasks** | APIコールやAI処理などのシステム自動実行タスク。 |
| **approval_histories** | ユーザーによる承認・却下のアクション履歴。 |
| **form_definitions** | フォームのスキーマ定義 (RJSF形式)。 |
| **flow_definitions** | フローのノード・エッジ定義 (ReactFlow形式)。 |
