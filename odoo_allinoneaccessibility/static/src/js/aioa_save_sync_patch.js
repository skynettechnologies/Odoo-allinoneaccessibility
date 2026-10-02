/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";
import { getAioaCanonicalDomain } from "./aioa_domain_util";
import { markAioaSynced } from "./aioa_dashboard_sync";

// Ported from the Django reference plugin's admin.py save_model(), which
// confirmed the real contract: endpoint name is singular "setting" (not
// "settings"), method is POST with a JSON body (not GET+querystring),
// and there is no token/license-key field at all — the domain itself
// (field "u") is what identifies the site to Skynet.
const WIDGET_SETTING_UPDATE_URL =
    "https://ada.skynettechnologies.us/api/widget-setting-update-platform";
const SAVE_SYNC_ACTION_NAME = "odoo_allinoneaccessibility.action_aioa_save_and_sync";

// ---------------------------------------------------------------------------
// Validation (runs BEFORE the record is saved and BEFORE anything is sent
// to Skynet/ADA).
//
// Order of operations on "Save and Sync Widget":
//   1. beforeExecuteActionButton: validate the form values   -> stop here
//                                  if anything is invalid (nothing saved,
//                                  nothing synced)
//   2. beforeExecuteActionButton: standard record save (super)
//   3. server action: re-validates + writes ir.config_parameter values
//   4. afterExecuteActionButton: sync the validated values to ADA
//
// Previously the sync ran at step 1 with the *unsaved* form values, so an
// invalid value reached ADA first and the validation message only appeared
// afterwards (from the server action's UserError).
//
// Empty values: a blank field arrives here as false / null / undefined / ""
// (never silently replaced with a default), so a missing value is reported
// instead of being coerced into something that passes the range check.
// ---------------------------------------------------------------------------

function isEmpty(value) {
    if (value === undefined || value === null || value === false) {
        return true;
    }
    if (typeof value === "string") {
        return value.trim() === "";
    }
    if (typeof value === "number") {
        return Number.isNaN(value);
    }
    return false;
}

/**
 * @param {Object} data  this.model.root.data of the x_aioa.settings form
 * @returns {{field: string, message: string}[]} empty when everything is valid
 */
