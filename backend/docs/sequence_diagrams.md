# シーケンス図

## ワークフロー承認プロセス (非同期)

ユーザーがタスクを「承認」し、次のステップへ進むまでの流れを示します。
Executor (WorkflowEngine) がフロー制御を行い、Worker (GenericWorker) が個別のタスク処理を実行する役割分担となっています。

```mermaid
sequenceDiagram
    actor User
    participant API as Backend API
    participant DB as PostgreSQL
    participant Queue as Job Queue
    participant Executor as Executor (WorkflowEngine)
    participant Worker as Worker (GenericWorker)
    participant Mail as Mail Service

    User->>API: POST /tasks/{id}/complete (Action: APPROVE)
    activate API
    
    API->>DB: begin transaction
    API->>DB: Update WorkflowTask Status (COMPLETED)
    API->>DB: Insert WorkflowTaskHistory
    API->>DB: Insert Approval History
    API->>DB: commit transaction
    
    API->>Queue: Enqueue (WORKFLOW_NODE_PROCESS)
    API-->>User: 200 OK (Updated Task Info)
    deactivate API

    loop Background Processing
        %% 1. Node Processing (Flow Control)
        Queue->>Executor: Fetch (WORKFLOW_NODE_PROCESS)
        activate Executor
        Executor->>DB: Fetch Application
        Executor->>Executor: Determine Next Node
        
        alt Next is Approval Node
            Executor->>DB: Create WorkflowTask (type: approval, status: PENDING)
            Executor->>Queue: Enqueue (TASK_EXECUTE)
        else Next is API Call
            Executor->>DB: Create WorkflowTask (type: apiCall, status: PENDING)
            Executor->>Queue: Enqueue (TASK_EXECUTE)
        end
        Executor->>DB: Update Application (Current Node)
        deactivate Executor

        %% 2. Task Execution
        Queue->>Worker: Fetch (TASK_EXECUTE)
        activate Worker
        Worker->>DB: Update Status (RUNNING)
        Worker->>Worker: Execute Handler
        
        alt Approval Task
            Worker->>Mail: Send Notification Email
            Worker->>Worker: Result (shouldAdvance: false)
        else Service Task
            Worker->>Worker: Execute HTTP Request
            Worker->>Worker: Result (shouldAdvance: true)
        end
        
        Worker->>DB: Update Result / History
        Worker->>Queue: Enqueue (TASK_COMPLETE)
        deactivate Worker
        
        %% 3. Completion Handling (Flow Advancement)
        Queue->>Executor: Fetch (TASK_COMPLETE)
        activate Executor
        alt shouldAdvance is true
            Executor->>Queue: Enqueue (WORKFLOW_NODE_PROCESS)
        end
        deactivate Executor
    end
```

## ヒューマンタスク間遷移 (承認 -> 次の承認)

承認者(A)の承認により、次の承認者(B)のタスクが生成される詳細フローです。

```mermaid
sequenceDiagram
    actor UserA as User A (Approver)
    participant API as Backend API
    participant Queue as Job Queue
    participant Executor as Executor (WorkflowEngine)
    participant Worker as Worker (GenericWorker)
    participant DB as PostgreSQL
    participant Mail as Mail Service
    actor UserB as User B (Next Approver)

    UserA->>API: POST /tasks/{id}/complete
    activate API
    API->>DB: Update Task Status
    API->>Queue: Enqueue (WORKFLOW_NODE_PROCESS)
    deactivate API
    
    %% Executorが次のステップ（Bさんの承認）を決定
    Queue->>Executor: Fetch (WORKFLOW_NODE_PROCESS)
    activate Executor
    Executor->>DB: Create WorkflowTask (Assigned to B)
    Executor->>Queue: Enqueue (TASK_EXECUTE)
    deactivate Executor
    
    %% Workerが通知処理を実行
    Queue->>Worker: Fetch (TASK_EXECUTE)
    activate Worker
    Worker->>Mail: Send Email Notification
    activate Mail
    Mail-->>UserB: Email: "Approval Request"
    deactivate Mail
    Worker->>Queue: Enqueue (TASK_COMPLETE)
    deactivate Worker
    
    %% Executorが完了を確認（承認タスクなので進まない）
    Queue->>Executor: Fetch (TASK_COMPLETE)
    activate Executor
    Executor->>Executor: shouldAdvance = false
    deactivate Executor
```

## 自動API実行タスク (Service Task)

APIコールノードに到達した際の処理フローです。

