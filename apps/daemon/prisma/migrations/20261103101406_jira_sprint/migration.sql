-- CreateEnum
CREATE TYPE "SpecSource" AS ENUM ('LOCAL', 'JIRA', 'HYBRID');

-- CreateEnum
CREATE TYPE "TicketSource" AS ENUM ('JIRA', 'LOCAL');

-- CreateEnum
CREATE TYPE "SprintSource" AS ENUM ('JIRA', 'LOCAL');

-- CreateEnum
CREATE TYPE "SprintState" AS ENUM ('FUTURE', 'ACTIVE', 'CLOSED');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "local_ticket_seq" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "spec_dir" VARCHAR(1024),
ADD COLUMN     "spec_source" "SpecSource" NOT NULL DEFAULT 'JIRA';

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "source" "TicketSource" NOT NULL DEFAULT 'JIRA',
ADD COLUMN     "spec_file" VARCHAR(1024),
ADD COLUMN     "sprint_id" INTEGER;

-- CreateTable
CREATE TABLE "sprints" (
    "id" SERIAL NOT NULL,
    "source" "SprintSource" NOT NULL,
    "jira_sprint_id" INTEGER,
    "jira_board_id" INTEGER,
    "project_id" INTEGER,
    "name" VARCHAR(255) NOT NULL,
    "state" "SprintState" NOT NULL DEFAULT 'FUTURE',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sprints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sprints_jira_sprint_id_key" ON "sprints"("jira_sprint_id");

-- CreateIndex
CREATE INDEX "sprints_project_id_idx" ON "sprints"("project_id");

-- CreateIndex
CREATE INDEX "tickets_sprint_id_idx" ON "tickets"("sprint_id");

-- AddForeignKey
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Only one local sprint may be active in a project.
CREATE UNIQUE INDEX "sprints_one_active_local" ON "sprints"("project_id") WHERE "state" = 'ACTIVE' AND "source" = 'LOCAL';
