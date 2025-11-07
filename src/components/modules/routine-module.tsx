"use client";

import { ModuleCard } from "../module-card";
import { usePersistentList } from "@/hooks/usePersistentList";
import { FormEvent, useState } from "react";
import clsx from "clsx";

type RoutineType = "morning" | "evening";

const defaults: Record<RoutineType, { id: string; label: string; done: boolean }[]> = {
  morning: [
    { id: "morning-1", label: "Open curtains + sunlight", done: false },
    { id: "morning-2", label: "Stretch + hydrate", done: false },
  ],
  evening: [
    { id: "evening-1", label: "Kitchen reset", done: false },
    { id: "evening-2", label: "Set out tomorrow's clothes", done: false },
  ],
};

export function RoutineModule() {
  const morning = usePersistentList("routine-morning", defaults.morning);
  const evening = usePersistentList("routine-evening", defaults.evening);
  const [active, setActive] = useState<RoutineType>("morning");

  const quickSteps: Record<RoutineType, string[]> = {
    morning: ["Hydrate", "Vitamin", "Stretch", "Morning walk"],
    evening: ["Dish reset", "Tidy toys", "Shut blinds", "Charge devices"],
  };

  const activeHook = active === "morning" ? morning : evening;

  return (
    <ModuleCard title="Routines" accent="from-indigo-500/30 to-indigo-500/10" contentClassName="gap-3">
      <div className="flex gap-2">
        {(["morning", "evening"] as RoutineType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setActive(type)}
            className={clsx(
              "flex-1 rounded-xl px-3 py-2 text-sm font-semibold capitalize transition",
              active === type ? "bg-indigo-500 text-white" : "bg-white/10 text-slate-200"
            )}
          >
            {type}
          </button>
        ))}
        <button
          type="button"
          onClick={() => activeHook.reset(defaults[active])}
          className="rounded-xl border border-white/15 px-3 py-2 text-xs text-white/70"
        >
          Reset
        </button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {quickSteps[active].map((step) => (
          <button
            key={step}
            type="button"
            onClick={() => activeHook.add(step)}
            className="rounded-full border border-indigo-300/40 px-3 py-1 font-semibold text-white hover:border-indigo-200"
          >
            {step}
          </button>
        ))}
      </div>

      <RoutineList title={active} hook={activeHook} />
    </ModuleCard>
  );
}

function RoutineList({ title, hook }: { title: string; hook: ReturnType<typeof usePersistentList> }) {
  const { items, add, toggle } = hook;
  const [text, setText] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    add(text);
    setText("");
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2 text-xs">
        <input
          className="flex-1 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-white/40"
          placeholder={`Add ${title} step`}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <button
          type="submit"
          className="rounded-lg bg-white/20 px-3 py-2 font-semibold text-white"
          disabled={!text.trim()}
        >
          Add
        </button>
      </form>
      <ul className="space-y-2">
        {items.slice(0, 6).map((item) => (
          <li key={item.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-slate-900/60 px-3 py-2">
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => toggle(item.id)}
              className="h-4 w-4 rounded border-white/30 bg-slate-950 text-white focus:ring-white/40"
            />
            <p className={clsx("text-xs font-medium", item.done ? "text-slate-400 line-through" : "text-white")}>{item.label}</p>
          </li>
        ))}
        {!items.length && <p className="text-xs text-slate-400">No steps yet.</p>}
      </ul>
    </div>
  );
}
