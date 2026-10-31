---
name: web-browser-testing
description: Use when verifying a visible apps/web change (page, component, form, route, theme, i18n) in a real browser, or when asked to test, screenshot or reproduce a frontend bug in apps/web.
---

# Test apps/web in the browser

## Overview
apps/web has no automated test runner; UI changes are verified by driving the running app in a browser
and reporting evidence (snapshots, screenshots, console output). Static checks do not replace this.

## 1. Start the stack
| Service | Command (from repo root) | Ready when |
|---|---|---|
| Postgres | `cd apps/infrastructure && make up-postgres -- --development` (skip if `docker ps` shows it healthy) | healthy |
| Daemon | `pnpm --filter daemon dev` | `curl -s http://127.0.0.1:3005/api/v1/health` answers |
| Web | `pnpm --filter web dev` | `curl -sI http://localhost:3000` returns 200 |

Run dev servers in the background (background shell or a sibling Herdr pane), not in the foreground of your
own terminal. Reuse servers that are already running; check the ports first. Web proxies `/api` to the daemon
via `API_PROXY_TARGET` in `apps/web/.env.development`.

## 2. Drive the browser
Use whichever browser tool the harness provides: Playwright MCP (`browser_navigate`, `browser_snapshot`,
`browser_click`, `browser_fill_form`, `browser_resize`, `browser_console_messages`, `browser_take_screenshot`)
or Claude in Chrome. Prefer accessibility snapshots for assertions; screenshots for visual evidence.
Never trigger native `alert/confirm` dialogs; uikit `UIUtils.alert` modals are fine.

## 3. Test matrix (only what the change touches)
- Viewport: desktop `1440x900` and mobile `390x844`; sidebar collapsed/expanded; long text truncates.
- Theme: light and dark (header theme toggle); contrast and focus rings visible.
- Language: `vi` and `en` (header language switch); no raw i18n keys like `ticket.title` on screen.
- States: loading, error (stop the daemon or use an unknown id), empty, populated.
- Interaction: the changed flow end-to-end, keyboard (Tab/Enter/Esc) for forms and dialogs, submit
  locks while pending and keeps input on error.
- Console: `browser_console_messages` has no new errors or React warnings; failed network requests are explained.

## 4. Report
List each checked item with pass/fail and the evidence (snapshot excerpt, screenshot path, console line).
Report failures as found; do not claim "works" for states you did not open.

## Common mistakes
- Testing only `/` after changing a nested route — navigate to the changed URL (e.g. `/tickets`, `/workspaces/...`).
- Treating a blank page as a pass — check the console; a missing daemon shows as an error state.
- Restarting servers another pane owns — reuse them.
