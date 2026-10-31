-- CreateEnum
CREATE TYPE "AgentStep" AS ENUM ('SPEC', 'DEV', 'TEST');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'STOPPED');

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "extra_instructions" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "extra_skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "spec_approved_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" SERIAL NOT NULL,
    "ticket_id" INTEGER NOT NULL,
    "step" "AgentStep" NOT NULL,
    "agent_slug" VARCHAR(128) NOT NULL,
    "pane_id" VARCHAR(128),
    "token" VARCHAR(64) NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'RUNNING',
    "feedback" TEXT,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spec_versions" (
    "id" SERIAL NOT NULL,
    "ticket_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "feedback" TEXT,
    "edited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spec_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_runs_ticket_id_step_idx" ON "agent_runs"("ticket_id", "step");

-- CreateIndex
CREATE UNIQUE INDEX "spec_versions_ticket_id_version_key" ON "spec_versions"("ticket_id", "version");

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_versions" ADD CONSTRAINT "spec_versions_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
