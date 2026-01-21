# -*- encoding: utf-8 -*-
{
    'name': 'All in One Accessibility',
    'category': "Website",
    'version': '1.2',
    'license': 'OPL-1',
    'summary': 'All in One Accessibility widget is based on assistive technology and AI that helps organizations enhance the accessibility and usability of their website quickly',
    'description': 'Website accessibility widget for improving WCAG 2.0, 2.1, 2.2 and ADA compliance!',
    'author': 'Skynet Technologies USA LLC',
    'website':'https://www.skynettechnologies.com/all-in-one-accessibility',
    'depends': ['base', 'base_setup', 'web', 'website'],
    'data': [
        # 'security/ir.model.access.csv',
        # 'views/templates.xml',
        'views/res_config_settings_views.xml',
        'templates/base_url_passing.xml',

    ],
    'qweb': [
    ],
    'images': ['static/description/banner.jpg'],
    'installable': True,
    'application': True,
    'support':'hello@skynettechnologies.com',
    'assets': {
        'web.assets_backend': [
        ],
    },
}

