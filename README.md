
# ⬡ QuizAI — AI-Powered Quiz Generator

**Upload a PDF or PowerPoint → Get an instant AI-generated quiz → Track your learning analytics**

## 🚀 Overview

QuizAI is a full-stack AI SaaS application that transforms your study material into interactive multiple-choice quizzes in seconds. Upload any PDF or PPTX file, choose your difficulty and question count, and let the AI do the rest. Every quiz you take feeds a live analytics dashboard that tracks your scores, streaks, strong topics, and weak areas over time.

Built as a portfolio-grade project demonstrating real-world AI integration, modern React architecture, and premium UI/UX design.

---

## ✨ Features

### Core
- **AI Quiz Generation** — Upload PDF or PPTX → AI reads the content → generates MCQs instantly via OpenRouter
- **Multiple Difficulty Levels** — Easy, Medium, Hard with adaptive question framing
- **Configurable Question Count** — Slider from 3 to 10 questions per quiz
- **Interactive Quiz Experience** — Animated question cards, option selection, progress bar, question navigator
- **Results Review** — See every question with your answer vs the correct answer after submission

### Analytics (100% Dynamic)
- **Live Dashboard** — All stats update in real time after every quiz — zero hardcoded data
- **Score Trend Chart** — Line chart tracking your quiz scores over time
- **Per-Topic Bar Chart** — Score breakdown by uploaded file/topic
- **Overall Pie Chart** — Correct vs wrong across all quizzes combined
- **Strong & Weak Topics** — Auto-classified based on your actual scores
- **Quiz History Table** — Full log of every attempt with file name, difficulty, score, and time
- **Learning Streak** — Tracks consecutive days you have taken at least one quiz

### UX & Design
- **Premium Glassmorphism UI** — Inspired by Linear, Framer, Vercel, and Stripe
- **Drag & Drop Upload** — With file validation, size display, and animated success/error states
- **Smooth Animations** — Framer Motion throughout: fade, slide, scale, hover, page transitions
- **Dark / Light Theme Toggle** — Instant switch with full theme support
- **Fully Responsive** — Desktop, tablet, and mobile layouts

---

## 🛠 Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| Vite | Build tool and dev server |
| Framer Motion | Animations and transitions |
| Recharts | Analytics charts (Pie, Bar, Line) |
| Axios | HTTP client for API calls |
| CSS3 | Custom styling (no UI library) |

### Backend
| Technology | Purpose |
|---|---|
| FastAPI | REST API framework |
| OpenRouter API | AI model access (LLM) |
| Python-Multipart | File upload handling |
| PyPDF2 / python-pptx | Document text extraction |
| Uvicorn | ASGI server |

---

## 📦 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+
- An [OpenRouter](https://openrouter.ai/) API key (free tier available)

---

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/ai-quiz-generator.git
cd ai-quiz-generator
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file inside the `backend/` folder:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

Start the backend:

```bash
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`

---

## 📁 Project Structure

```
ai-quiz-generator/
│
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   │   └── bg.png
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── .env
│
└── README.md
```

---

## 🔌 API Reference

### `POST /generate-quiz`

**Request** — `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `file` | File | PDF or PPTX file |
| `difficulty` | string | Easy / Medium / Hard |
| `num_questions` | integer | Number of questions (3–10) |

**Response**

```json
{
  "questions": [
    {
      "question": "What is backpropagation?",
      "options": [
        "A sorting algorithm",
        "A method to train neural networks",
        "A database query language",
        "A frontend framework"
      ],
      "answer": "A method to train neural networks"
    }
  ]
}
```

---

## 📊 How Analytics Work

All analytics are computed from a `quizHistory` array that grows with each quiz submission. Nothing is hardcoded.

```
Submit Quiz
    └── Save to quizHistory[]
            ├── fileName
            ├── difficulty
            ├── correct / total
            ├── timeTaken
            └── timestamp

quizHistory → useMemo → analyticsData
    ├── totalQuizzes
    ├── avgScore
    ├── streak (consecutive days)
    ├── pieData  (correct vs wrong)
    ├── barData  (score per file/topic)
    ├── lineData (trend over last 7 quizzes)
    ├── strongTopics (score ≥ 70%)
    └── weakTopics   (score < 70%)
```

---

## 🎨 Design System

| Token | Value |
|---|---|
| Primary | `#6366F1` Indigo |
| Accent | `#06B6D4` Cyan |
| Secondary | `#8B5CF6` Violet |
| Background | `#0A0E1A` Deep Navy |
| Display Font | Space Grotesk |
| Body Font | Inter |

---

<div align="center">

Made with ❤️ using React, FastAPI, and OpenRouter AI

⭐ Star this repo if you found it useful!

</div>
