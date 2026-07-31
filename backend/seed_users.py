import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

def seed():
    users_to_create = [
        {"username": "student", "email": "student@example.com", "password": "student", "role": User.Role.STUDENT},
        {"username": "examiner", "email": "examiner@example.com", "password": "examiner", "role": User.Role.EXAMINER},
        {"username": "admin", "email": "prakharssa2004@gmail.com", "password": "admin", "role": User.Role.ADMIN},
    ]

    for user_info in users_to_create:
        user, created = User.objects.get_or_create(
            username=user_info["username"],
            defaults={"email": user_info["email"], "role": user_info["role"]}
        )
        user.role = user_info["role"]
        user.email = user_info["email"]
        user.set_password(user_info["password"])
        user.save()
        status_msg = "Created" if created else "Updated"
        print(f"{status_msg} user {user.username} with password '{user_info['password']}'")

if __name__ == '__main__':
    seed()
