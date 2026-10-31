-- CreateEnum
CREATE TYPE "TestMode" AS ENUM ('WRITE_CASES', 'RUN_CASES');

-- AlterTable
ALTER TABLE "agent_runs" ADD COLUMN     "test_mode" "TestMode";

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "fix_round" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "test_cases" (
    "id" SERIAL NOT NULL,
    "ticket_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "title" VARCHAR(512) NOT NULL,
    "steps" TEXT NOT NULL,
    "expected" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_results" (
    "id" SERIAL NOT NULL,
    "agent_run_id" INTEGER NOT NULL,
    "test_case_id" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "test_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "test_cases_ticket_id_position_key" ON "test_cases"("ticket_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "test_results_agent_run_id_test_case_id_key" ON "test_results"("agent_run_id", "test_case_id");

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
