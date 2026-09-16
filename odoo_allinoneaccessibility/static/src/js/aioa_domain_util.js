/** @odoo-module **/

// Skynet's backend keys a registered site by "https://" + hostname, with no
// port — this mirrors the exact fix documented in Skynet's own Django
// reference plugin (admin.py save_model()): "request.scheme can be http on
// local/dev setups, which produced a domain_url that didn't match the
// registered record, so the settings sync silently updated nothing."
//
// window.location.origin includes whatever scheme/port the browser actually
// loaded over (e.g. "http://example.com:8074" on a dev box), so using it
// directly for the add-user-domain / widget-setting-update-platform payloads
// can register/sync under a key that never matches what the widget's own
// domain-based settings lookup queries for later — symptoms: a "successful"
// sync that has no visible effect, or a widget script that keeps falling
// back to stale/default icon type & size instead of what was just saved.
//
// getAioaCanonicalDomain() is ONLY for the payloads sent to Skynet's API.
// Local bookkeeping (localStorage dedupe keys, etc.) can keep using
// window.location.origin as-is — that only needs to be internally
// consistent per-browser, not match Skynet's server-side key format.
export function getAioaCanonicalDomain() {
    return "https://" + window.location.hostname;
}
