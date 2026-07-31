import pytest
from django.contrib.auth import get_user_model
from apps.question_bank.models import Question, Option
from apps.exams.models import Exam, ExamSession, ExamQuestion, Answer, Result
from apps.exams.services import ExamService
from django.utils import timezone
from datetime import timedelta

User = get_user_model()

@pytest.fixture
def test_users(db):
    examiner = User.objects.create_user(
        username="examiner_t",
        email="examiner_t@example.com",
        password="password123",
        role=User.Role.EXAMINER
    )
    student1 = User.objects.create_user(
        username="student_t1",
        email="student_t1@example.com",
        password="password123",
        role=User.Role.STUDENT
    )
    student2 = User.objects.create_user(
        username="student_t2",
        email="student_t2@example.com",
        password="password123",
        role=User.Role.STUDENT
    )
    return {"examiner": examiner, "student1": student1, "student2": student2}

@pytest.fixture
def exam_questions_pool(db, test_users):
    examiner = test_users["examiner"]
    questions = []
    
    # Create 10 MCQ easy questions
    for i in range(10):
        q = Question.objects.create(
            question_type=Question.QuestionType.MCQ,
            text=f"Easy question {i}",
            subject="Python",
            difficulty="easy",
            marks=2,
            negative_marks=0.5,
            created_by=examiner
        )
        Option.objects.create(question=q, text="Option A (Correct)", is_correct=True)
        Option.objects.create(question=q, text="Option B (Wrong)", is_correct=False)
        questions.append(q)
        
    return questions

