/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component, onWillStart, xml } from "@odoo/owl";

// Fires when the AIOA Settings form is opened in the backend. Does NOT run
// on frontend/website pages.
//
// Ported from the Django reference plugin's registration.py
// (register_domain_on_install): no license key/token anywhere — Skynet
// identifies the site purely by the "website" domain in the payload.
//
// Observed in practice: once a domain is already registered on Skynet's
// side, calling add-user-domain again for it returns a bare 500 with no
// body and no CORS headers (confirmed against widget-setting-update-platform
// succeeding cleanly from the same origin/host in the same session — so
// this isn't a general CORS problem, it's this endpoint not handling an
// already-registered domain gracefully). That failure is expected/benign
// for a domain that's already registered, not a real error to alarm on.
//
// So: use localStorage (persists across browser sessions, unlike
// sessionStorage) as the "already registered" flag, set only on a clean
// HTTP 200 as before. On failure, allow a small number of retries across
// separate page loads (covers transient failures / a genuinely new domain
// hitting a blip) and then stop trying and go quiet — there's no server-side
// flag file this install path can check, so this is the least-noisy
// approximation of "attempt once, don't hammer a known-duplicate".
const ADD_USER_DOMAIN_URL = "https://ada.skynettechnologies.us/api/add-user-domain";
const MAX_REGISTER_ATTEMPTS = 3;

export class AioaRegisterDomain extends Component {
    static template = xml`<div class="d-none"/>`;
    static props = { ...Component.props };

    setup() {
        onWillStart(() => this.registerDomain());
    }

    async detectNonEu() {
        // Same IP-geolocation approach as the Django plugin's _detect_eu():
        // default to non-EU (1) unless detection explicitly says EU.
        try {
            const resp = await fetch("https://ipapi.co/json/");
            if (resp.ok) {
                const data = await resp.json();
                return data.in_eu ? 0 : 1;
            }
        } catch (err) {
            console.warn("AIOA: EU detection failed, defaulting to non-EU", err);
        }
        return 1;
    }

    async registerDomain() {
        const domain = window.location.origin;
        const hostname = window.location.hostname;
        // "_v2" keys: the payload format changed (base64-encoded website +
        // full field set, see below) — versioning the storage keys means
        // any attempt counts/failures recorded against the old, incorrectly
        // -formatted payload don't count against this corrected one.
        const registeredKey = `aioa_domain_registered_v2_${domain}`;
        const attemptsKey = `aioa_domain_register_attempts_v2_${domain}`;

        if (["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname)) {
            return; // Dev/local instance — nothing to register
        }

        // Guard: already confirmed registered (any past session) — don't
        // ever call again.
        if (localStorage.getItem(registeredKey)) {
            return;
        }

        // Guard: give up quietly after a few failed attempts across
        // separate page loads, instead of retrying forever on every visit.
        const attempts = parseInt(localStorage.getItem(attemptsKey) || "0", 10);
        if (attempts >= MAX_REGISTER_ATTEMPTS) {
            return;
        }

        const noRequiredEu = await this.detectNonEu();

        // Payload ported field-for-field from the Django reference plugin's
        // registration.py. Two differences from the previous version that
        // are the likely actual cause of the 500s:
        //   1. "website" must be base64-encoded (Django: base64.b64encode(
        //      domain_url.encode()).decode()) — this build was sending the
        //      raw URL string instead. If Skynet's backend unconditionally
        //      base64-decodes this field, a plain URL string can throw
        //      server-side before the response is wrapped, which matches
        //      the empty-body/no-CORS-header 500s seen in the console.
        //   2. Django always sends ~12 additional fields (blank/defaulted)
        //      that this build omitted entirely — if the backend indexes
        //      into the payload without a default for any of them, a
        //      missing key is another plausible crash source.
        const payload = new URLSearchParams({
            name: hostname,
            email: `no-reply@${hostname}`,
            company_name: "",
            website: btoa(domain),
            package_type: "basic",
            start_date: new Date().toISOString(),
            end_date: "",
            price: "",
            discount_price: "0",
            platform: "Odoo",
            api_key: "",
            is_trial_period: "",
            is_free_widget: "1",
            bill_address: "",
            country: "",
            state: "",
            city: "",
            post_code: "",
            transaction_id: "",
            subscr_id: "",
            payment_source: "",
            no_required_eu: String(noRequiredEu),
        });

        try {
            const response = await fetch(ADD_USER_DOMAIN_URL, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: payload.toString(),
            });
            if (response.ok) {
                localStorage.setItem(registeredKey, "1");
                localStorage.removeItem(attemptsKey);
            } else {
                localStorage.setItem(attemptsKey, String(attempts + 1));
                // Most likely cause once a domain already exists on
                // Skynet's side: this endpoint 500s on duplicate
                // registration rather than returning it should. Not
                // fatal — the widget itself is unaffected — so this
                // stays at warn rather than error, and stops retrying
                // after MAX_REGISTER_ATTEMPTS.
                console.warn(
                    "AIOA: add-user-domain responded",
                    response.status,
                    `(attempt ${attempts + 1}/${MAX_REGISTER_ATTEMPTS})`
                );
            }
        } catch (err) {
            localStorage.setItem(attemptsKey, String(attempts + 1));
            // Most likely cause: the API doesn't send CORS headers back
            // to this origin on its error path. Not fatal — the widget
            // itself is unaffected. Check the Network tab if this needs
            // investigating further.
            console.warn(
                "AIOA: add-user-domain call failed",
                err,
                `(attempt ${attempts + 1}/${MAX_REGISTER_ATTEMPTS})`
            );
        }
    }
}

registry.category("view_widgets").add("aioa_register_domain", {
    component: AioaRegisterDomain,
});
