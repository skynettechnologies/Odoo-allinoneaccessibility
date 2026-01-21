import requests
from odoo.http import request
from urllib.parse import urlparse
from datetime import datetime
import base64

def run_accessibility_api_once(env):
    """Runs the accessibility API only once after module installation or settings access"""
    
    # Check if the API has already been called (using ir.config_parameter)
    api_called = env['ir.config_parameter'].sudo().get_param('odoo_allinoneaccessibility.api_called', 'False')

    # If already called, do nothing
    if api_called == 'True':
        return
    
    error_content = None
    try:
        # -------- Fetch the website base URL from ir.config_parameter
        base_url = env['ir.config_parameter'].sudo().get_param('web.base.url', '')
        
        # Parse the base URL to get domain
        parsed_url = urlparse(base_url)
        domain_url = f"{parsed_url.scheme}://{parsed_url.hostname}"
        domain_name = parsed_url.hostname

        # -------- Make the API call to external service
        response = requests.get(
            "https://ipapi.co/json/",  
            headers={"Accept": "application/json"},
            timeout=5
        )

        # Check if API response is valid
        in_eu = False
        if response.status_code == 200:
            data = response.json()
            in_eu = data.get("in_eu")  # Extracting 'in_eu' from response
        
        # -------- Handle EU/Non-EU logic and save it
        no_required_eu = 0 if in_eu else 1
        headers = {}
        # -------- Build the payload for the API registration
        payload = {
            "name": domain_name,
            "email": f"no-reply@{domain_name}",
            "company_name": "",
            "website": base64.b64encode(domain_url.encode()).decode(),
            "package_type": "free-widget",
            "start_date": datetime.utcnow().isoformat(),
            "end_date": "",
            "price": "",
            "discount_price": "0",
            "platform": "Odoo",
            "api_key": "",
            "is_trial_period": "",
            "is_free_widget": "1",
            "bill_address": "",
            "country": "",
            "state": "",
            "city": "",
            "post_code": "",
            "transaction_id": "",
            "subscr_id": "",
            "payment_source": "",
            "no_required_eu": 0 if in_eu else 1 
        }
        
        # -------- Send the registration payload to your external service
        register_resp = requests.post(
            "https://ada.skynettechnologies.us/api/add-user-domain",
            json=payload,
            headers=headers
        )
        # -------- Save the 'called' flag in ir.config_parameter to prevent future calls
        env['ir.config_parameter'].sudo().set_param('odoo_allinoneaccessibility.api_called', 'True')
        env['ir.config_parameter'].sudo().set_param('odoo_allinoneaccessibility.no_required_eu', str(no_required_eu))

    except requests.exceptions.RequestException as e:
        error_content = f"Request error: {str(e)}"

    except Exception as e:
        error_content = f"Unexpected error: {str(e)}"
        
