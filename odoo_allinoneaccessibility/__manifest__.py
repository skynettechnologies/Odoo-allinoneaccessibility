# -*- encoding: utf-8 -*-
{
    'name': 'All in One Accessibility',
    'category': 'Website',
    'version': '1.3',
    'license': 'OPL-1',
    'summary': 'All in One Accessibility widget helps organizations enhance accessibility and usability of their website',
    'description': '',
    'author': 'Skynet Technologies USA LLC',
    'website': 'https://www.skynettechnologies.com/all-in-one-accessibility',
    'depends': ['base', 'base_setup', 'web', 'website'],
    'data': [
        'models/aioa_model.xml',
        'security/ir.model.access.csv',
        'actions/aioa_actions.xml',
        'views/aioa_views.xml',
        'templates/base_url_passing.xml',
    ],
    'images': ['static/description/banner.jpg'],
    'installable': True,
    'application': True,
    'auto_install': False,
    'support': 'hello@skynettechnologies.com',
}