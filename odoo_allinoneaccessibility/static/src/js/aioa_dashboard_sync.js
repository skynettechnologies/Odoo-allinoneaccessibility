/** @odoo-module **/

// Dashboard -> settings-page sync (read side).
//
// Ported from the Plone module's aioa_skynet_sync.js: fetchWidgetSettings()
// and applyDashboardSettings(). When the AIOA Settings form opens, the
// site's current configuration is read from Skynet's `widget-settings`
// endpoint and written into the form, so changes an admin made directly on
// the Skynet/ADA dashboard show up on this page too — not only changes
// made from this form.
//
// The write direction (this form -> Skynet) lives in
// aioa_save_sync_patch.js and is unchanged.

const WIDGET_SETTINGS_URL = "https://ada.skynettechnologies.us/api/widget-settings";

// Hosts Skynet never has a real registration for. A widget-settings read
// for them comes back empty/unrelated, and applying that would overwrite
// whatever the admin last saved (same guard as the Plone module).
export const AIOA_LOCAL_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"];

// ---------------------------------------------------------------------------
// "Just synced" marker.
//
// widget-setting-update-platform (write) has no guaranteed read-after-write
// consistency: right after a save, widget-settings can still return the
// PREVIOUS values. Applying that stale read would silently undo the save
// the admin just made. The Plone module dodges this by skipping the read on
// the reload right after Save; Odoo has no reload (the form stays mounted),
// so instead the save handler stamps a marker and the read is skipped while
// the stamp is fresh. Dashboard changes still show up on every later open.
// ---------------------------------------------------------------------------
const LAST_SYNC_KEY = "aioa_last_sync_v1";
const LAST_SYNC_TTL_MS = 30 * 1000;

export function markAioaSynced() {
    try {
        window.sessionStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
    } catch (err) {
        /* private mode etc. — worst case the read isn't skipped */
    }
}

