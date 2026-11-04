-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "parent_description" TEXT,
ADD COLUMN     "parent_key" VARCHAR(64),
ADD COLUMN     "parent_summary" VARCHAR(1024);
