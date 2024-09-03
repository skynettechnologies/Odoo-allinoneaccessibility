# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
import random

img = '<img  src="https://skynettechnologies.com/sites/default/files/python/aioa-icon-type-1.svg" width="65" height="65" />'

CHOICES = [('aioa-icon-type-1','' ), ('aioa-icon-type-2', ''),('aioa-icon-type-3', '')]
CHOICES1 = [('aioa-big-icon','' ), ('aioa-medium-icon', ''),('aioa-default-icon', ''),('aioa-small-icon', ''),('aioa-extra-small-icon', '')]

aioa_NOTE = "<span class='validate_pro'><p>You are currently using Free version which have limited features. </br>Please <a href='https://www.skynettechnologies.com/add-ons/product/all-in-one-accessibility/'>purchase</a> License Key for additional features on the ADA Widget</p></span><script>if(document.querySelector('#id_aioa_license_Key').value != ''){document.querySelector('.validate_pro').style.display='none';} else {document.querySelector('.validate_pro').style.display='block';} </>"

class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'
    
    aioa_license_key = fields.Char(string="License Key",default="",store=True)

    aioa_icon_type = fields.Selection(CHOICES, default=CHOICES[0][0],store=True)

    aioa_icon_size_desktop = fields.Selection(CHOICES1,default='aioa-default-icon',store=True)
     
    aioa_icon_size_mobile = fields.Selection(CHOICES1,default='aioa-default-icon',store=True)
     
    style = fields.Selection(selection=[('top_left','Top left'),
      ('top_center','Top Center'),
      ('top_right','Top Right'),
      ('middel_left','Middle left'),
      ('middel_right','Middle Right'),
      ('bottom_left','Bottom left'),
      ('bottom_center','Bottom Center'),
      ('bottom_right','Bottom Right')], help='Select Background Theme',store=True)
    
    aioa_color_code = fields.Char(string="Hex color code",store=True)

    base_url = fields.Char(string="Base_url",store=True)

    @api.model  
    def default_get(self, fields):
        result = super(ResConfigSettings, self).default_get(fields)    
        result.update({'aioa_license_key':self.env['ir.config_parameter'].sudo().get_param('all_in_one_accessibility.aioa_license_key') or '','aioa_icon_type':self.env['ir.config_parameter'].sudo().get_param('all_in_one_accessibility.aioa_icon_type') or '','aioa_icon_size_desktop':self.env['ir.config_parameter'].sudo().get_param('all_in_one_accessibility.aioa_icon_size_desktop') or '','aioa_icon_size_mobile':self.env['ir.config_parameter'].sudo().get_param('all_in_one_accessibility.aioa_icon_size_mobile') or '',
                       'style':self.env['ir.config_parameter'].sudo().get_param('all_in_one_accessibility.style') or ''})
        return result
    
    def get_values(self):
        res = super(ResConfigSettings, self).get_values()
        res.update(
            aioa_color_code=self.env['ir.config_parameter'].sudo().get_param('all_in_one_accessibility.aioa_color_code'),
            aioa_license_key=self.env['ir.config_parameter'].sudo().get_param('all_in_one_accessibility.aioa_license_key'),                 
            style=self.env['ir.config_parameter'].sudo().get_param('all_in_one_accessibility.style'),
            aioa_icon_type=self.env['ir.config_parameter'].sudo().get_param('all_in_one_accessibility.aioa_icon_type'),
            aioa_icon_size_desktop=self.env['ir.config_parameter'].sudo().get_param('all_in_one_accessibility.aioa_icon_size_desktop'),
            aioa_icon_size_mobile=self.env['ir.config_parameter'].sudo().get_param('all_in_one_accessibility.aioa_icon_size_mobile'),
            base_url = "https://www.skynettechnologies.com/accessibility/js/all-in-one-accessibility-js-widget-minify.js?colorcode={}&token={}&t={}&position={}".format(self.env['ir.config_parameter'].sudo().get_param('all_in_one_accessibility.aioa_color_code') or '',self.env['ir.config_parameter'].sudo().get_param('all_in_one_accessibility.aioa_license_key') or '',str(random.randint(0,999999)),self.env['ir.config_parameter'].sudo().get_param('all_in_one_accessibility.style') or '',self.env['ir.config_parameter'].sudo().get_param('all_in_one_accessibility.aioa_icon_size_desktop') or '',self.env['ir.config_parameter'].sudo().get_param('all_in_one_accessibility.aioa_icon_size_mobile') or ''),

        )
        return res

    def set_values(self):
        super(ResConfigSettings, self).set_values()
        param = self.env['ir.config_parameter'].sudo()
        set_place = self.style or ''
        set_color_code = self.aioa_color_code or ''
        set_license_key = self.aioa_license_key or ''
        set_aioa_icon_type = self.aioa_icon_type or ''
        set_aioa_icon_size_desktop = self.aioa_icon_size_desktop or ''
        set_aioa_icon_size_mobile = self.aioa_icon_size_mobile or ''

        set_baseURL = "https://www.skynettechnologies.com/accessibility/js/all-in-one-accessibility-js-widget-minify.js?colorcode={}&token={}&t={}&position={}.{}.{}.{}".format(set_color_code,set_license_key,str(random.randint(0,999999)),set_place,set_aioa_icon_type,set_aioa_icon_size_desktop,set_aioa_icon_size_mobile)

        param.set_param('all_in_one_accessibility.style', set_place)
        param.set_param('all_in_one_accessibility.aioa_color_code', set_color_code)
        param.set_param('all_in_one_accessibility.aioa_license_key', set_license_key)
        param.set_param('all_in_one_accessibility.aioa_icon_type', set_aioa_icon_type)
        param.set_param('all_in_one_accessibility.aioa_icon_size_desktop', set_aioa_icon_size_desktop)
        param.set_param('all_in_one_accessibility.aioa_icon_size_mobile', set_aioa_icon_size_mobile)
        param.set_param('all_in_one_accessibility.base_url', set_baseURL)

