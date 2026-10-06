// Sample Lab questions for the demo. Written for this project and verified: every numeric key was
// recomputed in Python and every distractor checked against the mistake it encodes.

import type { Difficulty, Letter, QuestionOrigin, Verification } from "../types";

export interface DemoQuestion {
  key: string;
  moduleId: number;
  difficulty: Difficulty;
  origin: QuestionOrigin;
  stem: string;
  options: Record<Letter, string>;
  answer: Letter;
  explanation: string;
  verification: Verification;
}

export const DEMO_QUESTIONS: DemoQuestion[] = [
  {
    key: "hpr",
    moduleId: 1,
    difficulty: 1,
    origin: "starter",
    stem: "A stock is bought for $40.00, pays a $1.20 dividend and is sold one year later for $43.00. The holding period return is closest to",
    options: { A: "7.5%", B: "9.8%", C: "10.5%" },
    answer: "C",
    explanation:
      "(43.00 − 40.00 + 1.20) / 40.00 = 10.5%. A ignores the dividend and B divides by the ending price instead of the purchase price.",
    verification: "python",
  },
  {
    key: "cv",
    moduleId: 5,
    difficulty: 1,
    origin: "weak",
    stem: "An asset has a mean monthly return of 0.8% and a standard deviation of monthly returns of 2.4%. Its coefficient of variation is closest to",
    options: { A: "0.33", B: "3.00", C: "7.20" },
    answer: "B",
    explanation:
      "CV = standard deviation / mean = 2.4 / 0.8 = 3.0. A inverts the ratio and C puts the variance, 2.4 squared, in the numerator.",
    verification: "python",
  },
  {
    key: "geo",
    moduleId: 2,
    difficulty: 2,
    origin: "mistake",
    stem: "A fund returned 20% in year one and −10% in year two. Its geometric mean annual return is closest to",
    options: { A: "3.9%", B: "5.0%", C: "8.0%" },
    answer: "A",
    explanation:
      "√(1.20 × 0.90) − 1 = √1.08 − 1 = 3.92%. B is the arithmetic mean and C is the two year holding period return, not annualized.",
    verification: "python",
  },
  {
    key: "perfcomp",
    moduleId: 12,
    difficulty: 1,
    origin: "starter",
    stem: "In the long run, a firm in a perfectly competitive market most likely earns",
    options: { A: "zero economic profit.", B: "positive economic profit.", C: "zero accounting profit." },
    answer: "A",
    explanation:
      "Free entry and exit push price to the minimum of average total cost, so economic profit is zero. Accounting profit stays positive because it ignores the opportunity cost of capital.",
    verification: "blind",
  },
  {
    key: "r2",
    moduleId: 10,
    difficulty: 1,
    origin: "weak",
    stem: "A simple linear regression has a positive estimated slope and a coefficient of determination of 0.64. The sample correlation between the two variables is closest to",
    options: { A: "0.41", B: "0.64", C: "0.80" },
    answer: "C",
    explanation:
      "In a simple regression R² is the squared correlation, so r = √0.64 = 0.80, positive like the slope. A squares R² again and B confuses R² with r.",
    verification: "python",
  },
  {
    key: "alpha",
    moduleId: 7,
    difficulty: 2,
    origin: "mistake",
    stem: "Holding the sample size constant, lowering the significance level of a hypothesis test from 5% to 1% will most likely",
    options: {
      A: "increase the probability of a Type II error.",
      B: "increase the power of the test.",
      C: "increase the probability of a Type I error.",
    },
    answer: "A",
    explanation:
      "A smaller significance level rejects a true null less often, so Type I errors fall. The test then fails to reject false nulls more often, so Type II errors rise and power, one minus that probability, falls.",
    verification: "blind",
  },
  {
    key: "fvq",
    moduleId: 4,
    difficulty: 1,
    origin: "weak",
    stem: "An investor deposits $10,000 today in an account that pays a stated annual rate of 6% compounded quarterly. The account value after 5 years is closest to",
    options: { A: "$13,382", B: "$13,469", C: "$13,499" },
    answer: "B",
    explanation:
      "The periodic rate is 1.5% for 20 quarters, so FV = 10,000 × 1.015^20 = 13,468.55. A compounds annually and C compounds continuously.",
    verification: "python",
  },
  {
    key: "port",
    moduleId: 8,
    difficulty: 2,
    origin: "mistake",
    stem: "A portfolio holds 60% in asset X, with a standard deviation of 20%, and 40% in asset Y, with a standard deviation of 10%. The correlation between X and Y is 0.5. The portfolio standard deviation is closest to",
    options: { A: "12.6%", B: "14.4%", C: "16.0%" },
    answer: "B",
    explanation:
      "Variance = 0.6²(0.20)² + 0.4²(0.10)² + 2(0.6)(0.4)(0.5)(0.20)(0.10) = 0.0208, so σ = 14.4%. A drops the covariance term and C is the weighted average of the standard deviations, true only with perfect correlation.",
    verification: "python",
  },
  {
    key: "cross",
    moduleId: 19,
    difficulty: 2,
    origin: "mistake",
    stem: "The USD/EUR spot rate is 1.0800 (US dollars per euro) and the JPY/USD spot rate is 150.00 (yen per US dollar). The JPY/EUR cross rate is closest to",
    options: { A: "138.89", B: "162.00", C: "0.0062" },
    answer: "B",
    explanation:
      "JPY/EUR = JPY/USD × USD/EUR = 150.00 × 1.0800 = 162.00, the dollar cancels. A divides instead of multiplying and C is the inverse quote, euros per yen.",
    verification: "python",
  },
  {
    key: "omo",
    moduleId: 15,
    difficulty: 1,
    origin: "request",
    stem: "A central bank that wants to tighten monetary policy through open market operations would most likely",
    options: {
      A: "buy government bonds from commercial banks.",
      B: "sell government bonds to commercial banks.",
      C: "lower the interest rate it pays on bank reserves.",
    },
    answer: "B",
    explanation:
      "Selling bonds drains reserves from the banking system and pushes short term rates up. Buying bonds adds reserves and eases policy, and paying less on reserves also eases.",
    verification: "blind",
  },
  {
    key: "lifo",
    moduleId: 32,
    difficulty: 2,
    origin: "starter",
    stem: "In a period of rising prices and stable inventory quantities, compared with FIFO, a company using LIFO under US GAAP will most likely report",
    options: { A: "a higher gross margin.", B: "a lower ending inventory balance.", C: "a higher net income." },
    answer: "B",
    explanation:
      "With rising prices LIFO sends the newest, most expensive costs to COGS. COGS goes up, so gross margin and net income go down, while the older, cheaper costs stay in ending inventory, which is lower.",
    verification: "blind",
  },
  {
    key: "bond",
    moduleId: 56,
    difficulty: 2,
    origin: "starter",
    stem: "A 5-year bond with an 8% annual coupon is priced at par. If its yield to maturity rises to 9%, its price per 100 of par value is closest to",
    options: { A: "96.11", B: "96.04", C: "104.10" },
    answer: "A",
    explanation:
      "Discount five coupons of 8 and the 100 principal at 9%, which gives 8 × 3.8897 + 64.9931 = 96.11. B discounts semiannually and C is the price at a 7% yield.",
    verification: "python",
  },
  {
    key: "plag",
    moduleId: 95,
    difficulty: 1,
    origin: "starter",
    stem: "An analyst copies the conclusions of a competitor's research report into her own report without citing the source. She most likely violated the Standard relating to",
    options: { A: "misconduct.", B: "misrepresentation.", C: "independence and objectivity." },
    answer: "B",
    explanation: "Presenting someone else's work as your own is plagiarism, which falls under Standard I(C) Misrepresentation.",
    verification: "blind",
  },
  {
    key: "fwd",
    moduleId: 74,
    difficulty: 1,
    origin: "starter",
    stem: "A non-dividend-paying stock trades at 50. With a 1-year risk-free rate of 4% (annual compounding), the no-arbitrage price of a 1-year forward contract on the stock is closest to",
    options: { A: "52.00", B: "48.08", C: "52.04" },
    answer: "A",
    explanation: "F = S0 × (1 + r)^T = 50 × 1.04 = 52.00. B discounts instead of compounding and C uses continuous compounding.",
    verification: "python",
  },
  {
    key: "ddm",
    moduleId: 44,
    difficulty: 2,
    origin: "starter",
    stem: "A company just paid a dividend of $2.00. Dividends are expected to grow at 5% a year indefinitely and the required return is 9%. The intrinsic value per share is closest to",
    options: { A: "$50.00", B: "$52.50", C: "$23.33" },
    answer: "B",
    explanation: "V0 = D1 / (r − g) = 2.10 / 0.04 = 52.50. A uses D0 instead of D1 and C ignores growth.",
    verification: "python",
  },
];
