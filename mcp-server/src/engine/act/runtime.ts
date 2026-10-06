// mcp-server/src/engine/act/runtime.ts
//
// What a session observes about its browser between and during actions:
// which tabs exist, what is on the wire, what has been downloaded, and the
// dialog that is open, if any. Fed by context-level events, so tabs the page
// opens by itself are covered like the first one.
import type { BrowserContext, Dialog, Page, Request } from 'playwright';
import type { SnapshotState } from '../snapshot/snapshot.js';

export interface SessionRuntime {
  // Open tabs, in the order they appeared.
  tabs: Page[];
  // Indexes (into `tabs` at the time) of tabs opened and closed; drained by
  // the action that observes them.
  opened: number[];
  closed: number[];
  downloads: string[];
  // How many times a page asked the user for a file.
  choosers: number;
  inflight: Map<Request, { url: string; at: number }>;
  // Requests started recently, newest last.
  recent: Array<{ url: string; at: number }>;
  // Main-frame navigations seen per tab, same-document ones included.
  navigations: WeakMap<Page, number>;
  dialog?: Dialog;
  dialogWaiters: Set<() => void>;
}

export function attachRuntime(
  context: BrowserContext,
  snapshot: SnapshotState,
): SessionRuntime {
  const runtime: SessionRuntime = {
    tabs: [],
    opened: [],
    closed: [],
    downloads: [],
    choosers: 0,
    inflight: new Map(),
    recent: [],
    navigations: new WeakMap(),
    dialogWaiters: new Set(),
  };

  context.on('page', (page) => {
    runtime.tabs.push(page);
    runtime.opened.push(runtime.tabs.length - 1);

    page.on('close', () => {
      const index = runtime.tabs.indexOf(page);
      if (index === -1) return;
      runtime.closed.push(index);
      runtime.tabs.splice(index, 1);
    });
    page.on('framenavigated', (frame) => {
      if (frame !== page.mainFrame()) return;
      runtime.navigations.set(page, (runtime.navigations.get(page) ?? 0) + 1);
    });
    page.on('download', (download) => {
      runtime.downloads.push(download.suggestedFilename());
      // The file itself is of no use here; do not leave it downloading.
      download.cancel().catch(() => {});
    });
    // A button that opens the file picker did what it is for, though
    // nothing in the page shows it: the sweep reported every "Choose a
    // file" as wired to nothing.
    page.on('filechooser', () => {
      runtime.choosers++;
    });
    // A JavaScript dialog freezes its page until it is answered. It is kept
    // open and reported rather than dismissed behind the tester's back,
    // which is what Playwright does when nobody listens.
    page.on('dialog', (dialog) => {
      runtime.dialog = dialog;
      snapshot.dialog = { type: dialog.type(), message: dialog.message() };
      for (const wake of runtime.dialogWaiters) wake();
      runtime.dialogWaiters.clear();
    });
  });

  context.on('request', (request) => {
    const entry = { url: request.url(), at: Date.now() };
    runtime.inflight.set(request, entry);
    runtime.recent.push(entry);
    if (runtime.recent.length > 50) runtime.recent.shift();
  });
  const done = (request: Request) => runtime.inflight.delete(request);
  context.on('requestfinished', done);
  context.on('requestfailed', done);

  return runtime;
}
