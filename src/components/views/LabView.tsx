"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Bug, Flag, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { TOPICS, getModule, getTopic, moduleLabel, type TopicId } from "@/lib/curriculum";
import { fmtDay } from "@/lib/dates";
import { fmtTimestamp, pct, plural } from "@/lib/format";
import { ORIGIN_LABEL, labStats, questionState, skippedModules, type QuestionState } from "@/lib/lab";
import { CERTAINTY, DIFFICULTY_LABEL, LETTERS, type AiQuestion, type Certainty, type Difficulty, type Letter } from "@/lib/types";
import { useData } from "../data";
import { CoachNote, ModuleLink, latestBatch, moduleTitle } from "../domain";
import { MistakeForm, RequestForm } from "../forms";
import { Badge, Button, Card, CardTitle, Dots, Empty, Modal, PageHeader, Segmented, cx, inputBase, inputClass } from "../ui";

type View = "waiting" | "missed" | "answered" | "all";

const REPORT_REASONS = ["Wrong answer key", "Two options could be right", "Unclear wording", "Outside the Level I scope", "Other"];

function QuestionCard({
  q,
  onLogMistake,
  onReport,
  onAnswered,
}: {
  q: AiQuestion;
  onLogMistake: (q: AiQuestion, pick: Letter) => void;
  onReport: (q: AiQuestion) => void;
  onAnswered: (id: string) => void;
}) {
  const { derived, actions, ds } = useData();
  const answers = derived.answersByQ.get(q.id) ?? [];
  const first = answers[0];
  const last = answers[answers.length - 1];
  const [retry, setRetry] = useState(false);
  const [pick, setPick] = useState<Letter | null>(null);
  const [certainty, setCertainty] = useState<Certainty | null>(null);
  const answered = !!last && !retry;
  const shownPick = answered ? last.pick : pick;
  const logged = ds.mistakes.some((m) => m.questionId === q.id);
  const m = getModule(q.moduleId);

  const submit = async () => {
    if (!pick) return;
    onAnswered(q.id);
    await actions.answerQuestion(q.id, pick, certainty);
    setRetry(false);
    setPick(null);
    setCertainty(null);
  };

  return (
    <article className="rounded-2xl border border-line bg-surface p-4 sm:p-5" aria-label={`Question on ${moduleLabel(q.moduleId)}`}>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
        <ModuleLink id={q.moduleId} className="text-ink-2" />
        <span className="truncate">{m?.title}</span>
        <span className="inline-flex items-center gap-1">
          <Dots value={q.difficulty} label={`${DIFFICULTY_LABEL[q.difficulty]} difficulty`} /> {DIFFICULTY_LABEL[q.difficulty]}
        </span>
        <span>{ORIGIN_LABEL[q.origin]}</span>
        <span
          title={q.verification === "python" ? "The key was recomputed in Python" : "The question was re-solved blind before it was kept"}
        >
          {q.verification === "python" ? "Checked in Python" : "Checked blind"}
        </span>
      </div>
      <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{q.stem}</p>
      <div className="mt-3 space-y-2" role="radiogroup" aria-label="Options">
        {LETTERS.map((L) => {
          const isKey = L === q.answer;
          const isPick = L === shownPick;
          return (
            <button
              key={L}
              type="button"
              role="radio"
              aria-checked={isPick}
              disabled={answered}
              onClick={() => setPick(L)}
              className={cx(
                "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                !answered && (isPick ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong hover:bg-sunken"),
                answered && isKey && "border-good bg-good-soft",
                answered && isPick && !isKey && "border-bad bg-bad-soft",
                answered && !isKey && !isPick && "border-line opacity-70",
              )}
            >
              <span className={cx("font-semibold", answered && isKey ? "text-good" : answered && isPick ? "text-bad" : "text-accent")}>
                {L}
              </span>
              <span className="flex-1 text-ink">{q.options[L]}</span>
            </button>
          );
        })}
      </div>

      {!answered ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Segmented<Certainty>
            label="How sure are you"
            size="sm"
            value={certainty}
            onChange={setCertainty}
            options={CERTAINTY.map((c) => ({ value: c.id, label: c.label }))}
          />
          <Button variant="primary" size="sm" disabled={!pick} onClick={() => void submit()}>
            Check answer
          </Button>
          {retry ? (
            <Button variant="ghost" size="sm" onClick={() => setRetry(false)}>
              Cancel
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-3">
          <div className={cx("rounded-xl px-3.5 py-3 text-sm", last.correct ? "bg-good-soft" : "bg-bad-soft")}>
            <p className={cx("font-semibold", last.correct ? "text-good" : "text-bad")}>
              {last.correct ? "Correct" : `Not quite. The answer is ${q.answer}.`}
              {answers.length > 1 ? (
                <span className="ml-2 font-normal text-ink-3">
                  {first.correct ? "right" : "missed"} the first time, {answers.length - 1} {answers.length === 2 ? "retry" : "retries"}
                </span>
              ) : null}
            </p>
            {q.explanation ? <p className="mt-1 text-ink-2">{q.explanation}</p> : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {!first.correct && !logged ? (
              <Button size="sm" onClick={() => onLogMistake(q, first.pick)}>
                <Bug size={14} aria-hidden /> Log as mistake
              </Button>
            ) : null}
            {logged ? <Badge tone="mid">In your mistake bank</Badge> : null}
            <Button size="sm" variant="ghost" onClick={() => setRetry(true)}>
              <RotateCcw size={14} aria-hidden /> Try again
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onReport(q)}>
              <Flag size={14} aria-hidden /> Report a problem
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

function ReportForm({ q, onDone }: { q: AiQuestion; onDone: () => void }) {
  const { actions } = useData();
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [note, setNote] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onDone();
        void actions.reportQuestion(q.id, note.trim() ? `${reason}. ${note.trim()}` : reason);
      }}
      className="space-y-3"
    >
      <p className="text-sm text-ink-2">
        Reported questions disappear from the Lab. Three reports on one module in a week pause that module for two weeks.
      </p>
      <select className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason">
        {REPORT_REASONS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
      <textarea
        className={`${inputClass} min-h-20`}
        maxLength={240}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What is wrong with it"
        aria-label="Details"
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="danger" type="submit">
          Report
        </Button>
      </div>
    </form>
  );
}

export function LabView() {
  const params = useSearchParams();
  const moduleParam = Number(params.get("module"));
  const { ds, derived, actions, today } = useData();
  const [view, setView] = useState<View>("waiting");
  const [topic, setTopic] = useState<TopicId | "all">("all");
  const [difficulty, setDifficulty] = useState<Difficulty | 0>(0);
  const [moduleFilter, setModuleFilter] = useState<number | null>(getModule(moduleParam) ? moduleParam : null);
  const [limit, setLimit] = useState(8);
  const [mistakeFor, setMistakeFor] = useState<{ q: AiQuestion; pick: Letter } | null>(null);
  const [reportFor, setReportFor] = useState<AiQuestion | null>(null);
  // Questions answered on this visit stay on screen so the explanation can be read.
  const [justAnswered, setJustAnswered] = useState<Set<string>>(() => new Set());
  const batch = latestBatch(ds.batches);
  const stats = labStats(ds);
  const skipped = skippedModules(ds, today);

  const list = useMemo(() => {
    const want: Record<View, QuestionState[]> = {
      waiting: ["waiting"],
      missed: ["wrong"],
      answered: ["right", "wrong"],
      all: ["waiting", "right", "wrong"],
    };
    return [...ds.questions]
      .filter((q) => {
        const st = questionState(q, derived.answersByQ, derived.reported);
        return want[view].includes(st) || (st !== "reported" && justAnswered.has(q.id));
      })
      .filter((q) => (moduleFilter ? q.moduleId === moduleFilter : true))
      .filter((q) => (topic === "all" ? true : getModule(q.moduleId)?.topic === topic))
      .filter((q) => (difficulty ? q.difficulty === difficulty : true))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }, [ds.questions, derived.answersByQ, derived.reported, difficulty, justAnswered, moduleFilter, topic, view]);

  const pending = ds.requests.filter((r) => !r.servedBatchId);
  const served = ds.requests
    .filter((r) => r.servedBatchId)
    .slice(-5)
    .reverse();

  return (
    <div className="space-y-5">
      <PageHeader title="Question Lab" sub="Written every Sunday for your weak spots, checked before they land" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CoachNote batch={batch} />
          {batch ? (
            <p className="mt-2 text-[12px] text-ink-3">
              Last run {fmtTimestamp(batch.createdAt)}
              {batch.meta.discarded ? ` · ${plural(batch.meta.discarded, "question")} discarded in verification` : ""}
              {" · next run Sunday evening"}
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
          <div className="ui-stat rounded-2xl border border-line bg-surface px-3 py-2.5">
            <div className="ui-stat-label text-[12px] font-medium uppercase tracking-wide text-ink-3">Waiting</div>
            <div className="ui-stat-value tabular text-xl font-semibold">{derived.waiting.length}</div>
          </div>
          <div className="ui-stat rounded-2xl border border-line bg-surface px-3 py-2.5">
            <div className="ui-stat-label text-[12px] font-medium uppercase tracking-wide text-ink-3">Answered</div>
            <div className="ui-stat-value tabular text-xl font-semibold">{stats.answered}</div>
          </div>
          <div className="ui-stat rounded-2xl border border-line bg-surface px-3 py-2.5">
            <div className="ui-stat-label text-[12px] font-medium uppercase tracking-wide text-ink-3">First try accuracy</div>
            <div className="ui-stat-value tabular text-xl font-semibold">{stats.answered ? pct(stats.right / stats.answered) : "–"}</div>
          </div>
        </div>
      </div>

      {skipped.length ? (
        <Card tone="mid">
          <p className="text-sm">
            {skipped.map((s) => `${moduleLabel(s.moduleId)} until ${fmtDay(s.until)}`).join(", ")} paused after three reports. Use your
            question bank there.
          </p>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Segmented<View>
          label="Show"
          size="sm"
          value={view}
          onChange={(v) => {
            setView(v);
            setLimit(8);
          }}
          options={[
            { value: "waiting", label: `Waiting (${derived.waiting.length})` },
            { value: "missed", label: "Missed" },
            { value: "answered", label: "Answered" },
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
        <select
          className={inputBase}
          value={difficulty}
          onChange={(e) => setDifficulty(Number(e.target.value) as Difficulty | 0)}
          aria-label="Difficulty"
        >
          <option value={0}>Any difficulty</option>
          {([1, 2, 3] as Difficulty[]).map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABEL[d]}
            </option>
          ))}
        </select>
        {moduleFilter ? (
          <Button size="sm" variant="ghost" onClick={() => setModuleFilter(null)}>
            Only {moduleLabel(moduleFilter)} · clear
          </Button>
        ) : null}
      </div>

      {list.length ? (
        <div className="space-y-4">
          {list.slice(0, limit).map((q) => (
            <QuestionCard
              key={q.id}
              q={q}
              onLogMistake={(qq, pick) => setMistakeFor({ q: qq, pick })}
              onReport={setReportFor}
              onAnswered={(id) => setJustAnswered((prev) => new Set(prev).add(id))}
            />
          ))}
          {list.length > limit ? (
            <div className="text-center">
              <Button onClick={() => setLimit(limit + 8)}>Show more ({list.length - limit} left)</Button>
            </div>
          ) : null}
        </div>
      ) : (
        <Empty>
          {ds.questions.length
            ? view === "waiting"
              ? "You answered everything in the Lab. New questions arrive with the next weekly run."
              : "Nothing matches these filters."
            : "No questions yet. They arrive with the first weekly run. Queue a request below so the first batch covers what you need."}
        </Empty>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle info="The next run serves these first, up to 20 questions each.">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles size={16} className="text-accent" aria-hidden /> Ask for questions
            </span>
          </CardTitle>
          <RequestForm />
        </Card>
        <Card>
          <CardTitle sub={pending.length ? `${plural(pending.length, "request")} queued` : "Nothing queued"}>Requests</CardTitle>
          {pending.length || served.length ? (
            <ul className="divide-y divide-line text-sm">
              {[...pending.slice().reverse(), ...served].map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {r.moduleId ? `${moduleLabel(r.moduleId)} · ${moduleTitle(r.moduleId)}` : r.topicId ? getTopic(r.topicId).name : ""}
                    </p>
                    <p className="text-[12px] text-ink-3">
                      {r.count} × {DIFFICULTY_LABEL[r.difficulty].toLowerCase()} · {fmtDay(r.createdOn)}
                      {r.note ? ` · ${r.note}` : ""}
                    </p>
                  </div>
                  <Badge tone={r.servedBatchId ? "good" : "accent"}>{r.servedBatchId ? "Served" : "Queued"}</Badge>
                  {!r.servedBatchId ? (
                    <button
                      type="button"
                      aria-label="Delete request"
                      onClick={() => void actions.deleteRequest(r.id)}
                      className="rounded p-1 text-ink-3 hover:bg-sunken hover:text-bad"
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No requests yet.</Empty>
          )}
          <div className="mt-4 rounded-xl bg-sunken p-3 text-[12px] text-ink-3">
            By difficulty, first try:{" "}
            {([1, 2, 3] as Difficulty[])
              .map((d) => {
                const s = stats.byDifficulty[d];
                return `${DIFFICULTY_LABEL[d].toLowerCase()} ${s.answered ? pct(s.right / s.answered) : "–"} (${s.answered})`;
              })
              .join(" · ")}
          </div>
        </Card>
      </div>

      <Modal open={mistakeFor != null} onClose={() => setMistakeFor(null)} title="Log as mistake" wide>
        {mistakeFor ? (
          <MistakeForm
            initial={{
              moduleId: mistakeFor.q.moduleId,
              description: `Lab question. Picked ${mistakeFor.pick}, the answer was ${mistakeFor.q.answer}. ${mistakeFor.q.stem.slice(0, 160)}${mistakeFor.q.stem.length > 160 ? "…" : ""}`,
              source: "lab",
              certainty: derived.answersByQ.get(mistakeFor.q.id)?.[0]?.certainty ?? null,
              questionId: mistakeFor.q.id,
            }}
            onDone={() => setMistakeFor(null)}
          />
        ) : null}
      </Modal>
      <Modal open={reportFor != null} onClose={() => setReportFor(null)} title="Report a problem">
        {reportFor ? <ReportForm q={reportFor} onDone={() => setReportFor(null)} /> : null}
      </Modal>
    </div>
  );
}
