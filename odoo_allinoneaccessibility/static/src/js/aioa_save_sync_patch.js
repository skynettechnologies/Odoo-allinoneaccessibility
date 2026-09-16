/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";
import { getAioaCanonicalDomain } from "./aioa_domain_util";

// Ported from the Django reference plugin's admin.py save_model(), which
// confirmed the real contract: endpoint name is singular "setting" (not
// "settings"), method is POST with a JSON body (not GET+querystring),
// and there is no token/license-key field at all — the domain itself
// (field "u") is what identifies the site to Skynet.
const WIDGET_SETTING_UPDATE_URL =
    "https://ada.skynettechnologies.us/api/widget-setting-update-platform";
const SAVE_SYNC_ACTION_NAME = "odoo_allinoneaccessibility.action_aioa_save_and_sync";

patch(FormController.prototype, {
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
        return super.beforeExecuteActionButton(clickParams);
    },

    async _aioaSyncWidgetSettings() {
        const data = this.model.root.data;
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
            widget_color_code: "#" + (data.x_color_code || "420083").replace(/^#/, ""),
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
});
