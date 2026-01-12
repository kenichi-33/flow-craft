-- CreateTable
CREATE TABLE "workflow_tasks" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_to" TEXT,
    "assigned_to_display" TEXT,
    "assigned_to_info" JSONB,
    "due_date" TIMESTAMP(3),
    "config" JSONB,
    "result" JSONB,
    "error" TEXT,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_task_histories" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_task_histories_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_task_histories" ADD CONSTRAINT "workflow_task_histories_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "workflow_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_task_histories" ADD CONSTRAINT "workflow_task_histories_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
