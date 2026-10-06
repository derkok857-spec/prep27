-- Prep27 database schema for Supabase (Postgres 15+).
-- Run it once in the SQL editor of a fresh project. It is idempotent only for the seed, so run it on an empty database.
--
-- Every user table is protected by row level security: a signed in user only sees and changes rows where user_id = auth.uid().
-- The AI tables (ai_batches, ai_questions) are read only for users. The weekly worker writes them through
-- worker_insert_batch(), which only the service role can execute.

-- ---------------------------------------------------------------------------------------------------------
-- Curriculum (static, seeded at the end of this file)
-- ---------------------------------------------------------------------------------------------------------

create table public.topics (
  id text primary key,
  name text not null,
  short text not null,
  weight_min numeric(4,1) not null,
  weight_max numeric(4,1) not null,
  sort int not null unique
);

create table public.modules (
  id int primary key,
  topic_id text not null references public.topics(id),
  lm int not null,
  title text not null,
  unique (topic_id, lm)
);

-- ---------------------------------------------------------------------------------------------------------
-- User data
-- ---------------------------------------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  exam_date date not null default '2027-05-11',
  weekly_hours numeric(5,2) not null default 12 check (weekly_hours between 1 and 80),
  start_date date not null default current_date,
  mock_weeks int not null default 5 check (mock_weeks between 0 and 12),
  topic_order text[] not null default array['quant','econ','corp','fsa','equity','fi','deriv','alt','pc','ethics'],
  capacity_changes jsonb not null default '[]'::jsonb check (jsonb_typeof(capacity_changes) = 'array'),
  target_hours numeric(6,1) not null default 300 check (target_hours between 50 and 1000),
  updated_at timestamptz not null default now()
);

create table public.module_progress (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  module_id int not null references public.modules(id),
  status text not null default 'todo' check (status in ('todo', 'reading', 'done')),
  confidence smallint check (confidence between 1 and 3),
  done_at date,
  reviews jsonb not null default '{}'::jsonb check (jsonb_typeof(reviews) = 'object'),
  notes text not null default '' check (char_length(notes) <= 4000),
  hours_override numeric(5,2) check (hours_override between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, module_id)
);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  minutes int not null check (minutes between 1 and 960),
  module_id int references public.modules(id),
  kind text not null default 'learn' check (kind in ('learn', 'review')),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index study_sessions_user_day on public.study_sessions (user_id, day);

create table public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  module_id int references public.modules(id),
  topic_id text references public.topics(id),
  questions int not null check (questions between 1 and 500),
  correct int not null check (correct >= 0),
  minutes int check (minutes between 1 and 960),
  source text not null default 'qbank' check (source in ('qbank', 'topic_test', 'mock', 'lab', 'other')),
  created_at timestamptz not null default now(),
  check (correct <= questions)
);
create index practice_attempts_user_day on public.practice_attempts (user_id, day);

create table public.ai_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_key text not null check (char_length(run_key) between 1 and 64),
  created_at timestamptz not null default now(),
  summary text not null default '',
  patterns jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  unique (user_id, run_key)
);

create table public.ai_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null references public.ai_batches(id) on delete cascade,
  module_id int not null references public.modules(id),
  difficulty smallint not null check (difficulty between 1 and 3),
  origin text not null check (origin in ('request', 'mistake', 'weak', 'starter')),
  ref text,
  stem text not null check (char_length(stem) between 10 and 2000),
  options jsonb not null check (options ?& array['A', 'B', 'C']),
  answer text not null check (answer in ('A', 'B', 'C')),
  explanation text not null default '',
  verification text not null check (verification in ('python', 'blind')),
  created_at timestamptz not null default now()
);
create index ai_questions_user_created on public.ai_questions (user_id, created_at desc);

