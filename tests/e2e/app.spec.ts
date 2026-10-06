import { expect, test, type Page } from "@playwright/test";

// Demo mode with the date pinned, so the seeded data looks the same on every run.
const TODAY = "2026-10-05";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((today) => {
    if (!sessionStorage.getItem("e2e-ready")) {
      localStorage.clear();
      sessionStorage.setItem("e2e-ready", "1");
    }
    localStorage.setItem("prep27-today", today);
  }, TODAY);
});

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

async function openApp(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.getByText("Demo with sample data")).toBeVisible();
}

test("login page offers the demo and opens Today", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "A study system for the May 2027 Level I exam." })).toBeVisible();
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  await expect(page.getByText("Week 8 of 39")).toBeVisible();
  expect(errors).toEqual([]);
});

test("today: plan, reviews and mistake re-checks work", async ({ page }) => {
  await openApp(page);
  const plan = page.locator("section", { has: page.getByRole("heading", { name: "Plan for today" }) });
  await expect(plan.getByText("Working Capital and Liquidity")).toBeVisible();

  const due = page.locator("section", { has: page.getByRole("heading", { name: /Due now/ }) });
  const reviewed = due.getByRole("button", { name: "Reviewed" });
  const before = await reviewed.count();
  await reviewed.first().click();
  await expect(page.getByText("Review logged")).toBeVisible();
  await expect(reviewed).toHaveCount(before - 1);

  const gotIt = due.getByRole("button", { name: "Got it" });
  const mistakesBefore = await gotIt.count();
  await gotIt.first().click();
  await expect(page.getByText(/Clean check|Resolved/)).toBeVisible();
  await expect(gotIt).toHaveCount(mistakesBefore - 1);
});

test("logging time updates today's progress and survives a reload", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Log time" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Log study time" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "45", exact: true }).click();
  await dialog.getByRole("button", { name: "Log time" }).click();
  await expect(page.getByText("Logged 45 min")).toBeVisible();
  await expect(page.getByText("45 min logged of about 2 h planned")).toBeVisible();
  await page.reload();
  await expect(page.getByText("45 min logged of about 2 h planned")).toBeVisible();
});

test("lab: answer a question, read the explanation, log a miss", async ({ page }) => {
  await openApp(page, "/lab");
  await expect(page.getByRole("heading", { name: "Question Lab" })).toBeVisible();
  const waitingTab = page.getByRole("radio", { name: /Waiting \(9\)/ });
  await expect(waitingTab).toBeVisible();

  const fv = page.getByRole("article").filter({ hasText: "compounded quarterly" });
  await fv.getByRole("radio", { name: /\$13,469/ }).click();
  await fv.getByRole("radio", { name: "Sure", exact: true }).click();
  await fv.getByRole("button", { name: "Check answer" }).click();
  await expect(fv.getByText("Correct", { exact: true })).toBeVisible();
  await expect(fv.getByText(/1\.015\^20/)).toBeVisible();
  await expect(page.getByRole("radio", { name: /Waiting \(8\)/ })).toBeVisible();

  const port = page.getByRole("article").filter({ hasText: "portfolio standard deviation" });
  await port.getByRole("radio", { name: /16\.0%/ }).click();
  await port.getByRole("button", { name: "Check answer" }).click();
  await expect(port.getByText("Not quite. The answer is B.")).toBeVisible();
  await port.getByRole("button", { name: "Log as mistake" }).click();
  const dialog = page.getByRole("dialog", { name: "Log as mistake" });
  await expect(dialog.getByRole("textbox", { name: "What went wrong" })).toHaveValue(/Picked C, the answer was B/);
  await dialog.getByRole("radio", { name: "Formula" }).click();
  await dialog.getByRole("button", { name: "Save mistake" }).click();
  await expect(port.getByText("In your mistake bank")).toBeVisible();
});

test("lab: queue a request", async ({ page }) => {
  await openApp(page, "/lab");
  const form = page.locator("section", { has: page.getByRole("heading", { name: /Ask for questions/ }) });
  await form.getByRole("combobox", { name: "Topic" }).selectOption("fsa");
  await form.getByRole("radio", { name: "Hard" }).click();
  await form.getByRole("button", { name: "Queue request" }).click();
  await expect(page.getByText("Queued for the next AI run")).toBeVisible();
  const requests = page.locator("section", { has: page.getByRole("heading", { name: "Requests" }) });
  await expect(requests.getByText("Financial Statement Analysis")).toBeVisible();
  await expect(requests.getByText("2 requests queued")).toBeVisible();
});

