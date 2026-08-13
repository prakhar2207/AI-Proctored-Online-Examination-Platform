from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom claims
        token['role'] = user.role
        token['username'] = user.username
        token['email'] = user.email
        return token

    def validate(self, attrs):
        username = attrs.get('username')
        
        # Support email-based login by fetching the corresponding username
        if username and '@' in username:
            try:
                user = User.objects.get(email__iexact=username)
                attrs['username'] = user.username
            except User.DoesNotExist:
                pass
                
        data = super().validate(attrs)
        data['role'] = self.user.role
        data['username'] = self.user.username
        data['email'] = self.user.email
        data['id'] = self.user.id
        data['must_change_password'] = self.user.must_change_password
        return data

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'role')

    def validate(self, attrs):
        role = attrs.get('role', User.Role.STUDENT)
        if role != User.Role.STUDENT:
            raise serializers.ValidationError({"role": "Only student self-registration is allowed."})
        return attrs

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            role=validated_data.get('role', User.Role.STUDENT)
        )
        return user

class UserProfileSerializer(serializers.ModelSerializer):
    overall_performance = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'phone_number', 'organization', 'overall_performance', 'role')
        read_only_fields = ('id', 'username', 'role', 'overall_performance')

    def get_overall_performance(self, obj):
        if obj.role == 'student':
            from apps.exams.models import Result
            from django.db.models import Avg
            
            # Average score of all finalized results
            avg_score = Result.objects.filter(
                session__student=obj, 
                finalized=True
            ).aggregate(Avg('total_score'))['total_score__avg']
            
            if avg_score is not None:
                return f"{avg_score:.1f}"
        return "N/A"