export function wasAioaSyncedRecently() {
    try {
        const raw = window.sessionStorage.getItem(LAST_SYNC_KEY);
        if (!raw) {
            return false;
        }
        const age = Date.now() - parseInt(raw, 10);
        return !Number.isNaN(age) && age >= 0 && age <= LAST_SYNC_TTL_MS;
    } catch (err) {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

/**
 * Same request shape as the Plone module: POST with a JSON body. (A plain
 * GET with a query string returns an HTML error page, not JSON.) The real
 * payload is nested under "Data"; some deployments answer flat, so fall
 * back to the raw JSON when "Data" is absent.
 *
 * The site is identified by hostname (no port), matching the canonical key
 * add-user-domain / widget-setting-update-platform use (aioa_domain_util.js).
 * On production the two are identical.
 *
 * Best-effort: resolves to null on any failure — never throws.
 */
export async function fetchAioaWidgetSettings() {
    try {
        // Always hit the network: dashboard changes were only showing up
        // after the browser cache was cleared, because a cached response
        // was being reused. "no-store" skips the HTTP cache and the "_"
        // timestamp makes every URL unique so no proxy/CDN can reuse it.
        // (No custom request headers are added, so no CORS preflight.)
        const response = await fetch(`${WIDGET_SETTINGS_URL}?_=${Date.now()}`, {
            method: "POST",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ website_url: window.location.hostname }),
        });
        if (!response.ok) {
            console.warn("AIOA: widget-settings responded", response.status);
            return null;
        }
        const json = await response.json();
        if (json && json.Data && Object.keys(json.Data).length > 0) {
            return json.Data;
        }
        return json || null;
    } catch (err) {
        console.warn("AIOA: widget-settings call failed", err);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Mapping: Skynet field names -> x_aioa.settings fields
// ---------------------------------------------------------------------------

// Must match the selection values declared in models/aioa_model.xml. An
// unknown token is ignored rather than written — writing a value that isn't
// in a selection makes the whole record fail validation on save.
const STYLE_VALUES = [
    "top_left", "top_center", "top_right",
    "middle_left", "middle_right",
    "bottom_left", "bottom_center", "bottom_right",
];
const ICON_TYPE_VALUES = Array.from({ length: 10 }, (_, i) => `aioa-icon-type-${i + 1}`);
const ICON_SIZE_VALUES = [
    "aioa-big-icon", "aioa-medium-icon", "aioa-default-icon",
    "aioa-small-icon", "aioa-extra-small-icon",
];

function isSet(value) {
    return value !== undefined && value !== null && value !== "";
}

function truthy01(value) {
    return value === true || value === 1 || value === "1";
}

function toInt(value) {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? null : n;
}

// The server action in actions/aioa_actions.xml rejects out-of-range values
// (offsets 0-250, custom size 20-150) with a UserError, which would block
// the admin's next Save. Clamp instead of importing a value that can't save.
function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
}

/**
 * Turns a widget-settings response into the changes to apply to the form
 * record — only fields whose value actually differs from `current` (the
 * record's present data), so a dashboard that already matches the form
 * leaves the record clean instead of flagging it as modified.
 *
 * @param {Object|null} data     widget-settings payload (unwrapped)
 * @param {Object}      current  record.data of the x_aioa.settings form
 * @returns {Object} changes to pass to record.update() ({} if none)
 */
export function buildRecordChanges(data, current) {
    // Not a settings payload (e.g. an error object) — do nothing rather
    // than reset the form to blanks.
    if (!data || typeof data !== "object") {
        return {};
    }
    if (!("widget_color_code" in data) && !("widget_icon_type" in data)) {
        return {};
    }

    const changes = {};

    if (typeof data.widget_color_code === "string" && data.widget_color_code.trim()) {
        changes.x_color_code = data.widget_color_code.trim().replace(/^#/, "");
    }

    // The write side sends widget_size as 0/1; also accept the plain tokens.
    if (data.widget_size === 1 || data.widget_size === "1" || data.widget_size === "oversize") {
        changes.x_size = "oversize";
    } else if (data.widget_size === 0 || data.widget_size === "0" || data.widget_size === "regular") {
        changes.x_size = "regular";
    }

    if (ICON_TYPE_VALUES.includes(data.widget_icon_type)) {
        changes.x_icon_type = data.widget_icon_type;
    }

    // If a flag is missing from the payload, fall back to what the form
    // already has instead of assuming "off".
    const customPosition = isSet(data.is_widget_custom_position)
        ? truthy01(data.is_widget_custom_position)
        : !!current.x_precise_position;
    const customSize = isSet(data.is_widget_custom_size)
        ? truthy01(data.is_widget_custom_size)
        : !!current.x_custom_icon_size;

    if (isSet(data.is_widget_custom_position)) {
        changes.x_precise_position = customPosition;
    }
    if (isSet(data.is_widget_custom_size)) {
        changes.x_custom_icon_size = customSize;
    }

    if (customPosition) {
        // Same right/left and bottom/top interpretation as the Plone module.
        if (isSet(data.widget_position_right) && toInt(data.widget_position_right) !== null) {
            changes.x_offset_right = clamp(toInt(data.widget_position_right), 0, 250);
            changes.x_offset_right_dir = "to_the_right";
        } else if (isSet(data.widget_position_left) && toInt(data.widget_position_left) !== null) {
            changes.x_offset_right = clamp(toInt(data.widget_position_left), 0, 250);
            changes.x_offset_right_dir = "to_the_left";
        }
        if (isSet(data.widget_position_bottom) && toInt(data.widget_position_bottom) !== null) {
            changes.x_offset_bottom = clamp(toInt(data.widget_position_bottom), 0, 250);
            changes.x_offset_bottom_dir = "to_the_bottom";
        } else if (isSet(data.widget_position_top) && toInt(data.widget_position_top) !== null) {
            changes.x_offset_bottom = clamp(toInt(data.widget_position_top), 0, 250);
            changes.x_offset_bottom_dir = "to_the_top";
        }
    } else if (STYLE_VALUES.includes(data.widget_position)) {
        changes.x_style = data.widget_position;
    }

    if (customSize) {
        if (toInt(data.widget_icon_size_custom) !== null) {
            changes.x_custom_icon_size_px = clamp(toInt(data.widget_icon_size_custom), 20, 150);
        }
    } else if (ICON_SIZE_VALUES.includes(data.widget_icon_size)) {
        changes.x_icon_size_desktop = data.widget_icon_size;
    }

    // Keep only real differences.
    return Object.fromEntries(
        Object.entries(changes).filter(([key, value]) => current[key] !== value)
    );
}
