# AI-Proctored Online Examination Platform

A scalable, highly secure, and fully integrated online examination platform designed to handle mass concurrent testing sessions without performance degradation. Built with a modern decoupled full-stack architecture, this platform features an advanced client-side AI Proctoring Engine and automated LLM-assisted grading to minimize academic dishonesty and significantly reduce manual evaluation overhead for educators.

## 🚀 Tech Stack
- **Frontend:** Next.js (React/TypeScript)
- **Backend:** Python (FastAPI & Django)
- **Database:** PostgreSQL
- **AI & Machine Learning:** TensorFlow.js, Google MediaPipe, Google Gemini LLM
- **Multilingual Support:** Sarvam AI
- **Infrastructure:** Docker & Docker Compose, Celery, Redis

## ✨ Key Features
- **Strict AI Proctoring Engine:** Client-side real-time monitoring using Google MediaPipe. Actively tracks face presence, gaze direction, and multiple persons in the frame while preserving privacy by keeping video processing local.
- **Secure Exam Engine:** Implements randomized paper generation, continuous tab-switch logging, robust WebSocket heartbeats, and strict server-side timers to prevent cheating and client-clock manipulation.
- **Unified Evaluation & AI Grading Portal:** Seamlessly routes subjective submissions to Google Gemini (gemini-2.5-flash) for automated first-pass scoring and justifications. Examiners can review AI scores and watch video replays of any flagged suspicious events (ProctorEvents).
- **Dynamic Multilingual Support:** Integrates Sarvam AI to translate dynamic exam content (subjects, questions) on the fly, bridging accessibility gaps for diverse demographics.
- **Role-Based Access Control:** Secure JWT authentication with strict separation between Student, Examiner, and Administrator workflows.

## 🛠️ Setup & Installation

### Option 1: Docker Compose (Recommended)
This project is configured to run effortlessly using Docker Compose. Ensure you have Docker and Docker Compose installed on your system.

```bash
# Clone the repository
git clone https://github.com/prakhar2207/AI-Proctored-Online-Examination-Platform.git
cd AI-Proctored-Online-Examination-Platform

# Start all services (Backend, Frontend, PostgreSQL, Redis)
docker-compose up -d --build
```
The application will be available at:
- **Frontend UI:** `http://localhost:3000`
- **Backend API:** `http://localhost:8000`

### Option 2: Manual Setup
If you prefer running the services natively without Docker:

**1. Backend Setup**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

**2. Frontend Setup**
```bash
cd frontend
npm install
npm run dev
```

## 🔒 Security & Privacy
The proctoring system is designed with privacy-first principles. Facial detection and behavioral analysis run completely within the browser via TensorFlow.js. Only the resulting analytical flags (ProctorEvents) are transmitted to the backend, drastically reducing server bandwidth and ensuring strict data privacy for students.
