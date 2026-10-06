"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { MODULES, TOPICS, getTopic, type TopicId } from "@/lib/curriculum";
import { fmtDay } from "@/lib/dates";
import { progressOf } from "@/lib/defaults";
import { fmtHours, pct } from "@/lib/format";
import { nextReview } from "@/lib/srs";
import type { Status } from "@/lib/types";
import { useData } from "../data";
import { Badge, Card, MasteryBadge, PageHeader, Segmented, cx, inputBase } from "../ui";

type Filter = "all" | Status | "untested" | "weak";

const STATUS_LABEL: Record<Status, string> = { todo: "To do", reading: "Reading", done: "Done" };

export function ModulesView() {
  const params = useSearchParams();
  const initial = params.get("filter");
  const { ds, derived, actions, today } = useData();
  const [topic, setTopic] = useState<TopicId | "all">("all");
  const [filter, setFilter] = useState<Filter>(
    initial === "untested" || initial === "weak" || initial === "todo" || initial === "reading" || initial === "done" ? initial : "all",
  );

  const rows = useMemo(
    () =>
      MODULES.filter((m) => topic === "all" || m.topic === topic).filter((m) => {
        const p = progressOf(ds, m.id);
        const info = derived.mm.get(m.id)!;
        if (filter === "all") return true;
        if (filter === "untested") return p.status === "done" && info.acc.rawN === 0;
        if (filter === "weak") return info.mastery != null && info.mastery < 0.55;
        return p.status === filter;
      }),
    [ds, derived.mm, filter, topic],
  );

  const doneCount = Object.values(ds.progress).filter((p) => p.status === "done").length;

  return (
    <div className="space-y-5">
      <PageHeader title="Modules" sub={`${doneCount} of ${MODULES.length} learning modules done · 2027 Level I outline`} />
      <div className="flex flex-wrap items-center gap-3">
        <select className={inputBase} value={topic} onChange={(e) => setTopic(e.target.value as TopicId | "all")} aria-label="Topic">
          <option value="all">All topics</option>
          {TOPICS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <Segmented<Filter>
          label="Filter"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "todo", label: "To do" },
            { value: "reading", label: "Reading" },
            { value: "done", label: "Done" },
            { value: "weak", label: "Weak" },
            { value: "untested", label: "No practice", title: "Finished modules with no questions logged" },
          ]}
        />
      </div>

      {TOPICS.filter((t) => rows.some((m) => m.topic === t.id)).map((t) => {
        const st = derived.topicStats.find((s) => s.topic === t.id)!;
        const mods = rows.filter((m) => m.topic === t.id);
        return (
          <Card key={t.id} className="p-0 sm:p-0">
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
              <h2 className="font-semibold">{t.name}</h2>
              <span className="text-[13px] text-ink-3">
                {t.weightMin}–{t.weightMax}% of the exam · {st.modulesDone}/{st.modulesTotal} done
              </span>
              <span className="ml-auto">
                <MasteryBadge value={st.mastery} />
              </span>
            </div>
            <ul className="divide-y divide-line">
              {mods.map((m) => {
                const p = progressOf(ds, m.id);
                const info = derived.mm.get(m.id)!;
                const sched = derived.plan.schedule.get(m.id);
                const rev = nextReview(p);
                return (
                  <li
                    key={m.id}
                    className="grid grid-cols-[2.5rem_1fr] items-center gap-x-3 gap-y-1.5 px-4 py-2.5 sm:grid-cols-[2.5rem_1fr_7rem_5.5rem_9rem]"
                  >
                    <span className="tabular text-[13px] text-ink-3">LM{m.lm}</span>
                    <div className="min-w-0">
                      <Link href={`/modules/${m.id}`} className="text-sm font-medium hover:text-accent">
                        {m.title}
                      </Link>
                      <p className="text-[12px] text-ink-3">
                        {fmtHours(info.hours)}
                        {info.acc.rawN ? ` · ${info.acc.raw}/${info.acc.rawN} right (${pct(info.acc.raw / info.acc.rawN)})` : ""}
                        {p.status === "done" && p.doneAt ? ` · done ${fmtDay(p.doneAt)}` : sched ? ` · planned ${fmtDay(sched.from)}` : ""}
                        {rev && rev.due <= today ? " · review due" : ""}
                      </p>
                    </div>
                    <div className="col-start-2 sm:col-start-auto">
                      <select
                        aria-label={`Status of ${getTopic(m.topic).short} LM${m.lm}`}
                        className={cx(
                          "w-full rounded-lg border px-2 py-1 text-[13px] font-medium",
                          p.status === "done" && "border-good/40 bg-good-soft text-good",
                          p.status === "reading" && "border-accent/40 bg-accent-soft text-accent",
                          p.status === "todo" && "border-line bg-surface text-ink-2",
                        )}
                        value={p.status}
                        onChange={(e) => void actions.setStatus(m.id, e.target.value as Status)}
                      >
                        {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-start-2 sm:col-start-auto">
                      <MasteryBadge value={info.mastery} />
                    </div>
                    <div className="col-start-2 hidden text-[12px] text-ink-3 sm:col-start-auto sm:block">
                      {p.confidence ? <Badge>{["", "Low", "Medium", "High"][p.confidence]} confidence</Badge> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
      {!rows.length ? <p className="text-sm text-ink-3">No modules match these filters.</p> : null}
    </div>
  );
}
