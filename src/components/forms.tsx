"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { BookOpen, Bug, ListChecks } from "lucide-react";
import { TOPICS, getModule, isTopicId, type TopicId } from "@/lib/curriculum";
import { addDays, isISODate } from "@/lib/dates";
import {
  CERTAINTY,
  DIFFICULTY_LABEL,
  ERROR_TYPES,
  PRACTICE_SOURCES,
  type Certainty,
  type Difficulty,
  type ErrorType,
  type Mistake,
  type MistakeSource,
  type PracticeSource,
  type SessionKind,
} from "@/lib/types";
import { useData } from "./data";
import { ModuleSelect } from "./domain";
import { Button, Field, Modal, Segmented, inputClass } from "./ui";

function useDefaultModule(): number {
  const { ds, derived } = useData();
  const planned = derived.plan.todayPlan.items[0]?.moduleId;
  if (planned) return planned;
  const reading = Object.values(ds.progress).find((p) => p.status === "reading");
  return reading?.moduleId ?? 1;
}

function Actions({ onCancel, submitLabel, disabled }: { onCancel: () => void; submitLabel: string; disabled?: boolean }) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="primary" type="submit" disabled={disabled}>
        {submitLabel}
      </Button>
    </div>
  );
}

function DayField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { today } = useData();
  return (
    <Field label="Day">
      <input
        type="date"
        className={inputClass}
        value={value}
        max={today}
        min={addDays(today, -120)}
        onChange={(e) => onChange(e.target.value)}
        required
      />
    </Field>
  );
}

const MINUTE_PRESETS = [25, 45, 60, 90];

export function LogTimeForm({ moduleId, onDone }: { moduleId?: number | null; onDone: () => void }) {
  const { today, actions } = useData();
  const dflt = useDefaultModule();
  const [day, setDay] = useState(today);
  const [minutes, setMinutes] = useState("60");
  const [mod, setMod] = useState<number | null>(moduleId === undefined ? dflt : moduleId);
  const [kind, setKind] = useState<SessionKind>("learn");
  const [note, setNote] = useState("");
  const m = Number(minutes);
  const valid = isISODate(day) && day <= today && Number.isFinite(m) && m >= 1 && m <= 960;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onDone();
    await actions.logSession({ day, minutes: Math.round(m), moduleId: mod, kind, note: note.trim().slice(0, 500) });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DayField value={day} onChange={setDay} />
        <Field label="Minutes">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={960}
            className={inputClass}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            required
          />
          <div className="mt-1.5 flex gap-1">
            {MINUTE_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setMinutes(String(p))}
                className="rounded-lg border border-line px-2 py-0.5 text-[12px] text-ink-2 hover:border-accent hover:text-accent"
              >
                {p}
              </button>
            ))}
          </div>
        </Field>
      </div>
      <Field label="Module">
        <ModuleSelect value={mod} onChange={setMod} allowNone noneLabel="General study, no module" />
      </Field>
      <div>
        <span className="mb-1 block text-[13px] font-medium text-ink-2">What kind of time</span>
        <Segmented<SessionKind>
          label="Kind of time"
          value={kind}
          onChange={setKind}
          options={[
            { value: "learn", label: "Learning" },
            { value: "review", label: "Review" },
          ]}
        />
      </div>
      <Field label="Note" hint="Optional">
        <input
          className={inputClass}
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Videos, reading, flashcards…"
        />
      </Field>
      <Actions onCancel={onDone} submitLabel="Log time" disabled={!valid} />
    </form>
  );
}