export function validateAioaSettings(data) {
    const errors = [];
    const add = (field, message) => errors.push({ field, message });

    const requireValue = (field, label) => {
        if (isEmpty(data[field])) {
            add(field, `${label} is required.`);
            return false;
        }
        return true;
    };
    const requireRange = (field, label, lo, hi) => {
        if (!requireValue(field, label)) {
            return;
        }
        const n = Number(data[field]);
        if (!Number.isInteger(n) || n < lo || n > hi) {
            add(field, `${label} must be between ${lo} and ${hi}.`);
        }
    };

    // Colour: the "#" is optional, so "#" alone still counts as empty.
    if (isEmpty(data.x_color_code) || isEmpty(String(data.x_color_code).replace(/^#/, ""))) {
        add("x_color_code", "Hex Color Code is required.");
    }

    // Position
    if (data.x_precise_position) {
        requireRange("x_offset_right", "Right offset (PX)", 0, 250);
        requireValue("x_offset_right_dir", "Right Offset Direction");
        requireRange("x_offset_bottom", "Bottom offset (PX)", 0, 250);
        requireValue("x_offset_bottom_dir", "Bottom Offset Direction");
    } else {
        requireValue("x_style", "Position of Accessibility Icon");
    }

    // Appearance
    requireValue("x_size", "Widget Size");
    requireValue("x_icon_type", "Icon Type");
    if (data.x_custom_icon_size) {
        requireRange("x_custom_icon_size_px", "Custom icon size", 20, 150);
    } else {
        requireValue("x_icon_size_desktop", "Icon Size (Desktop)");
    }

    return errors;
}

patch(FormController.prototype, {
    _aioaIsSaveSyncButton(clickParams) {
        return (
            this.props.resModel === "x_aioa.settings" &&
            clickParams.name === SAVE_SYNC_ACTION_NAME
        );
    },

    async beforeExecuteActionButton(clickParams) {
        if (!this._aioaIsSaveSyncButton(clickParams)) {
            return super.beforeExecuteActionButton(clickParams);
        }

        this._aioaPendingSync = null;

        // 1. Validate first — before the save and before any ADA call.
        const errors = validateAioaSettings(this.model.root.data);
        if (errors.length) {
            for (const { field } of errors) {
                try {
                    await this.model.root.setInvalidField?.(field);
                } catch (err) {
                    /* highlighting is best-effort */
                }
            }
            this.env.services.notification.add(
                errors.map((e) => e.message).join(" "),
                { type: "danger", title: "Invalid settings", sticky: true }
            );
            // Returning false aborts the button: no save, no server
            // action, no sync.
            return false;
        }

        // 2. Standard save (button save="1" -> record.save()).
        const saved = await super.beforeExecuteActionButton(clickParams);
        if (saved === false) {
            return false;
        }

        // Snapshot of the just-saved, validated values. The ADA sync runs
        // in afterExecuteActionButton, once the server action has applied
        // the same values locally.
        this._aioaPendingSync = { ...this.model.root.data };
        return saved;
    },

    async afterExecuteActionButton(clickParams) {
        await super.afterExecuteActionButton(...arguments);
        if (!this._aioaIsSaveSyncButton(clickParams) || !this._aioaPendingSync) {
            return;
        }
        const data = this._aioaPendingSync;
        this._aioaPendingSync = null;
        // 4. Only now push the validated values to ADA.
        await this._aioaSyncWidgetSettings(data);
    },

    async _aioaSyncWidgetSettings(data) {
        const notification = this.env.services.notification;
        // Canonical https/no-port form — MUST match what
        // aioa_register_domain.js registered this site under (see
        // aioa_domain_util.js), or this sync silently updates a record
        // the widget never reads from and settings changes (icon type,
        // icon size, etc.) appear to have no effect on the front end.
        const domainUrl = getAioaCanonicalDomain();

        const payload = {
            u: domainUrl,
            // Skynet's API expects widget_color_code WITH a leading "#"
            // (confirmed against multiple reference plugins — TYPO3, Jelix,
            // Ibexa, Django/Wagtail all send e.g. "#420083", never bare
            // hex). Our own x_color_code field asks users to omit the "#"
            // (see the form's help text), so normalize to exactly one
            // leading "#" here regardless of how it was typed.
            widget_color_code: "#" + String(data.x_color_code).replace(/^#/, ""),
            is_widget_custom_position: data.x_precise_position ? 1 : 0,
            is_widget_custom_size: data.x_custom_icon_size ? 1 : 0,
            widget_icon_type: data.x_icon_type,
            widget_size: data.x_size === "oversize" ? 1 : 0,
        };

        if (!data.x_precise_position) {
            Object.assign(payload, {
                widget_position_top: null,
                widget_position_right: null,
                widget_position_bottom: null,
                widget_position_left: null,
                widget_position: data.x_style,
            });
        } else {
            const pos = { top: null, right: null, bottom: null, left: null };
            if (data.x_offset_right_dir === "to_the_left") {
                pos.left = data.x_offset_right;
            } else {
                pos.right = data.x_offset_right;
            }
            if (data.x_offset_bottom_dir === "to_the_top") {
                pos.top = data.x_offset_bottom;
            } else {
                pos.bottom = data.x_offset_bottom;
            }
            for (const [key, value] of Object.entries(pos)) {
                payload[`widget_position_${key}`] = value;
            }
            payload.widget_position = "";
        }

        if (!data.x_custom_icon_size) {
            Object.assign(payload, {
                widget_icon_size: data.x_icon_size_desktop,
                widget_icon_size_custom: 0,
            });
        } else {
            Object.assign(payload, {
                widget_icon_size: "",
                widget_icon_size_custom: data.x_custom_icon_size_px,
            });
        }

        try {
            const response = await fetch(WIDGET_SETTING_UPDATE_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const bodyText = await response.text().catch(() => "<unreadable body>");
            console.log(
                "AIOA: widget-setting-update-platform response",
                response.status,
                bodyText
            );

            if (response.ok) {
                // Stops the settings page from re-reading widget-settings
                // for a couple of minutes — Skynet may still return the
                // pre-save values and would visually undo this save.
                markAioaSynced();
                notification.add("Widget settings saved and synced.", { type: "success" });
            } else {
                notification.add(
                    `Widget settings were saved locally, but syncing to the widget ` +
                    `failed (HTTP ${response.status}). Check the browser console for details.`,
                    { type: "warning", sticky: true }
                );
            }
        } catch (err) {
            // If this still fails, check the Network tab for CORS/Allow
            // headers on the response — that's the most likely culprit
            // for a browser-side fetch to a third-party API.
            console.error("AIOA: widget-setting-update-platform call failed", err);
            notification.add(
                "Widget settings were saved locally, but the sync request could not " +
                "reach Skynet. Check the browser console for details.",
                { type: "warning", sticky: true }
            );
        }
    },
});
