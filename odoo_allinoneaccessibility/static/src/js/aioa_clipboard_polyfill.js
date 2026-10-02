/** @odoo-module **/

// DEV-ONLY WORKAROUND for an Odoo 20 (alpha) core bug.
//
// Over plain http:// on any hostname other than "localhost", browsers do not
// expose `navigator.clipboard` (it is a secure-context-only API). Odoo's own
// `@web_tour/tour_helpers/tour_helpers_clipboard` reads
// `window.navigator.clipboard.writeText` at load time with no guard, so the
// lazy-loaded tour bundle crashes and the whole client shows:
//   "Cannot destructure property 'TourInteractive' of
//    'odoo.loader.modules.get(...)' as it is undefined"
//
// This installs a harmless stub ONLY when the real API is missing, so the tour
// bundle can load. Copy-to-clipboard still won't work on an insecure page.
// Not needed (and never active) on https:// or http://localhost. Safe to
// delete once the site is served over HTTPS.
if (typeof window !== "undefined" && window.navigator && !window.navigator.clipboard) {
    try {
        Object.defineProperty(window.navigator, "clipboard", {
            configurable: true,
            value: {
                writeText: () => Promise.resolve(),
                readText: () => Promise.resolve(""),
                write: () => Promise.resolve(),
                read: () => Promise.resolve([]),
            },
        });
    } catch (err) {
        console.warn("AIOA: could not install clipboard stub", err);
    }
}