@pytest.mark.django_db
class TestExamEngine:
    def test_exam_paper_determinism(self, test_users, exam_questions_pool):
        # Create an Exam Config
        exam = Exam.objects.create(
            title="Python Basics",
            subject="Python",
            duration_minutes=45,
            start_window=timezone.now() - timedelta(hours=1),
            end_window=timezone.now() + timedelta(hours=1),
            config_rules={"easy_count": 5, "medium_count": 0, "hard_count": 0},
            created_by=test_users["examiner"]
        )

        # Start sessions for two students
        session1 = ExamSession.objects.create(
            student=test_users["student1"],
            exam=exam,
            status=ExamSession.Status.IN_PROGRESS
        )
        session2 = ExamSession.objects.create(
            student=test_users["student2"],
            exam=exam,
            status=ExamSession.Status.IN_PROGRESS
        )

        # Generate paper for student 1 twice
        paper1_first = ExamService.generate_random_paper(session1)
        paper1_second = ExamService.generate_random_paper(session1)
        
        # Verify determinism for same student (order & selection should match)
        assert len(paper1_first) == 5
        assert [eq.question.id for eq in paper1_first] == [eq.question.id for eq in paper1_second]

        # Generate paper for student 2
        paper2 = ExamService.generate_random_paper(session2)
        assert len(paper2) == 5
        
        # Student 2 should have a deterministic selection seeded by their student ID.
        # It could differ or match depending on random index, but must be consistent for student 2.
        paper2_second = ExamService.generate_random_paper(session2)
        assert [eq.question.id for eq in paper2] == [eq.question.id for eq in paper2_second]

    def test_mcq_auto_evaluation_correct(self, test_users):
        examiner = test_users["examiner"]
        student = test_users["student1"]

        # Setup MCQ
        q = Question.objects.create(
            question_type=Question.QuestionType.MCQ,
            text="What is 2 + 2?",
            subject="Math",
            difficulty="easy",
            marks=4,
            negative_marks=1.0,
            created_by=examiner
        )
        opt_correct = Option.objects.create(question=q, text="4", is_correct=True)
        opt_wrong = Option.objects.create(question=q, text="5", is_correct=False)

        exam = Exam.objects.create(
            title="Math Exam",
            subject="Math",
            duration_minutes=15,
            start_window=timezone.now() - timedelta(hours=1),
            end_window=timezone.now() + timedelta(hours=1),
            config_rules={"easy_count": 1, "medium_count": 0, "hard_count": 0},
            created_by=examiner
        )
        session = ExamSession.objects.create(student=student, exam=exam, status=ExamSession.Status.IN_PROGRESS)
        
        # Submit correct option
        answer = Answer.objects.create(session=session, question=q)
        answer.selected_options.add(opt_correct)
        
        # Auto-grade
        score = ExamService.evaluate_objective_answer(answer)
        assert score == 4.0
        assert answer.is_evaluated is True
        assert answer.score == 4.0

    def test_mcq_auto_evaluation_incorrect(self, test_users):
        examiner = test_users["examiner"]
        student = test_users["student1"]

        q = Question.objects.create(
            question_type=Question.QuestionType.MCQ,
            text="What is 2 + 2?",
            subject="Math",
            difficulty="easy",
            marks=4,
            negative_marks=1.5,
            created_by=examiner
        )
        opt_correct = Option.objects.create(question=q, text="4", is_correct=True)
        opt_wrong = Option.objects.create(question=q, text="5", is_correct=False)

        exam = Exam.objects.create(
            title="Math Exam",
            subject="Math",
            duration_minutes=15,
            start_window=timezone.now() - timedelta(hours=1),
            end_window=timezone.now() + timedelta(hours=1),
            created_by=examiner
        )
        session = ExamSession.objects.create(student=student, exam=exam, status=ExamSession.Status.IN_PROGRESS)
        
        # Submit wrong option
        answer = Answer.objects.create(session=session, question=q)
        answer.selected_options.add(opt_wrong)
        
        # Auto-grade should apply negative marks
        score = ExamService.evaluate_objective_answer(answer)
        assert score == -1.5
        assert answer.is_evaluated is True
        assert answer.score == -1.5

    def test_multi_select_auto_evaluation(self, test_users):
        examiner = test_users["examiner"]
        student = test_users["student1"]

        q = Question.objects.create(
            question_type=Question.QuestionType.MULTI_SELECT,
            text="Select prime numbers.",
            subject="Math",
            difficulty="easy",
            marks=5,
            negative_marks=2.0,
            created_by=examiner
        )
        opt_2 = Option.objects.create(question=q, text="2", is_correct=True)
        opt_3 = Option.objects.create(question=q, text="3", is_correct=True)
        opt_4 = Option.objects.create(question=q, text="4", is_correct=False)

        exam = Exam.objects.create(
            title="Math Exam",
            subject="Math",
            duration_minutes=15,
            start_window=timezone.now() - timedelta(hours=1),
            end_window=timezone.now() + timedelta(hours=1),
            created_by=examiner
        )
        session = ExamSession.objects.create(student=student, exam=exam, status=ExamSession.Status.IN_PROGRESS)
        
        # Test Case 1: Partial selection (only 1 of 2 correct options) -> Marks deducted (wrong answer)
        answer1 = Answer.objects.create(session=session, question=q)
        answer1.selected_options.add(opt_2)
        score1 = ExamService.evaluate_objective_answer(answer1)
        assert score1 == -2.0

        # Test Case 2: Full correct selection
        answer2 = Answer.objects.create(session=session, question=q)
        answer2.selected_options.add(opt_2, opt_3)
        score2 = ExamService.evaluate_objective_answer(answer2)
        assert score2 == 5.0

        # Test Case 3: Correct selection + one incorrect option
        answer3 = Answer.objects.create(session=session, question=q)
        answer3.selected_options.add(opt_2, opt_3, opt_4)
        score3 = ExamService.evaluate_objective_answer(answer3)
        assert score3 == -2.0

    def test_assigned_exams_visibility_and_security(self, test_users, db):
        from rest_framework.test import APIClient
        examiner = test_users["examiner"]
        student1 = test_users["student1"]
        student2 = test_users["student2"]

        exam = Exam.objects.create(
            title="Assigned Exam Only",
            subject="Python",
            duration_minutes=45,
            start_window=timezone.now() - timedelta(hours=1),
            end_window=timezone.now() + timedelta(hours=1),
            created_by=examiner
        )
        # Assign only to student1
        ExamSession.objects.create(student=student1, exam=exam, status=ExamSession.Status.IN_PROGRESS)

        client_s1 = APIClient()
        client_s1.force_authenticate(user=student1)
        res1 = client_s1.get('/api/exam-engine/exams/')
        assert res1.status_code == 200
        assert len(res1.data) == 1
        assert res1.data[0]["id"] == exam.id

        client_s2 = APIClient()
        client_s2.force_authenticate(user=student2)
        res2 = client_s2.get('/api/exam-engine/exams/')
        assert res2.status_code == 200
        assert len(res2.data) == 0  # Unassigned student sees 0 exams

        # Unassigned student cannot enter unassigned exam
        enter_res = client_s2.post(f'/api/exam-engine/exams/{exam.id}/enter/')
        assert enter_res.status_code == 403
