# -*- encoding: utf-8 -*-
{
    'name': 'All in One Accessibility',
    'category': 'Website',
    'version': '1.4',
    'license': 'OPL-1',
    'summary': 'Website accessibility widget for improving WCAG 2.0, 2.1, 2.2 and ADA, EAA compliance',
    'description': '',
    'author': 'Skynet Technologies USA LLC',
    'website': 'https://www.skynettechnologies.com/all-in-one-accessibility',
    'depends': ['base', 'base_setup', 'web', 'website', 'base_automation'],
    'data': [
        'models/aioa_model.xml',
        'security/ir.model.access.csv',
        'actions/aioa_actions.xml',
        'views/aioa_views.xml',
        'templates/base_url_passing.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'odoo_allinoneaccessibility/static/src/js/aioa_register_domain.js',
            'odoo_allinoneaccessibility/static/src/js/aioa_save_sync_patch.js',
        ],
    },
    'images': ['static/description/banner.jpg'],
    'installable': True,
    'application': True,
    'auto_install': False,
    'support': 'hello@skynettechnologies.com',
}
