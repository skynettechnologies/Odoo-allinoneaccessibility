# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
import requests
from odoo.exceptions import UserError
from urllib.parse import urlparse
from odoo.exceptions import ValidationError
img = '<img  src="https://www.skynettechnologies.com/sites/default/files/aioa-icon-type-1.svg" width="65" height="65" />'

CHOICES = [
    ('aioa-icon-type-1', 'Icon Type-1'),
    ('aioa-icon-type-2', 'Icon Type-2'),
    ('aioa-icon-type-3', 'Icon Type-3'),
    ('aioa-icon-type-4', 'Icon Type-4'),
    ('aioa-icon-type-5', 'Icon Type-5'),
    ('aioa-icon-type-6', 'Icon Type-6'),
    ('aioa-icon-type-7', 'Icon Type-7'),
    ('aioa-icon-type-8', 'Icon Type-8'),
    ('aioa-icon-type-9', 'Icon Type-9'),
    ('aioa-icon-type-10', 'Icon Type-10')
]

CHOICES1 = [('aioa-big-icon','Big Icon' ), ('aioa-medium-icon', 'Medium Icon'),('aioa-default-icon', 'Default Icon'),('aioa-small-icon', 'Small Icon'),('aioa-extra-small-icon', 'Extra Small Icon')]

class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        called = self.env['ir.config_parameter'].sudo().get_param('odoo_allinoneaccessibility.api_called')
        if not called:
            from .register_domain_api import run_accessibility_api_once
            run_accessibility_api_once(self.env)
            self.env['ir.config_parameter'].sudo().set_param('odoo_allinoneaccessibility.api_called', 'True')
        return res
    
    aioa_icon_type = fields.Selection(CHOICES, default=CHOICES[0][0],store=True,string="Icon Type")

    aioa_icon_size_desktop = fields.Selection(CHOICES1,default='aioa-default-icon',store=True)
      
    style = fields.Selection(selection=[('top_left', 'Top Left'),
        ('top_center', 'Top Center'),
        ('top_right', 'Top Right'),
        ('middle_left', 'Middle Left'),
        ('middle_right', 'Middle Right'),
        ('bottom_left', 'Bottom Left'),
        ('bottom_center', 'Bottom Center'),
        ('bottom_right', 'Bottom Right')], help='Select Background Theme', string="Position of the accessibility icon", store=True,default='bottom_right')
    
    aioa_size = fields.Selection(selection=[('regular', 'Regular Size'),
        ('oversize', 'Oversize')],store=True,default='regular')
    
    aioa_precise_position = fields.Boolean(string="Enable Precise accessibility widget icon position",default=False)

    aioa_offset_right = fields.Integer(string="Right offset (PX)", default=20, help="0 - 250px are permitted values")
    aioa_offset_right_dir = fields.Selection([
        ('to_the_left','To the left'),
        ('to_the_right','To the right'),
    ], string="To the left", default='to_the_left')

    aioa_offset_bottom = fields.Integer(string="Bottom offset (PX)", default=20, help="0 - 250px are permitted values")
    aioa_offset_bottom_dir = fields.Selection([
        ('to_the_bottom','To the bottom'),
        ('to_the_top','To the top'),
    ], string="To the bottom", default='to_the_bottom')

    aioa_custom_icon_size = fields.Boolean(string="Enable Icon Custom Size",default=False)
    aioa_custom_icon_size_px = fields.Integer(
        string="Select exact icon size (PX)",
        default=50,
        help="20 - 150px are permitted values"
    )
    
    aioa_color_code = fields.Char(string="Hex color code",store=True)

    base_url = fields.Char(string="Base_url",store=True)

    def set_values(self):
        super(ResConfigSettings, self).set_values()
        base_url = self.env['ir.config_parameter'].sudo().get_param('web.base.url', '')
        # Parse the URL
        parsed_url = urlparse(base_url)
        
        # Remove port if present in netloc
        hostname = parsed_url.hostname  # This gets only the host part, without port
        scheme = parsed_url.scheme

        # Rebuild the URL without port
        domain_only_url = f'{scheme}://{hostname}'
        
        # Build external payload
        data = {
            "u": domain_only_url,  
            "widget_color_code": self.aioa_color_code,
            "is_widget_custom_position": int(self.aioa_precise_position),
            "is_widget_custom_size": int(self.aioa_custom_icon_size),
        }

        # Position logic
        if not self.aioa_precise_position:
            data.update({
                "widget_position_top": None,
                "widget_position_right": None,
                "widget_position_bottom": None,
                "widget_position_left": None,
                "widget_position": self.style,  # Use aioa_place
            })
        else:
            widget_position = {
                "widget_position_top": None,
                "widget_position_right": None,
                "widget_position_bottom": None,
                "widget_position_left": None,
            }

            # Horizontal offset
            if self.aioa_offset_right_dir == "to_the_left":
                widget_position["widget_position_left"] = self.aioa_offset_right
            elif self.aioa_offset_right_dir == "to_the_right":
                widget_position["widget_position_right"] = self.aioa_offset_right

            # Vertical offset
            if self.aioa_offset_bottom_dir == "to_the_bottom":
                widget_position["widget_position_bottom"] = self.aioa_offset_bottom
            elif self.aioa_offset_bottom_dir == "to_the_top":
                widget_position["widget_position_top"] = self.aioa_offset_bottom

            data.update(widget_position)
            data["widget_position"] = ""

        # Icon size
        if not self.aioa_custom_icon_size:
            data.update({
                "widget_icon_size": self.aioa_icon_size_desktop,
                "widget_icon_size_custom": 0,
            })
        else:
            data.update({
                "widget_icon_size": "",
                "widget_icon_size_custom": self.aioa_custom_icon_size_px,
            })

        # General widget size
        widget_size_value = 1 if self.aioa_size == "oversize" else 0
        data.update({
            "widget_size": widget_size_value,
            "widget_icon_type": self.aioa_icon_type,
        })
      
        try:
            response = requests.post("https://ada.skynettechnologies.us/api/widget-setting-update-platform", json=data)
            if response.status_code != 200:
                raise Exception("Failed to update external API {}".format(response.status_code))
        except Exception as e:
            raise UserError("API Error: %s" % str(e))
        
     
    @api.constrains('aioa_offset_right', 'aioa_offset_bottom', 'aioa_custom_icon_size_px')
    def _check_pixel_ranges(self):
        for record in self:
            if record.aioa_precise_position:
                if not (0 <= record.aioa_offset_right <= 250):
                    raise ValidationError(_("Right offset (PX) must be between 0 and 250."))
                if not (0 <= record.aioa_offset_bottom <= 250):
                    raise ValidationError(_("Bottom offset (PX) must be between 0 and 250."))
            if record.aioa_custom_icon_size:
                if not (20 <= record.aioa_custom_icon_size_px <= 150):
                    raise ValidationError(_("Custom icon size must be between 20 and 150 pixels."))






