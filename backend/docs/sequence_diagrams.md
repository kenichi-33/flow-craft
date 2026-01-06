# シーケンス図

## ワークフロー承認プロセス (非同期)

ユーザーがタスクを「承認」し、次のステップへ進むまでの流れを示します。

```mermaid
sequenceDiagram
    actor User
    participant API as Backend API
    participant DB as PostgreSQL
    participant Queue as Job Queue
    participant Worker as Background Worker
    participant Mail as Mail Service

    User->>API: POST /tasks/{id}/complete (Action: APPROVE)
    activate API
    
    API->>DB: begin transaction
    API->>DB: Update Task Status (COMPLETED)
    API->>DB: Insert Approval History
    API->>DB: commit transaction
    
    API->>Queue: Enqueue Job (WORKFLOW_NODE_PROCESS)
    API-->>User: 200 OK (Updated Task Info)
    deactivate API

    rect rgb(230, 245, 255)
        Note over Worker: Background Processing
        Queue->>Worker: Fetch Job
        activate Worker
        
        Worker->>DB: Fetch Application (Latest State)
        Worker->>Worker: Determine Next Node
        
        alt Next is Approval Node
            Worker->>DB: Create Approval Task (PENDING)
            Worker->>Mail: Send Notification Email
        else Next is API Call (Service Task)
            Worker->>Worker: Execute HTTP Request
            Worker->>DB: Save Result & History
            Worker->>Queue: Enqueue Job (Next Step)
        end
        
        Worker->>DB: Update Application (Current Node)
        
        deactivate Worker
    end
```

## ヒューマンタスク間遷移 (承認 -> 次の承認)

承認者(A)の承認により、次の承認者(B)のタスクが生成される詳細フローです。

```mermaid
sequenceDiagram
    actor UserA as User A (Approver)
    participant API as Backend API
    participant Queue as Job Queue
    participant Worker
    participant DB as PostgreSQL
    participant Mail as Mail Service
    actor UserB as User B (Next Approver)

    UserA->>API: POST /tasks/{id}/complete
    activate API
    API->>DB: Update Task Status
    API->>Queue: Enqueue Job (WORKFLOW_NODE_PROCESS)
    API-->>UserA: 200 OK
    deactivate API
    
    Queue->>Worker: Fetch Job
    activate Worker

    Worker->>DB: Fetch Application
    Worker->>Worker: Determine Next Node (Approval Node)
    
    Worker->>DB: Create New Task (Status: PENDING)
    Worker->>DB: Assign to User B (Assignee)
    
    Worker->>Mail: Send Email Notification
    activate Mail
    Mail-->>UserB: Email: "Approval Request"
    deactivate Mail
    
    Worker->>DB: Update Application Current Node
    
    deactivate Worker
```

## 自動API実行タスク (Service Task)

APIコールノードに到達した際の処理フローです。

```mermaid
sequenceDiagram
    participant Queue as Job Queue
    participant Worker
    participant DB as PostgreSQL
    participant ExtAPI as External API

    Queue->>Worker: Fetch Job (WORKFLOW_NODE_PROCESS)
    activate Worker

    Worker->>DB: Fetch Application Input Data
    Worker->>Worker: Replace Variables in URL/Body
    
    Worker->>ExtAPI: HTTP Request
    activate ExtAPI
    ExtAPI-->>Worker: HTTP Response
    deactivate ExtAPI
    
    Worker->>Worker: Parse Response
    Worker->>Worker: Map Response to Input Data
    
    alt Response Mapping Exists
        Worker->>DB: Update Application Input Data
    end
    
    Worker->>DB: Save Service Task Result (COMPLETED)
    Worker->>DB: Save History
    
    Worker->>Queue: Enqueue Next Step Job
    deactivate Worker
```
