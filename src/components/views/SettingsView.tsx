"use client";

import { useEffect, useRef, useState } from "react";
import { Download, RotateCcw, Upload } from "lucide-react";
import { BackupError, exportBackup, parseBackup } from "@/lib/backup";
import { EXAM_WINDOW, KEY_DATES, moduleLabel } from "@/lib/curriculum";
import { diffDays, eachDay, fmtDayYear, fmtWeekday, isISODate, relDays } from "@/lib/dates";
import { downloadFile, fmtTimestamp, toCsv } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { errorTypeLabel, sourceLabel, type Dataset } from "@/lib/types";
import { useData } from "../data";
import { latestBatch } from "../domain";
import { useToast } from "../toast";
import { Badge, Button, Card, CardTitle, Field, Modal, PageHeader, cx, inputClass } from "../ui";

function ExamCard() {
  const { ds, actions, today } = useData();
  const p = ds.profile;
  const windowDays = eachDay(EXAM_WINDOW.start, EXAM_WINDOW.end);
  return (
    <Card>
      <CardTitle sub="Until you book, keep the first day of the window. Test centers do not all offer every day.">Exam date</CardTitle>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Exam day" className="w-48">
          <input
            type="date"
            className={inputClass}
            value={p.examDate}
            min={today}
            onChange={(e) => isISODate(e.target.value) && void actions.saveProfile({ examDate: e.target.value })}
          />
        </Field>
        <span className="pb-2 text-sm text-ink-3">
          {fmtWeekday(p.examDate)}, {relDays(diffDays(today, p.examDate))}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {windowDays.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => void actions.saveProfile({ examDate: d })}
            className={cx(
              "rounded-lg border px-2.5 py-1 text-[13px]",
              d === p.examDate
                ? "border-accent bg-accent-soft font-semibold text-accent"
                : "border-line text-ink-2 hover:border-line-strong",
            )}
          >
            {fmtWeekday(d)}
          </button>
        ))}
      </div>
      <h3 className="mb-2 mt-5 text-sm font-semibold">Key dates for the May 2027 window</h3>
      <ul className="space-y-1.5 text-sm">
        {KEY_DATES.map((k) => {
          const d = diffDays(today, k.date);
          return (
            <li key={k.date} className="flex items-center gap-3">
              <span className="tabular w-28 shrink-0 text-ink-3">{fmtDayYear(k.date)}</span>
              <span className={cx("flex-1", d < 0 && "text-ink-3 line-through")}>{k.label}</span>
              {d >= 0 && d <= 21 && k.kind === "deadline" ? <Badge tone="bad">{relDays(d)}</Badge> : null}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[12px] text-ink-3">Check the dates and fees on the official program site before you register.</p>
    </Card>
  );
}

function StudyCard() {
  const { ds, actions } = useData();
  const p = ds.profile;
  const [target, setTarget] = useState(String(p.targetHours));
  const saveTarget = () => {
    const n = Number(target);
    if (Number.isFinite(n) && n >= 50 && n <= 1000 && n !== p.targetHours) void actions.saveProfile({ targetHours: n });
  };
  return (
    <Card>
      <CardTitle sub="Weekly hours, mock weeks, topic order and capacity changes live on the Plan page.">Study period and budget</CardTitle>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Started studying on" hint="Charts and pace start here">
          <input
            type="date"
            className={inputClass}
            value={p.startDate}
            onChange={(e) => isISODate(e.target.value) && void actions.saveProfile({ startDate: e.target.value })}
          />
        </Field>
        <Field label="Content hours budget" hint="Split across modules by exam weight. 250 to 350 is typical for Level I.">
          <input
            type="number"
            min={50}
            max={1000}
            step={10}
            className={inputClass}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onBlur={saveTarget}
            onKeyDown={(e) => e.key === "Enter" && saveTarget()}
          />
        </Field>
      </div>
    </Card>
  );
}

function WorkerCard() {
  const { ds, mode } = useData();
  const batch = latestBatch(ds.batches);
  return (
    <Card>
      <CardTitle sub="A scheduled Claude task, once a week. No API keys in the browser and no per call cost.">AI worker</CardTitle>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-2">
        <li>Every Sunday evening it reads a snapshot of your log through a token protected endpoint.</li>
        <li>It looks for recurring causes in your mistakes and weak modules, then writes about 20 questions, your requests first.</li>
        <li>Numeric questions are recomputed in Python and conceptual ones are re-solved blind. Anything that fails is discarded.</li>
        <li>The batch, the patterns and a coach note land in the Lab. It can never edit your own data.</li>
      </ol>
      <div className="mt-4 rounded-xl bg-sunken p-3 text-[13px] text-ink-2">
        {batch
          ? `Last batch ${fmtTimestamp(batch.createdAt)}, ${ds.questions.filter((q) => q.batchId === batch.id).length} questions.`
          : "No batch received yet."}
        {mode === "demo" ? " In the demo the batches are sample data." : " Setup steps are in the README of the repository."}
      </div>
    </Card>
  );
}

function DataCard() {
  const { ds, mode, actions, today } = useData();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Dataset | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const csvSessions = () =>
    toCsv([
      ["day", "minutes", "kind", "module", "note"],
      ...ds.sessions.map((s) => [s.day, s.minutes, s.kind, s.moduleId ? moduleLabel(s.moduleId) : "", s.note]),
    ]);
  const csvPractice = () =>
    toCsv([
      ["day", "module", "topic", "questions", "correct", "accuracy", "minutes", "source"],
      ...ds.attempts.map((a) => [
        a.day,
        a.moduleId ? moduleLabel(a.moduleId) : "",
        a.topicId ?? "",
        a.questions,
        a.correct,
        (a.correct / a.questions).toFixed(3),
        a.minutes ?? "",
        sourceLabel(a.source),
      ]),
    ]);
  const csvMistakes = () =>
    toCsv([
      ["created", "module", "cause", "certainty", "source", "description", "lesson", "streak", "resolved"],
      ...ds.mistakes.map((m) => [
        m.createdOn,
        moduleLabel(m.moduleId),
        errorTypeLabel(m.errorType),
        m.certainty ?? "",
        sourceLabel(m.source),
        m.description,
        m.lesson,
        m.streak,
        m.resolvedOn ?? "",
      ]),
    ]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      setPending(parseBackup(await f.text(), today));
    } catch (e) {
      toast(e instanceof BackupError ? e.message : "Could not read that file", "bad");
    } finally {
      if (file.current) file.current.value = "";
    }
  };

  return (
    <Card>
      <CardTitle sub="Your data is yours. Export it any time.">Data</CardTitle>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => downloadFile(`prep27-backup-${today}.json`, exportBackup(ds), "application/json")}>
          <Download size={16} aria-hidden /> Backup (JSON)
        </Button>
        <Button variant="ghost" onClick={() => downloadFile(`prep27-sessions-${today}.csv`, csvSessions(), "text/csv;charset=utf-8")}>
          Sessions CSV
        </Button>
        <Button variant="ghost" onClick={() => downloadFile(`prep27-practice-${today}.csv`, csvPractice(), "text/csv;charset=utf-8")}>
          Practice CSV
        </Button>
        <Button variant="ghost" onClick={() => downloadFile(`prep27-mistakes-${today}.csv`, csvMistakes(), "text/csv;charset=utf-8")}>
          Mistakes CSV
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <Button onClick={() => file.current?.click()}>
          <Upload size={16} aria-hidden /> Restore a backup
        </Button>
        {mode === "demo" ? (
          <Button variant="danger" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={16} aria-hidden /> Reset demo data
          </Button>
        ) : null}
      </div>
      <Modal open={pending != null} onClose={() => setPending(null)} title="Restore this backup?">
        {pending ? (
          <div className="space-y-3 text-sm">
            <p className="text-ink-2">
              It has {pending.sessions.length} sessions, {pending.attempts.length} practice sets and {pending.mistakes.length} mistakes.
              {mode === "demo"
                ? " It replaces the demo data in this browser."
                : " Matching records are updated and nothing is deleted. AI batches are not imported."}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const d = pending;
                  setPending(null);
                  void actions.importData(d);
                }}
              >
                Restore
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset the demo?">
        <p className="text-sm text-ink-2">Everything you changed in the demo goes back to the sample data.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmReset(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirmReset(false);
              void actions.resetDemo();
            }}
          >
            Reset
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

function AccountCard() {
  const { mode } = useData();
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    if (mode !== "cloud") return;
    let alive = true;
    getSupabase()
      .auth.getUser()
      .then(({ data }) => {
        if (alive) setEmail(data.user?.email ?? null);
      });
    return () => {
      alive = false;
    };
  }, [mode]);
  if (mode !== "cloud") return null;
  return (
    <Card>
      <CardTitle>Account</CardTitle>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-ink-2">Signed in as {email ?? "…"}</span>
        <Button onClick={() => void getSupabase().auth.signOut()}>Sign out</Button>
      </div>
    </Card>
  );
}

export function SettingsView() {
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ExamCard />
        <div className="space-y-5">
          <StudyCard />
          <WorkerCard />
        </div>
      </div>
      <DataCard />
      <AccountCard />
    </div>
  );
}
