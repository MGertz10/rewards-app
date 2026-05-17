"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, Check, Clock, Lightbulb, Trash2, ChevronDown, ChevronUp } from "lucide-react";

type Status = "idea" | "in_progress" | "done";

interface Idea {
  id: string;
  title: string;
  category: string;
  status: Status;
  created_at: string;
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; Icon: React.ComponentType<{size?: number; className?: string}> }> = {
  idea:        { label: "Idea",        color: "text-amber-500",   bg: "bg-amber-500/10",   Icon: Lightbulb },
  in_progress: { label: "In Progress", color: "text-blue-500",    bg: "bg-blue-500/10",    Icon: Clock },
  done:        { label: "Done",        color: "text-emerald-500", bg: "bg-emerald-500/10", Icon: Check },
};

const STATUSES: Status[] = ["idea", "in_progress", "done"];

const CATEGORIES = [
  "Dashboard", "Strategy Hub", "Trip Planner", "Cards", "Infrastructure", "General",
];

export default function IdeasPage() {
  const router = useRouter();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  const [adding, setAdding] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/feature-ideas")
      .then(r => r.json())
      .then(({ data }) => { if (data) setIdeas(data); })
      .finally(() => setLoading(false));
  }, []);

  const grouped = ideas.reduce<Record<string, Idea[]>>((acc, idea) => {
    if (!acc[idea.category]) acc[idea.category] = [];
    acc[idea.category].push(idea);
    return acc;
  }, {});

  const counts = { idea: 0, in_progress: 0, done: 0 };
  ideas.forEach(i => { counts[i.status] = (counts[i.status] ?? 0) + 1; });

  async function cycleStatus(idea: Idea) {
    const next = STATUSES[(STATUSES.indexOf(idea.status) + 1) % STATUSES.length];
    setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, status: next } : i));
    await fetch("/api/feature-ideas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: idea.id, status: next }),
    });
  }

  async function deleteIdea(id: string) {
    setIdeas(prev => prev.filter(i => i.id !== id));
    await fetch(`/api/feature-ideas?id=${id}`, { method: "DELETE" });
  }

  async function addIdea() {
    if (!newTitle.trim()) return;
    setAdding(true);
    const res = await fetch("/api/feature-ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), category: newCategory }),
    });
    const { data } = await res.json();
    if (data) setIdeas(prev => [...prev, data]);
    setNewTitle("");
    setAdding(false);
    inputRef.current?.focus();
  }

  function toggleCollapse(cat: string) {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen max-w-lg mx-auto animate-pulse px-4 pt-6">
        <div className="h-6 w-40 bg-muted rounded mb-6" />
        {[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-2xl mb-3" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-28 max-w-lg mx-auto">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-primary active:opacity-60">
          <ChevronLeft size={22} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Feature Ideas</h1>
          <p className="text-[11px] text-muted-foreground">
            {counts.idea} ideas · {counts.in_progress} in progress · {counts.done} done
          </p>
        </div>
      </div>

      <div className="px-4 flex flex-col gap-4">
        {/* Add new idea */}
        <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
          <p className="text-xs font-bold text-foreground">Add New Idea</p>
          <input
            ref={inputRef}
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addIdea(); }}
            placeholder="Describe the feature…"
            className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-2 items-center">
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className="flex-1 bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              onClick={addIdea}
              disabled={adding || !newTitle.trim()}
              className="bg-primary text-white rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40 active:opacity-70"
            >
              <Plus size={15} />
              Add
            </button>
          </div>
        </div>

        {/* Grouped by category */}
        {Object.entries(grouped).sort(([a], [b]) => {
          const order = ["Dashboard", "Strategy Hub", "Trip Planner", "Cards", "Infrastructure", "General"];
          return (order.indexOf(a) ?? 99) - (order.indexOf(b) ?? 99);
        }).map(([category, items]) => {
          const isCollapsed = collapsed[category];
          const doneCount = items.filter(i => i.status === "done").length;
          return (
            <div key={category} className="rounded-2xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => toggleCollapse(category)}
                className="w-full flex items-center justify-between px-4 py-3 active:opacity-70"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{category}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                    {items.length}
                  </span>
                  {doneCount > 0 && (
                    <span className="text-[10px] text-emerald-500 font-medium">
                      {doneCount} done
                    </span>
                  )}
                </div>
                {isCollapsed
                  ? <ChevronDown size={14} className="text-muted-foreground" />
                  : <ChevronUp size={14} className="text-muted-foreground" />
                }
              </button>

              {!isCollapsed && (
                <div className="divide-y divide-border/50">
                  {items.map(idea => {
                    const cfg = STATUS_CONFIG[idea.status];
                    const { Icon } = cfg;
                    return (
                      <div key={idea.id} className="flex items-start gap-3 px-4 py-3">
                        {/* Status toggle */}
                        <button
                          onClick={() => cycleStatus(idea)}
                          className={`shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center ${cfg.bg} active:opacity-60`}
                          title={`Status: ${cfg.label} — tap to advance`}
                        >
                          <Icon size={12} className={cfg.color} />
                        </button>
                        <p className={`flex-1 text-sm leading-snug ${idea.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {idea.title}
                        </p>
                        <button
                          onClick={() => deleteIdea(idea.id)}
                          className="shrink-0 mt-0.5 text-muted-foreground/40 active:text-destructive active:opacity-70"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
