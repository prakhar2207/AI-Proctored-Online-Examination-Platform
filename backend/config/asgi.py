import os
from django.core.asgi import get_asgi_application

# Set settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')

# Initialize django ASGI application first before importing routing/consumers to load models
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from channels.auth import AuthMiddlewareStack
import apps.proctoring.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter(
                apps.proctoring.routing.websocket_urlpatterns
            )
        )
    ),
})
