# Getting Started with Pulse — Reviewer Guide

This guide gets you from "I have a link to a folder" to running your first review cycle in Pulse. It covers three things: getting the app running on your machine, picking the Reviewer role, and starting a review.

Pulse is a local app — there's no server to log into and no account to create. Everything lives in a shared folder your team already has set up (iCloud Drive, OneDrive, a network share, etc.), and the app itself runs entirely in your browser.

## What you'll need

- **Chrome or Edge.** Pulse's folder-sync feature (how everyone sees the same data) only works in these two browsers. Safari and Firefox can open the app, but can't link to the shared folder.
- **Access to the Pulse folder** your team is already using — either the shared/synced folder itself (if you're on the same iCloud Drive/OneDrive/network share), or a copy of the whole `Pulse` app folder to run locally.
- **A password**, only if your Admin has protected the Reviewer role with one. If you don't know whether that applies to you, just try picking the role — Pulse will ask if one's needed.

## Step 1: Get Pulse running on your machine

Pulse is a single app folder — you need the whole thing, not just one file. Put it anywhere on your own machine — your Desktop or Documents folder is fine.

Open the folder and double-click **`pulse.html`**. It opens straight in your browser — that's it, nothing to install.

Once it opens, you should see Pulse's dashboard — but before anything shows up, there are two setup screens to get through first (below).

## Step 2: Choose the Reviewer role

The very first time Pulse opens on a machine, it shows a role picker before anything else. This isn't a login — it's a soft, on-device switch that decides what you can edit (it doesn't add real security, since anyone with access to the file can see everything regardless of role — think of it as a workflow safety rail, not a lock).

1. In the tile grid, click **Reviewer**.
2. If your Admin has set a password for the Reviewer role, you'll see a small padlock on that tile and be asked to enter it. If you don't have it, ask your Admin.
3. Click **Done**.

You can switch roles again any time later from the shield icon in the top-right of the toolbar — no need to reopen the app.

Right after that (or right after this, the first time), Pulse will ask you to **link a folder** — this step is mandatory for every role, including Reviewer, since it's how your changes get saved and shared with everyone else. Choose **"Choose a folder"** and pick the *same* shared/synced folder your team is already using for this programme (not a new empty one — unless you're deliberately the first person setting this programme up). Picking the wrong folder here is the most common way to end up looking at an empty or unfamiliar board, so double-check with your team if you're not sure which folder is the right one.

## Step 3: Start a review cycle

1. In the left sidebar, click the **workstream** you want to review (not "All Workstreams" — a review is always scoped to one workstream at a time).
2. Click **Review** in the top navigation bar.
3. Make sure you're on the first sub-tab (it's labeled **Review**, or **Review Status** if you're on "All Workstreams" — go back and pick a real workstream if you see that).
4. Click **Start review cycle**.

That opens the live checklist: every scope item in that workstream, with its milestones listed underneath. For each one:

- Click the small circle on a milestone's row (or an item's own row, if it has no milestones) to **confirm** it. Confirming an item with several milestones confirms all of them at once — click again to un-confirm.
- Anything already marked Complete is automatically treated as confirmed — no need to click through work that's already finished.
- Click the chevron on an item's row to expand it and see its milestones — Due date, Actual date, and Status, one row per milestone.
  - Click a milestone's **Status** badge to cycle it (Not Started → On Track → At Risk → Off Track → Completed) — a quick way to correct it without opening the full item.
  - Click a milestone's **Due** date to edit it directly, or the small **+** under **Actual** to record when it actually happened. Both are only editable here, from Review mode — that's specific to the Reviewer role.
- This is useful for fixing something as you go, without having to switch back to Planning.

Once every item is confirmed, the **Complete review** button lights up — click it to close out the cycle. If you started a review by mistake, **Cancel review** removes it entirely (no history kept, so use Complete instead if there's anything worth recording).

Optional: once you've wrapped up, you can attach meeting minutes to the cycle from its History row (the small document icon) — paste in notes from your review meeting and Pulse will try to auto-split them into a summary, decisions, next steps, and action items.

## A few other things worth knowing

- Every workstream in the sidebar shows a small badge: amber **"In review"** while a cycle's active, red **"Overdue"** if it's gone stale (or was never reviewed). That's your at-a-glance cue for what needs attention.
- Review mode has its own sub-tabs beyond the checklist: **Action Log**, **Decision Log**, and **Change Log** — running logs of what got tracked and changed across every review cycle for that workstream (or across all of them, if you're on "All Workstreams").
- As a Reviewer, you can't restructure the plan itself — adding/removing workstreams, scope items, or milestones is one tier up (Editor). If something needs restructuring rather than correcting, flag it to whoever holds that role.

## Troubleshooting

- **"I don't have the Reviewer password."** Ask whoever set it up (your Admin) — Pulse can't recover or bypass it for you.
- **The board looks empty or wrong after I linked a folder.** You most likely linked a different folder than the one your team is actually using. Reopen the folder-sync indicator in the topbar, unlink, and relink to the correct shared folder.
- **I don't see a "Link folder" option working at all.** Make sure you're using Chrome or Edge — this feature isn't available in Safari or Firefox.