create table public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  module_id int not null references public.modules(id),
  created_on date not null,
  description text not null check (char_length(description) between 1 and 1000),
  lesson text not null default '' check (char_length(lesson) <= 1000),
  error_type text not null check (error_type in ('concept', 'formula', 'calc', 'misread', 'trap', 'time')),
  certainty text check (certainty in ('sure', 'unsure', 'guess')),
  source text not null default 'qbank' check (source in ('qbank', 'topic_test', 'mock', 'lab', 'other', 'reading')),
  next_review date,
  streak int not null default 0 check (streak between 0 and 10),
  resolved_on date,
  question_id uuid references public.ai_questions(id) on delete set null,
  history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array'),
  created_at timestamptz not null default now()
);
create index mistakes_user_created on public.mistakes (user_id, created_on);

create table public.question_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  question_id uuid not null references public.ai_questions(id) on delete cascade,
  day date not null,
  pick text not null check (pick in ('A', 'B', 'C')),
  correct boolean not null,
  certainty text check (certainty in ('sure', 'unsure', 'guess')),
  created_at timestamptz not null default now()
);
create index question_answers_user_question on public.question_answers (user_id, question_id);

create table public.question_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_on date not null,
  topic_id text references public.topics(id),
  module_id int references public.modules(id),
  difficulty smallint not null check (difficulty between 1 and 3),
  count int not null check (count between 3 and 20),
  note text not null default '' check (char_length(note) <= 240),
  served_batch_id uuid references public.ai_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  check (topic_id is not null or module_id is not null)
);

create table public.question_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  question_id uuid not null references public.ai_questions(id) on delete cascade,
  day date not null,
  reason text not null default '' check (char_length(reason) <= 300),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------------------------------------

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger module_progress_touch before update on public.module_progress
  for each row execute function public.touch_updated_at();

-- The server decides whether a Lab answer is right, so the client cannot mark its own homework.
create function public.grade_answer() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_key text;
begin
  select q.answer into v_key from public.ai_questions q where q.id = new.question_id and q.user_id = new.user_id;
  if v_key is null then
    raise exception 'question % not found for this user', new.question_id using errcode = '23503';
  end if;
  new.correct := (new.pick = v_key);
  return new;
end $$;

create trigger question_answers_grade before insert or update on public.question_answers
  for each row execute function public.grade_answer();

-- ---------------------------------------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------------------------------------

alter table public.topics enable row level security;
alter table public.modules enable row level security;
alter table public.profiles enable row level security;
alter table public.module_progress enable row level security;
alter table public.study_sessions enable row level security;
alter table public.practice_attempts enable row level security;
alter table public.ai_batches enable row level security;
alter table public.ai_questions enable row level security;
alter table public.mistakes enable row level security;
alter table public.question_answers enable row level security;
alter table public.question_requests enable row level security;
alter table public.question_reports enable row level security;

create policy topics_read on public.topics for select to authenticated using (true);
create policy modules_read on public.modules for select to authenticated using (true);

create policy profiles_own on public.profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy module_progress_own on public.module_progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy study_sessions_own on public.study_sessions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy practice_attempts_own on public.practice_attempts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy question_requests_own on public.question_requests for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy mistakes_own on public.mistakes for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (question_id is null or exists (
      select 1 from public.ai_questions q where q.id = question_id and q.user_id = (select auth.uid())))
  );

create policy question_answers_own on public.question_answers for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.ai_questions q where q.id = question_id and q.user_id = (select auth.uid()))
  );

create policy question_reports_own on public.question_reports for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.ai_questions q where q.id = question_id and q.user_id = (select auth.uid()))
  );

create policy ai_batches_read on public.ai_batches for select to authenticated
  using (user_id = (select auth.uid()));
create policy ai_questions_read on public.ai_questions for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------------------
-- Worker entry point. Atomic: the batch, its questions and the served requests land together or not at all.
-- A repeated run_key returns the existing batch instead of inserting twice.
-- ---------------------------------------------------------------------------------------------------------

