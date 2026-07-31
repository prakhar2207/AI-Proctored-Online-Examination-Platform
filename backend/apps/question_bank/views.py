import os
import tempfile
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction

from .models import Question, Subject
from .serializers import QuestionSerializer, SubjectSerializer
from apps.users.permissions import IsExaminer
from .pdf_parser import PDFQuestionParser

class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.all().prefetch_related('options')
    serializer_class = QuestionSerializer
    permission_classes = [IsExaminer]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def get_queryset(self):
        queryset = super().get_queryset()
        subject = self.request.query_params.get('subject', None)
        if subject:
            queryset = queryset.filter(subject__iexact=subject)
        difficulty = self.request.query_params.get('difficulty', None)
        if difficulty:
            queryset = queryset.filter(difficulty=difficulty)
        return queryset

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        """
        Deletes multiple questions at once given an array of question IDs.
        """
        question_ids = request.data.get('question_ids', [])
        if not isinstance(question_ids, list) or not question_ids:
            return Response({"error": "No question IDs provided for bulk deletion."}, status=status.HTTP_400_BAD_REQUEST)

        deleted_count, _ = Question.objects.filter(id__in=question_ids).delete()
        return Response({
            "status": f"Successfully deleted {deleted_count} question(s).",
            "deleted_count": deleted_count
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='upload-pdf')
    def upload_pdf(self, request):
        """
        Uploads a PDF exam question paper, saves the UploadedPDF model, and converts it
        into structured questions linked to the PDF source.
        """
        subject = request.data.get('subject')
        difficulty = request.data.get('difficulty', 'medium')
        pdf_file = request.FILES.get('file')

        if not subject:
            return Response({"error": "Subject is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not pdf_file:
            return Response({"error": "PDF file is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # 1. Create UploadedPDF instance
            from .models import UploadedPDF
            uploaded_pdf = UploadedPDF.objects.create(
                name=pdf_file.name,
                file=pdf_file,
                subject=subject,
                uploaded_by=request.user
            )

            # 2. Extract text from the saved file path
            temp_file_path = uploaded_pdf.file.path

            raw_text = PDFQuestionParser.extract_text_from_pdf(temp_file_path)
            
            # 3. Parse questions
            parsed_questions = PDFQuestionParser.parse_questions_from_text(raw_text, subject)

            if not parsed_questions:
                uploaded_pdf.delete()
                return Response({"error": "No questions could be extracted from the uploaded PDF."}, status=status.HTTP_400_BAD_REQUEST)

            created_count = 0
            skipped_count = 0

            with transaction.atomic():
                for q_data in parsed_questions:
                    serializer_data = {
                        "question_type": q_data.get("question_type"),
                        "text": q_data.get("text"),
                        "subject": subject,
                        "difficulty": difficulty,
                        "marks": q_data.get("marks", 5.0),
                        "negative_marks": q_data.get("negative_marks", 0.0),
                        "model_answer": q_data.get("model_answer", ""),
                        "pdf_source": uploaded_pdf.id
                    }
                    
                    options = q_data.get("options", [])
                    
                    serializer = QuestionSerializer(data=serializer_data)
                    serializer.initial_data = {**serializer_data, "options": options}
                    
                    if serializer.is_valid():
                        serializer.save(created_by=request.user)
                        created_count += 1
                    else:
                        skipped_count += 1

            return Response({
                "message": f"Successfully parsed PDF and created {created_count} questions.",
                "created_count": created_count,
                "skipped_count": skipped_count,
                "pdf_source_id": uploaded_pdf.id,
                "pdf_source_name": uploaded_pdf.name
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": f"Failed to parse PDF: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

from .models import UploadedPDF
from .serializers import UploadedPDFSerializer

class UploadedPDFViewSet(viewsets.ModelViewSet):
    queryset = UploadedPDF.objects.all().order_by('-uploaded_at')
    serializer_class = UploadedPDFSerializer
    permission_classes = [IsExaminer]

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    def get_queryset(self):
        qs = self.queryset.filter(uploaded_by=self.request.user)
        subject = self.request.query_params.get('subject')
        if subject:
            qs = qs.filter(subject__iexact=subject)
        return qs

class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all().order_by('name')
    serializer_class = SubjectSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [IsExaminer()]

    def list(self, request, *args, **kwargs):
        if not Subject.objects.exists():
            default_subjects = ["Python", "Chemistry", "Physics", "Mathematics"]
            for name in default_subjects:
                Subject.objects.get_or_create(name=name)
        return super().list(request, *args, **kwargs)


