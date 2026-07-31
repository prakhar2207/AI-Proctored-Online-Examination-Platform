'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthSession, clearAuthSession, apiFetch } from '@/lib/api';

// ─── Interfaces ──────────────────────────────────────────────────
interface Option {
  id: number;
  text: string;
  is_correct: boolean;
}

interface Question {
  id: number;
  question_type: 'mcq' | 'multi_select' | 'short_answer' | 'long_answer' | 'image_upload';
  text: string;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  marks: number;
  negative_marks: string;
  model_answer?: string;
  options: Option[];
  pdf_source?: number;
  pdf_source_name?: string;
}

interface Subject {
  id: number;
  name: string;
}

interface Exam {
  id: number;
  title: string;
  subject: string;
  duration_minutes: number;
  start_window: string;
  end_window: string;
  enable_webcam: boolean;
  sections?: {
    id: number;
    name: string;
    description: string;
    order: number;
    use_random: boolean;
  }[];
}

interface AttemptedQuestion {
  id: number;
  question_id: number;
  question_type: string;
  question_text: string;
  marks: number;
  text_answer?: string;
  image_answer_url?: string;
  word_count?: number;
  score?: number;
  is_evaluated: boolean;
  ai_justification?: string;
  examiner_feedback?: string;
  student_username?: string;
}

interface UnansweredQuestion {
  question_id: number;
  question_type: string;
  question_text: string;
  marks: number;
  status: string;
}

interface AssessmentSession {
  session_id: number;
  student_username: string;
  student_email: string;
  exam_id: number;
  exam_title: string;
  status: string;
  start_time: string;
  submitted_at?: string;
  total_questions: number;
  attempted_count: number;
  unanswered_count: number;
  is_fully_evaluated: boolean;
  attempted_questions: AttemptedQuestion[];
  unanswered_questions: UnansweredQuestion[];
}

interface Student {
  id: number;
  username: string;
  email: string;
  name: string;
  associated?: boolean;
}

interface UploadedPDF {
  id: number;
  name: string;
  file: string;
  subject: string;
  uploaded_at: string;
}

interface ExamSectionForm {
  name: string;
  description: string;
  subject?: string;
  use_random: boolean;
  easy_count: number;
  medium_count: number;
  hard_count: number;
  question_type: string;
  pdf_source_id: string;
  question_ids: number[];
}

