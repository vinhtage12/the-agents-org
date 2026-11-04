-- CreateEnum
CREATE TYPE "ScheduledRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'STOPPED', 'MISSED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ScheduledRunTrigger" AS ENUM ('SCHEDULE', 'MANUAL', 'RERUN');

-- CreateTable
CREATE TABLE "scheduled_tasks" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "slug" VARCHAR(128) NOT NULL,
    "prompt" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "time" INTEGER NOT NULL,
    "days" INTEGER[],
    "agent_id" INTEGER NOT NULL,
    "output_dir" VARCHAR(1024) NOT NULL,
    "checked_until" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_task_repos" (
    "task_id" INTEGER NOT NULL,
    "repo_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "scheduled_task_repos_pkey" PRIMARY KEY ("task_id","repo_id")
);

-- CreateTable
CREATE TABLE "scheduled_runs" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "trigger" "ScheduledRunTrigger" NOT NULL,
    "status" "ScheduledRunStatus" NOT NULL,
    "rerun_of_id" INTEGER,
    "dismissed_at" TIMESTAMP(3),
    "agent_id" INTEGER,
    "agent_name" VARCHAR(128) NOT NULL,
    "pane_id" VARCHAR(128),
    "token" VARCHAR(64) NOT NULL,
    "output_path" VARCHAR(1024),
    "output" TEXT,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_tasks_name_key" ON "scheduled_tasks"("name");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_tasks_slug_key" ON "scheduled_tasks"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_task_repos_task_id_position_key" ON "scheduled_task_repos"("task_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_runs_rerun_of_id_key" ON "scheduled_runs"("rerun_of_id");

-- CreateIndex
CREATE INDEX "scheduled_runs_task_id_scheduled_for_idx" ON "scheduled_runs"("task_id", "scheduled_for");

CREATE UNIQUE INDEX "scheduled_runs_one_per_occurrence" ON "scheduled_runs"("task_id", "scheduled_for") WHERE "trigger" = 'SCHEDULE';
CREATE UNIQUE INDEX "scheduled_runs_one_running_per_task" ON "scheduled_runs"("task_id") WHERE "status" = 'RUNNING';

-- AddForeignKey
ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_task_repos" ADD CONSTRAINT "scheduled_task_repos_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "scheduled_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_task_repos" ADD CONSTRAINT "scheduled_task_repos_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_runs" ADD CONSTRAINT "scheduled_runs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "scheduled_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_runs" ADD CONSTRAINT "scheduled_runs_rerun_of_id_fkey" FOREIGN KEY ("rerun_of_id") REFERENCES "scheduled_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_runs" ADD CONSTRAINT "scheduled_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
