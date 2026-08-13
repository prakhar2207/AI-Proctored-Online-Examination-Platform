'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch, getAuthSession } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';
import PWAInstallButton from '@/components/PWAInstallButton';

interface Option {
  id: number;
  text: string;
}

interface Question {
  id: number;
  question_type: 'mcq' | 'multi_select' | 'one_word' | 'fill_blank' | 'short_answer' | 'long_answer' | 'image_upload';
  text: string;
  marks: number;
  negative_marks?: string | number;
  options?: Option[];
}

interface ExamQuestion {
  id: number;
  question: Question;
  order: number;
  section_id?: number | string | null;
  section_name?: string | null;
  section_order?: number | null;
}

export default function ExamConsolePage() {
  const router = useRouter();
  const params = useParams();
  const { t, tQuestion } = useLanguage();
  const examId = params.examId as string;

  // States
  const [loading, setLoading] = useState(true);
  const [setupMode, setSetupMode] = useState(true);
  const [examTitle, setExamTitle] = useState('');
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<{ [qId: string | number]: any }>({});
  
  // Custom States for TCS style palette
  const [visitedIdxs, setVisitedIdxs] = useState<number[]>([0]);
  const [markedForReview, setMarkedForReview] = useState<number[]>([]);
  const [activeSection, setActiveSection] = useState<string>('objective');


  // Candidate session details
  const [candidate, setCandidate] = useState({ name: 'Candidate User', email: 'candidate@exam.com', id: 'ROLL-10903' });

  // Timer & Session
  const [timeLeft, setTimeLeft] = useState(0);
  const [sessionToken, setSessionToken] = useState('');
  
  // Webcam & Proctoring States
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [violations, setViolations] = useState<string[]>([]);
  const [warningsCount, setWarningsCount] = useState(0);
  const [suspicionScore, setSuspicionScore] = useState(0);
  const [violationModal, setViolationModal] = useState<string | null>(null);
  const [instantScorecard, setInstantScorecard] = useState<{
    total_score: string;
    percentile?: string | null;
    finalized?: boolean;
    answers: { question_id: number; question_text: string; score: number; feedback: string; is_evaluated: boolean }[];
  } | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const timeLeftRef = useRef(0);
  timeLeftRef.current = timeLeft;

  const violationsRef = useRef<string[]>([]);
  violationsRef.current = violations;
  const lastViolationTimeRef = useRef<{ [key: string]: number }>({});

  // Load User Session details
  useEffect(() => {
    const session = getAuthSession();
    if (session) {
      setCandidate({
        name: session.username || 'Candidate User',
        email: session.email || 'candidate@exam.com',
        id: `ROLL-1090${session.id || '3'}`
      });
    }
  }, []);

  // Setup permission check
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        streamRef.current = stream;
        setCameraPermission(true);
      })
      .catch((err) => {
        console.error("Webcam blocked:", err);
        setCameraPermission(false);
      });

    return () => {
      // Stop webcam stream on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      // Close websocket
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Dynamic webcam stream attachment when video element mounts (setup card or exam console)
  useEffect(() => {
    if (cameraPermission && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraPermission, setupMode]);


  // Secure exam view hook
  useEffect(() => {
    if (setupMode) return;

    // Security Guards: Prevent right click, select, copy, paste
    const preventContextMenu = (e: MouseEvent) => e.preventDefault();
    const preventCopy = (e: ClipboardEvent) => e.preventDefault();
    const preventPaste = (e: ClipboardEvent) => e.preventDefault();
    const preventSelect = (e: Event) => e.preventDefault();

    // Hotkey guards (Ctrl+C, Ctrl+V, Ctrl+U, etc.)
    const preventKeys = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && ['c', 'v', 'u', 's', 'a'].includes(e.key.toLowerCase())) ||
        (e.ctrlKey && e.shiftKey && ['i', 'j'].includes(e.key.toLowerCase())) ||
        e.key === 'F12'
      ) {
        e.preventDefault();
        addViolationEvent('key_shortcut_block', 'Tried to copy/paste or access developer tools.');
      }
    };

    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('copy', preventCopy);
    document.addEventListener('paste', preventPaste);
    document.addEventListener('selectstart', preventSelect);
    document.addEventListener('keydown', preventKeys);

    // Visibility / Tab Change Guard
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        addViolationEvent('tab_switch', 'Navigated away from the exam tab.');
      }
    };

    // Fullscreen exit guard
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        addViolationEvent('fullscreen_exit', 'Exited the lock-screen fullscreen window.');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('paste', preventPaste);
      document.removeEventListener('selectstart', preventSelect);
      document.removeEventListener('keydown', preventKeys);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [setupMode]);

  // Exam Initialization Timer countdown loop
  useEffect(() => {
    if (setupMode || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [setupMode, timeLeft]);

  // Track visited questions indices
  useEffect(() => {
    if (!setupMode && !visitedIdxs.includes(currentIdx)) {
      setVisitedIdxs(prev => [...prev, currentIdx]);
    }
  }, [currentIdx, setupMode, visitedIdxs]);

  // Dynamically group sections from the questions list
  const getSectionsList = () => {
    const list: { id: any; name: string; order: number }[] = [];
    const seen = new Set();
    
    questions.forEach(eq => {
      const sId = eq.section_id != null ? String(eq.section_id) : 'general';
      const sName = eq.section_name || 'General Section';
      const sOrder = eq.section_order || 1;
      
      if (!seen.has(sId)) {
        seen.add(sId);
        list.push({ id: sId, name: sName, order: sOrder });
      }
    });
    
    return list.sort((a, b) => a.order - b.order);
  };

  // Filter questions by active section
  const getSectionQuestions = () => {
    if (questions.length === 0) return [];
    const sections = getSectionsList();
    const activeSecId = (activeSection === 'objective' || activeSection === 'subjective') 
      ? (sections[0]?.id || 'general') 
      : activeSection;
      
    const filtered = questions.filter(eq => {
      const sId = eq.section_id != null ? String(eq.section_id) : 'general';
      return String(sId) === String(activeSecId);
    });

    return filtered.length > 0 ? filtered : questions;
  };

  const activeSectionQuestions = getSectionQuestions();

  // Find index relative to current selected section question
  const getCurrentQuestionIndexInAll = () => {
    const currentQuestion = activeSectionQuestions[currentIdx];
    if (!currentQuestion) return 0;
    return questions.findIndex(q => q.id === currentQuestion.id);
  };


  const getQuestionState = (eq: ExamQuestion, idxInAll: number) => {
    const isAnswered = answers[eq.question.id] !== undefined && 
                       answers[eq.question.id] !== '' && 
                       (!Array.isArray(answers[eq.question.id]) || answers[eq.question.id].length > 0);
    const isMarked = markedForReview.includes(eq.question.id);
    const isVisited = visitedIdxs.includes(idxInAll);

    if (isMarked && isAnswered) return 'marked-answered';
    if (isMarked) return 'marked';
    if (isAnswered) return 'answered';
    if (isVisited) return 'visited-unanswered';
    return 'unvisited';
  };

  // WebSocket heartbeat logic
  useEffect(() => {
    if (setupMode || !sessionToken) return;

    const wsUrl = `ws://127.0.0.1:8000/ws/proctoring/${sessionToken}/`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'heartbeat_ack') {
        setSuspicionScore(data.suspicion_score);
        setWarningsCount(data.warnings_count);
        if (
          data.max_violations_exceeded ||
          data.session_status === 'flagged' ||
          (data.max_allowed_warnings && data.warnings_count >= data.max_allowed_warnings)
        ) {
          handleAutoSubmit('terminated');
        }
      }
    };

    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const accumulated = [...violationsRef.current];
        if (accumulated.length > 0) {
          setViolations([]);
          violationsRef.current = [];
        }

        ws.send(JSON.stringify({
          type: 'heartbeat',
          violations: accumulated
        }));
      }
    }, 10000);

    return () => {
      clearInterval(heartbeatInterval);
      ws.close();
    };
  }, [setupMode, sessionToken]);

  // MediaPipe Face & Gaze AI Proctoring Loop
  useEffect(() => {
    if (setupMode || !cameraPermission) return;

    let faceLandmarker: any = null;
    let active = true;
    let checkInterval: any = null;
    let absentCounter = 0;

    // Intercept Emscripten / TFLite WASM "INFO:" logs in console.error to prevent Next.js dev error overlay
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const firstArg = args[0];
      if (
        typeof firstArg === 'string' &&
        (firstArg.startsWith('INFO:') ||
         firstArg.includes('TensorFlow Lite') ||
         firstArg.includes('XNNPACK'))
      ) {
        console.log(...args);
        return;
      }
      originalConsoleError.apply(console, args);
    };

    const initModels = async () => {
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const filesetResolver = await vision.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
        );
        
        if (!active) return;

        faceLandmarker = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "IMAGE",
          numFaces: 2
        });
      } catch (e) {
        console.warn("Failed to load MediaPipe FaceLandmarker:", e);
      }
    };

    initModels();

    checkInterval = setInterval(async () => {
      if (
        !active ||
        !faceLandmarker ||
        !videoRef.current ||
        videoRef.current.readyState < 2 ||
        videoRef.current.paused ||
        videoRef.current.ended ||
        videoRef.current.videoWidth === 0 ||
        videoRef.current.videoHeight === 0
      ) {
        return;
      }

      try {
        const result = faceLandmarker.detect(videoRef.current);
        if (!result || !result.faceLandmarks) return;
        
        // 1. Multiple-person detection
        if (result.faceLandmarks.length > 1) {
          addViolationEvent('multiple_faces', 'More than one person detected in the webcam frame.');
        } 
        // 2. Face presence check (requires 8 consecutive checks ~16 seconds)
        else if (result.faceLandmarks.length === 0) {
          absentCounter += 1;
          if (absentCounter >= 8) {
            addViolationEvent('face_absent', 'Face not detected in webcam frame.');
          }
        } else {
          absentCounter = 0;
          
          // 3. Gaze direction estimation (generous thresholds for reading long questions)
          const landmarks = result.faceLandmarks[0];
          if (landmarks && landmarks.length > 0) {
            const nose = landmarks[4];
            const leftEye = landmarks[33];
            const rightEye = landmarks[263];
            
            if (nose && leftEye && rightEye) {
              const xRatio = (nose.x - leftEye.x) / (rightEye.x - leftEye.x);
              if (xRatio < 0.10 || xRatio > 0.90) {
                addViolationEvent('gaze_away', 'Looking away from the screen.');
              }
            }
          }
        }
      } catch (e) {
        console.warn("Proctor loop warning:", e);
      }
    }, 2000);

    return () => {
      active = false;
      if (checkInterval) clearInterval(checkInterval);
      if (faceLandmarker) {
        try { faceLandmarker.close(); } catch (_) {}
      }
      console.error = originalConsoleError;
    };
  }, [setupMode, cameraPermission]);

  const addViolationEvent = (type: string, description: string) => {
    if (setupMode) return; // Ignore security violations during pre-exam setup phase
    const now = Date.now();
    const lastTime = lastViolationTimeRef.current[type] || 0;

    // 30 seconds cooldown per violation type to avoid duplicate rapid ticks
    if (now - lastTime < 30000) return;
    lastViolationTimeRef.current[type] = now;

    setViolations(prev => [...prev, type]);
    setViolationModal(`${type.replace(/_/g, ' ').toUpperCase()}: ${description}`);
  };

  const handleStartExam = async () => {
    if (!cameraPermission) {
      alert("Please grant webcam permission to start this proctored exam.");
      return;
    }

    try {
      const res = await apiFetch(`/exam-engine/exams/${examId}/enter/`, { method: 'POST' });
      if (res.status === 200) {
        const data = await res.json();
        setExamTitle(data.session.exam_title);
        setTimeLeft(data.session.time_remaining_seconds);
        setSessionToken(data.session.session_token);

        // Fetch Exam Questions
        const qRes = await apiFetch('/exam-engine/session/questions/', {
          headers: { 'X-Exam-Session-Token': data.session.session_token }
        });
        if (qRes.status === 200) {
          const qData = await qRes.json();
          setQuestions(qData);
          if (qData.length > 0) {
            const firstSec = qData[0].section_id || 'general';
            setActiveSection(String(firstSec));
          }
        }

        // Safely Request Fullscreen Mode without throwing if browser user gesture expired
        try {
          const docEl = document.documentElement;
          if (docEl.requestFullscreen && !document.fullscreenElement) {
            await docEl.requestFullscreen();
          }
        } catch (fsErr) {
          console.warn("Fullscreen request bypassed or requires user activation:", fsErr);
        }

        setSetupMode(false);
        setLoading(false);
      } else {
        let errMsg = "Failed to enter exam.";
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch (e) {
          console.error("Non-JSON error response:", e);
        }
        alert(errMsg);
      }
    } catch (err: any) {
      console.error("[ExamStartError]", err);
      const message = err?.message || "An unexpected error occurred while starting the exam.";
      alert(message);
    }
  };

  const handleSelectOption = (qId: number, optId: number, isMultiSelect = false) => {
    const currentAnswers = answers[qId] || [];
    let updated;
    if (isMultiSelect) {
      if (currentAnswers.includes(optId)) {
        updated = currentAnswers.filter((id: number) => id !== optId);
      } else {
        updated = [...currentAnswers, optId];
      }
    } else {
      updated = [optId];
    }

    setAnswers(prev => ({ ...prev, [qId]: updated }));
    saveAnswerToBackend(qId, updated, '');
  };

  const handleTextChange = (qId: number, text: string) => {
    setAnswers(prev => ({ ...prev, [qId]: text }));
    saveAnswerToBackend(qId, [], text);
  };

  const saveAnswerToBackend = async (qId: number, options: number[], text: string, file?: File) => {
    if (!sessionToken) return;

    try {
      const formData = new FormData();
      formData.append('question', String(qId));
      if (options.length > 0) {
        options.forEach(opt => formData.append('selected_options', String(opt)));
      }
      if (text !== undefined) {
        formData.append('text_answer', text);
      }
      if (file) {
        formData.append('image_answer', file);
      }

      await apiFetch('/exam-engine/session/submit-answer/', {
        method: 'POST',
        headers: { 'X-Exam-Session-Token': sessionToken },
        body: formData
      });
    } catch (err) {
      console.error("Auto-save answer failed:", err);
    }
  };

  const handleImageUpload = (qId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setAnswers(prev => ({ ...prev, [`${qId}_img`]: previewUrl }));

    saveAnswerToBackend(qId, [], '', file);
  };

  const handleFinishExam = async () => {
    const confirmSubmit = window.confirm("Are you sure you want to finish and submit your exam? This action is irreversible.");
    if (!confirmSubmit) return;

    try {
      const res = await apiFetch('/exam-engine/session/finish/', {
        method: 'POST',
        headers: { 'X-Exam-Session-Token': sessionToken }
      });

      if (res.status === 200) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(err => console.log(err));
        }
        const data = await res.json();
        if (data.is_mock || data.finalized) {
          setInstantScorecard({
            total_score: data.total_score || '0',
            percentile: data.percentile,
            finalized: data.finalized,
            answers: data.answers || []
          });
        } else {
          router.push('/student/dashboard?submitted=true');
        }
      } else {
        alert("Failed to submit exam.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAutoSubmit = async (reason?: string) => {
    try {
      const res = await apiFetch('/exam-engine/session/finish/', {
        method: 'POST',
        headers: { 'X-Exam-Session-Token': sessionToken }
      });
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => console.log(err));
      }
      if (res.status === 200) {
        const data = await res.json();
        if (data.is_mock || data.finalized) {
          setInstantScorecard({
            total_score: data.total_score || '0',
            percentile: data.percentile,
            finalized: data.finalized,
            answers: data.answers || []
          });
          return;
        }
      }
      if (reason === 'terminated') {
        alert("CRITICAL WARNING: Your exam session has been TERMINATED due to exceeding maximum allowed proctoring violations (tab switches, face absence, or suspicious activity). Your attempts have been auto-submitted and flagged for examiner review.");
        router.push('/student/dashboard?auto_submitted=true&flagged=true');
      } else {
        alert("Exam time expired. Your answers have been auto-submitted.");
        router.push('/student/dashboard?auto_submitted=true');
      }
    } catch (err) {
      console.error(err);
      router.push('/student/dashboard');
    }
  };

  // Clear Response Button
  const handleClearResponse = (qId: number) => {
    setAnswers(prev => {
      const copy = { ...prev };
      delete copy[qId];
      return copy;
    });
    // Call backend to clear answer
    saveAnswerToBackend(qId, [], '');
  };

  // Mark for Review & Next
  const handleMarkForReviewAndNext = (qId: number) => {
    if (!markedForReview.includes(qId)) {
      setMarkedForReview(prev => [...prev, qId]);
    }
    // Save response if any, and navigate next
    handleSaveAndNext(qId);
  };

  const handleSaveAndNext = (qId: number) => {
    // Clear marked for review if moving to Save
    setMarkedForReview(prev => prev.filter(id => id !== qId));
    // Move to next question if index is not last
    if (currentIdx < activeSectionQuestions.length - 1) {
      setCurrentIdx(prev => prev + 1);
    }
  };

  const formatTime = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Counts for statistics panel
  const getStatsCounts = () => {
    let answered = 0;
    let notAnswered = 0;
    let marked = 0;
    let markedAnswered = 0;
    let unvisited = 0;

    questions.forEach((eq, index) => {
      const state = getQuestionState(eq, index);
      if (state === 'answered') answered++;
      else if (state === 'marked-answered') markedAnswered++;
      else if (state === 'marked') marked++;
      else if (state === 'visited-unanswered') notAnswered++;
      else if (state === 'unvisited') unvisited++;
    });

    return { answered, notAnswered, marked, markedAnswered, unvisited };
  };

  const stats = getStatsCounts();

  // SETUP VIEW
  if (setupMode) {
    return (
      <div style={styles.container}>
        <div style={styles.setupCard}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
            <div style={styles.tcsLogoBox}>
              <div style={styles.tcsAssessmentLogo}>AI-EXAM</div>
              <div style={styles.tcsAssessmentText}>
                <span style={{ fontWeight: '800', color: 'var(--foreground)', fontSize: '15px' }}>SECURE ASSESSMENT CONSOLE</span>
                <span style={{ fontWeight: '500', color: 'var(--muted-text)', fontSize: '11px' }}>AI Proctored Candidate Portal v2.0</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <LanguageSelector />
            </div>
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center' }}>
            <h2 style={styles.setupTitle}>{tQuestion("Proctored Environment Configuration")}</h2>
            <p style={styles.setupText}>{tQuestion("To enter this secure assessment, please verify your camera controls and request authorization access.")}</p>
          </div>

          {/* Video Preview with AI Face Alignment Overlay */}
          <div style={styles.webcamSetup}>
            {cameraPermission === true ? (
              <>
                <video ref={videoRef} autoPlay playsInline muted style={styles.setupVideo} />
                {/* AI Overlay Badge */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'rgba(16, 185, 129, 0.9)',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
                  {tQuestion("CAMERA LIVE")}
                </div>
                
                {/* Face Alignment Box Grid */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '180px',
                  height: '210px',
                  border: '2px dashed rgba(255,255,255,0.4)',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  paddingBottom: '12px'
                }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.8)', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '4px' }}>
                    {tQuestion("Center Face Here")}
                  </span>
                </div>
              </>
            ) : cameraPermission === false ? (
              <div style={styles.cameraError}>
                ⚠️ {tQuestion("Camera permission denied. Enable camera settings in your browser address bar to unlock this exam.")}
              </div>
            ) : (
              <div style={styles.cameraLoader}>⌛ {tQuestion("Verifying camera permissions...")}</div>
            )}
          </div>

          {/* Guidelines Box */}
          <div style={styles.rulesBox}>
            <h4 style={styles.rulesTitle}>🛡️ {tQuestion("Secured Exam Guidelines:")}</h4>
            <ul style={styles.rulesList}>
              <li>🔒 {tQuestion("Do not close or navigate away from the fullscreen console window.")}</li>
              <li>⚠️ {tQuestion("Tab-switching or losing window focus triggers an immediate violation warning.")}</li>
              <li>👁️ {tQuestion("A live webcam preview tracks head orientation and gaze direction client-side.")}</li>
              <li>💾 {tQuestion("MCQ questions auto-save automatically. Written files can be uploaded as images.")}</li>
            </ul>
          </div>

          {/* Start CTA */}
          <button 
            onClick={handleStartExam} 
            disabled={cameraPermission === false}
            style={{
              ...styles.startBtn,
              opacity: cameraPermission === false ? 0.6 : 1,
              cursor: cameraPermission === false ? 'not-allowed' : 'pointer'
            }}
          >
            🚀 {tQuestion("Enter Secure Console")}
          </button>
        </div>
      </div>
    );
  }

  // ACTIVE EXAM CONSOLE
  const currentEQ = activeSectionQuestions[currentIdx];
  const question = currentEQ?.question;
  const currentIdxInAll = getCurrentQuestionIndexInAll();

  return (
    <div style={styles.consoleContainer}>
      {/* Top Banner - TCS Style light theme */}
      <header style={styles.topbar}>
        <div style={styles.tcsLogoBox}>
          <div style={styles.tcsAssessmentLogo}>iON</div>
          <div style={styles.tcsAssessmentText}>
            <span style={{ fontWeight: '800', color: '#1e3a8a', fontSize: '14px' }}>ASSESSMENT CONSOLE</span>
            <span style={{ fontWeight: '400', color: '#475569', fontSize: '10px', display: 'block' }}>Candidate Secure Console v4.2</span>
          </div>
        </div>

        <div style={styles.examHeaderCenter}>
          <h3 style={styles.examTitleText}>{tQuestion(examTitle) || 'Semester Examination'}</h3>
        </div>

        <div style={styles.topbarControls}>
          <PWAInstallButton />
          <LanguageSelector />
          <div style={styles.timerBox}>
            <span style={styles.timerLabel}>{t('exam.time_remaining')}:</span>
            <span style={timeLeft < 300 ? styles.timerRed : styles.timerNormal}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>
      </header>

      {/* Section tabs layer */}
      <div style={styles.sectionsBar}>
        <div style={styles.sectionTabsList}>
          {getSectionsList().map((sec) => {
            const isSecActive = String(activeSection) === String(sec.id) || (activeSection === 'objective' && sec.id === getSectionsList()[0]?.id);
            return (
              <button 
                key={sec.id}
                onClick={() => {
                  setActiveSection(String(sec.id));
                  setCurrentIdx(0);
                }} 
                style={isSecActive ? styles.sectionTabActive : styles.sectionTab}
              >
                {tQuestion(sec.name)}
              </button>
            );
          })}
          {getSectionsList().length === 0 && (
            <div style={{ color: '#475569', fontSize: 13, padding: '8px 16px' }}>No sections defined for this exam.</div>
          )}
        </div>
      </div>

      {/* Main Column Layout */}
      <div style={styles.workspace}>
        {/* Left Side: Question and Options Panel */}
        <section style={styles.questionPanel}>
          {question ? (
            <div style={styles.panelCard}>
              <div style={styles.panelHeader}>
                <span style={styles.qIndexLabel}>{t('exam.question')} No. {currentIdx + 1}</span>
                <div style={styles.metaMarksBox}>
                  <span style={styles.qMarksLabel}>{t('exam.marks')}: {question.marks}</span>
                  <span style={styles.qNegativeLabel}>{t('exam.negative_marks')}: -{Math.abs(parseFloat(String(question.negative_marks || 0)) || 0)}</span>
                </div>
              </div>

              <div style={styles.questionTextZone}>
                <p style={styles.mainQuestionText}>{tQuestion(question.text)}</p>
              </div>

              {/* Options list / Written text answers */}
              <div style={styles.inputArea}>
                {/* MCQ option selectors */}
                {question.question_type === 'mcq' && question.options && (
                  <div style={styles.optionsList}>
                    {question.options.map((opt, oIdx) => {
                      const isChecked = (answers[question.id] || []).includes(opt.id);
                      const optLabel = String.fromCharCode(65 + oIdx); // A, B, C, D
                      return (
                        <div
                          key={opt.id}
                          onClick={() => handleSelectOption(question.id, opt.id, false)}
                          style={isChecked ? styles.optionRowActive : styles.optionRow}
                        >
                          <div style={isChecked ? styles.optBadgeActive : styles.optBadge}>
                            {optLabel}
                          </div>
                          <input
                            type="radio"
                            name={`mcq_${question.id}`}
                            checked={isChecked}
                            onChange={() => {}}
                            style={styles.radioInput}
                          />
                          <span style={styles.optionText}>{tQuestion(opt.text)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Multi Select checkbox selectors */}
                {question.question_type === 'multi_select' && question.options && (
                  <div style={styles.optionsList}>
                    {question.options.map((opt, oIdx) => {
                      const isChecked = (answers[question.id] || []).includes(opt.id);
                      const optLabel = String.fromCharCode(65 + oIdx);
                      return (
                        <div
                          key={opt.id}
                          onClick={() => handleSelectOption(question.id, opt.id, true)}
                          style={isChecked ? styles.optionRowActive : styles.optionRow}
                        >
                          <div style={isChecked ? styles.optBadgeActive : styles.optBadge}>
                            {optLabel}
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            style={styles.checkInput}
                          />
                          <span style={styles.optionText}>{tQuestion(opt.text)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Text responses short, long, one word, fill blank */}
                {['short_answer', 'long_answer', 'one_word', 'fill_blank'].includes(question.question_type) && (
                  <div style={styles.textAnswerZone}>
                    <textarea
                      value={answers[question.id] || ''}
                      onChange={(e) => handleTextChange(question.id, e.target.value)}
                      placeholder="Write your official response here..."
                      style={styles.textAnswerArea}
                      rows={question.question_type === 'short_answer' ? 6 : 12}
                    />
                    <div style={styles.counterRow}>
                      Characters: {(answers[question.id] || '').length} | Words: {((answers[question.id] || '').split(/\s+/).filter(Boolean)).length}
                    </div>
                  </div>
                )}

                {/* File / Image answer sheet uploads */}
                {question.question_type === 'image_upload' && (
                  <div style={styles.imageUploadZone}>
                    <p style={styles.uploadTip}>Attach a photograph or scan of your hand-written equations or sheets:</p>
                    <label style={styles.fileBox}>
                      📁 Select Answer Sheet Image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(question.id, e)}
                        style={styles.hiddenFileInput}
                      />
                    </label>
                    {answers[`${question.id}_img`] && (
                      <div style={styles.imagePreviewBox}>
                        <p style={styles.previewTitle}>Uploaded Answer Preview:</p>
                        <img src={answers[`${question.id}_img`]} alt="Answer Preview" style={styles.imgPreview} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons row matching professional exam console */}
              <div style={styles.navButtonsRow}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => handleMarkForReviewAndNext(question.id)} 
                    style={styles.markReviewBtn}
                  >
                    Mark for Review & Next
                  </button>
                  <button 
                    onClick={() => handleClearResponse(question.id)} 
                    style={styles.clearResponseBtn}
                  >
                    Clear Response
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    disabled={currentIdx === 0}
                    onClick={() => setCurrentIdx(prev => prev - 1)}
                    style={currentIdx === 0 ? styles.navBtnDisabled : styles.navBtn}
                  >
                    ◀ Previous
                  </button>
                  <button 
                    onClick={() => handleSaveAndNext(question.id)} 
                    style={styles.saveNextBtn}
                  >
                    Save & Next 
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={styles.emptyState}>No questions available in this section.</div>
          )}
        </section>

        {/* Right Side: Candidate Profile details & Question Palette */}
        <aside style={styles.sidebar}>
          {/* Candidate Profile Details Box */}
          <div style={styles.profileCard}>
            <div style={styles.profileMetaInfo}>
              <div style={styles.candidatePhotoAvatar}>
                
              </div>
              <div style={styles.candidateMetaText}>
                <div style={styles.candidateLabel}>CANDIDATE:</div>
                <div style={styles.candidateName}>{candidate.name}</div>
                <div style={styles.candidateRoll}>{candidate.id}</div>
              </div>
            </div>

            {/* Embedded Live Webcam proctor box inside profile block */}
            <div style={styles.webcamPreviewBox}>
              <video ref={videoRef} autoPlay playsInline muted style={styles.liveWebcam} />
              <div style={styles.webcamOverlayText}>PROCTORING ACTIVE</div>
            </div>
            
            {/* Proctor Alert Logs/Status */}
            <div style={styles.proctorStatusBox}>
              <div style={styles.statusRow}>
                <span>System Security:</span>
                <span style={suspicionScore > 50 ? styles.statusBad : styles.statusGood}>
                  {suspicionScore > 50 ? 'SUSPICIOUS' : 'SECURE'}
                </span>
              </div>
              <div style={styles.statusRow}>
                <span>Warning Flags:</span>
                <span style={{ color: warningsCount > 2 ? '#ef4444' : '#ffffff' }}>
                  {warningsCount} / 5
                </span>
              </div>
            </div>
          </div>

          {/* TCS iON style Question Palette section */}
          <div style={styles.paletteContainer}>
            <div style={styles.questionNavHeader}>Question Palette</div>
            
            <div style={styles.paletteGridWrapper}>
              <div style={styles.navGrid}>
                {activeSectionQuestions.map((eq, index) => {
                  const idxInAll = questions.findIndex(q => q.question.id === eq.question.id);
                  const state = getQuestionState(eq, idxInAll);
                  const isActive = index === currentIdx;
                  
                  let boxStyle = styles.paletteUnvisited;
                  let checkDot = false;
                  
                  if (isActive) {
                    boxStyle = styles.paletteActive;
                  } else if (state === 'answered') {
                    boxStyle = styles.paletteAnswered;
                  } else if (state === 'marked-answered') {
                    boxStyle = styles.paletteMarkedAnswered;
                    checkDot = true;
                  } else if (state === 'marked') {
                    boxStyle = styles.paletteMarked;
                  } else if (state === 'visited-unanswered') {
                    boxStyle = styles.paletteNotAnswered;
                  }

                  return (
                    <button
                      key={eq.id}
                      onClick={() => setCurrentIdx(index)}
                      style={boxStyle}
                    >
                      {index + 1}
                      {checkDot && <span style={styles.dotBadge}>•</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TCS Legend Stats */}
            <div style={styles.legendContainer}>
              <h4 style={styles.legendTitle}>Legend Statistics:</h4>
              <div style={styles.legendGrid}>
                <div style={styles.legendItem}>
                  <div style={styles.legendBadgeGreen}>{stats.answered}</div>
                  <span style={styles.legendLabel}>Answered</span>
                </div>
                <div style={styles.legendItem}>
                  <div style={styles.legendBadgeRed}>{stats.notAnswered}</div>
                  <span style={styles.legendLabel}>Not Answered</span>
                </div>
                <div style={styles.legendItem}>
                  <div style={styles.legendBadgeGray}>{stats.unvisited}</div>
                  <span style={styles.legendLabel}>Not Visited</span>
                </div>
                <div style={styles.legendItem}>
                  <div style={styles.legendBadgePurple}>{stats.marked}</div>
                  <span style={styles.legendLabel}>Marked for Review</span>
                </div>
                <div style={styles.legendItem}>
                  <div style={styles.legendBadgePurpleDot}>{stats.markedAnswered}</div>
                  <span style={styles.legendLabel}>Ans & Marked (Review)</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {/* Exam submission block at bottom of palette */}
          <button onClick={handleFinishExam} style={styles.finishBtn}>
            Submit Assessment
          </button>
        </aside>
      </div>

      {/* SECURITY VIOLATION WARNING MODAL */}
      {violationModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.warningContent}>
            <div style={styles.warningIcon}></div>
            <h3 style={styles.warningTitle}>Security Compliance Alert</h3>
            <p style={styles.warningMsg}>{violationModal}</p>
            <p style={styles.warningInstructions}>Academic integrity policies are strictly enforced. Repeated infractions will flag your exam and trigger automatic submission.</p>
            <button onClick={() => setViolationModal(null)} style={styles.warningDismissBtn}>
              Acknowledge & Continue
            </button>
          </div>
        </div>
      )}

      {/* INSTANT AI EVALUATION SCORECARD MODAL */}
      {instantScorecard && (
        <div style={styles.modalOverlay}>
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '650px',
            width: '90%',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            color: 'var(--foreground)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎉</div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px 0' }}>Exam Completed & AI Evaluated!</h2>
              <p style={{ fontSize: '14px', color: 'var(--muted-text)', margin: 0 }}>
                Your exam has been graded instantly. Here is your scorecard:
              </p>
            </div>

            {/* Scorecard Hero Banner */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(59, 130, 246, 0.12) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center',
              marginBottom: '24px'
            }}>
              <div style={{ fontSize: '12px', color: 'var(--muted-text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Awarded Score
              </div>
              <div style={{ fontSize: '38px', fontWeight: 900, color: '#10b981' }}>
                {instantScorecard.total_score} Marks
              </div>
              {instantScorecard.percentile !== null && instantScorecard.percentile !== undefined && (
                <div style={{ fontSize: '13px', color: '#3b82f6', fontWeight: 600, marginTop: '4px' }}>
                  Percentile Rank: {instantScorecard.percentile}%ile
                </div>
              )}
            </div>

            {/* Question Breakdown */}
            {instantScorecard.answers.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: 'var(--foreground)' }}>
                  Question Breakdown & AI Feedback
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {instantScorecard.answers.map((ans, idx) => (
                    <div key={idx} style={{
                      background: 'var(--table-head-bg)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '12px 14px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)', flex: 1 }}>
                          Q{idx + 1}. {ans.question_text}
                        </span>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: ans.score > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: ans.score > 0 ? '#10b981' : '#ef4444'
                        }}>
                          +{ans.score} Marks
                        </span>
                      </div>
                      {ans.feedback && (
                        <div style={{ fontSize: '12px', color: 'var(--muted-text)', marginTop: '4px', fontStyle: 'italic' }}>
                          AI Feedback: {ans.feedback}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => router.push('/student/results')}
                style={{
                  padding: '10px 20px',
                  background: 'var(--accent)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                View Full Results Page →
              </button>
              <button
                onClick={() => router.push('/student/dashboard')}
                style={{
                  padding: '10px 20px',
                  background: 'var(--table-head-bg)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// TCS Style professional exam CSS styles (Light mode main pane with corporate headers)
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'var(--background)',
    fontFamily: 'Inter, system-ui, sans-serif',
    padding: '30px 20px',
    color: 'var(--foreground)',
  },
  setupCard: {
    width: '100%',
    maxWidth: '680px',
    padding: '36px',
    borderRadius: '16px',
    background: 'var(--card-bg)',
    border: '1px solid var(--border)',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  tcsLogoBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  tcsAssessmentLogo: {
    padding: '6px 14px',
    borderRadius: '8px',
    background: 'var(--accent)',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '800',
    letterSpacing: '0.06em',
  },
  tcsAssessmentText: {
    display: 'flex',
    flexDirection: 'column',
  },
  setupTitle: {
    fontSize: '22px',
    fontWeight: '800',
    color: 'var(--foreground)',
    marginBottom: '6px',
  },
  setupText: {
    fontSize: '14px',
    color: 'var(--muted-text)',
    lineHeight: '1.6',
  },
  webcamSetup: {
    height: '280px',
    borderRadius: '12px',
    backgroundColor: '#0f172a',
    border: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  },
  setupVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)',
  },
  cameraError: {
    padding: '24px',
    textAlign: 'center',
    color: '#ef4444',
    fontSize: '14px',
    fontWeight: 600,
    lineHeight: '1.5',
  },
  cameraLoader: {
    fontSize: '14px',
    color: 'var(--accent)',
    fontWeight: 600,
  },
  rulesBox: {
    padding: '20px 24px',
    borderRadius: '12px',
    backgroundColor: 'var(--background)',
    border: '1px solid var(--border)',
  },
  rulesTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--foreground)',
    marginBottom: '12px',
  },
  rulesList: {
    fontSize: '13px',
    color: 'var(--foreground)',
    paddingLeft: '0',
    margin: 0,
    listStyleType: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    lineHeight: '1.5',
  },
  startBtn: {
    padding: '16px 24px',
    borderRadius: '10px',
    border: 'none',
    background: 'var(--accent)',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    letterSpacing: '0.02em',
    transition: 'all 0.2s',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)',
  },

  // ACTIVE CONSOLE PANEL
  consoleContainer: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    background: 'var(--background)',
    color: 'var(--foreground)',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(37, 99, 235, 0.3)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
    zIndex: 10,
    flexWrap: 'wrap',
    gap: '10px',
  },
  examHeaderCenter: {
    textAlign: 'center',
  },
  examTitleText: {
    fontSize: '15px',
    fontWeight: '700',
    color: 'var(--accent)',
    margin: 0,
    textShadow: 'none',
  },
  topbarControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  timerBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '8px',
    backgroundColor: '#f8fafc',
    border: '1px solid #cbd5e1',
    boxShadow: 'inset 0 0 10px rgba(0, 0, 0, 0.05)',
  },
  timerLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
  },
  timerNormal: {
    fontSize: '15px',
    fontWeight: '700',
    color: 'var(--accent)',
    fontFamily: 'monospace',
    textShadow: 'none',
  },
  timerRed: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#ef4444',
    fontFamily: 'monospace',
    textShadow: 'none',
    animation: 'pulse 1s infinite',
  },
  sectionsBar: {
    background: '#ffffff',
    padding: '0 16px',
    display: 'flex',
    borderBottom: '1px solid #cbd5e1',
    overflowX: 'auto',
  },
  sectionTabsList: {
    display: 'flex',
    gap: '4px',
    whiteSpace: 'nowrap',
  },
  sectionTab: {
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#475569',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  sectionTabActive: {
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--accent)',
    backgroundColor: 'rgba(37,99,235,0.05)',
    border: 'none',
    borderBottom: '2px solid var(--accent)',
    cursor: 'pointer',
    textShadow: 'none',
  },
  workspace: {
    flex: 1,
    display: 'flex',
    overflow: 'auto',
    background: 'var(--background)',
    flexWrap: 'wrap',
  },
  questionPanel: {
    flex: 1,
    minWidth: '280px',
    padding: '16px',
    overflowY: 'auto',
  },
  panelCard: {
    backgroundColor: '#ffffff',
    backdropFilter: 'blur(16px)',
    border: '1px solid #cbd5e1',
    borderRadius: '16px',
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    minHeight: '100%',
    boxShadow: '0 4px 15px rgba(0,0,0,0.04)',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '16px',
  },
  qIndexLabel: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--foreground)',
  },
  metaMarksBox: {
    display: 'flex',
    gap: '12px',
    fontSize: '13px',
    fontWeight: '600',
    padding: '6px 12px',
    background: 'rgba(0,0,0,0.03)',
    borderRadius: '20px',
    border: '1px solid #cbd5e1',
  },
  qMarksLabel: {
    color: '#10b981',
  },
  qNegativeLabel: {
    color: '#ef4444',
  },
  questionTextZone: {
    fontSize: '17px',
    lineHeight: '1.7',
    fontWeight: '600',
    color: '#000000',
  },
  mainQuestionText: {
    whiteSpace: 'pre-wrap',
  },
  inputArea: {
    minHeight: '150px',
  },
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px 20px',
    borderRadius: '12px',
    backgroundColor: '#f8fafc',
    border: '1px solid #cbd5e1',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  optionRowActive: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px 20px',
    borderRadius: '12px',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    border: '1px solid var(--accent)',
    boxShadow: 'none',
    cursor: 'pointer',
  },
  optBadge: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: 'rgba(0,0,0,0.03)',
    border: '1px solid #cbd5e1',
    color: '#475569',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '13px',
    fontWeight: '700',
  },
  optBadgeActive: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent)',
    color: '#ffffff',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '13px',
    fontWeight: '700',
    boxShadow: 'none',
  },
  radioInput: {
    display: 'none',
  },
  checkInput: {
    display: 'none',
  },
  optionText: {
    fontSize: '15px',
    color: '#000000',
    fontWeight: '500',
  },
  textAnswerZone: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  textAnswerArea: {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#f8fafc',
    color: 'var(--foreground)',
    fontSize: '15px',
    lineHeight: '1.6',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical',
    boxShadow: 'none',
  },
  counterRow: {
    alignSelf: 'flex-end',
    fontSize: '12px',
    color: '#475569',
  },
  imageUploadZone: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  uploadTip: {
    fontSize: '14px',
    color: '#475569',
  },
  fileBox: {
    display: 'inline-block',
    padding: '16px 32px',
    backgroundColor: 'rgba(37, 99, 235, 0.05)',
    border: '1px dashed #38bdf8',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--accent)',
    textAlign: 'center',
    transition: 'all 0.2s',
  },
  hiddenFileInput: {
    display: 'none',
  },
  imagePreviewBox: {
    marginTop: '15px',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#f8fafc',
  },
  previewTitle: {
    fontSize: '12px',
    color: '#475569',
    marginBottom: '12px',
  },
  imgPreview: {
    maxWidth: '100%',
    maxHeight: '260px',
    borderRadius: '8px',
  },
  navButtonsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    borderTop: '1px solid #cbd5e1',
    paddingTop: '24px',
    marginTop: 'auto',
  },
  navBtn: {
    padding: '10px 24px',
    borderRadius: '8px',
    backgroundColor: 'rgba(0,0,0,0.03)',
    border: '1px solid #cbd5e1',
    color: 'var(--foreground)',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  navBtnDisabled: {
    padding: '10px 24px',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    border: '1px solid #f1f5f9',
    color: '#475569',
    cursor: 'not-allowed',
    fontSize: '14px',
  },
  markReviewBtn: {
    padding: '10px 24px',
    borderRadius: '8px',
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    border: '1px solid var(--purple)',
    color: 'var(--purple)',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    boxShadow: 'none',
  },
  clearResponseBtn: {
    padding: '10px 24px',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    border: '1px solid #cbd5e1',
    color: '#475569',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
  },
  saveNextBtn: {
    padding: '10px 24px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #059669, #10b981)',
    border: 'none',
    color: 'var(--accent)',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    boxShadow: 'none',
  },

  // SIDEBAR & PALETTE
  sidebar: {
    width: '100%',
    maxWidth: '340px',
    background: '#ffffff',
    backdropFilter: 'blur(10px)',
    borderLeft: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    gap: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
    flexShrink: 0,
  },
  profileCard: {
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxShadow: 'none',
  },
  profileMetaInfo: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  candidatePhotoAvatar: {
    width: '44px',
    height: '44px',
    borderRadius: '8px',
    backgroundColor: 'rgba(37, 99, 235, 0.05)',
    border: '1px solid var(--accent)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '20px',
    boxShadow: 'none',
  },
  candidateMetaText: {
    display: 'flex',
    flexDirection: 'column',
  },
  candidateLabel: {
    fontSize: '10px',
    fontWeight: '700',
    color: 'var(--accent)',
    letterSpacing: '0.05em',
  },
  candidateName: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--foreground)',
  },
  candidateRoll: {
    fontSize: '11px',
    color: '#475569',
    fontFamily: 'monospace',
  },
  webcamPreviewBox: {
    height: '140px',
    borderRadius: '8px',
    backgroundColor: '#000000',
    border: '1px solid var(--accent)',
    overflow: 'hidden',
    position: 'relative',
    boxShadow: 'none',
  },
  liveWebcam: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)',
    opacity: 0.85,
  },
  webcamOverlayText: {
    position: 'absolute',
    top: '8px',
    left: '8px',
    fontSize: '10px',
    background: 'rgba(0, 0, 0, 0.8)',
    padding: '4px 8px',
    borderRadius: '4px',
    color: 'var(--accent)',
    fontWeight: '700',
    border: '1px solid rgba(37, 99, 235, 0.3)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  proctorStatusBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '12px',
    color: '#475569',
    backgroundColor: '#ffffff',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #f1f5f9',
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontFamily: 'monospace',
  },
  statusGood: {
    color: '#10b981',
    fontWeight: '700',
    textShadow: 'none',
  },
  statusBad: {
    color: '#ef4444',
    fontWeight: '700',
    textShadow: 'none',
    animation: 'pulse 1s infinite',
  },
  paletteContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    padding: '16px',
    backgroundColor: '#f8fafc',
    backdropFilter: 'blur(5px)',
  },
  questionNavHeader: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--accent)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #cbd5e1',
    paddingBottom: '10px',
  },
  paletteGridWrapper: {
    maxHeight: '180px',
    overflowY: 'auto',
    paddingRight: '8px',
  },
  navGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '10px',
  },
  paletteUnvisited: {
    aspectRatio: '1',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: 'rgba(0,0,0,0.03)',
    color: '#475569',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.2s',
  },
  paletteNotAnswered: {
    aspectRatio: '1',
    borderRadius: '8px',
    border: '1px solid #ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    color: '#ef4444',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    position: 'relative',
    boxShadow: 'none',
  },
  paletteAnswered: {
    aspectRatio: '1',
    borderRadius: '8px',
    border: '1px solid #10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    color: '#10b981',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    position: 'relative',
    boxShadow: 'none',
  },
  paletteMarked: {
    aspectRatio: '1',
    borderRadius: '8px',
    border: '1px solid var(--purple)',
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    color: 'var(--purple)',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    position: 'relative',
    boxShadow: 'none',
  },
  paletteMarkedAnswered: {
    aspectRatio: '1',
    borderRadius: '8px',
    border: '1px solid var(--purple)',
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    color: 'var(--purple)',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    position: 'relative',
    boxShadow: 'none',
  },
  paletteActive: {
    aspectRatio: '1',
    borderRadius: '8px',
    border: '2px solid var(--accent)',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    color: 'var(--accent)',
    fontSize: '14px',
    fontWeight: '800',
    cursor: 'pointer',
    boxShadow: 'none',
  },
  dotBadge: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    color: '#10b981',
    fontSize: '20px',
    lineHeight: 1,
    textShadow: 'none',
  },
  legendContainer: {
    borderTop: '1px solid #cbd5e1',
    paddingTop: '12px',
  },
  legendTitle: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#475569',
    marginBottom: '10px',
    textTransform: 'uppercase',
  },
  legendGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    fontSize: '11px',
    color: '#475569',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  legendLabel: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  legendBadgeGray: {
    width: '14px',
    height: '14px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
  },
  legendBadgeRed: {
    width: '14px',
    height: '14px',
    borderRadius: '4px',
    border: '1px solid #ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    boxShadow: 'none',
  },
  legendBadgeGreen: {
    width: '14px',
    height: '14px',
    borderRadius: '4px',
    border: '1px solid #10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    boxShadow: 'none',
  },
  legendBadgePurple: {
    width: '14px',
    height: '14px',
    borderRadius: '4px',
    border: '1px solid var(--purple)',
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
  },
  legendBadgePurpleDot: {
    width: '14px',
    height: '14px',
    borderRadius: '4px',
    border: '1px solid var(--purple)',
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    boxShadow: 'none',
  },
  finishBtn: {
    padding: '16px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)',
    border: 'none',
    color: 'var(--accent)',
    fontWeight: '800',
    fontSize: '15px',
    cursor: 'pointer',
    width: '100%',
    boxShadow: 'none',
    transition: 'all 0.2s',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },

  // SECURITY WARNING
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  warningContent: {
    width: '100%',
    maxWidth: '460px',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid #ef4444',
    borderRadius: '16px',
    padding: '32px',
    color: 'var(--foreground)',
    textAlign: 'center',
    boxShadow: '0 0 40px rgba(239, 68, 68, 0.3)',
    position: 'relative',
    overflow: 'hidden',
  },
  warningIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    animation: 'pulse 1s infinite',
    textShadow: '0 0 20px rgba(239, 68, 68, 0.8)',
  },
  warningTitle: {
    fontSize: '20px',
    fontWeight: '800',
    color: '#ef4444',
    marginBottom: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  warningMsg: {
    fontSize: '15px',
    fontWeight: '500',
    color: 'var(--foreground)',
    marginBottom: '16px',
  },
  warningInstructions: {
    fontSize: '13px',
    color: '#475569',
    lineHeight: '1.6',
    marginBottom: '24px',
  },
  warningDismissBtn: {
    padding: '12px 24px',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    color: '#ef4444',
    border: '1px solid #ef4444',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer',
    width: '100%',
    transition: 'all 0.2s',
    boxShadow: 'none',
  }
};
