import { CalendarModule } from "./modules/calendar-module";
import { TodoModule } from "./modules/todo-module";
import { ChoresModule } from "./modules/chores-module";
import { RoutineModule } from "./modules/routine-module";

export function Dashboard() {
  return (
    <div className="h-dvh w-dvw overflow-hidden bg-slate-950 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.25),_transparent_60%)] p-4 text-slate-100">
      <div className="mx-auto flex h-full max-w-6xl flex-col gap-4">
        <header className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/80 px-5 py-3 shadow-lg shadow-black/40">
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-slate-400">Skylight Inspired</p>
            <h1 className="text-2xl font-semibold text-white">Home Rhythm</h1>
          </div>
          <p className="text-xs text-slate-400">Tap-friendly dashboard · 15&quot; display</p>
        </header>

        <main className="grid flex-1 gap-4 overflow-hidden lg:grid-cols-[1.45fr_1fr]">
          <div className="flex min-h-0 flex-col gap-4">
            <div className="flex min-h-0 flex-1">
              <CalendarModule />
            </div>
            <div className="flex min-h-0 flex-1">
              <TodoModule />
            </div>
          </div>
          <div className="grid min-h-0 grid-rows-2 gap-4">
            <ChoresModule />
            <RoutineModule />
          </div>
        </main>
      </div>
    </div>
  );
}
