// Loaded by every gauntlet page (and every frame). Keeps the page's ground
// truth on window.__gauntlet so a test can check what really happened,
// independently of what the tool under test reports.
(() => {
  const roots = [document];
  const WIRED = ['click', 'dblclick', 'contextmenu', 'change', 'input'];

  const G = {
    // { type, id, detail, t } in the order things happened.
    events: [],
    // Free-form per-page state (uploads, list order, slider value, ...).
    state: {},

    record(type, id, detail) {
      G.events.push({
        type,
        id,
        detail: detail === undefined ? null : detail,
        t: Math.round(performance.now()),
      });
    },

    // Every element a user can act on carries data-g="<unique id>". Closed
    // shadow roots are invisible to document.querySelectorAll, so components
    // hand their root over here.
    registerRoot(root) {
      roots.push(root);
      wire(root);
    },
    elements() {
      return roots.flatMap((root) => [...root.querySelectorAll('[data-g]')]);
    },
    ids() {
      return G.elements().map((el) => el.getAttribute('data-g'));
    },
    find(id) {
      return (
        G.elements().find((el) => el.getAttribute('data-g') === id) || null
      );
    },

    count(type, id) {
      return G.events.filter(
        (e) => e.type === type && (id === undefined || e.id === id),
      ).length;
    },
    of(type) {
      return G.events.filter((e) => e.type === type);
    },
    reset() {
      G.events.length = 0;
    },
  };

  // Records the event against the element that actually received it. A click
  // that lands on an overlay is recorded under the overlay, never under the
  // element it covers.
  function wire(root) {
    for (const type of WIRED) {
      root.addEventListener(
        type,
        (event) => {
          const path = event.composedPath();
          const target = path.find(
            (node) => node.getAttribute && node.hasAttribute('data-g'),
          );
          if (!target) return;
          // An event crossing a shadow boundary reaches the document too;
          // record it once, at the innermost root that owns the target.
          if (target.getRootNode() !== root) return;
          const detail =
            type === 'input' || type === 'change'
              ? target.type === 'checkbox' || target.type === 'radio'
                ? target.checked
                : target.type === 'password'
                  ? '(password)'
                  : target.value
              : type === 'click'
                ? {
                    button: event.button,
                    ctrl: event.ctrlKey,
                    meta: event.metaKey,
                    shift: event.shiftKey,
                    trusted: event.isTrusted,
                  }
                : null;
          G.record(type, target.getAttribute('data-g'), detail);
        },
        true,
      );
    }
  }

  wire(document);
  window.__gauntlet = G;
})();
