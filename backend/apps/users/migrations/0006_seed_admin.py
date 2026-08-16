# Generated manually

from django.db import migrations
from django.contrib.auth.hashers import make_password

def seed_admin_user(apps, schema_editor):
    User = apps.get_model('users', 'User')
    
    # Create or update the admin user
    user, created = User.objects.get_or_create(
        username='admin',
        defaults={
            'email': 'support.aiexam@gmail.com',
            'role': 'admin',
            'is_staff': True,
            'is_superuser': True,
            'is_active': True,
        }
    )
    
    # Always set the requested password and email
    user.email = 'support.aiexam@gmail.com'
    user.password = make_password('22072004Ps@')
    user.role = 'admin'
    user.is_staff = True
    user.is_superuser = True
    user.save()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_user_organization'),
    ]

    operations = [
        migrations.RunPython(seed_admin_user),
    ]