create function public.worker_insert_batch(p_user uuid, p_batch jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_batch uuid;
  v_count int;
begin
  insert into public.ai_batches (user_id, run_key, summary, patterns, meta)
  values (
    p_user,
    p_batch->>'runKey',
    coalesce(p_batch->>'summary', ''),
    coalesce(p_batch->'patterns', '[]'::jsonb),
    coalesce(p_batch->'meta', '{}'::jsonb)
  )
  on conflict (user_id, run_key) do nothing
  returning id into v_batch;

  if v_batch is null then
    select b.id into v_batch from public.ai_batches b where b.user_id = p_user and b.run_key = p_batch->>'runKey';
    return jsonb_build_object('batchId', v_batch, 'inserted', 0, 'duplicate', true);
  end if;

  insert into public.ai_questions
    (user_id, batch_id, module_id, difficulty, origin, ref, stem, options, answer, explanation, verification)
  select
    p_user, v_batch, (q->>'moduleId')::int, (q->>'difficulty')::smallint, q->>'origin', nullif(q->>'ref', ''),
    q->>'stem', q->'options', q->>'answer', coalesce(q->>'explanation', ''), q->>'verification'
  from jsonb_array_elements(coalesce(p_batch->'questions', '[]'::jsonb)) as q;
  get diagnostics v_count = row_count;

  update public.question_requests r
     set served_batch_id = v_batch
   where r.user_id = p_user
     and r.served_batch_id is null
     and r.id in (
       select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(p_batch->'servedRequestIds', '[]'::jsonb)) as x
     );

  return jsonb_build_object('batchId', v_batch, 'inserted', v_count, 'duplicate', false);
end $$;

