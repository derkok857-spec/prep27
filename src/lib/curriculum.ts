// Level I 2027 topic outline. Topic weights are the published 2027 ranges.
// Module titles follow the public 2027 topic outline. No curriculum text lives in this repo.

export type TopicId = "quant" | "econ" | "corp" | "fsa" | "equity" | "fi" | "deriv" | "alt" | "pc" | "ethics";

export interface Topic {
  id: TopicId;
  name: string;
  short: string;
  weightMin: number;
  weightMax: number;
  sort: number;
}

export interface CurriculumModule {
  id: number;
  topic: TopicId;
  lm: number;
  title: string;
}

export const TOPICS: Topic[] = [
  { id: "quant", name: "Quantitative Methods", short: "Quant", weightMin: 6, weightMax: 9, sort: 1 },
  { id: "econ", name: "Economics", short: "Econ", weightMin: 6, weightMax: 9, sort: 2 },
  { id: "corp", name: "Corporate Finance", short: "Corp", weightMin: 6, weightMax: 9, sort: 3 },
  { id: "fsa", name: "Financial Statement Analysis", short: "FSA", weightMin: 11, weightMax: 14, sort: 4 },
  { id: "equity", name: "Equities", short: "Equity", weightMin: 11, weightMax: 14, sort: 5 },
  { id: "fi", name: "Fixed Income", short: "FI", weightMin: 11, weightMax: 14, sort: 6 },
  { id: "deriv", name: "Derivatives", short: "Deriv", weightMin: 5, weightMax: 8, sort: 7 },
  { id: "alt", name: "Alternative Investments", short: "Alts", weightMin: 7, weightMax: 10, sort: 8 },
  { id: "pc", name: "Portfolio Construction", short: "PC", weightMin: 8, weightMax: 12, sort: 9 },
  { id: "ethics", name: "Ethical and Professional Standards", short: "Ethics", weightMin: 15, weightMax: 20, sort: 10 },
];

const OUTLINE: [TopicId, string[]][] = [
  [
    "quant",
    [
      "Returns of Financial Assets and Instruments",
      "Types of Financial Returns",
      "Benchmarking Returns",
      "The Time Value of Money in Finance",
      "Statistical Characteristics of Asset Returns",
      "Statistical Distributions for Financial Asset Prices and Returns",
      "Estimation and Hypothesis Testing",
      "The Return and Risk of a Financial Portfolio",
      "Simulation of Financial Asset Prices and Returns",
      "Applications of Simple Linear Regression in Finance",
      "Introduction to Financial Data Science",
    ],
  ],
  [
    "econ",
    [
      "The Firm and Market Structures",
      "Understanding Business Cycles",
      "Fiscal Policy",
      "Monetary Policy",
      "Introduction to Geopolitics",
      "International Trade",
      "Capital Flows and the FX Market",
      "Exchange Rate Calculations",
    ],
  ],
  [
    "corp",
    [
      "Organizational Forms, Corporate Issuer Features, and Ownership",
      "Investors and Other Stakeholders",
      "Corporate Governance: Conflicts, Mechanisms, Risks, and Benefits",
      "Working Capital and Liquidity",
      "Capital Investments and Capital Allocation",
      "Capital Structure",
      "Business Models",
    ],
  ],
  [
    "fsa",
    [
      "Introduction to Financial Statement Analysis",
      "Analyzing Income Statements",
      "Analyzing Balance Sheets",
      "Analyzing Statements of Cash Flows I",
      "Analyzing Statements of Cash Flows II",
      "Analysis of Inventories",
      "Analysis of Long-Term Assets",
      "Topics in Long-Term Liabilities and Equity",
      "Analysis of Income Taxes",
      "Financial Reporting Quality",
      "Financial Analysis Techniques",
      "Introduction to Financial Statement Modeling",
    ],
  ],
  [
    "equity",
    [
      "Equity Instrument Features",
      "Equity Jurisdictions, Classes, and the Voting Process",
      "Equity Issuance and Trading",
      "Sources of Equity Returns",
      "Introduction to Equity Valuation",
      "Discounted Cash Flow (DCF) and Growth Models",
      "Relative Value Equity Valuation Approaches",
      "Financial Statement Forecasting in Equity Valuation",
      "Industry and Competitive Analysis",
      "Company Analysis: Past, Present, and Future",
      "Equity Analyst Research Reports",
      "The Capital Asset Pricing Model, Market Model, and Other Factor-Based Equity Models",
    ],
  ],
  [
    "fi",
    [
      "Fixed-Income Instrument Features",
      "Fixed-Income Cash Flows and Types",
      "Fixed-Income Issuance and Trading",
      "Fixed-Income Markets for Corporate Issuers",
      "Fixed-Income Markets for Government Issuers",
      "Fixed-Income Bond Valuation: Prices and Yields",
      "Yield and Yield Spread Measures for Fixed-Rate Bonds",
      "Yield and Yield Spread Measures for Floating-Rate Instruments",
      "The Term Structure of Interest Rates: Spot, Par, and Forward Curves",
      "Interest Rate Risk and Return",
      "Yield-Based Bond Duration Measures and Properties",
      "Yield-Based Bond Convexity and Portfolio Properties",
      "Curve-Based and Empirical Fixed-Income Risk Measures",
      "Credit Risk",
      "Credit Analysis for Government Issuers",
      "Credit Analysis for Corporate Issuers",
      "Fixed-Income Securitization",
      "Asset-Backed Security (ABS) Instrument and Market Features",
      "Mortgage-Backed Security (MBS) Instrument and Market Features",
    ],
  ],
  [
    "deriv",
    [
      "Derivative Instrument and Derivative Market Features",
      "Forward Commitment and Contingent Claim Features and Instruments",
      "Derivative Benefits, Risks, and Issuer and Investor Uses",
      "Arbitrage, Replication, and the Cost of Carry in Pricing Derivatives",
      "Pricing and Valuation of Forward Contracts and for an Underlying with Varying Maturities",
      "Pricing and Valuation of Futures Contracts",
      "Pricing and Valuation of Interest Rate and Other Swaps",
      "Pricing and Valuation of Options",
      "Option Replication Using Put–Call Parity",
      "Valuing a Derivative Using a One-Period Binomial Model",
    ],
  ],
  [
    "alt",
    [
      "Alternative Investment Features, Methods, and Structures",
      "Alternative Investment Performance and Returns",
      "Investments in Private Capital: Equity and Debt",
      "Real Estate and Infrastructure",
      "Natural Resources",
      "Hedge Funds",
      "Introduction to Digital Assets",
    ],
  ],
  [
    "pc",
    [
      "Portfolio Risk and Return: Part I",
      "Portfolio Risk and Return: Part II",
      "Portfolio Management: An Overview",
      "Basics of Portfolio Planning and Construction",
      "The Behavioral Biases of Individuals",
      "Introduction to Risk Management",
    ],
  ],
  [
    "ethics",
    [
      "Ethics and Trust in the Investment Profession",
      "Code of Ethics and Standards of Professional Conduct",
      "Guidance for Standard I: Professionalism",
      "Guidance for Standard II: Integrity of Capital Markets",
      "Guidance for Standard III: Duties to Clients",
      "Guidance for Standard IV: Duties to Employers",
      "Guidance for Standard V: Investment Analysis, Recommendations, and Actions",
      "Guidance for Standard VI: Conflicts of Interest",
      "Guidance for Standard VII: Responsibilities as a CFA Institute Member or CFA Candidate",
      "Application of the Code and Standards: Level I",
    ],
  ],
];