test("mistake bank: patterns show and a new mistake can be logged", async ({ page }) => {
  await openApp(page, "/mistakes");
  await expect(page.getByText("You were sure on 4 misses").first()).toBeVisible();
  await expect(page.getByText("Cross rates and parity, the same slip three times")).toBeVisible();
  await page.getByRole("button", { name: "Log mistake" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Log a mistake" });
  await dialog.getByRole("combobox").first().selectOption("32");
  await dialog.getByRole("textbox", { name: "What went wrong" }).fill("Flipped the effect of LIFO on ending inventory");
  await dialog.getByRole("textbox", { name: "The rule to remember" }).fill("Rising prices, LIFO leaves old cheap costs in inventory");
  await dialog.getByRole("radio", { name: "Concept gap" }).click();
  await dialog.getByRole("button", { name: "Save mistake" }).click();
  await expect(page.getByText("Saved. First re-check in 3 days.")).toBeVisible();
  await page.getByRole("radio", { name: "Open" }).click();
  await expect(page.getByText("Flipped the effect of LIFO on ending inventory")).toBeVisible();
});

test("module page: mark done schedules reviews and updates the map", async ({ page }) => {
  await openApp(page, "/modules/23");
  await expect(page.getByRole("heading", { name: "Working Capital and Liquidity" })).toBeVisible();
  await page.getByRole("radiogroup", { name: "Status" }).getByRole("radio", { name: "Done" }).click();
  await expect(page.getByText("Marked done. First review tomorrow.")).toBeVisible();
  await expect(page.getByText("due Oct 6")).toBeVisible();
  await page.getByRole("radiogroup", { name: "Confidence" }).getByRole("radio", { name: "High" }).click();
  await expect(page.getByText("Confidence (high)")).toBeVisible();

  await page.getByRole("link", { name: "Knowledge Map" }).first().click();
  await expect(page.getByRole("heading", { name: "Knowledge map" })).toBeVisible();
  await expect(page.locator('g[role="link"]')).toHaveCount(102);
  await page.getByRole("link", { name: /Corp LM4, Working Capital and Liquidity/ }).click();
  await expect(page).toHaveURL(/\/modules\/23$/);
});

test("plan reacts to capacity and fewer weekly hours", async ({ page }) => {
  await openApp(page, "/plan");
  await expect(page.getByRole("heading", { name: "Ahead of plan" })).toBeVisible();
  const capacity = page.locator("#capacity");
  await capacity.getByRole("listitem").filter({ hasText: "Summer break" }).getByRole("button", { name: "Remove capacity change" }).click();
  await expect(capacity.getByText("Summer break")).toHaveCount(0);
  const hours = page.getByRole("spinbutton", { name: "Hours a week" }).first();
  await hours.fill("6");
  await hours.press("Enter");
  await expect(page.getByRole("heading", { name: "The content needs more hours than you scheduled" })).toBeVisible();
  await expect(page.getByText(/you need about \d+(\.\d)? h a week instead of 6/)).toBeVisible();
});

test("settings: exam day and backup download", async ({ page }) => {
  await openApp(page, "/settings");
  await page.getByRole("button", { name: "Thu, May 13" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();
  await expect(page.getByText("May 13, 2027").first()).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Backup \(JSON\)/ }).click();
  expect((await download).suggestedFilename()).toBe(`prep27-backup-${TODAY}.json`);
});

test("every page renders without console errors", async ({ page }) => {
  const errors = collectErrors(page);
  for (const path of ["/", "/plan", "/modules", "/modules/1", "/lab", "/mistakes", "/map", "/dashboard", "/settings"]) {
    await page.goto(path);
    await expect(page.locator("main h1").first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("mobile tab bar navigates @mobile", async ({ page }) => {
  await openApp(page);
  const tabs = page.getByRole("navigation", { name: "Quick" });
  await tabs.getByRole("link", { name: /Lab/ }).click();
  await expect(page.getByRole("heading", { name: "Question Lab" })).toBeVisible();
  await tabs.getByRole("button", { name: "More" }).click();
  await page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Knowledge Map" }).click();
  await expect(page.getByRole("heading", { name: "Knowledge map" })).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()!.width);
});