export default function ExaminerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'queue' | 'questions' | 'exams' | 'students'>('queue');

  // Data lists
  const [questions, setQuestions] = useState<Question[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [gradingQueue, setGradingQueue] = useState<AssessmentSession[]>([]);
  const [expandedSessionIds, setExpandedSessionIds] = useState<number[]>([]);
  const [associatedStudents, setAssociatedStudents] = useState<Student[]>([]);
  const [uploadedPdfs, setUploadedPdfs] = useState<UploadedPDF[]>([]);

  // Search Students
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);

  // Create Question Form State
  const [showQModal, setShowQModal] = useState(false);
  const [qForm, setQForm] = useState({
    question_type: 'mcq',
    text: '',
    subject: '',
    difficulty: 'medium',
    marks: 1,
    negative_marks: '0.00',
    model_answer: '',
    options: [
      { text: '', is_correct: true },
      { text: '', is_correct: false }
    ]
  });

  // Create Exam Form State with Multiple Sections
  const [showEModal, setShowEModal] = useState(false);
  const [eForm, setEForm] = useState({
    title: '',
    subject: '',
    duration_minutes: 45,
    start_window: '',
    end_window: '',
    randomize_questions: true,
    enable_webcam: true,
    gaze_sensitivity: '0.50',
    max_tab_switches: 3,
    grading_mode: 'ai_checked',
    easy_marks: 2,
    easy_negative_marks: 0,
    medium_marks: 4,
    medium_negative_marks: 0,
    hard_marks: 6,
    hard_negative_marks: 0,
    sections: [] as ExamSectionForm[]
  });

  // Assign Exam State
  const [assigningExam, setAssigningExam] = useState<Exam | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);

  // Score Override State
  const [overrideItem, setOverrideItem] = useState<AttemptedQuestion | null>(null);
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideFeedback, setOverrideFeedback] = useState('');

  // Question Bank multi-selection state
  const [selectedQIds, setSelectedQIds] = useState<number[]>([]);

  const toggleSelectQId = (id: number) => {
    setSelectedQIds(prev =>
      prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]
    );
  };

  const handleBulkDeleteQuestions = async () => {
    if (selectedQIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedQIds.length} selected question(s) from the question bank?`)) return;

    try {
      const res = await apiFetch('/question-bank/questions/bulk-delete/', {
        method: 'POST',
        body: JSON.stringify({ question_ids: selectedQIds })
      });
      if (res.status === 200) {
        showAlert('success', `Successfully deleted ${selectedQIds.length} question(s)!`);
        setSelectedQIds([]);
        fetchQuestions();
      } else {
        const errData = await res.json();
        showAlert('error', errData.error || 'Failed to delete selected questions.');
      }
    } catch (err) {
      console.error(err);
      showAlert('error', 'Network request failed.');
    }
  };

  // Notifications
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });
  const [studentResults, setStudentResults] = useState<any[]>([]);

  // Question bank search/filter and editing states
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [filterSubjects, setFilterSubjects] = useState<string[]>([]);
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterType, setFilterType] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [showSubjectManager, setShowSubjectManager] = useState(false);
  const [subjectDropdownOpen, setSubjectDropdownOpen] = useState(false);

  const showAlert = (type: string, text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg({ type: '', text: '' }), 5000);
  };


  // PDF Bulk Upload State
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [pdfSubject, setPdfSubject] = useState('');
  const [pdfDifficulty, setPdfDifficulty] = useState('medium');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Student Account creation states
  const [showSModal, setShowSModal] = useState(false);
  const [sForm, setSForm] = useState({ username: '', name: '', email: '', exam_id: '' });
  const [sLoading, setSLoading] = useState(false);

  // Mail Link states
  const [showMailModal, setShowMailModal] = useState(false);
  const [mailForm, setMailForm] = useState({ username: '', email: '', exam_id: '' });
  const [mailLoading, setMailLoading] = useState(false);

  // ─── Fetchers ──────────────────────────────────────────────────
  const fetchQuestions = async () => {
    try {
      const res = await apiFetch('/question-bank/questions/');
      if (res.status === 200) setQuestions(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchExams = async () => {
    try {
      const res = await apiFetch('/exam-engine/exams/');
      if (res.status === 200) setExams(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchGradingQueue = async () => {
    try {
      const res = await apiFetch('/grading-portal/portal/queue/');
      if (res.status === 200) setGradingQueue(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAssociatedStudents = async () => {
    try {
      const res = await apiFetch('/auth/examiner/students/');
      if (res.status === 200) setAssociatedStudents(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUploadedPdfs = async () => {
    try {
      const res = await apiFetch('/question-bank/uploaded-pdfs/');
      if (res.status === 200) setUploadedPdfs(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStudentResults = async () => {
    try {
      const res = await apiFetch('/auth/examiner/students/results/');
      if (res.status === 200) setStudentResults(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await apiFetch('/question-bank/subjects/');
      if (res.status === 200) {
        setSubjects(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    try {
      const res = await apiFetch('/question-bank/subjects/', {
        method: 'POST',
        body: JSON.stringify({ name: newSubjectName.trim() })
      });
      if (res.status === 201) {
        setNewSubjectName('');
        fetchSubjects();
        showAlert('success', 'Subject added successfully!');
      } else {
        const errorData = await res.json();
        showAlert('error', errorData.name ? errorData.name[0] : 'Failed to add subject.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSubject = async (id: number) => {
    if (!confirm('Are you sure you want to delete this subject?')) return;
    try {
      const res = await apiFetch(`/question-bank/subjects/${id}/`, {
        method: 'DELETE'
      });
      if (res.status === 204) {
        fetchSubjects();
        showAlert('success', 'Subject deleted successfully!');
      } else {
        showAlert('error', 'Failed to delete subject.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadAllData = useCallback(async () => {
    await Promise.all([
      fetchQuestions(),
      fetchExams(),
      fetchGradingQueue(),
      fetchAssociatedStudents(),
      fetchUploadedPdfs(),
      fetchStudentResults(),
      fetchSubjects()
    ]);
  }, []);


  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      router.replace('/login');
    } else if (session.must_change_password) {
      router.replace('/change-password');
    } else if (session.role !== 'examiner' && session.role !== 'admin') {
      router.replace('/student/dashboard');
    } else {
      setUser({ username: session.username || '', role: session.role });
      setLoading(false);
      loadAllData();
    }
  }, [router, loadAllData]);

  const handleLogout = () => {
    clearAuthSession();
    router.push('/login');
  };

  // ─── Students Lookup & Search ───────────────────────────────────
  const handleStudentSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await apiFetch(`/auth/examiner/students/search/?q=${encodeURIComponent(searchQuery)}`);
      if (res.status === 200) {
        setSearchResults(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ─── Actions & Submissions ──────────────────────────────────────
  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMsg({ type: '', text: '' });
    try {
      const isObjective = ['mcq', 'multi_select'].includes(qForm.question_type);
      const payload = {
        question_type: qForm.question_type,
        text: qForm.text,
        subject: qForm.subject,
        difficulty: qForm.difficulty,
        marks: qForm.marks,
        negative_marks: qForm.negative_marks,
        model_answer: qForm.model_answer,
        options: isObjective ? qForm.options : []
      };

      const url = editingQuestionId 
        ? `/question-bank/questions/${editingQuestionId}/`
        : '/question-bank/questions/';
      const method = editingQuestionId ? 'PATCH' : 'POST';

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (res.status === 201 || res.status === 200) {
        setAlertMsg({ 
          type: 'success', 
          text: editingQuestionId ? 'Question updated successfully!' : 'Question added successfully!' 
        });
        setShowQModal(false);
        setEditingQuestionId(null);
        fetchQuestions();
        setQForm({
          question_type: 'mcq',
          text: '',
          subject: '',
          difficulty: 'medium',
          marks: 1,
          negative_marks: '0.00',
          model_answer: '',
          options: [
            { text: '', is_correct: true },
            { text: '', is_correct: false }
          ]
        });
      } else {
        const errors = await res.json();
        setAlertMsg({ type: 'error', text: JSON.stringify(errors) });
      }
    } catch (err) {
      console.error(err);
      setAlertMsg({ type: 'error', text: 'Network request failed.' });
    }
  };

  const startEditQuestion = (q: Question) => {
    setEditingQuestionId(q.id);
    setQForm({
      question_type: q.question_type,
      text: q.text,
      subject: q.subject || '',
      difficulty: q.difficulty || 'medium',
      marks: q.marks || 1,
      negative_marks: q.negative_marks || '0.00',
      model_answer: q.model_answer || '',
      options: q.options && q.options.length > 0 
        ? q.options.map(opt => ({ text: opt.text, is_correct: opt.is_correct }))
        : [
            { text: '', is_correct: true },
            { text: '', is_correct: false }
          ]
    });
    setShowQModal(true);
  };

  const handleDeleteQuestion = async (id: number) => {
    if (!confirm('Are you sure you want to delete this question from the bank?')) return;
    try {
      const res = await apiFetch(`/question-bank/questions/${id}/`, {
        method: 'DELETE'
      });
      if (res.status === 204) {
        fetchQuestions();
        showAlert('success', 'Question deleted successfully!');
      } else {
        showAlert('error', 'Failed to delete question.');
      }
    } catch (err) {
      console.error(err);
      showAlert('error', 'Network request failed.');
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMsg({ type: '', text: '' });

    if (eForm.duration_minutes < 45) {
      alert("Minimum assessment duration must be at least 45 minutes.");
      return;
    }

    if (eForm.sections.length === 0) {
      alert("Please add at least one section to the exam.");
      return;
    }

    // Solving time budget estimation check (1 mark = 1 minute estimated solving time)
    let totalSolvingTime = 0;
    eForm.sections.forEach(sec => {
      totalSolvingTime += (sec.easy_count * eForm.easy_marks) + (sec.medium_count * eForm.medium_marks) + (sec.hard_count * eForm.hard_marks);
    });

    if (totalSolvingTime > eForm.duration_minutes) {
      const proceed = confirm(
        `Notice: The total estimated solving time for configured questions (${totalSolvingTime} mins) exceeds the exam duration (${eForm.duration_minutes} mins). Questions will be automatically capped at ${eForm.duration_minutes} mins during paper generation. Do you wish to proceed?`
      );
      if (!proceed) return;
    }

    try {
      // Map sections to exact payload structure
      const formattedSections = eForm.sections.map((sec, idx) => ({
        name: sec.name,
        description: sec.description,
        order: idx + 1,
        use_random: sec.use_random,
        config_rules: {
          subject: sec.subject || eForm.subject || null,
          easy_count: sec.easy_count,
          medium_count: sec.medium_count,
          hard_count: sec.hard_count,
          question_type: sec.question_type || null,
          pdf_source_id: sec.pdf_source_id ? parseInt(sec.pdf_source_id) : null
        },
        question_ids: sec.question_ids
      }));

      const payload = {
        title: eForm.title,
        subject: eForm.subject,
        duration_minutes: eForm.duration_minutes,
        start_window: new Date(eForm.start_window).toISOString(),
        end_window: new Date(eForm.end_window).toISOString(),
        enable_webcam: eForm.enable_webcam,
        gaze_sensitivity: eForm.gaze_sensitivity,
        max_tab_switches: eForm.max_tab_switches,
        grading_mode: eForm.grading_mode,
        config_rules: {
          easy_marks: eForm.easy_marks,
          easy_negative_marks: eForm.easy_negative_marks,
          medium_marks: eForm.medium_marks,
          medium_negative_marks: eForm.medium_negative_marks,
          hard_marks: eForm.hard_marks,
          hard_negative_marks: eForm.hard_negative_marks
        },
        sections: formattedSections
      };

      const res = await apiFetch('/exam-engine/exams/', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.status === 201) {
        setAlertMsg({ type: 'success', text: 'Exam scheduled successfully!' });
        setShowEModal(false);
        fetchExams();
        // Reset Exam form
        setEForm({
          title: '',
          subject: '',
          duration_minutes: 60,
          start_window: '',
          end_window: '',
          randomize_questions: true,
          enable_webcam: true,
          gaze_sensitivity: '0.50',
          max_tab_switches: 3,
          grading_mode: 'ai_checked',
          easy_marks: 2,
          easy_negative_marks: 0,
          medium_marks: 4,
          medium_negative_marks: 0,
          hard_marks: 6,
          hard_negative_marks: 0,
          sections: []
        });
      } else {
        const errors = await res.json();
        setAlertMsg({ type: 'error', text: JSON.stringify(errors) });
      }
    } catch (err) {
      console.error(err);
      setAlertMsg({ type: 'error', text: 'Network request failed.' });
    }
  };

  const handleAssignExamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningExam || selectedStudentIds.length === 0) return;
    try {
      const res = await apiFetch(`/exam-engine/exams/${assigningExam.id}/assign/`, {
        method: 'POST',
        body: JSON.stringify({ student_ids: selectedStudentIds })
      });
      if (res.status === 200) {
        setAlertMsg({ type: 'success', text: 'Exam assigned successfully to selected students.' });
        setAssigningExam(null);
        setSelectedStudentIds([]);
      } else {
        alert("Failed to assign exam.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSessionExpanded = (sessionId: number) => {
    setExpandedSessionIds(prev => 
      prev.includes(sessionId) 
        ? prev.filter(id => id !== sessionId) 
        : [...prev, sessionId]
    );
  };

  const handlePublishResults = async (sessionId: number) => {
    try {
      const res = await apiFetch(`/grading-portal/portal/${sessionId}/publish/`, {
        method: 'POST'
      });
      if (res.status === 200) {
        setAlertMsg({ type: 'success', text: 'Assessment results successfully published to student!' });
        fetchGradingQueue();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to publish results.');
      }
    } catch (err) {
      console.error(err);
      alert('Network request failed.');
    }
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideItem) return;
    try {
      const res = await apiFetch(`/grading-portal/portal/${overrideItem.id}/override/`, {
        method: 'POST',
        body: JSON.stringify({
          score: parseFloat(overrideScore),
          examiner_feedback: overrideFeedback
        })
      });
      if (res.status === 200) {
        setAlertMsg({ type: 'success', text: 'Grading override saved!' });
        setOverrideItem(null);
        fetchGradingQueue();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to submit score.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePDFSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfSubject || !pdfFile) {
      alert('Please fill subject and select a PDF file.');
      return;
    }

    setPdfLoading(true);
    const formData = new FormData();
    formData.append('subject', pdfSubject);
    formData.append('difficulty', pdfDifficulty);
    formData.append('file', pdfFile);

    try {
      const session = getAuthSession();
      const headers: { [key: string]: string } = {};
      if (session?.access) {
        headers['Authorization'] = `Bearer ${session.access}`;
      }

      const res = await fetch('http://localhost:8000/api/question-bank/questions/upload-pdf/', {
        method: 'POST',
        headers,
        body: formData
      });

      if (res.status === 201) {
        const data = await res.json();
        setAlertMsg({ type: 'success', text: data.message || 'PDF parsed successfully!' });
        setShowPDFModal(false);
        setPdfSubject('');
        setPdfFile(null);
        fetchQuestions();
        fetchUploadedPdfs();
      } else {
        const data = await res.json();
        setAlertMsg({ type: 'error', text: data.error || 'Failed to parse PDF.' });
      }
    } catch (err) {
      console.error(err);
      setAlertMsg({ type: 'error', text: 'Network error parsing PDF.' });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMsg({ type: '', text: '' });
    if (!sForm.username || !sForm.email || !sForm.name) {
      alert('Username, Email, and Full Name are required.');
      return;
    }
    setSLoading(true);
    try {
      const res = await apiFetch('/auth/create-student/', {
        method: 'POST',
        body: JSON.stringify({
          username: sForm.username,
          name: sForm.name,
          email: sForm.email,
          exam_id: sForm.exam_id ? parseInt(sForm.exam_id) : null
        })
      });
      const data = await res.json();
      if (res.status === 201) {
        setAlertMsg({ 
          type: 'success', 
          text: `Student ${data.username} created successfully! Password: ${data.password}. Credentials sent to ${sForm.email}.` 
        });
        setShowSModal(false);
        setSForm({ username: '', name: '', email: '', exam_id: '' });
        fetchAssociatedStudents();
      } else {
        setAlertMsg({ type: 'error', text: data.error || 'Failed to create student account.' });
      }
    } catch (err) {
      console.error(err);
      setAlertMsg({ type: 'error', text: 'Network error occurred.' });
    } finally {
      setSLoading(false);
    }
  };

  const handleSendMailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMsg({ type: '', text: '' });
    if (!mailForm.username || !mailForm.email || !mailForm.exam_id) {
      alert('All fields are required.');
      return;
    }
    setMailLoading(true);
    try {
      const res = await apiFetch('/auth/send-exam-link/', {
        method: 'POST',
        body: JSON.stringify({
          username: mailForm.username,
          email: mailForm.email,
          exam_id: parseInt(mailForm.exam_id)
        })
      });
      if (res.status === 200) {
        setAlertMsg({ type: 'success', text: `Exam link successfully sent to ${mailForm.email}!` });
        setShowMailModal(false);
        setMailForm({ username: '', email: '', exam_id: '' });
      } else {
        const data = await res.json();
        setAlertMsg({ type: 'error', text: data.error || 'Failed to send mail link.' });
      }
    } catch (err) {
      console.error(err);
      setAlertMsg({ type: 'error', text: 'Network error occurred.' });
    } finally {
      setMailLoading(false);
    }
  };

  const handleFinalizeSession = async (sessionId: number) => {
    try {
      const res = await apiFetch(`/grading-portal/portal/${sessionId}/publish/`, { method: 'POST' });
      if (res.status === 200) {
        showAlert('success', 'Session results successfully finalized and published!');
        fetchStudentResults();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to finalize session.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Section form handlers
  const addSectionToForm = () => {
    const newSec: ExamSectionForm = {
      name: `Section ${eForm.sections.length + 1}`,
      description: '',
      subject: eForm.subject || '',
      use_random: false,
      easy_count: 0,
      medium_count: 0,
      hard_count: 0,
      question_type: '',
      pdf_source_id: '',
      question_ids: []
    };
    setEForm({ ...eForm, sections: [...eForm.sections, newSec] });
  };

  const removeSectionFromForm = (idx: number) => {
    const updated = eForm.sections.filter((_, i) => i !== idx);
    setEForm({ ...eForm, sections: updated });
  };

  const handleSectionFormChange = (index: number, field: keyof ExamSectionForm, value: any) => {
    const updated = [...eForm.sections];
    updated[index] = { ...updated[index], [field]: value } as any;
    setEForm({ ...eForm, sections: updated });
  };

  const handleToggleQuestionSelection = (index: number, qId: number) => {
    const updated = [...eForm.sections];
    const currentList = updated[index].question_ids;
    if (currentList.includes(qId)) {
      updated[index].question_ids = currentList.filter(id => id !== qId);
    } else {
      updated[index].question_ids = [...currentList, qId];
    }
    setEForm({ ...eForm, sections: updated });
  };

  // Add Option to MCQ list
  const addOption = () => {
    setQForm({
      ...qForm,
      options: [...qForm.options, { text: '', is_correct: false }]
    });
  };

  const handleOptionChange = (index: number, field: string, value: any) => {
    const updated = [...qForm.options];
    if (field === 'is_correct' && qForm.question_type === 'mcq') {
      // Single correct choice constraint
      updated.forEach((opt, idx) => {
        opt.is_correct = idx === index;
      });
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setQForm({ ...qForm, options: updated });
  };

  // ─── Grouping Helpers ───────────────────────────────────────────
  // Group questions by subject -> PDF Source name (or 'Manual/Other')
  const getGroupedQuestions = () => {
    const grouped: { [subject: string]: { [pdfName: string]: Question[] } } = {};
    let filteredQuestions = questions;

    if (filterSubjects.length > 0) {
      filteredQuestions = filteredQuestions.filter(q => 
        filterSubjects.includes(q.subject)
      );
    }
    if (filterDifficulty) {
      filteredQuestions = filteredQuestions.filter(q => 
        q.difficulty === filterDifficulty
      );
    }
    if (filterType) {
      filteredQuestions = filteredQuestions.filter(q => 
        q.question_type === filterType
      );
    }

    filteredQuestions.forEach(q => {
      if (!grouped[q.subject]) {
        grouped[q.subject] = {};
      }
      const sourceKey = q.pdf_source_name || 'Manually Uploaded';
      if (!grouped[q.subject][sourceKey]) {
        grouped[q.subject][sourceKey] = [];
      }
      grouped[q.subject][sourceKey].push(q);
    });
    return grouped;
  };

  const groupedQuestions = getGroupedQuestions();

  // ─── Loading State ──────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div className="animated-bg"><div className="orb orb-1"/><div className="orb orb-2"/></div>
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={styles.loadingSpinner} />
          <p style={{ color: '#475569', marginTop: 16 }}>Loading evaluator console...</p>
        </div>
      </div>
    );
  }

  // ─── JSX Render ─────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      <div className="animated-bg"><div className="orb orb-1"/><div className="orb orb-2"/><div className="orb orb-3"/></div>

      {/* Top Navigation */}
      <nav style={styles.navbar}>
        <div style={styles.navBrand}>
          <span className="ai-dot" />
          <span style={styles.logo}>Examiner Portal</span>
        </div>
        <div style={styles.navActions}>
          <div style={styles.navUserChip}>
            <span style={styles.navUserName}>{user?.username}</span>
            <span style={styles.navUserRole}>{user?.role}</span>
          </div>
          <button onClick={handleLogout} className="btn-danger">Sign Out</button>
        </div>
      </nav>

      {/* Main Workspace */}
      <main style={styles.main}>
        {alertMsg.text && (
          <div style={alertMsg.type === 'success' ? styles.alertSuccess : styles.alertError}>
            {alertMsg.text}
          </div>
        )}

        {/* Tab Selection Header */}
        <div style={styles.tabHeader}>
          <button
            onClick={() => setActiveTab('queue')}
            className={activeTab === 'queue' ? 'tab-btn-active' : 'tab-btn'}
          >
            Grading Queue ({gradingQueue.length})
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={activeTab === 'questions' ? 'tab-btn-active' : 'tab-btn'}
          >
            Question Bank ({questions.length})
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            className={activeTab === 'exams' ? 'tab-btn-active' : 'tab-btn'}
          >
            Exams Config ({exams.length})
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={activeTab === 'students' ? 'tab-btn-active' : 'tab-btn'}
          >
            Students Portal ({associatedStudents.length})
          </button>
        </div>

        {/* TAB CONTENT: GRADING QUEUE (STUDENT ASSESSMENT SUBMISSIONS) */}
        {activeTab === 'queue' && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Subjective Assessment Queue</h2>
              <button onClick={fetchGradingQueue} className="btn-secondary btn-sm">Refresh Queue</button>
            </div>
            {gradingQueue.length === 0 ? (
              <div style={styles.emptyState}>
                <p>No student assessments currently pending review.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {gradingQueue.map((session) => {
                  const isExpanded = expandedSessionIds.includes(session.session_id);
                  const pendingCount = session.attempted_questions.filter(q => !q.is_evaluated).length;

                  return (
                    <div key={session.session_id} style={{ border: '1px solid #cbd5e1', borderRadius: '12px', background: '#ffffff', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                      {/* Card Header for Single Assessment taken by Student */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#f8fafc', borderBottom: isExpanded ? '1px solid #cbd5e1' : 'none' }}>
                        <div>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                            Student: <span style={{ color: '#2563eb' }}>{session.student_username}</span> ({session.student_email})
                          </div>
                          <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
                            Exam: <strong>{session.exam_title}</strong> | Questions: <strong>{session.attempted_count} Attempted</strong> / {session.total_questions} Total ({session.unanswered_count} Unanswered)
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          {session.is_fully_evaluated ? (
                            <span style={{ backgroundColor: '#dcfce7', color: '#15803d', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', border: '1px solid #bbf7d0' }}>
                              ✓ All Graded
                            </span>
                          ) : (
                            <span style={{ backgroundColor: '#fef3c7', color: '#b45309', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', border: '1px solid #fde68a' }}>
                              Pending Review ({pendingCount} Pending)
                            </span>
                          )}

                          <button 
                            onClick={() => toggleSessionExpanded(session.session_id)}
                            className="btn-secondary btn-sm"
                            style={{ fontSize: '13px', padding: '6px 14px' }}
                          >
                            {isExpanded ? 'Collapse Assessment ▲' : 'View & Grade Assessment ▼'}
                          </button>

                          <button
                            onClick={() => handlePublishResults(session.session_id)}
                            className="btn-primary btn-sm"
                            style={{ fontSize: '13px', padding: '6px 14px', backgroundColor: '#10b981', borderColor: '#10b981' }}
                          >
                            Publish Results 🚀
                          </button>
                        </div>
                      </div>

                      {/* Expanded Single Assessment Body */}
                      {isExpanded && (
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                          
                          {/* 1. ATTEMPTED QUESTIONS SECTION (TO GRADE) */}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', borderBottom: '2px solid #2563eb', paddingBottom: '8px' }}>
                              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e3a8a' }}>
                                📝 Attempted Questions ({session.attempted_questions.length})
                              </h3>
                              <span style={{ fontSize: '12px', color: '#64748b' }}>Attempted answers submitted by student</span>
                            </div>

                            {session.attempted_questions.length === 0 ? (
                              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '14px' }}>
                                No attempted questions submitted for this assessment.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {session.attempted_questions.map((item, idx) => (
                                  <div key={item.id} style={{ border: '1px solid #cbd5e1', borderRadius: '10px', padding: '16px', backgroundColor: '#ffffff', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#000000' }}>
                                        Q{idx + 1}. <span style={{ textTransform: 'capitalize', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', marginLeft: '6px', fontWeight: 600 }}>{item.question_type.replace(/_/g, ' ')}</span>
                                      </span>
                                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                                        Max Marks: <strong>{item.marks}</strong> | {item.is_evaluated ? (
                                          <span style={{ color: '#16a34a', fontWeight: 700 }}>Graded ({item.score} Marks)</span>
                                        ) : (
                                          <span style={{ color: '#d97706', fontWeight: 700 }}>Pending Review</span>
                                        )}
                                      </span>
                                    </div>

                                    <p style={{ fontSize: '15px', color: '#000000', fontWeight: 600, margin: '0 0 12px 0' }}>{item.question_text}</p>

                                    {/* Student Response */}
                                    <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '12px' }}>
                                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>STUDENT ANSWER:</div>
                                      {item.text_answer ? (
                                        <p style={{ margin: 0, fontSize: '14px', color: '#000000', fontWeight: 500, whiteSpace: 'pre-wrap' }}>{item.text_answer}</p>
                                      ) : item.image_answer_url ? (
                                        <a href={`http://localhost:8000${item.image_answer_url}`} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'underline' }}>
                                          🖼️ View Handwritten Answer Sheet Image
                                        </a>
                                      ) : (
                                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No answer text submitted</span>
                                      )}
                                    </div>

                                    {/* AI Justification */}
                                    {item.ai_justification && (
                                      <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', color: '#166534' }}>
                                        <strong>🤖 AI Grading Assist Report:</strong> {item.ai_justification}
                                      </div>
                                    )}

                                    {/* Action button */}
                                    <div>
                                      <button
                                        onClick={() => {
                                          setOverrideItem({ ...item, student_username: session.student_username });
                                          setOverrideScore(item.score !== undefined ? String(item.score) : '');
                                          setOverrideFeedback(item.examiner_feedback || '');
                                        }}
                                        className="btn-primary btn-sm"
                                        style={{ fontSize: '12px', padding: '6px 14px' }}
                                      >
                                        {item.is_evaluated ? 'Edit Grade / Feedback' : 'Grade Submission'}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 2. UNANSWERED QUESTIONS SECTION (BELOW ATTEMPTED QUESTIONS) */}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', borderBottom: '2px dashed #94a3b8', paddingBottom: '8px' }}>
                              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#64748b' }}>
                                ⏸️ Unanswered / Skipped Questions ({session.unanswered_questions.length})
                              </h3>
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Questions left unattempted by student</span>
                            </div>

                            {session.unanswered_questions.length === 0 ? (
                              <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#16a34a', fontSize: '13px', fontWeight: 600 }}>
                                🎉 Student attempted all questions in this assessment paper!
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {session.unanswered_questions.map((uq, uIdx) => (
                                  <div key={uq.question_id || uIdx} style={{ border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '14px', backgroundColor: '#f8fafc', opacity: 0.9 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                                        Q{session.attempted_questions.length + uIdx + 1}. <span style={{ textTransform: 'capitalize', background: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', marginLeft: '6px', fontWeight: 600 }}>{uq.question_type.replace(/_/g, ' ')}</span>
                                      </span>
                                      <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                        Unanswered (0 / {uq.marks} Marks)
                                      </span>
                                    </div>
                                    <p style={{ fontSize: '14px', color: '#000000', margin: '0 0 6px 0', fontWeight: 600 }}>{uq.question_text}</p>
                                    <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                                      Student did not attempt or submit an answer for this question.
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB CONTENT: QUESTION BANK (GROUPED BY SUBJECT & PDF SOURCE) */}
        {activeTab === 'questions' && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Question Repository</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowSubjectManager(!showSubjectManager)} className="btn-secondary btn-sm">
                  {showSubjectManager ? 'Close Subject Manager' : 'Manage Subjects'}
                </button>
                <button onClick={() => setShowPDFModal(true)} className="btn-success btn-sm">Scan Question PDF</button>
                <button onClick={() => setShowQModal(true)} className="btn-primary btn-sm">Add Question</button>
              </div>
            </div>

            {/* Subject Manager Panel */}
            {showSubjectManager && (
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#fbbf24' }}>Manage Assessment Subjects</h4>
                
                {/* Add Subject form */}
                <form onSubmit={handleAddSubject} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <input
                    type="text"
                    placeholder="Enter new subject name (e.g. History)..."
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    style={{ ...styles.input, margin: 0, flex: 1 }}
                    required
                  />
                  <button type="submit" className="btn-primary">Add Subject</button>
                </form>

                {/* List of subjects */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {subjects.map(sub => (
                    <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f1f5f9', padding: '6px 12px', borderRadius: '20px', border: '1px solid #cbd5e1' }}>
                      <span style={{ fontSize: '13px', color: '#000000', fontWeight: 600 }}>{sub.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteSubject(sub.id)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 700, padding: 0, fontSize: '14px' }}
                        title="Delete Subject"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {subjects.length === 0 && (
                    <div style={{ fontSize: '13px', color: '#64748b' }}>No subjects defined yet. Add one above.</div>
                  )}
                </div>
              </div>
            )}

            {/* Search and Filters Bar */}
            <div style={{ display: 'flex', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
                <label style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>Filter Subjects</label>
                <button
                  type="button"
                  onClick={() => setSubjectDropdownOpen(!subjectDropdownOpen)}
                  style={{
                    ...styles.input,
                    margin: 0,
                    textAlign: 'left',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'var(--foreground)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '13px'
                  }}
                >
                  <span>
                    {filterSubjects.length === 0
                      ? 'All Subjects'
                      : filterSubjects.length <= 2
                        ? filterSubjects.join(', ')
                        : `${filterSubjects.length} Selected`}
                  </span>
                  <span>▼</span>
                </button>
                {subjectDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                      zIndex: 100,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      padding: '8px',
                      marginTop: '4px'
                    }}
                  >
                    {subjects.map((sub) => {
                      const isChecked = filterSubjects.includes(sub.name);
                      return (
                        <label
                          key={sub.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 8px',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            fontSize: '13px',
                            color: '#000000',
                            userSelect: 'none'
                          }}
                          className="hover-bg-slate"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setFilterSubjects(filterSubjects.filter(name => name !== sub.name));
                              } else {
                                setFilterSubjects([...filterSubjects, sub.name]);
                              }
                            }}
                          />
                          <span>{sub.name}</span>
                        </label>
                      );
                    })}
                    {subjects.length === 0 && (
                      <div style={{ padding: '8px', color: '#475569', fontSize: '12px' }}>
                        No subjects defined.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>Filter Difficulty</label>
                <select
                  value={filterDifficulty}
                  onChange={(e) => setFilterDifficulty(e.target.value)}
                  style={styles.select}
                >
                  <option value="">All Difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>Filter Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  style={styles.select}
                >
                  <option value="">All Types</option>
                  <option value="mcq">Multiple Choice (MCQ)</option>
                  <option value="multi_select">Multi Select Checkboxes</option>
                  <option value="one_word">Answer in One Word</option>
                  <option value="fill_blank">Fill in the Blank</option>
                  <option value="short_answer">Short Answer</option>
                  <option value="long_answer">Long Answer</option>
                  <option value="image_upload">Handwritten Image Upload</option>
                </select>
              </div>
            </div>

            {/* Bulk Selection Actions Bar */}
            {selectedQIds.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef2f2', border: '1px solid #fca5a5', padding: '12px 18px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>✓</span>
                  <span>{selectedQIds.length} question(s) selected for deletion</span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setSelectedQIds([])} className="btn-secondary btn-sm" style={{ padding: '6px 14px', fontSize: '12px' }}>
                    Deselect All
                  </button>
                  <button onClick={handleBulkDeleteQuestions} className="btn-danger btn-sm" style={{ padding: '6px 16px', fontSize: '12px', background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
                    🗑️ Delete Selected Questions ({selectedQIds.length})
                  </button>
                </div>
              </div>
            )}

            {Object.keys(groupedQuestions).length === 0 ? (
              <div style={styles.emptyState}>
                <p>No questions found matching the filter criteria.</p>
              </div>
            ) : (
              <div style={styles.subjectContainer}>
                {Object.keys(groupedQuestions).map(subject => (
                  <div key={subject} style={styles.subjectCard} className="card-hover">
                    <div style={styles.subjectTitle}>{subject}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
                      
                      {Object.keys(groupedQuestions[subject]).map(pdfSource => (
                        <div key={pdfSource} style={styles.pdfSourceBox}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '4px', borderBottom: '1px dashed #cbd5e1' }}>
                            <span style={styles.pdfSourceTitle}>Source: {pdfSource}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const sourceQIds = groupedQuestions[subject][pdfSource].map(q => q.id);
                                const allSelected = sourceQIds.every(id => selectedQIds.includes(id));
                                if (allSelected) {
                                  setSelectedQIds(prev => prev.filter(id => !sourceQIds.includes(id)));
                                } else {
                                  setSelectedQIds(prev => Array.from(new Set([...prev, ...sourceQIds])));
                                }
                              }}
                              className="btn-ghost btn-sm"
                              style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: 'none' }}
                            >
                              {groupedQuestions[subject][pdfSource].every(q => selectedQIds.includes(q.id)) ? '✓ Deselect Group' : '☐ Select All in Group'}
                            </button>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                            {groupedQuestions[subject][pdfSource].map((q) => (
                              <div key={q.id} style={{ ...styles.miniQuestionRow, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', borderLeft: selectedQIds.includes(q.id) ? '4px solid #ef4444' : 'none', background: selectedQIds.includes(q.id) ? '#fef2f2' : '#ffffff' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                                  <input
                                    type="checkbox"
                                    checked={selectedQIds.includes(q.id)}
                                    onChange={() => toggleSelectQId(q.id)}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer', marginTop: '3px' }}
                                    title="Select question for bulk deletion"
                                  />
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '14px', color: '#000000', fontWeight: 600 }}>{q.text}</div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                                      <span style={styles.miniBadge}>{(q.question_type || 'question').toUpperCase().replace(/_/g, ' ')}</span>
                                      <span style={styles.miniBadge}>{q.difficulty.toUpperCase()}</span>
                                      <span style={styles.miniBadge}>{q.marks} Marks</span>
                                    </div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button 
                                    onClick={() => startEditQuestion(q)} 
                                    className="btn-secondary btn-sm"
                                    style={{ padding: '4px 10px', fontSize: '12px' }}
                                  >
                                    Edit
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteQuestion(q.id)} 
                                    className="btn-danger btn-sm"
                                    style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB CONTENT: EXAMS CONFIG */}
        {activeTab === 'exams' && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Examination Papers</h2>
              <button onClick={() => setShowEModal(true)} className="btn-primary btn-sm">Configure Exam</button>
            </div>
            {exams.length === 0 ? (
              <div style={styles.emptyState}>
                <p>No exams configured. Create one to schedule tests.</p>
              </div>
            ) : (
              <div style={styles.grid}>
                {exams.map((ex) => (
                  <div key={ex.id} style={styles.card} className="card-hover">
                    <div style={styles.cardHeader}>
                      <span style={styles.cardTitle}>{ex.title}</span>
                      <span style={styles.subjectBadge}>{ex.subject}</span>
                    </div>
                    <p style={styles.examMeta}>Duration: {ex.duration_minutes} Minutes</p>
                    <p style={styles.examMeta}>Window: {new Date(ex.start_window).toLocaleString()} - {new Date(ex.end_window).toLocaleString()}</p>
                    <div style={styles.examCardRules}>
                      Proctoring: {ex.enable_webcam ? 'Webcam Enabled' : 'No Webcam Required'}
                    </div>
                    <div style={styles.cardFooter}>
                      <button 
                        onClick={() => {
                          setAssigningExam(ex);
                          setSelectedStudentIds([]);
                        }} 
                        className="btn-success btn-sm"
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        Assign Exam to Candidates
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB CONTENT: STUDENTS PORTAL */}
        {activeTab === 'students' && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Students Directory</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowMailModal(true)} className="btn-secondary btn-sm">Email Exam Link</button>
                <button onClick={() => setShowSModal(true)} className="btn-primary btn-sm">Register Student Profile</button>
              </div>
            </div>

            <div style={styles.studentWorkspace}>
              <div style={styles.searchPanel}>
                <h4 style={{ margin: '0 0 10px 0', color: 'var(--accent)', fontSize: '14px' }}>Lookup Candidate Database</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Search name, email, or username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={styles.input}
                  />
                  <button onClick={handleStudentSearch} className="btn-primary">Search</button>
                </div>

                {searchResults.length > 0 && (
                  <div style={styles.searchResultsBox}>
                    <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#64748b' }}>Search Results:</h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {searchResults.map(s => (
                        <div key={s.id} style={styles.studentSearchRow}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13px' }}>{s.name} ({s.username})</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{s.email}</div>
                          </div>
                          <div>
                            {s.associated ? (
                              <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>Associated</span>
                            ) : (
                              <button 
                                onClick={async () => {
                                  try {
                                    // Associate student
                                    const res = await apiFetch(`/auth/admin/users/${s.id}/`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ examiner: user?.username ? s.id : null }) 
                                    });
                                    if (res.status === 200) {
                                      showAlert('success', 'Student associated successfully!');
                                      fetchAssociatedStudents();
                                      handleStudentSearch();
                                    }
                                  } catch (err) {
                                    console.error(err);
                                  }
                                }} 
                                className="btn-ghost btn-sm"
                              >
                                Associate
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={styles.associatedListCard}>
                <h4 style={{ margin: '0 0 16px 0', color: 'var(--foreground)', fontSize: '15px' }}>Associated Candidates & Audits</h4>
                {associatedStudents.length === 0 ? (
                  <div style={styles.emptyState}>No students currently associated with your account.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {associatedStudents.map(st => {
                      const studentSess = studentResults.filter(r => r.student_id === st.id);
                      return (
                        <div key={st.id} style={styles.studentListRow}>
                          <div style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '10px', marginBottom: '10px' }}>
                            <div style={{ fontWeight: 700, fontSize: '14px', color: '#38bdf8' }}>{st.name}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{st.email} | Username: {st.username}</div>
                          </div>

                          {studentSess.length === 0 ? (
                            <div style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic' }}>No exams assigned or started.</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {studentSess.map(sess => (
                                <div key={sess.session_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.02)', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                                  <div>
                                    <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>{sess.exam_title}</div>
                                    <div style={{ fontSize: '11px', color: '#475569', textTransform: 'capitalize' }}>Status: {(sess.status || 'unknown').replace(/_/g, ' ')}</div>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    {sess.finalized ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                        <span style={{ color: '#10b981', fontWeight: 700 }}>Published</span>
                                        <span style={{ fontSize: '11px', color: '#cbd5e1' }}>{sess.score} Marks</span>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        {['submitted', 'auto_submitted', 'flagged'].includes(sess.status) ? (
                                          <>
                                            <span style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 600 }}>Awaiting Audit</span>
                                            <button 
                                              onClick={() => handleFinalizeSession(sess.session_id)} 
                                              className="btn-success btn-sm"
                                              style={{ padding: '3px 8px', fontSize: '11px' }}
                                            >
                                              Finalize Results
                                            </button>
                                          </>
                                        ) : (
                                          <span style={{ color: '#475569', fontStyle: 'italic' }}>In Progress</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ─── MODAL: CREATE QUESTION ─── */}
      {showQModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>{editingQuestionId ? 'Edit Question Details' : 'Add Question to Bank'}</h3>
            <form onSubmit={handleCreateQuestion} style={styles.form}>
              <div style={styles.row}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Subject</label>
                  <select
                    value={qForm.subject}
                    onChange={(e) => setQForm({ ...qForm, subject: e.target.value })}
                    style={styles.select}
                    required
                  >
                    <option value="">Select Subject</option>
                    {subjects.map(sub => (
                      <option key={sub.id} value={sub.name}>{sub.name}</option>
                    ))}
                  </select>
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Difficulty</label>
                  <select
                    value={qForm.difficulty}
                    onChange={(e) => setQForm({ ...qForm, difficulty: e.target.value as any })}
                    style={styles.select}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <div style={styles.row}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Question Type</label>
                  <select
                    value={qForm.question_type}
                    onChange={(e) => setQForm({ ...qForm, question_type: e.target.value })}
                    style={styles.select}
                  >
                    <option value="mcq">Multiple Choice (MCQ)</option>
                    <option value="multi_select">Multi Select Checkboxes</option>
                    <option value="one_word">Answer in One Word</option>
                    <option value="fill_blank">Fill in the Blank</option>
                    <option value="short_answer">Short Answer (Subjective)</option>
                    <option value="long_answer">Long Answer (Subjective)</option>
                    <option value="image_upload">Handwritten Image Upload</option>
                  </select>
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Marks</label>
                  <input
                    type="number"
                    value={isNaN(qForm.marks) ? '' : qForm.marks}
                    onChange={(e) => setQForm({ ...qForm, marks: parseInt(e.target.value) || 0 })}
                    style={styles.input}
                    min="1"
                  />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Question Text</label>
                <textarea
                  value={qForm.text}
                  onChange={(e) => setQForm({ ...qForm, text: e.target.value })}
                  style={styles.textarea}
                  rows={3}
                  required
                />
              </div>

              {['mcq', 'multi_select'].includes(qForm.question_type) && (
                <div style={styles.optionsSection}>
                  <div style={styles.rowBetween}>
                    <label style={styles.label}>Options / Choices</label>
                    <button type="button" onClick={addOption} style={styles.linkBtn}>+ Add Choice</button>
                  </div>
                  {qForm.options.map((opt, index) => (
                    <div key={index} style={styles.optionRow}>
                      <input
                        type={qForm.question_type === 'mcq' ? 'radio' : 'checkbox'}
                        name="correct_choice"
                        checked={opt.is_correct}
                        onChange={(e) => handleOptionChange(index, 'is_correct', e.target.checked)}
                      />
                      <input
                        type="text"
                        placeholder={`Choice ${index + 1}`}
                        value={opt.text}
                        onChange={(e) => handleOptionChange(index, 'text', e.target.value)}
                        style={styles.optionInput}
                        required
                      />
                    </div>
                  ))}
                </div>
              )}

              {['short_answer', 'long_answer', 'image_upload', 'one_word', 'fill_blank'].includes(qForm.question_type) && (
                <div style={styles.inputGroup}>
                  <label style={styles.label}>
                    {['one_word', 'fill_blank'].includes(qForm.question_type) 
                      ? 'Correct Answer Text' 
                      : 'Model Answer / Grading Rubrics Guidelines'}
                  </label>
                  <textarea
                    value={qForm.model_answer}
                    onChange={(e) => setQForm({ ...qForm, model_answer: e.target.value })}
                    style={styles.textarea}
                    rows={2}
                    placeholder={['one_word', 'fill_blank'].includes(qForm.question_type) 
                      ? "Enter the exact correct answer word or phrase..." 
                      : "Enter guidelines to assist AI / Manual evaluation..."}
                    required={['one_word', 'fill_blank'].includes(qForm.question_type)}
                  />
                </div>
              )}

              <div style={styles.modalActions}>
                <button 
                  type="button" 
                  onClick={() => { setShowQModal(false); setEditingQuestionId(null); }} 
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingQuestionId ? 'Save Updates' : 'Add Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADVANCED EXAM CONFIGURATION (MULTIPLE SECTIONS) ─── */}
      {showEModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: '800px' }}>
            <h3 style={styles.modalTitle}>Configure Assessment & Sections</h3>
            <form onSubmit={handleCreateExam} style={styles.form}>
              <div style={styles.row}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Exam Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Physics mid-term"
                    value={eForm.title}
                    onChange={(e) => setEForm({ ...eForm, title: e.target.value })}
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Subject</label>
                  <select
                    value={eForm.subject}
                    onChange={(e) => setEForm({ ...eForm, subject: e.target.value })}
                    style={styles.select}
                    required
                  >
                    <option value="">Select Subject</option>
                    {subjects.map(sub => (
                      <option key={sub.id} value={sub.name}>{sub.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.row}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Duration (Minutes - Min 45 mins)</label>
                  <input
                    type="number"
                    value={isNaN(eForm.duration_minutes) ? '' : eForm.duration_minutes}
                    onChange={(e) => setEForm({ ...eForm, duration_minutes: parseInt(e.target.value) || 0 })}
                    style={styles.input}
                    min="45"
                    required
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Start Window</label>
                  <input
                    type="datetime-local"
                    value={eForm.start_window}
                    onChange={(e) => setEForm({ ...eForm, start_window: e.target.value })}
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>End Window</label>
                  <input
                    type="datetime-local"
                    value={eForm.end_window}
                    onChange={(e) => setEForm({ ...eForm, end_window: e.target.value })}
                    style={styles.input}
                    required
                  />
                </div>
              </div>

              <div style={styles.row}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Grading Evaluation Mode</label>
                  <select
                    value={eForm.grading_mode}
                    onChange={(e) => setEForm({ ...eForm, grading_mode: e.target.value })}
                    style={styles.select}
                  >
                    <option value="ai_checked">AI Checked (AI drafts scores, examiner audits & finalizes)</option>
                    <option value="manual_checked">Manual Checked (Examiner scores manually from scratch)</option>
                  </select>
                </div>
              </div>

              {/* Difficulty Marking Scheme */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px', marginTop: '10px' }}>
                <label style={{ ...styles.label, fontSize: '13px', color: '#fbbf24', display: 'block', marginBottom: '10px' }}>Difficulty Marking Scheme Configuration</label>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  
                  {/* Easy */}
                  <div style={{ flex: '1 1 200px', background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '12px', color: '#10b981', marginBottom: '8px' }}>Easy Questions</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={styles.inputGroup}>
                        <label style={{ fontSize: '10px', color: '#94a3b8' }}>Correct Marks</label>
                        <input
                          type="number"
                          value={isNaN(eForm.easy_marks) ? '' : eForm.easy_marks}
                          onChange={(e) => setEForm({ ...eForm, easy_marks: parseFloat(e.target.value) || 0 })}
                          style={{ ...styles.input, padding: '4px 8px', fontSize: '12px' }}
                          min="0.5"
                          step="0.5"
                          required
                        />
                      </div>
                      <div style={styles.inputGroup}>
                        <label style={{ fontSize: '10px', color: '#94a3b8' }}>Negative Marks</label>
                        <input
                          type="number"
                          value={isNaN(eForm.easy_negative_marks) ? '' : eForm.easy_negative_marks}
                          onChange={(e) => setEForm({ ...eForm, easy_negative_marks: parseFloat(e.target.value) || 0 })}
                          style={{ ...styles.input, padding: '4px 8px', fontSize: '12px' }}
                          min="0"
                          step="0.25"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Medium */}
                  <div style={{ flex: '1 1 200px', background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '12px', color: '#3b82f6', marginBottom: '8px' }}>Medium Questions</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={styles.inputGroup}>
                        <label style={{ fontSize: '10px', color: '#94a3b8' }}>Correct Marks</label>
                        <input
                          type="number"
                          value={isNaN(eForm.medium_marks) ? '' : eForm.medium_marks}
                          onChange={(e) => setEForm({ ...eForm, medium_marks: parseFloat(e.target.value) || 0 })}
                          style={{ ...styles.input, padding: '4px 8px', fontSize: '12px' }}
                          min="0.5"
                          step="0.5"
                          required
                        />
                      </div>
                      <div style={styles.inputGroup}>
                        <label style={{ fontSize: '10px', color: '#94a3b8' }}>Negative Marks</label>
                        <input
                          type="number"
                          value={isNaN(eForm.medium_negative_marks) ? '' : eForm.medium_negative_marks}
                          onChange={(e) => setEForm({ ...eForm, medium_negative_marks: parseFloat(e.target.value) || 0 })}
                          style={{ ...styles.input, padding: '4px 8px', fontSize: '12px' }}
                          min="0"
                          step="0.25"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Hard */}
                  <div style={{ flex: '1 1 200px', background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '12px', color: '#ef4444', marginBottom: '8px' }}>Hard Questions</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={styles.inputGroup}>
                        <label style={{ fontSize: '10px', color: '#94a3b8' }}>Correct Marks</label>
                        <input
                          type="number"
                          value={isNaN(eForm.hard_marks) ? '' : eForm.hard_marks}
                          onChange={(e) => setEForm({ ...eForm, hard_marks: parseFloat(e.target.value) || 0 })}
                          style={{ ...styles.input, padding: '4px 8px', fontSize: '12px' }}
                          min="0.5"
                          step="0.5"
                          required
                        />
                      </div>
                      <div style={styles.inputGroup}>
                        <label style={{ fontSize: '10px', color: '#94a3b8' }}>Negative Marks</label>
                        <input
                          type="number"
                          value={isNaN(eForm.hard_negative_marks) ? '' : eForm.hard_negative_marks}
                          onChange={(e) => setEForm({ ...eForm, hard_negative_marks: parseFloat(e.target.value) || 0 })}
                          style={{ ...styles.input, padding: '4px 8px', fontSize: '12px' }}
                          min="0"
                          step="0.25"
                          required
                        />
                      </div>
                    </div>
                  </div>

                </div>
              </div>


              {/* Multi-Section Area */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                <div style={styles.rowBetween}>
                  <label style={{ ...styles.label, fontSize: '13px', color: '#38bdf8' }}>Exam Sections Configuration</label>
                  <button type="button" onClick={addSectionToForm} className="btn-secondary btn-sm">+ Add Section</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                  {eForm.sections.map((sec, sIdx) => (
                    <div key={sIdx} style={styles.sectionBlock}>
                      <div style={styles.rowBetween}>
                        <h4 style={{ margin: 0, fontSize: '13px', color: '#fbbf24' }}>Section {sIdx + 1}</h4>
                        <button type="button" onClick={() => removeSectionFromForm(sIdx)} className="btn-danger btn-sm" style={{ padding: '2px 8px', fontSize: '11px' }}>Remove</button>
                      </div>

                      <div style={styles.row} className="mt-2">
                        <div style={styles.inputGroup}>
                          <label style={styles.label}>Section Name</label>
                          <input
                            type="text"
                            value={sec.name}
                            onChange={(e) => handleSectionFormChange(sIdx, 'name', e.target.value)}
                            style={styles.input}
                            required
                          />
                        </div>
                        <div style={styles.inputGroup}>
                          <label style={styles.label}>Section Subject</label>
                          <select
                            value={sec.subject || ''}
                            onChange={(e) => handleSectionFormChange(sIdx, 'subject', e.target.value)}
                            style={styles.select}
                          >
                            <option value="">Default ({eForm.subject || 'All Subjects'})</option>
                            {subjects.map(sub => (
                              <option key={sub.id} value={sub.name}>{sub.name}</option>
                            ))}
                          </select>
                        </div>
                        <div style={styles.inputGroup}>
                          <label style={styles.label}>Description</label>
                          <input
                            type="text"
                            value={sec.description}
                            onChange={(e) => handleSectionFormChange(sIdx, 'description', e.target.value)}
                            style={styles.input}
                          />
                        </div>
                      </div>

                      <div style={{ marginTop: '10px' }}>
                        <label style={styles.chkLabel}>
                          <input
                            type="checkbox"
                            checked={sec.use_random}
                            onChange={(e) => handleSectionFormChange(sIdx, 'use_random', e.target.checked)}
                          />
                          Use Random Selection Rules for this Section
                        </label>
                      </div>

                      {sec.use_random ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px' }}>
                          <div style={styles.row}>
                            <div style={styles.inputGroup}>
                              <label style={styles.label}>Easy Count</label>
                              <input type="number" min="0" value={sec.easy_count} onChange={e => handleSectionFormChange(sIdx, 'easy_count', parseInt(e.target.value) || 0)} style={styles.input} />
                            </div>
                            <div style={styles.inputGroup}>
                              <label style={styles.label}>Medium Count</label>
                              <input type="number" min="0" value={sec.medium_count} onChange={e => handleSectionFormChange(sIdx, 'medium_count', parseInt(e.target.value) || 0)} style={styles.input} />
                            </div>
                            <div style={styles.inputGroup}>
                              <label style={styles.label}>Hard Count</label>
                              <input type="number" min="0" value={sec.hard_count} onChange={e => handleSectionFormChange(sIdx, 'hard_count', parseInt(e.target.value) || 0)} style={styles.input} />
                            </div>
                          </div>

                          <div style={styles.row}>
                            <div style={styles.inputGroup}>
                              <label style={styles.label}>Question Type Filter</label>
                              <select value={sec.question_type} onChange={e => handleSectionFormChange(sIdx, 'question_type', e.target.value)} style={styles.select}>
                                <option value="">Any Type</option>
                                <option value="mcq">MCQ</option>
                                <option value="multi_select">Multi Select</option>
                                <option value="short_answer">Short Answer</option>
                                <option value="long_answer">Long Answer</option>
                              </select>
                            </div>
                            <div style={styles.inputGroup}>
                              <label style={styles.label}>PDF Source Filter</label>
                              <select value={sec.pdf_source_id} onChange={e => handleSectionFormChange(sIdx, 'pdf_source_id', e.target.value)} style={styles.select}>
                                <option value="">Any PDF / Source</option>
                                {uploadedPdfs.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: '10px', padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                          <label style={styles.label}>Select Questions from Bank:</label>
                          {questions.length === 0 ? (
                            <div style={{ color: '#475569', fontSize: '12px', marginTop: '6px' }}>No questions available.</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                              {questions.map(q => (
                                <label key={q.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                                  <input
                                    type="checkbox"
                                    checked={sec.question_ids.includes(q.id)}
                                    onChange={() => handleToggleQuestionSelection(sIdx, q.id)}
                                  />
                                  <span style={{ color: '#000000', fontWeight: 500 }}>{q.text} <strong style={{ color: 'var(--accent)' }}>({q.marks}M)</strong></span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Proctoring configurations */}
              <div style={styles.checkboxGroup}>
                <label style={styles.chkLabel}>
                  <input
                    type="checkbox"
                    checked={eForm.enable_webcam}
                    onChange={(e) => setEForm({ ...eForm, enable_webcam: e.target.checked })}
                  />
                  Enable Webcam Monitoring (AI Proctoring)
                </label>
              </div>

              {eForm.enable_webcam && (
                <div style={styles.row}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Gaze Sensitivity</label>
                    <input
                      type="text"
                      value={eForm.gaze_sensitivity}
                      onChange={(e) => setEForm({ ...eForm, gaze_sensitivity: e.target.value })}
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Max Tab Warnings</label>
                    <input
                      type="number"
                      value={isNaN(eForm.max_tab_switches) ? '' : eForm.max_tab_switches}
                      onChange={(e) => setEForm({ ...eForm, max_tab_switches: parseInt(e.target.value) || 0 })}
                      style={styles.input}
                    />
                  </div>
                </div>
              )}

              <div style={styles.modalActions}>
                <button type="button" onClick={() => setShowEModal(false)} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-primary">Schedule Exam</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ASSIGN EXAM TO CANDIDATES ─── */}
      {assigningExam && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Assign Exam: {assigningExam.title}</h3>
            <form onSubmit={handleAssignExamSubmit} style={styles.form}>
              <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                Select associated candidates to assign this examination paper:
              </p>
              
              <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                {associatedStudents.length === 0 ? (
                  <div style={{ color: '#475569', fontSize: '13px', textAlign: 'center', padding: '16px' }}>No associated students found.</div>
                ) : (
                  associatedStudents.map(st => {
                    const isChecked = selectedStudentIds.includes(st.id);
                    return (
                      <label key={st.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedStudentIds(selectedStudentIds.filter(id => id !== st.id));
                            } else {
                              setSelectedStudentIds([...selectedStudentIds, st.id]);
                            }
                          }}
                        />
                        <span>{st.name} ({st.username})</span>
                      </label>
                    );
                  })
                )}
              </div>

              <div style={styles.modalActions}>
                <button type="button" onClick={() => setAssigningExam(null)} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-primary" disabled={selectedStudentIds.length === 0}>
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: SCAN & IMPORT PDF ─── */}
      {showPDFModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Scan & Import Question Paper PDF</h3>
            <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '20px' }}>
              Upload an exam question paper PDF. The system will automatically parse and convert it into structured MCQ, short, and long questions.
            </p>
            
            <form onSubmit={handlePDFSubmit} style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Subject / Category Name</label>
                <select
                  value={pdfSubject}
                  onChange={(e) => setPdfSubject(e.target.value)}
                  style={styles.select}
                  required
                >
                  <option value="">Select Subject</option>
                  {subjects.map(sub => (
                    <option key={sub.id} value={sub.name}>{sub.name}</option>
                  ))}
                </select>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Default Question Difficulty</label>
                <select
                  value={pdfDifficulty}
                  onChange={(e) => setPdfDifficulty(e.target.value)}
                  style={styles.select}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Upload PDF File</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setPdfFile(e.target.files[0]);
                    }
                  }}
                  style={{ ...styles.input, padding: '8px' }}
                  required
                />
              </div>

              <div style={styles.modalActions}>
                <button 
                  type="button" 
                  onClick={() => {
                    if (!pdfLoading) {
                      setShowPDFModal(false);
                      setPdfSubject('');
                      setPdfFile(null);
                    }
                  }} 
                  className="btn-ghost"
                  disabled={pdfLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-success"
                  disabled={pdfLoading}
                >
                  {pdfLoading ? 'Analyzing & Uploading...' : 'Start PDF Scan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: REGISTER STUDENT ─── */}
      {showSModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Register Student Profile</h3>
            <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '20px' }}>
              Create a new student profile. They will receive their credentials and assigned exam details via email.
            </p>
            
            <form onSubmit={handleCreateStudent} style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Student Username</label>
                <input
                  type="text"
                  placeholder="e.g. student123"
                  value={sForm.username}
                  onChange={(e) => setSForm({ ...sForm, username: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={sForm.name}
                  onChange={(e) => setSForm({ ...sForm, name: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Email Address</label>
                <input
                  type="email"
                  placeholder="student@example.com"
                  value={sForm.email}
                  onChange={(e) => setSForm({ ...sForm, email: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Assign Exam (Optional)</label>
                <select
                  value={sForm.exam_id}
                  onChange={(e) => setSForm({ ...sForm, exam_id: e.target.value })}
                  style={styles.select}
                >
                  <option value="">Do Not Assign Exam Yet</option>
                  {exams.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.title}</option>
                  ))}
                </select>
              </div>

              <div style={styles.modalActions}>
                <button type="button" onClick={() => setShowSModal(false)} className="btn-ghost" disabled={sLoading}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={sLoading}>
                  {sLoading ? 'Registering...' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: EMAIL EXAM LINK ─── */}
      {showMailModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Email Exam Link to Student</h3>
            <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '20px' }}>
              Send an email containing a direct exam link to a registered student.
            </p>
            
            <form onSubmit={handleSendMailLink} style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Student Username</label>
                <input
                  type="text"
                  placeholder="studentusername"
                  value={mailForm.username}
                  onChange={(e) => setMailForm({ ...mailForm, username: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Student Email Address</label>
                <input
                  type="email"
                  placeholder="student@example.com"
                  value={mailForm.email}
                  onChange={(e) => setMailForm({ ...mailForm, email: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Select Exam</label>
                <select
                  value={mailForm.exam_id}
                  onChange={(e) => setMailForm({ ...mailForm, exam_id: e.target.value })}
                  style={styles.select}
                  required
                >
                  <option value="">Select Examination</option>
                  {exams.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.title}</option>
                  ))}
                </select>
              </div>

              <div style={styles.modalActions}>
                <button type="button" onClick={() => setShowMailModal(false)} className="btn-ghost" disabled={mailLoading}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={mailLoading}>
                  {mailLoading ? 'Sending Mail...' : 'Send Exam Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: GRADING / OVERRIDE SCORE ─── */}
      {overrideItem && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Grade Submission</h3>
            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '15px' }}>
              Grade answer sheet for student <strong>{overrideItem.student_username}</strong>:
            </p>
            <form onSubmit={handleOverrideSubmit} style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Assigned Score</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="Enter score"
                  value={overrideScore}
                  onChange={(e) => setOverrideScore(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Assigned Feedback / Review Comments</label>
                <textarea
                  value={overrideFeedback}
                  onChange={(e) => setOverrideFeedback(e.target.value)}
                  style={styles.textarea}
                  rows={4}
                  placeholder="Write your review comments or feedback here..."
                />
              </div>

              <div style={styles.modalActions}>
                <button type="button" onClick={() => setOverrideItem(null)} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-primary">Apply Grade</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles Object ────────────────────────────────────────────────
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    background: 'var(--background)',
    color: 'var(--foreground)',
    fontFamily: 'Inter, system-ui, sans-serif',
    position: 'relative',
    overflow: 'hidden',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'var(--background)',
    position: 'relative',
    overflow: 'hidden',
  },
  loadingSpinner: {
    width: 44,
    height: 44,
    border: '3px solid rgba(37,99,235,0.15)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto',
  },
  navbar: {
    position: 'relative',
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 40px',
    height: 64,
    background: '#ffffff',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderBottom: '1px solid #e2e8f0',
    boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
  },
  navBrand: { display: 'flex', alignItems: 'center', gap: 10 },
  logo: {
    fontSize: 18,
    fontWeight: 800,
    color: 'var(--accent)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    textShadow: 'none',
  },
  navActions: { display: 'flex', alignItems: 'center', gap: 16 },
  navUserChip: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  navUserName: { fontSize: 14, fontWeight: 700, color: 'var(--foreground)' },
  navUserRole: { fontSize: 11, color: '#475569', textTransform: 'capitalize' },
  main: {
    position: 'relative',
    zIndex: 10,
    maxWidth: 1280,
    margin: '0 auto',
    padding: '36px 40px 60px',
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
  },
  tabHeader: {
    display: 'flex',
    gap: 4,
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: 0,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--foreground)',
    margin: 0,
  },
  alertSuccess: {
    padding: '14px 20px',
    borderRadius: 12,
    background: 'rgba(16,185,129,0.05)',
    border: '1px solid rgba(16,185,129,0.25)',
    color: '#059669',
    fontSize: 14,
    lineHeight: 1.5,
  },
  alertError: {
    padding: '14px 20px',
    borderRadius: 12,
    background: 'rgba(239,68,68,0.05)',
    border: '1px solid rgba(239,68,68,0.25)',
    color: '#dc2626',
    fontSize: 14,
    lineHeight: 1.5,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 20,
  },
  card: {
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: 14,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    boxShadow: '0 4px 15px rgba(0,0,0,0.04)',
    transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 18px',
    borderBottom: '1px solid #cbd5e1',
    background: 'rgba(0,0,0,0.02)',
  },
  cardTitle: { fontSize: 14, fontWeight: 700, color: 'var(--accent)', margin: 0 },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 18px',
    borderTop: '1px solid #cbd5e1',
    fontSize: 12,
    color: '#475569',
  },
  subjectBadge: {
    padding: '3px 10px',
    borderRadius: 99,
    background: 'rgba(37,99,235,0.08)',
    border: '1px solid rgba(37,99,235,0.2)',
    color: 'var(--accent)',
    fontSize: 11,
    fontWeight: 700,
  },
  examMeta: { fontSize: 13, color: '#475569', padding: '14px 18px 0', margin: 0 },
  examCardRules: {
    fontSize: 12,
    color: '#475569',
    padding: '10px 18px',
    margin: '8px 18px',
    background: '#f8fafc',
    borderRadius: 6,
    border: '1px solid #e2e8f0',
  },
  emptyState: {
    padding: '48px 24px',
    textAlign: 'center',
    color: '#475569',
    fontSize: 14,
    background: '#f8fafc',
    borderRadius: '12px',
    border: '1px dashed #cbd5e1',
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  itemCard: {
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: 14,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 15px rgba(0,0,0,0.04)',
  },
  itemMeta: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    padding: '14px 20px',
    borderBottom: '1px solid #cbd5e1',
    background: '#f8fafc',
    fontSize: 13,
    color: '#475569',
    alignItems: 'center',
  },
  answerSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: '16px 20px',
  },
  qText: { fontSize: 14, color: '#000000', fontWeight: 600, lineHeight: 1.65, margin: 0 },
  studentAnswer: {
    background: '#f8fafc',
    borderRadius: 8,
    padding: '14px 16px',
    fontSize: 14,
    color: '#000000',
    border: '1px solid #cbd5e1',
  },
  studentAnswerText: { marginTop: 6, lineHeight: 1.6, color: '#000000', fontWeight: 500 },
  imgContainer: { marginTop: 10 },
  imgLink: { color: 'var(--accent)', fontSize: 13, fontWeight: 600, textDecoration: 'none' },
  aiBox: {
    background: 'rgba(124, 58, 237, 0.05)',
    border: '1px solid rgba(124, 58, 237, 0.2)',
    borderRadius: 10,
    padding: '14px 16px',
    fontSize: 13,
    color: 'var(--foreground)',
    margin: '0 20px 4px',
  },
  aiBoxTitle: { color: 'var(--purple)', fontWeight: 700, fontSize: 13, marginBottom: 8 },
  actionContainer: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '12px 20px',
    borderTop: '1px solid #cbd5e1',
    background: '#f8fafc',
  },
  subjectContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  subjectCard: {
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: 16,
    overflow: 'hidden',
  },
  subjectTitle: {
    padding: '14px 20px',
    background: 'rgba(37,99,235,0.08)',
    borderBottom: '1px solid rgba(37, 99, 235, 0.15)',
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--accent)',
  },
  pdfSourceBox: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '16px',
  },
  pdfSourceTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#475569',
    paddingBottom: '8px',
    borderBottom: '1px dashed #cbd5e1',
  },
  miniQuestionRow: {
    background: '#ffffff',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniBadge: {
    fontSize: '10px',
    color: '#475569',
    background: '#f1f5f9',
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: 600,
  },
  studentWorkspace: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
  },
  searchPanel: {
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  associatedListCard: {
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '16px',
    padding: '24px',
  },
  searchResultsBox: {
    marginTop: '10px',
    background: '#f8fafc',
    padding: '14px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
  },
  studentSearchRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#ffffff',
    padding: '8px 12px',
    borderRadius: '8px',
  },
  studentListRow: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px 16px',
  },
  sectionBlock: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px',
    marginTop: '10px',
  },
  /* MODALS */
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 580,
    backgroundColor: '#ffffff',
    border: '1px solid rgba(37,99,235,0.2)',
    borderRadius: 18,
    color: 'var(--foreground)',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: 'var(--accent)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    padding: '22px 28px 20px',
    borderBottom: '1px solid #e2e8f0',
    margin: 0,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    padding: '20px 28px',
    borderTop: '1px solid #e2e8f0',
    background: '#f8fafc',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 18, padding: '20px 28px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  },
  input: {
    padding: '11px 14px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: 'var(--foreground)',
    fontSize: 14,
    outline: 'none',
    width: '100%',
  },
  select: {
    padding: '11px 14px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: 'var(--foreground)',
    fontSize: 14,
    outline: 'none',
    width: '100%',
  },
  textarea: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: 'var(--foreground)',
    fontSize: 14,
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.5,
  },
  row: {
    display: 'flex',
    gap: 14,
  },
  rowBetween: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  optionsSection: { display: 'flex', flexDirection: 'column', gap: 10 },
  optionRow: { display: 'flex', gap: 10, alignItems: 'center' },
  optionInput: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: 'var(--foreground)',
    fontSize: 14,
    outline: 'none',
  },
  chkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    color: '#475569',
    cursor: 'pointer',
  },
  checkboxGroup: { display: 'flex', flexDirection: 'column', gap: 8 },
  linkBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--accent)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 4,
  },
};
