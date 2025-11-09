"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarModule } from "./modules/calendar-module";
import { TodoModule } from "./modules/todo-module";
import { ChoresModule } from "./modules/chores-module";
import { WeatherModule } from "./modules/weather-module";

export function Dashboard() {
  const [calendarExpanded, setCalendarExpanded] = useState(false);

  return (
    <div className="h-dvh w-full max-w-none overflow-hidden bg-slate-950 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.25),_transparent_60%)] p-4 text-slate-100">
      <div className="flex h-full w-full flex-col gap-4 overflow-hidden">
        <Link
          href="/settings"
          className="fixed bottom-4 right-4 z-50 rounded-full border border-white/20 bg-slate-900/30 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-slate-200 shadow-lg shadow-black/30 backdrop-blur transition hover:border-white/60 hover:text-white"
        >
          Settings
        </Link>
        <main className="flex-1 min-h-0 w-full overflow-hidden">
          {calendarExpanded ? (
            <div className="flex h-full min-h-0 w-full flex-col">
              <CalendarModule expanded onToggleExpand={() => setCalendarExpanded(false)} />
            </div>
          ) : (
            <div className="grid h-full min-h-0 w-full gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
              <div className="flex min-h-0 w-full flex-col gap-4">
                <div className="flex w-full">
                  <WeatherModule />
                </div>
                <div className="flex min-h-0 w-full flex-1">
                  <CalendarModule onToggleExpand={() => setCalendarExpanded(true)} />
                </div>
              </div>
              <div className="flex min-h-0 w-full flex-col gap-4">
                <div className="flex min-h-0 w-full flex-1">
                  <TodoModule />
                </div>
                <div className="flex min-h-0 w-full flex-1">
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
