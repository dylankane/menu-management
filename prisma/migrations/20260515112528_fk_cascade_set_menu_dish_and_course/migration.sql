-- DropForeignKey
ALTER TABLE "set_menu_courses" DROP CONSTRAINT "set_menu_courses_course_id_fkey";

-- DropForeignKey
ALTER TABLE "set_menu_dishes" DROP CONSTRAINT "set_menu_dishes_dish_id_fkey";

-- AddForeignKey
ALTER TABLE "set_menu_courses" ADD CONSTRAINT "set_menu_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_menu_dishes" ADD CONSTRAINT "set_menu_dishes_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
