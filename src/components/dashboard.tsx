"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarModule } from "./modules/calendar-module";
import { TodoModule } from "./modules/todo-module";
import { ChoresModule } from "./modules/chores-module";
import { WeatherModule } from "./modules/weather-module";
import { FullscreenToggle } from "./fullscreen-toggle";

export function Dashboard() {
  const [calendarExpanded, setCalendarExpanded] = useState(false);

  return (
    <div className="h-dvh w-full max-w-none overflow-hidden p-4 text-slate-100">
      <div className="flex h-full w-full flex-col gap-4 overflow-hidden">
        <FullscreenToggle />
        <Link
          href="/settings"
          className="fixed bottom-4 right-4 z-50 rounded-full border border-white/15 bg-[rgba(11,24,42,0.68)] px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-100 shadow-[0_12px_28px_rgba(4,10,20,0.28)] backdrop-blur-xl transition hover:border-white/35 hover:bg-[rgba(17,34,58,0.8)] hover:text-white"
        >
          Settings
        </Link>
        <main className="flex-1 min-h-0 w-full overflow-hidden">
          {calendarExpanded ? (
            <div className="flex h-full min-h-0 w-full flex-col">
              <CalendarModule expanded onToggleExpand={() => setCalendarExpanded(false)} />
            </div>
          ) : (
            <div className="grid h-full min-h-0 w-full gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,2fr)]">
              <div className="flex min-h-0 w-full flex-col gap-4">
                <div className="flex min-h-0 w-full flex-[5]">
                  <WeatherModule />
                </div>
                <div className="flex min-h-0 w-full flex-[6]">
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
