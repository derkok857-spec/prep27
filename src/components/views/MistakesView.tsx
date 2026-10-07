"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { TOPICS, getModule, getTopic, type TopicId } from "@/lib/curriculum";
import { addDays, fmtDay } from "@/lib/dates";
import { plural } from "@/lib/format";
import { MISTAKE_STEPS, failedChecks, isOpen } from "@/lib/srs";
import { mistakeBreakdown } from "@/lib/stats";
import { CERTAINTY, ERROR_TYPES, errorTypeLabel, sourceLabel, type Certainty, type ErrorType, type Mistake } from "@/lib/types";
import { HBarList } from "../charts";
import { useData } from "../data";
import { InsightList, ModuleLink, PatternList, latestBatch } from "../domain";
import { MistakeForm } from "../forms";
import { Badge, Button, Card, CardTitle, Dots, Empty, Modal, PageHeader, Segmented, cx, inputBase } from "../ui";

type StatusFilter = "open" | "due" | "resolved" | "all";
const MISTAKE_INSIGHTS = /^(confident-misses|type-|module-hotspot|stubborn)/;

function MistakeRow({ m, onEdit }: { m: Mistake; onEdit: (m: Mistake) => void }) {
  const { actions, today } = useData();
  const [showLesson, setShowLesson] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const open = isOpen(m);
  const due = open && m.nextReview != null && m.nextReview <= today;
  return (
    <li
      className={cx("rounded-xl border p-3.5", due ? "border-accent/40 bg-accent-soft" : "border-line bg-surface", !open && "opacity-70")}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-[13rem] flex-1">
          <p className={cx("text-sm text-ink", !open && "line-through")}>{m.description}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
            <ModuleLink id={m.moduleId} className="text-ink-2" />
            <Badge>{errorTypeLabel(m.errorType)}</Badge>
            {m.certainty ? (
              <Badge tone={m.certainty === "sure" ? "bad" : m.certainty === "unsure" ? "mid" : "neutral"}>
                {CERTAINTY.find((c) => c.id === m.certainty)?.label}
              </Badge>
            ) : null}
            <span>{sourceLabel(m.source)}</span>
            <span>{fmtDay(m.createdOn)}</span>
            <span className="inline-flex items-center gap-1" title="Clean checks in a row">
              <Dots value={Math.min(m.streak, 3)} label={`${m.streak} of 3 clean checks`} />
            </span>
            {open && m.nextReview ? <span>{due ? "re-check due" : `next check ${fmtDay(m.nextReview)}`}</span> : null}
            {!open && m.resolvedOn ? <span>resolved {fmtDay(m.resolvedOn)}</span> : null}
            {failedChecks(m) >= 2 ? <Badge tone="bad">missed {failedChecks(m)} re-checks</Badge> : null}
          </div>
          {m.lesson ? (
            showLesson || !due ? (
              <p className="mt-2 rounded-lg bg-sunken px-2.5 py-1.5 text-[13px] text-ink-2">{m.lesson}</p>
            ) : (
              <button
                type="button"
                onClick={() => setShowLesson(true)}
                className="mt-1.5 text-[13px] font-medium text-accent hover:underline"
              >
                Show the rule
              </button>
            )
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {due ? (
            <>
              <Button size="sm" variant="good" onClick={() => void actions.recheckMistake(m.id, true)}>
                <Check size={14} aria-hidden /> Got it
              </Button>
              <Button size="sm" variant="danger" onClick={() => void actions.recheckMistake(m.id, false)}>
                <X size={14} aria-hidden /> Missed
              </Button>
            </>
          ) : null}
          {open ? (
            <Button size="sm" variant="ghost" onClick={() => void actions.resolveMistake(m.id)} title="Mark resolved now">
              Resolve
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => void actions.reopenMistake(m.id)}>
              <RotateCcw size={14} aria-hidden /> Reopen
            </Button>
          )}
          <button
            type="button"
            aria-label="Edit mistake"
            onClick={() => onEdit(m)}
            className="rounded-lg p-1.5 text-ink-3 hover:bg-sunken hover:text-ink"
          >
            <Pencil size={15} />
          </button>
          {confirm ? (
            <Button size="sm" variant="danger" onClick={() => void actions.deleteMistake(m.id)} onBlur={() => setConfirm(false)} autoFocus>
              Delete?
            </Button>
          ) : (
            <button
              type="button"
              aria-label="Delete mistake"
              onClick={() => setConfirm(true)}
              className="rounded-lg p-1.5 text-ink-3 hover:bg-sunken hover:text-bad"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export function MistakesView() {
  const params = useSearchParams();
  const { ds, derived, today } = useData();
  const pType = params.get("type");
  const pCert = params.get("certainty");
  const [status, setStatus] = useState<StatusFilter>(derived.dueMistakes.length ? "due" : "open");
  const [topic, setTopic] = useState<TopicId | "all">("all");
  const [type, setType] = useState<ErrorType | "all">(ERROR_TYPES.some((e) => e.id === pType) ? (pType as ErrorType) : "all");
  const [certainty, setCertainty] = useState<Certainty | "all">(CERTAINTY.some((c) => c.id === pCert) ? (pCert as Certainty) : "all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Mistake | null>(null);

  const since = addDays(today, -56);
  const br = mistakeBreakdown(ds.mistakes, since);
  const openAll = ds.mistakes.filter(isOpen);
  const sureOpen = openAll.filter((m) => m.certainty === "sure").length;
  const batch = latestBatch(ds.batches);
  const known = useMemo(() => new Set(ds.mistakes.map((m) => m.id)), [ds.mistakes]);

  const list = useMemo(
    () =>
      ds.mistakes
        .filter((m) => {
          if (status === "open") return isOpen(m);
          if (status === "resolved") return !isOpen(m);
          if (status === "due") return isOpen(m) && m.nextReview != null && m.nextReview <= today;
          return true;
        })
        .filter((m) => (topic === "all" ? true : getModule(m.moduleId)?.topic === topic))
        .filter((m) => (type === "all" ? true : m.errorType === type))
        .filter((m) => (certainty === "all" ? true : m.certainty === certainty))
        .sort((a, b) => {
          const da = isOpen(a) && a.nextReview && a.nextReview <= today ? 0 : 1;
          const db = isOpen(b) && b.nextReview && b.nextReview <= today ? 0 : 1;
          return da - db || (a.createdOn < b.createdOn ? 1 : -1);
        }),
    [certainty, ds.mistakes, status, today, topic, type],
  );

  const byTopic = TOPICS.map((t) => ({ t, n: openAll.filter((m) => getModule(m.moduleId)?.topic === t.id).length })).filter((x) => x.n > 0);
  const maxType = Math.max(1, ...br.byType.map((b) => b.open));
  const maxTopic = Math.max(1, ...byTopic.map((b) => b.n));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mistake Bank"
        sub={`Every miss returns after ${MISTAKE_STEPS.join(", ")} days until it sticks`}
        action={
          <Button variant="primary" onClick={() => setAdding(true)}>
            Log mistake
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="ui-stat rounded-2xl border border-line bg-surface p-3.5">
          <div className="ui-stat-label text-[12px] font-medium uppercase tracking-wide text-ink-3">Open</div>
          <div className="ui-stat-value tabular text-xl font-semibold">{openAll.length}</div>
        </div>
        <div className="ui-stat rounded-2xl border border-line bg-surface p-3.5">
          <div className="ui-stat-label text-[12px] font-medium uppercase tracking-wide text-ink-3">Due to re-check</div>
          <div className="ui-stat-value tabular text-xl font-semibold">{derived.dueMistakes.length}</div>
        </div>
        <div className="ui-stat rounded-2xl border border-line bg-surface p-3.5">
          <div className="ui-stat-label text-[12px] font-medium uppercase tracking-wide text-ink-3">Confident misses, open</div>
          <div className={cx("ui-stat-value tabular text-xl font-semibold", sureOpen >= 3 && "text-bad")}>{sureOpen}</div>
        </div>
        <div className="ui-stat rounded-2xl border border-line bg-surface p-3.5">
          <div className="ui-stat-label text-[12px] font-medium uppercase tracking-wide text-ink-3">Resolved, 8 weeks</div>
          <div className="ui-stat-value tabular text-xl font-semibold text-good">{br.resolved}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle info="Rules that run on every change to your log. Three clean re-checks in a row retire a mistake.">
            What the log shows
          </CardTitle>
          {derived.insights.some((i) => MISTAKE_INSIGHTS.test(i.id)) ? (
            <InsightList items={derived.insights.filter((i) => MISTAKE_INSIGHTS.test(i.id))} />
          ) : (
            <p className="text-sm text-ink-3">
              No recurring problem yet. Patterns need at least five open mistakes from the last eight weeks.
            </p>
          )}
        </Card>
        <Card>
          <CardTitle sub={batch ? "Last weekly run" : undefined}>AI patterns</CardTitle>
          <PatternList batch={batch} knownMistakes={known} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle sub="Last 8 weeks">By cause</CardTitle>
          <HBarList
            colorBy="accent"
            format={(v) => String(v)}
            rows={br.byType.map((b) => ({
              key: b.type,
              label: errorTypeLabel(b.type),
              value: b.open,
              max: maxType,
              sub: b.total ? `${b.total} logged` : undefined,
            }))}
          />
        </Card>
        <Card>
          <CardTitle>By topic</CardTitle>
          {byTopic.length ? (
            <HBarList
              colorBy="accent"
              format={(v) => String(v)}
              rows={byTopic.map((b) => ({ key: b.t.id, label: getTopic(b.t.id).name, value: b.n, max: maxTopic }))}
            />
          ) : (
            <Empty>No open mistakes.</Empty>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented<StatusFilter>
          label="Status"
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            { value: "due", label: `Due (${derived.dueMistakes.length})` },
            { value: "open", label: "Open" },
            { value: "resolved", label: "Resolved" },
            { value: "all", label: "All" },
          ]}
        />
        <select className={inputBase} value={topic} onChange={(e) => setTopic(e.target.value as TopicId | "all")} aria-label="Topic">
          <option value="all">All topics</option>
          {TOPICS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select className={inputBase} value={type} onChange={(e) => setType(e.target.value as ErrorType | "all")} aria-label="Cause">
          <option value="all">Any cause</option>
          {ERROR_TYPES.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
        <select
          className={inputBase}
          value={certainty}
          onChange={(e) => setCertainty(e.target.value as Certainty | "all")}
          aria-label="Certainty"
        >
          <option value="all">Any certainty</option>
          {CERTAINTY.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <span className="text-[13px] text-ink-3">{plural(list.length, "mistake")}</span>
      </div>

      {list.length ? (
        <ul className="space-y-2">
          {list.map((m) => (
            <MistakeRow key={m.id} m={m} onEdit={setEditing} />
          ))}
        </ul>
      ) : (
        <Empty
          action={
            <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
              Log mistake
            </Button>
          }
        >
          {ds.mistakes.length
            ? "Nothing here with these filters."
            : "No mistakes logged yet. Every miss you log now is one you will not repeat in May."}
        </Empty>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Log a mistake" wide>
        <MistakeForm onDone={() => setAdding(false)} />
      </Modal>
      <Modal open={editing != null} onClose={() => setEditing(null)} title="Edit mistake" wide>
        {editing ? <MistakeForm editing={editing} onDone={() => setEditing(null)} /> : null}
      </Modal>
    </div>
  );
}
