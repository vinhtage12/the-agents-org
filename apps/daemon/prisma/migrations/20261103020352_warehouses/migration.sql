/*
  Warnings:

  - `project_repos` is dropped, but its rows are copied into `repos` first (see "Data move" below).

*/
-- CreateEnum
CREATE TYPE "AgentRole" AS ENUM ('BA', 'DEV', 'QC', 'FILE_PROCESSOR');

-- CreateEnum
CREATE TYPE "BranchKind" AS ENUM ('CHECKOUT_BASE', 'PR_TARGET', 'NONE');

-- DropForeignKey
ALTER TABLE "project_repos" DROP CONSTRAINT "project_repos_project_id_fkey";

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_default_repo_id_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_repo_id_fkey";

-- AlterTable
ALTER TABLE "agent_runs" ADD COLUMN     "agent_id" INTEGER;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "dev_agent_id" INTEGER,
ADD COLUMN     "spec_agent_id" INTEGER,
ADD COLUMN     "test_agent_id" INTEGER;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "branch" VARCHAR(255),
ADD COLUMN     "dev_agent_id" INTEGER,
ADD COLUMN     "spec_agent_id" INTEGER,
ADD COLUMN     "test_agent_id" INTEGER;

-- CreateTable
CREATE TABLE "repos" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "path" VARCHAR(1024) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repo_environments" (
    "id" SERIAL NOT NULL,
    "repo_id" INTEGER NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "env_file" VARCHAR(255) NOT NULL DEFAULT '',

    CONSTRAINT "repo_environments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repo_branches" (
    "id" SERIAL NOT NULL,
    "environment_id" INTEGER NOT NULL,
    "repo_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "kind" "BranchKind" NOT NULL DEFAULT 'NONE',

    CONSTRAINT "repo_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "role" "AgentRole" NOT NULL,
    "provider" VARCHAR(16) NOT NULL,
    "model" VARCHAR(128),
    "effort" VARCHAR(32),
    "path" VARCHAR(1024) NOT NULL,
    "description" VARCHAR(512) NOT NULL DEFAULT '',
    "allowed_tools" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "provider" VARCHAR(16) NOT NULL,
    "command" VARCHAR(128) NOT NULL,
    "path" VARCHAR(1024) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "path" VARCHAR(1024) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProjectRepos" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ProjectRepos_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_AgentToSkill" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_AgentToSkill_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_AgentToRule" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_AgentToRule_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_SkillToTicket" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_SkillToTicket_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_RuleToTicket" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_RuleToTicket_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "repos_name_key" ON "repos"("name");

-- CreateIndex
CREATE UNIQUE INDEX "repos_path_key" ON "repos"("path");

-- CreateIndex
CREATE UNIQUE INDEX "repo_environments_repo_id_name_key" ON "repo_environments"("repo_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "repo_branches_environment_id_name_key" ON "repo_branches"("environment_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "agents_name_key" ON "agents"("name");

-- CreateIndex
CREATE UNIQUE INDEX "skills_provider_name_key" ON "skills"("provider", "name");

-- CreateIndex
CREATE UNIQUE INDEX "rules_name_key" ON "rules"("name");

-- CreateIndex
CREATE INDEX "_ProjectRepos_B_index" ON "_ProjectRepos"("B");

-- Data move: project_repos -> repos. Repos are deduped by path (smallest id wins) and keep that id.
-- A name already taken by an earlier repo gets an "-<id>" suffix.
INSERT INTO "repos" ("id", "name", "path", "updated_at")
SELECT c.id,
       CASE WHEN row_number() OVER (PARTITION BY c.name ORDER BY c.id) > 1
            THEN left(c.name, 55) || '-' || c.id ELSE c.name END,
       c.path,
       CURRENT_TIMESTAMP
FROM (SELECT DISTINCT ON (path) id, name, path FROM "project_repos" ORDER BY path, id) c;
SELECT setval(pg_get_serial_sequence('repos', 'id'), COALESCE((SELECT max(id) FROM "repos"), 1), (SELECT count(*) > 0 FROM "repos"));

CREATE TEMP TABLE "_repo_map" AS
SELECT o.id AS old_id, c.id AS new_id
FROM "project_repos" o
JOIN (SELECT DISTINCT ON (path) id, path FROM "project_repos" ORDER BY path, id) c ON c.path = o.path;

UPDATE "tickets" t SET "repo_id" = m.new_id FROM "_repo_map" m WHERE t."repo_id" = m.old_id;
UPDATE "projects" p SET "default_repo_id" = m.new_id FROM "_repo_map" m WHERE p."default_repo_id" = m.old_id;
-- A = Project, B = Repo (alphabetical order of model names).
INSERT INTO "_ProjectRepos" ("A", "B")
SELECT DISTINCT o."project_id", m.new_id FROM "project_repos" o JOIN "_repo_map" m ON m.old_id = o.id;

DROP TABLE "_repo_map";
DROP TABLE "project_repos";

-- One CHECKOUT_BASE branch per repo.
CREATE UNIQUE INDEX "repo_branches_one_checkout_base" ON "repo_branches"("repo_id") WHERE "kind" = 'CHECKOUT_BASE';

-- CreateIndex
CREATE INDEX "_AgentToSkill_B_index" ON "_AgentToSkill"("B");

-- CreateIndex
CREATE INDEX "_AgentToRule_B_index" ON "_AgentToRule"("B");

-- CreateIndex
CREATE INDEX "_SkillToTicket_B_index" ON "_SkillToTicket"("B");

-- CreateIndex
CREATE INDEX "_RuleToTicket_B_index" ON "_RuleToTicket"("B");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_default_repo_id_fkey" FOREIGN KEY ("default_repo_id") REFERENCES "repos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_spec_agent_id_fkey" FOREIGN KEY ("spec_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_dev_agent_id_fkey" FOREIGN KEY ("dev_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_test_agent_id_fkey" FOREIGN KEY ("test_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repo_environments" ADD CONSTRAINT "repo_environments_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repo_branches" ADD CONSTRAINT "repo_branches_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "repo_environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_spec_agent_id_fkey" FOREIGN KEY ("spec_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_dev_agent_id_fkey" FOREIGN KEY ("dev_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_test_agent_id_fkey" FOREIGN KEY ("test_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectRepos" ADD CONSTRAINT "_ProjectRepos_A_fkey" FOREIGN KEY ("A") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectRepos" ADD CONSTRAINT "_ProjectRepos_B_fkey" FOREIGN KEY ("B") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgentToSkill" ADD CONSTRAINT "_AgentToSkill_A_fkey" FOREIGN KEY ("A") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgentToSkill" ADD CONSTRAINT "_AgentToSkill_B_fkey" FOREIGN KEY ("B") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgentToRule" ADD CONSTRAINT "_AgentToRule_A_fkey" FOREIGN KEY ("A") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgentToRule" ADD CONSTRAINT "_AgentToRule_B_fkey" FOREIGN KEY ("B") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SkillToTicket" ADD CONSTRAINT "_SkillToTicket_A_fkey" FOREIGN KEY ("A") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SkillToTicket" ADD CONSTRAINT "_SkillToTicket_B_fkey" FOREIGN KEY ("B") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RuleToTicket" ADD CONSTRAINT "_RuleToTicket_A_fkey" FOREIGN KEY ("A") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RuleToTicket" ADD CONSTRAINT "_RuleToTicket_B_fkey" FOREIGN KEY ("B") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
