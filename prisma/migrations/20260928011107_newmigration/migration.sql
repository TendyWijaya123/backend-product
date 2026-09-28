/*
  Warnings:

  - Added the required column `file_key` to the `task_attachments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "task_attachments" ADD COLUMN     "file_key" TEXT NOT NULL;
