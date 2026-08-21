# Playwright Testing & Step Latency Optimization Rule

## Core Requirement
Playwright tests and automated browser verification flows must execute snappily and deterministically without artificial or arbitrary delays between steps. Tests must rely on Playwright's built-in auto-waiting mechanisms and web-first assertions rather than manual sleep/timeouts.

## Rules

1. **Strictly Forbid Arbitrary Sleep / Timeouts**:
   - NEVER use `page.waitForTimeout(ms)`, `setTimeout`, or arbitrary sleep calls between steps.
   - Do NOT insert artificial pauses to wait for UI rendering, animations, or API responses.

2. **Rely on Playwright Auto-Waiting**:
   - Playwright action methods (`click`, `fill`, `check`, `selectOption`, `press`, etc.) automatically wait for target elements to be attached, visible, stable, enabled, and editable.
   - Directly invoke actions on user-facing locators without preceding manual wait calls.

3. **Use Web-First Assertions**:
   - Always use async web-first assertions from `expect`:
     - `await expect(locator).toBeVisible()`
     - `await expect(locator).toBeHidden()`
     - `await expect(locator).toHaveText(...)`
     - `await expect(page).toHaveURL(...)`
   - Web-first assertions automatically retry until the expectation is met or timeout is reached, eliminating the need for pre-assertion delays.

4. **Event-Driven & State-Based Synchronization**:
   - When waiting for backend operations, data fetching, or page transitions:
     - Wait for specific network responses using `page.waitForResponse()` or `page.waitForRequest()`.
     - Wait for loading indicators to disappear: `await expect(page.getByTestId("loading-spinner")).toBeHidden()`.
     - Wait for URL changes: `await expect(page).toHaveURL(...)`.

5. **Tune Timeouts for Fast Failure**:
   - Set concise action timeouts (e.g. 5,000ms - 10,000ms) rather than default 30s hangs.
   - Configure global expectation and action timeouts in `playwright.config.ts` so broken selectors fail quickly instead of stalling the test run.

6. **Keep `slowMo` at 0 for Automated Runs**:
   - Never commit or enable `slowMo` in test configurations or CI pipelines. `slowMo` is strictly for manual visual debugging.

7. **Fast Locator Strategy**:
   - Prefer role-based and accessible locators (`page.getByRole()`, `page.getByLabel()`, `page.getByPlaceholder()`, `page.getByTestId()`).
   - Avoid slow or brittle XPath queries and deep hierarchical CSS selectors.