```mermaid
sequenceDiagram
    participant Queue as Job Queue
    participant Executor as Executor (WorkflowEngine)
    participant Worker as Worker (GenericWorker)
    participant DB as PostgreSQL
    participant ExtAPI as External API

    %% 前のステップから遷移
    Queue->>Executor: Fetch (WORKFLOW_NODE_PROCESS)
    activate Executor
    Executor->>DB: Create WorkflowTask (apiCall)
    Executor->>Queue: Enqueue (TASK_EXECUTE)
    deactivate Executor
    
    %% WorkerがAPI実行
    Queue->>Worker: Fetch (TASK_EXECUTE)
    activate Worker
    Worker->>ExtAPI: HTTP Request
    activate ExtAPI
    ExtAPI-->>Worker: HTTP Response
    deactivate ExtAPI
    
    Worker->>DB: Update Result & History
    Worker->>Queue: Enqueue (TASK_COMPLETE)
    deactivate Worker
    
    %% Executorが完了を検知して次へ進む
    Queue->>Executor: Fetch (TASK_COMPLETE)
    activate Executor
    Executor->>Executor: shouldAdvance = true
    Executor->>Queue: Enqueue (WORKFLOW_NODE_PROCESS for Next Node)
    deactivate Executor
```

## Generic Worker 内部フロー

GenericWorker がジョブを受信してから完了させるまでの詳細フローです。

```mermaid
sequenceDiagram
    participant Queue as pg-boss
    participant Worker as GenericWorker
    participant Registry as TaskHandlerRegistry
    participant Handler as ConcreteHandler
    participant DB as PostgreSQL

    Queue->>Worker: PROCESS (TASK_EXECUTE)
    activate Worker
    
    Worker->>DB: Update Status (RUNNING)
    
    Worker->>Registry: getHandler(nodeType)
    activate Registry
    Registry-->>Worker: Handler Instance
    deactivate Registry
    
    Worker->>Handler: execute(Context)
    activate Handler
    Handler->>Handler: Business Logic
    Handler-->>Worker: Result { success, output, shouldAdvance }
    deactivate Handler
    
    alt Success
        Worker->>DB: Update Task Result (COMPLETED if advanced)
        Worker->>DB: Insert History
        Worker->>Queue: Enqueue TASK_COMPLETE
    else Failure
        Worker->>DB: Update Status (FAILED)
        Worker->>DB: Insert History (FAILED)
        Worker->>Queue: Enqueue TASK_COMPLETE (with error)
    end
    
    deactivate Worker
```

## Scheduler: アプリケーションリカバリー

```mermaid
sequenceDiagram
    participant Cron as Scheduler
    participant Service as ApplicationRecoveryService
    participant DB as PostgreSQL
    participant Queue as pg-boss

    Cron->>Service: Every 5 min
    activate Service
    
    Service->>DB: Find Stuck Applications (IN_PROGRESS)
    DB-->>Service: Application List
    
    loop For Each App
        Service->>Queue: Enqueue (WORKFLOW_NODE_PROCESS)
        Service->>DB: Update updatedAt
    end
    
    deactivate Service
```

## Scheduler: ストレージクリーンアップ

```mermaid
sequenceDiagram
    participant Cron as Scheduler
    participant Service as StorageCleanupService
    participant DB as PostgreSQL
    participant Storage as S3/MinIO

    Cron->>Service: Every Day 3:00 AM
    activate Service
    
    Service->>DB: Find Expired Pending Files
    DB-->>Service: File List
    
    loop For Each File
        Service->>Storage: Delete Object
        Service->>DB: Update Status / Delete Record
    end
    
    deactivate Service
```

## タスクステータス遷移フロー

`WorkflowTask` のライフサイクルとステータス遷移を示します。

```mermaid
stateDiagram
    [*] --> PENDING: Created by Executor
    
    PENDING --> RUNNING: Worker picks up task
    PENDING --> CANCELED: Remand action
    
    RUNNING --> COMPLETED: Success (shouldAdvance=true)
    RUNNING --> PENDING: Success (shouldAdvance=false)
    RUNNING --> FAILED: Execution Error
    
    FAILED --> PENDING: Retry
    
    PENDING --> WaitingForAction: Approval Task
    
    WaitingForAction --> Approved
    WaitingForAction --> Rejected
    WaitingForAction --> Remanded
    
    Approved --> COMPLETED: Action APPROVE
    Rejected --> COMPLETED: Action REJECT
    Remanded --> CANCELED: Action REMAND
```

## アプリケーション同期 (検索インデックス)

Elasticsearch へのデータ同期は、アプリケーションの作成・更新イベントをトリガーとして非同期で行われます。

```mermaid
sequenceDiagram
    participant API as ApplicationsService
    participant DB as PostgreSQL
    participant Queue as Job Queue
    participant Indexer as SearchService
    participant ES as Elasticsearch

    %% 1. Application Update
    API->>DB: Create / Update Application
    API->>Queue: Enqueue (application-indexing)
    
    %% 2. Async Indexing
    loop Background Indexing
        Queue->>Indexer: Fetch (application-indexing)
        activate Indexer
        
        Indexer->>DB: Fetch Application Data
        
        alt Mode is Elasticsearch
            Indexer->>ES: Index Document (upsert)
        end
        
        deactivate Indexer
    end
```