revoke all on function public.worker_insert_batch(uuid, jsonb) from public;
revoke all on function public.worker_insert_batch(uuid, jsonb) from anon, authenticated;
grant execute on function public.worker_insert_batch(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- Handy views for the SQL editor. security_invoker keeps row level security in force.
-- ---------------------------------------------------------------------------------------------------------

create view public.weekly_hours with (security_invoker = true) as
select user_id, date_trunc('week', day)::date as week_start, round(sum(minutes) / 60.0, 2) as hours
from (
  select user_id, day, minutes from public.study_sessions
  union all
  select user_id, day, minutes from public.practice_attempts where minutes is not null
) t
group by user_id, date_trunc('week', day);

create view public.topic_accuracy with (security_invoker = true) as
select pa.user_id,
       coalesce(m.topic_id, pa.topic_id) as topic_id,
       sum(pa.correct) as correct,
       sum(pa.questions) as questions,
       round(sum(pa.correct)::numeric / nullif(sum(pa.questions), 0), 3) as accuracy
from public.practice_attempts pa
left join public.modules m on m.id = pa.module_id
group by pa.user_id, coalesce(m.topic_id, pa.topic_id);

-- ---------------------------------------------------------------------------------------------------------
-- Seed. Generated from src/lib/curriculum.ts by `npm run gen:seed`. Do not edit by hand.
-- ---------------------------------------------------------------------------------------------------------

-- BEGIN SEED
insert into public.topics (id, name, short, weight_min, weight_max, sort) values
  ('quant', 'Quantitative Methods', 'Quant', 6, 9, 1),
  ('econ', 'Economics', 'Econ', 6, 9, 2),
  ('corp', 'Corporate Finance', 'Corp', 6, 9, 3),
  ('fsa', 'Financial Statement Analysis', 'FSA', 11, 14, 4),
  ('equity', 'Equities', 'Equity', 11, 14, 5),
  ('fi', 'Fixed Income', 'FI', 11, 14, 6),
  ('deriv', 'Derivatives', 'Deriv', 5, 8, 7),
  ('alt', 'Alternative Investments', 'Alts', 7, 10, 8),
  ('pc', 'Portfolio Construction', 'PC', 8, 12, 9),
  ('ethics', 'Ethical and Professional Standards', 'Ethics', 15, 20, 10)
on conflict (id) do nothing;

insert into public.modules (id, topic_id, lm, title) values
  (1, 'quant', 1, 'Returns of Financial Assets and Instruments'),
  (2, 'quant', 2, 'Types of Financial Returns'),
  (3, 'quant', 3, 'Benchmarking Returns'),
  (4, 'quant', 4, 'The Time Value of Money in Finance'),
  (5, 'quant', 5, 'Statistical Characteristics of Asset Returns'),
  (6, 'quant', 6, 'Statistical Distributions for Financial Asset Prices and Returns'),
  (7, 'quant', 7, 'Estimation and Hypothesis Testing'),
  (8, 'quant', 8, 'The Return and Risk of a Financial Portfolio'),
  (9, 'quant', 9, 'Simulation of Financial Asset Prices and Returns'),
  (10, 'quant', 10, 'Applications of Simple Linear Regression in Finance'),
  (11, 'quant', 11, 'Introduction to Financial Data Science'),
  (12, 'econ', 1, 'The Firm and Market Structures'),
  (13, 'econ', 2, 'Understanding Business Cycles'),
  (14, 'econ', 3, 'Fiscal Policy'),
  (15, 'econ', 4, 'Monetary Policy'),
  (16, 'econ', 5, 'Introduction to Geopolitics'),
  (17, 'econ', 6, 'International Trade'),
  (18, 'econ', 7, 'Capital Flows and the FX Market'),
  (19, 'econ', 8, 'Exchange Rate Calculations'),
  (20, 'corp', 1, 'Organizational Forms, Corporate Issuer Features, and Ownership'),
  (21, 'corp', 2, 'Investors and Other Stakeholders'),
  (22, 'corp', 3, 'Corporate Governance: Conflicts, Mechanisms, Risks, and Benefits'),
  (23, 'corp', 4, 'Working Capital and Liquidity'),
  (24, 'corp', 5, 'Capital Investments and Capital Allocation'),
  (25, 'corp', 6, 'Capital Structure'),
  (26, 'corp', 7, 'Business Models'),
  (27, 'fsa', 1, 'Introduction to Financial Statement Analysis'),
  (28, 'fsa', 2, 'Analyzing Income Statements'),
  (29, 'fsa', 3, 'Analyzing Balance Sheets'),
  (30, 'fsa', 4, 'Analyzing Statements of Cash Flows I'),
  (31, 'fsa', 5, 'Analyzing Statements of Cash Flows II'),
  (32, 'fsa', 6, 'Analysis of Inventories'),
  (33, 'fsa', 7, 'Analysis of Long-Term Assets'),
  (34, 'fsa', 8, 'Topics in Long-Term Liabilities and Equity'),
  (35, 'fsa', 9, 'Analysis of Income Taxes'),
  (36, 'fsa', 10, 'Financial Reporting Quality'),
  (37, 'fsa', 11, 'Financial Analysis Techniques'),
  (38, 'fsa', 12, 'Introduction to Financial Statement Modeling'),
  (39, 'equity', 1, 'Equity Instrument Features'),
  (40, 'equity', 2, 'Equity Jurisdictions, Classes, and the Voting Process'),
  (41, 'equity', 3, 'Equity Issuance and Trading'),
  (42, 'equity', 4, 'Sources of Equity Returns'),
  (43, 'equity', 5, 'Introduction to Equity Valuation'),
  (44, 'equity', 6, 'Discounted Cash Flow (DCF) and Growth Models'),
  (45, 'equity', 7, 'Relative Value Equity Valuation Approaches'),
  (46, 'equity', 8, 'Financial Statement Forecasting in Equity Valuation'),
  (47, 'equity', 9, 'Industry and Competitive Analysis'),
  (48, 'equity', 10, 'Company Analysis: Past, Present, and Future'),
  (49, 'equity', 11, 'Equity Analyst Research Reports'),
  (50, 'equity', 12, 'The Capital Asset Pricing Model, Market Model, and Other Factor-Based Equity Models'),
  (51, 'fi', 1, 'Fixed-Income Instrument Features'),
  (52, 'fi', 2, 'Fixed-Income Cash Flows and Types'),
  (53, 'fi', 3, 'Fixed-Income Issuance and Trading'),
  (54, 'fi', 4, 'Fixed-Income Markets for Corporate Issuers'),
  (55, 'fi', 5, 'Fixed-Income Markets for Government Issuers'),
  (56, 'fi', 6, 'Fixed-Income Bond Valuation: Prices and Yields'),
  (57, 'fi', 7, 'Yield and Yield Spread Measures for Fixed-Rate Bonds'),
  (58, 'fi', 8, 'Yield and Yield Spread Measures for Floating-Rate Instruments'),
  (59, 'fi', 9, 'The Term Structure of Interest Rates: Spot, Par, and Forward Curves'),
  (60, 'fi', 10, 'Interest Rate Risk and Return'),
  (61, 'fi', 11, 'Yield-Based Bond Duration Measures and Properties'),
  (62, 'fi', 12, 'Yield-Based Bond Convexity and Portfolio Properties'),
  (63, 'fi', 13, 'Curve-Based and Empirical Fixed-Income Risk Measures'),
  (64, 'fi', 14, 'Credit Risk'),
  (65, 'fi', 15, 'Credit Analysis for Government Issuers'),
  (66, 'fi', 16, 'Credit Analysis for Corporate Issuers'),
  (67, 'fi', 17, 'Fixed-Income Securitization'),
  (68, 'fi', 18, 'Asset-Backed Security (ABS) Instrument and Market Features'),
  (69, 'fi', 19, 'Mortgage-Backed Security (MBS) Instrument and Market Features'),
  (70, 'deriv', 1, 'Derivative Instrument and Derivative Market Features'),
  (71, 'deriv', 2, 'Forward Commitment and Contingent Claim Features and Instruments'),
  (72, 'deriv', 3, 'Derivative Benefits, Risks, and Issuer and Investor Uses'),
  (73, 'deriv', 4, 'Arbitrage, Replication, and the Cost of Carry in Pricing Derivatives'),
  (74, 'deriv', 5, 'Pricing and Valuation of Forward Contracts and for an Underlying with Varying Maturities'),
  (75, 'deriv', 6, 'Pricing and Valuation of Futures Contracts'),
  (76, 'deriv', 7, 'Pricing and Valuation of Interest Rate and Other Swaps'),
  (77, 'deriv', 8, 'Pricing and Valuation of Options'),
  (78, 'deriv', 9, 'Option Replication Using Put–Call Parity'),
  (79, 'deriv', 10, 'Valuing a Derivative Using a One-Period Binomial Model'),
  (80, 'alt', 1, 'Alternative Investment Features, Methods, and Structures'),
  (81, 'alt', 2, 'Alternative Investment Performance and Returns'),
  (82, 'alt', 3, 'Investments in Private Capital: Equity and Debt'),
  (83, 'alt', 4, 'Real Estate and Infrastructure'),
  (84, 'alt', 5, 'Natural Resources'),
  (85, 'alt', 6, 'Hedge Funds'),
  (86, 'alt', 7, 'Introduction to Digital Assets'),
  (87, 'pc', 1, 'Portfolio Risk and Return: Part I'),
  (88, 'pc', 2, 'Portfolio Risk and Return: Part II'),
  (89, 'pc', 3, 'Portfolio Management: An Overview'),
  (90, 'pc', 4, 'Basics of Portfolio Planning and Construction'),
  (91, 'pc', 5, 'The Behavioral Biases of Individuals'),
  (92, 'pc', 6, 'Introduction to Risk Management'),
  (93, 'ethics', 1, 'Ethics and Trust in the Investment Profession'),
  (94, 'ethics', 2, 'Code of Ethics and Standards of Professional Conduct'),
  (95, 'ethics', 3, 'Guidance for Standard I: Professionalism'),
  (96, 'ethics', 4, 'Guidance for Standard II: Integrity of Capital Markets'),
  (97, 'ethics', 5, 'Guidance for Standard III: Duties to Clients'),
  (98, 'ethics', 6, 'Guidance for Standard IV: Duties to Employers'),
  (99, 'ethics', 7, 'Guidance for Standard V: Investment Analysis, Recommendations, and Actions'),
  (100, 'ethics', 8, 'Guidance for Standard VI: Conflicts of Interest'),
  (101, 'ethics', 9, 'Guidance for Standard VII: Responsibilities as a CFA Institute Member or CFA Candidate'),
  (102, 'ethics', 10, 'Application of the Code and Standards: Level I')
on conflict (id) do nothing;
-- END SEED