export function LogPracticeForm({ moduleId, onDone }: { moduleId?: number | null; onDone: () => void }) {
  const { today, actions } = useData();
  const dflt = useDefaultModule();
  const [day, setDay] = useState(today);
  const [mod, setMod] = useState<number | null>(moduleId === undefined ? dflt : moduleId);
  const [topic, setTopic] = useState<TopicId | "">("");
  const [n, setN] = useState("");
  const [c, setC] = useState("");
  const [minutes, setMinutes] = useState("");
  const [source, setSource] = useState<PracticeSource>("qbank");
  const qn = Number(n);
  const qc = Number(c);
  const valid =
    isISODate(day) &&
    day <= today &&
    Number.isInteger(qn) &&
    qn >= 1 &&
    qn <= 500 &&
    Number.isInteger(qc) &&
    qc >= 0 &&
    qc <= qn &&
    (mod != null || topic !== "");
  const tooMany = n !== "" && c !== "" && qc > qn;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const min = minutes ? Math.round(Number(minutes)) : Math.round(qn * 1.5);
    onDone();
    await actions.logAttempt({
      day,
      moduleId: mod,
      topicId: mod != null ? null : (topic as TopicId),
      questions: qn,
      correct: qc,
      minutes: min > 0 ? min : null,
      source,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DayField value={day} onChange={setDay} />
        <Field label="Source">
          <select className={inputClass} value={source} onChange={(e) => setSource(e.target.value as PracticeSource)}>
            {PRACTICE_SOURCES.filter((s) => s.id !== "lab").map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Module" hint="Pick none for a topic test or a mock that mixes modules">
        <ModuleSelect value={mod} onChange={setMod} allowNone noneLabel="Several modules" />
      </Field>
      {mod == null ? (
        <Field label="Topic">
          <select className={inputClass} value={topic} onChange={(e) => setTopic(isTopicId(e.target.value) ? e.target.value : "")} required>
            <option value="">Choose a topic</option>
            {TOPICS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Questions">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            className={inputClass}
            value={n}
            onChange={(e) => setN(e.target.value)}
            required
          />
        </Field>
        <Field label="Correct">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={500}
            className={inputClass}
            value={c}
            onChange={(e) => setC(e.target.value)}
            required
            aria-invalid={tooMany}
          />
        </Field>
        <Field label="Minutes">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={960}
            className={inputClass}
            value={minutes}
            placeholder={qn > 0 ? String(Math.round(qn * 1.5)) : ""}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </Field>
      </div>
      {tooMany ? <p className="text-[13px] text-bad">Correct answers cannot exceed the number of questions.</p> : null}
      <Actions onCancel={onDone} submitLabel="Log practice" disabled={!valid} />
    </form>
  );
}

export interface MistakeDraft {
  moduleId: number;
  description: string;
  lesson: string;
  errorType: ErrorType;
  certainty: Certainty | null;
  source: MistakeSource;
  questionId?: string | null;
}

export function MistakeForm({
  initial,
  editing,
  onDone,
}: {
  initial?: Partial<MistakeDraft> & { id?: string };
  editing?: Mistake;
  onDone: () => void;
}) {
  const { today, actions } = useData();
  const dflt = useDefaultModule();
  const [mod, setMod] = useState<number | null>(editing?.moduleId ?? initial?.moduleId ?? dflt);
  const [description, setDescription] = useState(editing?.description ?? initial?.description ?? "");
  const [lesson, setLesson] = useState(editing?.lesson ?? initial?.lesson ?? "");
  const [type, setType] = useState<ErrorType>(editing?.errorType ?? initial?.errorType ?? "concept");
  const [certainty, setCertainty] = useState<Certainty | null>(editing?.certainty ?? initial?.certainty ?? null);
  const [source, setSource] = useState<MistakeSource>(editing?.source ?? initial?.source ?? "qbank");
  const [day, setDay] = useState(editing?.createdOn ?? today);
  const valid = mod != null && description.trim().length > 0 && isISODate(day) && day <= today;
  const hint = ERROR_TYPES.find((e) => e.id === type)?.hint;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || mod == null) return;
    onDone();
    if (editing) {
      await actions.updateMistake(editing.id, { moduleId: mod, description, lesson, errorType: type, certainty });
    } else {
      await actions.addMistake({
        moduleId: mod,
        description,
        lesson,
        errorType: type,
        certainty,
        source,
        createdOn: day,
        questionId: initial?.questionId ?? null,
      });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Module">
        <ModuleSelect value={mod} onChange={setMod} />
      </Field>
      <Field label="What went wrong">
        <textarea
          className={`${inputClass} min-h-20`}
          value={description}
          maxLength={1000}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Mixed up which rate goes on top in interest rate parity"
          required
        />
      </Field>
      <Field label="The rule to remember" hint="Write it so that future you gets it right in ten seconds">
        <textarea className={`${inputClass} min-h-16`} value={lesson} maxLength={1000} onChange={(e) => setLesson(e.target.value)} />
      </Field>
      <div>
        <span className="mb-1 block text-[13px] font-medium text-ink-2">Cause</span>
        <Segmented<ErrorType>
          label="Cause"
          size="sm"
          value={type}
          onChange={setType}
          options={ERROR_TYPES.map((e) => ({ value: e.id, label: e.label, title: e.hint }))}
        />
        {hint ? <p className="mt-1 text-[12px] text-ink-3">{hint}</p> : null}
      </div>
      <div className="flex flex-wrap gap-6">
        <div>
          <span className="mb-1 block text-[13px] font-medium text-ink-2">How sure were you</span>
          <Segmented<Certainty | "none">
            label="How sure were you"
            size="sm"
            value={certainty ?? "none"}
            onChange={(v) => setCertainty(v === "none" ? null : v)}
            options={[...CERTAINTY.map((c) => ({ value: c.id as Certainty | "none", label: c.label })), { value: "none", label: "Skip" }]}
          />
        </div>
        {!editing ? (
          <Field label="Where" className="min-w-40">
            <select className={inputClass} value={source} onChange={(e) => setSource(e.target.value as MistakeSource)}>
              {PRACTICE_SOURCES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
              <option value="reading">Reading</option>
            </select>
          </Field>
        ) : null}
      </div>
      {!editing ? <DayField value={day} onChange={setDay} /> : null}
      <Actions onCancel={onDone} submitLabel={editing ? "Save changes" : "Save mistake"} disabled={!valid} />
    </form>
  );
}

export function RequestForm({ moduleId, onDone }: { moduleId?: number; onDone?: () => void }) {
  const { actions } = useData();
  const [scope, setScope] = useState<"topic" | "module">(moduleId ? "module" : "topic");
  const [topic, setTopic] = useState<TopicId>(moduleId ? getModule(moduleId)!.topic : "quant");
  const [mod, setMod] = useState<number | null>(moduleId ?? 1);
  const [difficulty, setDifficulty] = useState<Difficulty>(2);
  const [count, setCount] = useState("8");
  const [note, setNote] = useState("");
  const n = Number(count);
  const valid = Number.isInteger(n) && n >= 3 && n <= 20 && (scope === "topic" || mod != null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    await actions.addRequest({
      topicId: scope === "topic" ? topic : null,
      moduleId: scope === "module" ? mod : null,
      difficulty,
      count: n,
      note: note.trim().slice(0, 240),
    });
    setNote("");
    onDone?.();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Segmented<"topic" | "module">
        label="Request scope"
        size="sm"
        value={scope}
        onChange={setScope}
        options={[
          { value: "topic", label: "A topic" },
          { value: "module", label: "A module" },
        ]}
      />
      {scope === "topic" ? (
        <select className={inputClass} value={topic} onChange={(e) => setTopic(e.target.value as TopicId)} aria-label="Topic">
          {TOPICS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      ) : (
        <ModuleSelect value={mod} onChange={setMod} />
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="mb-1 block text-[13px] font-medium text-ink-2">Difficulty</span>
          <Segmented<Difficulty>
            label="Difficulty"
            size="sm"
            value={difficulty}
            onChange={setDifficulty}
            options={([1, 2, 3] as Difficulty[]).map((d) => ({ value: d, label: DIFFICULTY_LABEL[d] }))}
          />
        </div>
        <Field label="How many" className="w-24">
          <input type="number" min={3} max={20} className={inputClass} value={count} onChange={(e) => setCount(e.target.value)} />
        </Field>
      </div>
      <input
        className={inputClass}
        value={note}
        maxLength={240}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional focus, for example LIFO vs FIFO when prices rise"
        aria-label="Note"
      />
      <div className="flex justify-end">
        <Button variant="primary" type="submit" disabled={!valid}>
          Queue request
        </Button>
      </div>
    </form>
  );
}

type QuickKind = "time" | "practice" | "mistake";

export function QuickLog({ moduleId, compact = false, extra }: { moduleId?: number | null; compact?: boolean; extra?: ReactNode }) {
  const [open, setOpen] = useState<QuickKind | null>(null);
  const close = () => setOpen(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size={compact ? "sm" : "md"} onClick={() => setOpen("time")}>
          <BookOpen size={16} aria-hidden /> Log time
        </Button>
        <Button size={compact ? "sm" : "md"} onClick={() => setOpen("practice")}>
          <ListChecks size={16} aria-hidden /> Log practice
        </Button>
        <Button size={compact ? "sm" : "md"} onClick={() => setOpen("mistake")}>
          <Bug size={16} aria-hidden /> Log mistake
        </Button>
        {extra}
      </div>
      <Modal open={open === "time"} onClose={close} title="Log study time">
        <LogTimeForm moduleId={moduleId} onDone={close} />
      </Modal>
      <Modal open={open === "practice"} onClose={close} title="Log a practice set">
        <LogPracticeForm moduleId={moduleId} onDone={close} />
      </Modal>
      <Modal open={open === "mistake"} onClose={close} title="Log a mistake" wide>
        <MistakeForm initial={moduleId ? { moduleId } : undefined} onDone={close} />
      </Modal>
    </>
  );
}
