-- CreateEnum
CREATE TYPE "CalendarRecurrence" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateTable
CREATE TABLE "CalendarTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "startDate" TEXT NOT NULL,
    "time" TEXT,
    "recurrence" "CalendarRecurrence" NOT NULL DEFAULT 'NONE',
    "interval" INTEGER NOT NULL DEFAULT 1,
    "endDate" TEXT,
    "remindDaysBefore" INTEGER,
    "preset" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarOccurrence" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "CalendarOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendarTask_preset_key" ON "CalendarTask"("preset");

-- CreateIndex
CREATE INDEX "CalendarOccurrence_date_idx" ON "CalendarOccurrence"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarOccurrence_taskId_date_key" ON "CalendarOccurrence"("taskId", "date");

-- AddForeignKey
ALTER TABLE "CalendarOccurrence" ADD CONSTRAINT "CalendarOccurrence_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CalendarTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