export const MODULES: CurriculumModule[] = (() => {
  const out: CurriculumModule[] = [];
  let id = 1;
  for (const [topic, titles] of OUTLINE) {
    titles.forEach((title, i) => {
      out.push({ id: id++, topic, lm: i + 1, title });
    });
  }
  return out;
})();

export const MODULE_COUNT = MODULES.length;
export const TOPIC_IDS = TOPICS.map((t) => t.id);
export const DEFAULT_TOPIC_ORDER: TopicId[] = [...TOPIC_IDS];

const topicIndex = new Map(TOPICS.map((t) => [t.id, t]));
const moduleIndex = new Map(MODULES.map((m) => [m.id, m]));

export function weightMid(t: Topic): number {
  return (t.weightMin + t.weightMax) / 2;
}

export const TOTAL_WEIGHT_MID = TOPICS.reduce((a, t) => a + weightMid(t), 0);

export function getTopic(id: TopicId): Topic {
  const t = topicIndex.get(id);
  if (!t) throw new Error(`Unknown topic ${id}`);
  return t;
}

export function isTopicId(v: unknown): v is TopicId {
  return typeof v === "string" && topicIndex.has(v as TopicId);
}

export function getModule(id: number): CurriculumModule | undefined {
  return moduleIndex.get(id);
}

export function isModuleId(v: unknown): v is number {
  return typeof v === "number" && moduleIndex.has(v);
}

export function modulesOf(topic: TopicId): CurriculumModule[] {
  return MODULES.filter((m) => m.topic === topic);
}

export function moduleLabel(id: number): string {
  const m = moduleIndex.get(id);
  if (!m) return `Module ${id}`;
  return `${getTopic(m.topic).short} LM${m.lm}`;
}

/** Hours budget of a module before any override, split by exam weight and then evenly inside the topic. */
export function baseHours(moduleId: number, targetHours: number): number {
  const m = moduleIndex.get(moduleId);
  if (!m) return 0;
  const t = getTopic(m.topic);
  const n = modulesOf(m.topic).length;
  return (targetHours * weightMid(t)) / TOTAL_WEIGHT_MID / n;
}

export interface KeyDate {
  date: string;
  label: string;
  kind: "deadline" | "window";
}

// May 2027 window. The exact days inside the window depend on the test center.
export const KEY_DATES: KeyDate[] = [
  { date: "2026-10-14", label: "Early registration deadline for the May 2027 window", kind: "deadline" },
  { date: "2027-02-10", label: "Standard registration deadline for May 2027", kind: "deadline" },
  { date: "2027-02-16", label: "Scheduling deadline for May 2027", kind: "deadline" },
  { date: "2027-05-11", label: "May 2027 exam window opens", kind: "window" },
  { date: "2027-05-17", label: "May 2027 exam window closes", kind: "window" },
];

export const EXAM_WINDOW = { start: "2027-05-11", end: "2027-05-17" };
