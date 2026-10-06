"use client";

import Link from "next/link";
import { useState } from "react";
import { getTopic, moduleLabel } from "@/lib/curriculum";
import { diffDays, relDays } from "@/lib/dates";
import { pct, plural } from "@/lib/format";
import { ChartLegend } from "../charts";
import { useData } from "../data";
import { moduleTitle } from "../domain";
import { MASTERY_LEGEND, PROGRESS_LEGEND, Treemap, type ColorMode } from "../Treemap";
import { Card, CardTitle, Empty, MasteryBadge, PageHeader, ProgressBar, Segmented } from "../ui";

export function MapView() {
  const { ds, derived, today } = useData();
  const [color, setColor] = useState<ColorMode>("mastery");
  const stats = [...derived.topicStats].sort((a, b) => b.weight - a.weight);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Knowledge map"
        sub="Every module of the curriculum. Topics are sized by exam weight, modules by study hours. Click a module to open it."
        action={
          <Segmented<ColorMode>
            label="Color by"
            size="sm"
            value={color}
            onChange={setColor}
            options={[
              { value: "mastery", label: "Mastery" },
              { value: "progress", label: "Progress" },
            ]}
          />
        }
      />
      <Card className="p-2 sm:p-3">
        <Treemap ds={ds} mm={derived.mm} color={color} />
        <div className="px-2 pb-1">
          <ChartLegend items={color === "mastery" ? MASTERY_LEGEND : PROGRESS_LEGEND} />
          {color === "mastery" ? <p className="mt-1 text-[12px] text-ink-3">A dashed outline marks a module you are reading now.</p> : null}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle sub={`Readiness ${pct(derived.readiness)}, the exam weighted share of the curriculum you can back with evidence`}>
            By topic
          </CardTitle>
          <ul className="divide-y divide-line">
            {stats.map((s) => (
              <li
                key={s.topic}
                className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_8rem_5rem]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{getTopic(s.topic).name}</p>
                  <p className="text-[12px] text-ink-3">
                    {getTopic(s.topic).weightMin}–{getTopic(s.topic).weightMax}% · {s.modulesDone}/{s.modulesTotal} done · evidence on{" "}
                    {pct(s.coverage)}
                  </p>
                </div>
                <ProgressBar
                  value={s.doneShare}
                  tone="good"
                  label={`${getTopic(s.topic).short} done`}
                  className="col-span-2 sm:col-span-1"
                />
                <div className="row-start-1 text-right sm:row-start-auto">
                  <MasteryBadge value={s.mastery} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle sub="Weak modules ranked by exam weight and time since you touched them">Fix these first</CardTitle>
          {derived.weak.length ? (
            <ul className="space-y-3">
              {derived.weak.map((w) => (
                <li key={w.moduleId} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/modules/${w.moduleId}`} className="block truncate text-sm font-medium hover:text-accent">
                      {moduleLabel(w.moduleId)} · {moduleTitle(w.moduleId)}
                    </Link>
                    <p className="text-[12px] text-ink-3">
                      {w.lastContact ? `last touched ${relDays(diffDays(today, w.lastContact))}` : "not touched"}
                      {w.labWaiting ? ` · ${plural(w.labWaiting, "Lab question")} ready` : ""}
                    </p>
                  </div>
                  <MasteryBadge value={w.mastery} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No weak modules right now. Keep logging practice so the map stays honest.</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}
