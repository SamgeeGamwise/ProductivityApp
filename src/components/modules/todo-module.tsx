"use client";

import { FormEvent, useState } from "react";
import { usePersistentList } from "@/hooks/usePersistentList";
import { ModuleCard } from "../module-card";
import clsx from "clsx";

const defaultTodos = [
  { id: "sample-1", label: "Plan tomorrow's top 3 tasks", done: false },
  { id: "sample-2", label: "Reply to important emails", done: false },
];

const quickTodos = ["Prep dinner plan", "Laundry reset", "Inbox zero", "Budget check", "Call family", "Device charge"];

export function TodoModule() {
  const { items, add, toggle, remove } = usePersistentList("todo-items", defaultTodos);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    add(text, note || undefined);
    setText("");
    setNote("");
  };

  const visible = items.slice(0, 5);
  const remaining = items.length - visible.length;

  return (
    <ModuleCard
      title="Todo List"
      accent="from-emerald-500/30 to-emerald-500/10"
      contentClassName="gap-3"
    >
      <div className="flex flex-wrap gap-2 text-xs text-white/80">
        {quickTodos.map((task) => (
          <button
            key={task}
            type="button"
            onClick={() => add(task)}
            className="rounded-full border border-emerald-300/40 px-3 py-1 font-semibold hover:border-emerald-200"
          >
            {task}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setText("");
            setNote("");
          }}
          className="rounded-full border border-white/20 px-3 py-1 font-semibold text-white/70 hover:border-white/50"
        >
          Custom…
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-2 sm:grid-cols-[2fr_1fr_auto] text-sm">
        <input
          className="rounded-lg border border-emerald-400/40 bg-slate-900/60 px-3 py-2 text-white outline-none focus:border-emerald-300"
          placeholder="Custom task"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <input
          className="rounded-lg border border-emerald-400/40 bg-slate-900/60 px-3 py-2 text-white outline-none focus:border-emerald-300"
          placeholder="Note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-400"
          disabled={!text.trim()}
        >
          Add
        </button>
      </form>

      <ul className="space-y-2 text-sm">
        {visible.map((item) => (
          <li key={item.id} className="flex items-start gap-2 rounded-xl border border-white/5 bg-slate-900/80 p-3">
            <button
              type="button"
              onClick={() => toggle(item.id)}
              className={clsx(
                "mt-0.5 h-5 w-5 rounded-full border transition",
                item.done ? "border-emerald-400 bg-emerald-400/30" : "border-white/30 hover:border-emerald-300"
              )}
              aria-label={`Mark ${item.label} as done`}
            >
              {item.done && <span className="block h-full w-full rounded-full bg-emerald-300" />}
            </button>
            <div className="flex-1">
              <p className={clsx("font-medium", item.done ? "text-slate-400 line-through" : "text-white")}>{item.label}</p>
              {item.note && <p className="text-xs text-slate-400">{item.note}</p>}
            </div>
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="text-xs text-slate-400 transition hover:text-red-300"
            >
              Remove
            </button>
          </li>
        ))}
        {!items.length && <p className="text-sm text-slate-400">Tap a quick chip to create your first task.</p>}
      </ul>
      {remaining > 0 && <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">+{remaining} more</p>}
    </ModuleCard>
  );
}
