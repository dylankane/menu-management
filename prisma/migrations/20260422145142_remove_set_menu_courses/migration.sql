/*
  Warnings:

  - You are about to drop the `set_menu_courses` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "set_menu_courses" DROP CONSTRAINT "set_menu_courses_course_id_fkey";

-- DropForeignKey
ALTER TABLE "set_menu_courses" DROP CONSTRAINT "set_menu_courses_set_menu_id_fkey";

-- DropTable
DROP TABLE "set_menu_courses";
