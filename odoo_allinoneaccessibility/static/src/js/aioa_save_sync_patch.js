/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";

// Ported from the Django reference plugin's admin.py save_model(), which
// confirmed the real contract: endpoint name is singular "setting" (not
// "settings"), method is POST with a JSON body (not GET+querystring),
// and there is no token/license-key field at all — the domain itself
// (field "u") is what identifies the site to Skynet.
const WIDGET_SETTING_UPDATE_URL =
    "https://ada.skynettechnologies.us/api/widget-setting-update-platform";
const SAVE_SYNC_ACTION_NAME = "odoo_allinoneaccessibility.action_aioa_save_and_sync";

// Captured directly instead of relying on super/this._super: this build's
// patch() does not reliably expose either (beforeExecuteActionButton may
// not even exist yet on the base prototype in this Odoo version, so there
// is nothing for _super to bind to). Falling back to `true` when there is
// no base implementation preserves the default "go ahead" behavior.
const superBeforeExecuteActionButton = FormController.prototype.beforeExecuteActionButton;

// patch()'s signature changed between Odoo versions:
//   - Odoo <= 16.0 (and this build's declared saas~16.4 line, depending on
//     exact point release): patch(obj, patchName, extension)
//   - Odoo >= 17.0: patch(obj, extension) — no name argument, native
//     `super` instead of `_super`.
// Calling the 3-arg form against a 2-arg patch() silently drops the real
// extension object (the patch name string gets treated as the extension
// and iterated character-by-character), corrupting FormController's
// prototype with junk numeric-keyed properties and breaking Owl rendering
// across the backend — this is the root cause of the "C is not a
// constructor" / OwlError seen when opening unrelated screens. Detecting
// the installed patch()'s arity at runtime avoids having to hardcode a
// guess about the exact Odoo point release.
const aioaFormControllerExtension = {
    async beforeExecuteActionButton(clickParams) {
        if (
            this.props.resModel === "x_aioa.settings" &&
            clickParams.name === SAVE_SYNC_ACTION_NAME
        ) {
            // The button has save="1", so by the time this hook runs the
            // record has already been saved — this.model.root.data holds
            // the just-saved values.
            await this._aioaSyncWidgetSettings();
        }
        if (typeof superBeforeExecuteActionButton === "function") {
            return superBeforeExecuteActionButton.call(this, clickParams);
        }
        return true;
    },

    async _aioaSyncWidgetSettings() {
        const data = this.model.root.data;
        const notification = this.env.services.notification;
        const domainUrl = window.location.origin;

        const payload = {
            u: domainUrl,
            widget_color_code: (data.x_color_code || "420083").replace(/^#/, ""),
            is_widget_custom_position: data.x_precise_position ? 1 : 0,
            is_widget_custom_size: data.x_custom_icon_size ? 1 : 0,
            widget_icon_type: data.x_icon_type || "aioa-icon-type-1",
            widget_size: data.x_size === "oversize" ? 1 : 0,
        };

        if (!data.x_precise_position) {
            Object.assign(payload, {
                widget_position_top: null,
                widget_position_right: null,
                widget_position_bottom: null,
                widget_position_left: null,
                widget_position: data.x_style || "bottom_right",
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
                widget_icon_size: data.x_icon_size_desktop || "aioa-default-icon",
                widget_icon_size_custom: 0,
            });
        } else {
            Object.assign(payload, {
                widget_icon_size: "",
                widget_icon_size_custom: data.x_custom_icon_size_px || 50,
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
};

if (patch.length >= 3) {
    // Old-style API: patch(obj, patchName, extension)
    patch(
        FormController.prototype,
        "odoo_allinoneaccessibility.aioa_save_sync_patch",
        aioaFormControllerExtension
    );
} else {
    // New-style API: patch(obj, extension)
    patch(FormController.prototype, aioaFormControllerExtension);
}
