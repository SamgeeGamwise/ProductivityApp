"use client";

import { useState } from "react";
import { CalendarModule } from "./modules/calendar-module";
import { TodoModule } from "./modules/todo-module";
import { ChoresModule } from "./modules/chores-module";

export function Dashboard() {
  const [calendarExpanded, setCalendarExpanded] = useState(false);

  return (
    <div className="h-dvh w-dvw overflow-hidden bg-slate-950 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.25),_transparent_60%)] p-4 text-slate-100">
      <div className="mx-auto flex h-full max-w-6xl flex-col gap-4">
        <main className="flex-1 overflow-hidden">
          {calendarExpanded ? (
            <div className="flex h-full min-h-0 flex-col">
              <CalendarModule expanded onToggleExpand={() => setCalendarExpanded(false)} />
            </div>
          ) : (
            <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[1.5fr_1fr]">
              <div className="flex min-h-0">
                <CalendarModule onToggleExpand={() => setCalendarExpanded(true)} />
              </div>
              <div className="grid min-h-0 grid-rows-2 gap-4">
                <div className="flex min-h-0">
                  <TodoModule />
                </div>
                <div className="flex min-h-0">
                  <ChoresModule />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
