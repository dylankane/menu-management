-- CreateTable
CREATE TABLE "set_menu_courses" (
    "set_menu_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "set_menu_courses_pkey" PRIMARY KEY ("set_menu_id","course_id")
);

-- AddForeignKey
ALTER TABLE "set_menu_courses" ADD CONSTRAINT "set_menu_courses_set_menu_id_fkey" FOREIGN KEY ("set_menu_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_menu_courses" ADD CONSTRAINT "set_menu_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
