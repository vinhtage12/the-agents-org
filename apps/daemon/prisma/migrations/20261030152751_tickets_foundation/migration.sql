-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('TODO', 'IN_SPEC', 'IN_REVIEW_SPEC', 'IN_PROGRESS', 'IN_TESTING', 'IN_REVIEW', 'DONE', 'CANCELED');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "default_repo_id" INTEGER,
ADD COLUMN     "dev_agent" VARCHAR(128),
ADD COLUMN     "spec_agent" VARCHAR(128),
ADD COLUMN     "test_agent" VARCHAR(128);

-- CreateTable
CREATE TABLE "project_repos" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "path" VARCHAR(1024) NOT NULL,

    CONSTRAINT "project_repos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" SERIAL NOT NULL,
    "jira_key" VARCHAR(64) NOT NULL,
    "summary" VARCHAR(1024) NOT NULL,
    "description" TEXT NOT NULL,
    "issue_type" VARCHAR(64) NOT NULL,
    "jira_status" VARCHAR(128) NOT NULL,
    "jira_url" VARCHAR(1024) NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'TODO',
    "project_id" INTEGER,
    "repo_id" INTEGER,
    "spec_agent" VARCHAR(128),
    "dev_agent" VARCHAR(128),
    "test_agent" VARCHAR(128),
    "linked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_repos_project_id_name_key" ON "project_repos"("project_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_jira_key_key" ON "tickets"("jira_key");

-- CreateIndex
CREATE INDEX "tickets_project_id_idx" ON "tickets"("project_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_default_repo_id_fkey" FOREIGN KEY ("default_repo_id") REFERENCES "project_repos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_repos" ADD CONSTRAINT "project_repos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "project_repos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
