# Filing Service Issues & Findings

## Issue 1: "Sign in to your account" button click failing (FIXED)

**Status:** Fixed

**Problem:** All 3 selector approaches failed to click the sign-in button on the Tyler Technologies landing page.

**Root cause:** Two issues:
1. Text mismatch — code searched for "Sign **into** your account" but actual text is "Sign **in to** your account"
2. Element is `<forge-button>` (web component with shadow DOM), not a native `<button>` — so `button >>` and `text=` selectors couldn't reach it

**Actual HTML:**
```html
<forge-button id="sign-in" aria-label="Sign in to your account" role="button">
  #shadow-root (open)
    <span>Sign in to your account</span>
</forge-button>
```

**Fix:** Replaced 3-approach try/catch with `forge-button#sign-in` ID selector + `getByRole` fallback.

---

## Issue 2: Plaintiff name not overridden correctly (FIXED)

**Status:** Fixed

**Problem:** When sending a curl with `partyData.firstName: "Madeleine"`, `partyData.lastName: "Lee"`, the Tyler form sometimes showed "Irawati Puteri Lee" instead of "Madeleine Lee".

**Root cause:** The "I Am This Party" toggle auto-populated fields from the logged-in Tyler account profile (Irawati Puteri). The auto-fill could race with the `fill()` calls, sometimes overwriting the override values.

**Fix:** Removed the "I Am This Party" toggle entirely. The script always files on behalf of someone else, so the toggle is unnecessary and was causing the race condition.

---

## Issue 3: "Filings" button click ambiguity (FIXED)

**Status:** Fixed

**Problem:** After saving defendant details, clicking the "Filings" navigation button failed with strict mode violation — `getByRole('button', { name: /filings/i })` matched 2 elements: sidebar "My Filings" icon button and the bottom-right "Filings" nav button.

**Fix:** Replaced with `forge-button#parties-next` ID selector + `getByRole` with `exact: true` fallback.

---

## General Reliability Notes

- Global timeout is 5s (`timeout: 5000` in constructor) — intentionally kept low for fast local iteration
- The automation is ~1780 lines with many try/catch fallback chains for selectors
- Tyler Technologies uses Forge web components extensively (`forge-button`, `forge-select`, `forge-text-field`, `forge-option`) — standard Playwright selectors often can't pierce shadow DOM
- When fixing selectors, prefer: ID selectors > `forge-*` tag selectors > `getByRole` with aria-label > text selectors
