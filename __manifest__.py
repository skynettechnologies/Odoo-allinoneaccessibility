# -*- encoding: utf-8 -*-
{
    'name': 'All in One Accessibility',
    'category': "Website",
    'version': '1.0',
    'license': 'OPL-1',
    'summary': 'All in One Accessibility widget makes it easy for users to customize their experience in a single click tap or press of a button.',
    'description': 'It uses the accessibility interface which handles UI and design related adjustments. All in One Accessibility app enhances your Django website accessibility to people with hearing or vision impairments, motor impaired, color blind, dyslexia, cognitive & learning impairments, seizure and epileptic, and ADHD problems. It uses the accessibility interface which handles UI and design related adjustments',
    'author': 'Skynet Technologies LLC',
    'website':'https://www.skynettechnologies.com/',
    'depends': ['base', 'base_setup', 'web'],
    'data': [
        # 'security/ir.model.access.csv',
        'views/res_config_settings_views.xml',
        'templates/left_login_template.xml',

    ],
    'qweb': [
    ],
    'installable': True,
    'application': True,
    'images': ['static/description/banner.png'],
}

