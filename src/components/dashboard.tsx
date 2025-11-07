"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarModule } from "./modules/calendar-module";
import { TodoModule } from "./modules/todo-module";
import { ChoresModule } from "./modules/chores-module";

export function Dashboard() {
  const [calendarExpanded, setCalendarExpanded] = useState(false);

  return (
    <div className="h-dvh w-full overflow-hidden bg-slate-950 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.25),_transparent_60%)] p-4 text-slate-100">
      <div className="flex h-full w-full flex-col gap-4 overflow-hidden">
        <Link
          href="/settings"
          className="fixed bottom-4 right-4 z-50 rounded-full border border-white/20 bg-slate-900/30 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-slate-200 shadow-lg shadow-black/30 backdrop-blur transition hover:border-white/60 hover:text-white"
        >
          Settings
        </Link>
        <main className="flex-1 min-h-0 overflow-hidden">
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
