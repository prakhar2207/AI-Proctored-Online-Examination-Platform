import json
import re
from django.utils.deprecation import MiddlewareMixin
from deep_translator import GoogleTranslator

# In-memory translation cache to avoid hitting the API repeatedly
TRANSLATION_CACHE = {}

# Keys that should NEVER be translated (IDs, usernames, emails, tokens, timestamps, etc)
SKIP_KEYS = {
    'id', 'username', 'email', 'password', 'token', 'access', 'refresh', 
    'created_at', 'updated_at', 'start_window', 'end_window', 'start_time', 
    'submitted_at', 'role', 'status', 'question_type', 'phone_number',
    'first_name', 'last_name', 'pdf_source_name'
}

def translate_text(text, target_lang):
    if not text or not isinstance(text, str):
        return text
        
    # Skip if very short or only contains numbers/symbols
    if len(text.strip()) < 2 or re.match(r'^[\d\W_]+$', text):
        return text
        
    # Skip if looks like email, URL, or filepath
    if '@' in text or 'http://' in text or 'https://' in text or text.endswith('.pdf'):
        return text

    if target_lang not in TRANSLATION_CACHE:
        TRANSLATION_CACHE[target_lang] = {}
        
    if text in TRANSLATION_CACHE[target_lang]:
        return TRANSLATION_CACHE[target_lang][text]
        
    try:
        translated = GoogleTranslator(source='en', target=target_lang).translate(text)
        TRANSLATION_CACHE[target_lang][text] = translated
        return translated
    except Exception as e:
        print(f"Translation error: {e}")
        return text

def recursively_translate(data, target_lang):
    if isinstance(data, dict):
        new_data = {}
        for k, v in data.items():
            if k in SKIP_KEYS:
                new_data[k] = v
            else:
                new_data[k] = recursively_translate(v, target_lang)
        return new_data
    elif isinstance(data, list):
        return [recursively_translate(item, target_lang) for item in data]
    elif isinstance(data, str):
        return translate_text(data, target_lang)
    return data

class TranslationMiddleware(MiddlewareMixin):
    def process_response(self, request, response):
        # Only translate JSON API responses
        if response.get('Content-Type') == 'application/json':
            target_lang = request.META.get('HTTP_ACCEPT_LANGUAGE', 'en').split(',')[0].split('-')[0]
            
            # Skip translation if language is English or unspecified
            if target_lang and target_lang != 'en':
                try:
                    data = json.loads(response.content.decode('utf-8'))
                    translated_data = recursively_translate(data, target_lang)
                    response.content = json.dumps(translated_data).encode('utf-8')
                    # Update Content-Length since length might have changed
                    response['Content-Length'] = str(len(response.content))
                except json.JSONDecodeError:
                    pass
        
        return response
