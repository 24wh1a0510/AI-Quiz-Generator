import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend
} from "recharts";
import "./App.css";

// ─── CONSTANTS ──────────────────────────────────────────────────────────────
const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const NAV_LINKS = ["Dashboard", "Generate Quiz", "Analytics"];
const CHART_COLORS = ["#6366F1", "#06B6D4", "#8B5CF6", "#F59E0B", "#10B981"];
const STORAGE_KEY = "quizai_history";

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] } }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.88 },
  visible: (i = 0) => ({ opacity: 1, scale: 1, transition: { delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }),
};

// ─── HISTORY HELPERS ─────────────────────────────────────────────────────────

/** Load quiz history from localStorage */
function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Save a new quiz result entry to localStorage */
function saveResult(entry) {
  try {
    const history = loadHistory();
    history.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // storage unavailable; silently skip
  }
}

/** Derive all analytics from stored history */
function deriveAnalytics(history) {
  const totalQuizzes = history.length;
  const attempted = history.reduce((sum, e) => sum + e.total, 0);

  // Average score across all quizzes
  const avgScore =
    totalQuizzes === 0
      ? 0
      : Math.round(history.reduce((sum, e) => sum + e.pct, 0) / totalQuizzes);

  // Best topic: filename (trimmed) with the highest score
  const topicMap = {};
  history.forEach((e) => {
    const key = e.topic || "General";
    if (!topicMap[key]) topicMap[key] = { total: 0, count: 0 };
    topicMap[key].total += e.pct;
    topicMap[key].count += 1;
  });
  const topicAvgs = Object.entries(topicMap).map(([name, v]) => ({
    name,
    avg: Math.round(v.total / v.count),
  }));
  topicAvgs.sort((a, b) => b.avg - a.avg);

  const bestTopic = topicAvgs[0]?.name || "—";

  // Streak: consecutive days with at least one quiz (counting backwards from today)
  const today = new Date().toDateString();
  const daySet = new Set(history.map((e) => new Date(e.date).toDateString()));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (daySet.has(d.toDateString())) {
      streak++;
    } else if (i > 0) {
      break; // gap found
    }
  }

  // Pie: overall correct vs wrong across all quizzes
  const totalCorrect = history.reduce((sum, e) => sum + e.correct, 0);
  const totalWrong = history.reduce((sum, e) => sum + e.wrong, 0);
  const pieData =
    totalCorrect + totalWrong === 0
      ? [{ name: "No data", value: 1 }]
      : [
          { name: "Correct", value: totalCorrect },
          { name: "Wrong", value: totalWrong },
        ];

  // Bar: score per topic (top 6)
  const barData = topicAvgs.slice(0, 6).map((t) => ({
    topic: t.name.length > 8 ? t.name.slice(0, 7) + "…" : t.name,
    score: t.avg,
  }));

  // Line: scores over the last 7 days
  const lineData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toDateString();
    const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
    const dayEntries = history.filter(
      (e) => new Date(e.date).toDateString() === dayStr
    );
    const dayAvg =
      dayEntries.length === 0
        ? null
        : Math.round(
            dayEntries.reduce((sum, e) => sum + e.pct, 0) / dayEntries.length
          );
    lineData.push({ day: dayLabel, score: dayAvg });
  }

  // Strong / Weak topics (need ≥1 quiz)
  const strongTopics = topicAvgs.filter((t) => t.avg >= 75).map((t) => t.name);
  const weakTopics = topicAvgs.filter((t) => t.avg < 60).map((t) => t.name);

  // Recommended: topics not yet attempted or with low scores
  const SUGGESTION_POOL = [
    "System Design",
    "Database Indexing",
    "Cloud Architecture",
    "Data Structures",
    "Operating Systems",
    "Computer Networks",
    "Machine Learning",
    "Algorithms",
  ];
  const attempted_topics = new Set(Object.keys(topicMap));
  const recommended = SUGGESTION_POOL.filter(
    (t) => !attempted_topics.has(t) || topicMap[t]?.avg < 60
  ).slice(0, 3);

  // Study suggestions generated dynamically
  const suggestions = [];
  if (weakTopics.length > 0)
    suggestions.push(
      `Review weak topics (${weakTopics.slice(0, 2).join(", ")}) with focused 20-min sessions`
    );
  if (streak > 0)
    suggestions.push(`Keep your ${streak}-day streak alive — take a quiz today`);
  else suggestions.push("Start a daily quiz habit to build a streak");
  if (avgScore < 70)
    suggestions.push("Focus on accuracy: review answers after every quiz");
  else suggestions.push("Solid performance — push to harder difficulty levels");
  if (recommended.length > 0)
    suggestions.push(`Try a new topic: ${recommended[0]}`);

  return {
    totalQuizzes,
    avgScore,
    bestTopic,
    streak,
    attempted,
    strongTopics: strongTopics.length > 0 ? strongTopics : ["No strong topics yet"],
    weakTopics: weakTopics.length > 0 ? weakTopics : ["No weak topics yet"],
    recommended: recommended.length > 0 ? recommended : ["Keep quizzing to get recommendations"],
    pieData,
    barData,
    lineData,
    suggestions,
  };
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [activeSection, setActiveSection] = useState("Dashboard");
  const [theme, setTheme] = useState("dark");
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [difficulty, setDifficulty] = useState("Medium");
  const [questionCount, setQuestionCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [timeTaken, setTimeTaken] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("idle");
  const [history, setHistory] = useState(loadHistory);
  const fileInputRef = useRef(null);

  // ── Derived analytics (recomputed whenever history changes) ──
  const analyticsData = deriveAnalytics(history);

  // ── File handling ──
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSetFile(dropped);
  };

  const validateAndSetFile = (f) => {
    const valid = f.name.endsWith(".pdf") || f.name.endsWith(".pptx");
    if (valid) {
      setFile(f);
      setUploadStatus("success");
    } else {
      setUploadStatus("error");
    }
  };

  // ── Generate quiz via Anthropic API ──
  const generateQuiz = async () => {
    if (!file) return;
    setLoading(true);
    setQuiz(null);
    setSubmitted(false);
    setResults(null);
    setAnswers({});
    setCurrentQ(0);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("difficulty", difficulty);
      formData.append("num_questions", questionCount);

      const res = await fetch("http://localhost:8000/generate-quiz", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Backend returns { quiz: [...] } with correct_answer field
      // Normalize to { answer } so the rest of the UI works uniformly
      const raw = Array.isArray(data.quiz) ? data.quiz
                : Array.isArray(data.questions) ? data.questions
                : data;

      const questions = raw.map((q) => ({
        question: q.question,
        options: q.options,
        answer: q.correct_answer ?? q.answer,
        topic: q.topic || "",
        explanation: q.explanation || "",
      }));

      if (!questions.length) throw new Error("No questions returned from server.");

      setQuiz(questions);
      setStartTime(Date.now());
      setActiveSection("Generate Quiz");
    } catch (err) {
      console.error("Quiz generation failed:", err);
      alert(`❌ Failed to generate quiz:\n${err.message}\n\nMake sure your FastAPI server is running:\n  uvicorn app:app --reload`);
    } finally {
      setLoading(false);
    }
  };

  // ── Answer selection ──
  const selectAnswer = (option) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [currentQ]: option }));
  };

  // ── Submit quiz ──
  const submitQuiz = () => {
    if (!quiz) return;
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    setTimeTaken(elapsed);
    let correct = 0;
    quiz.forEach((q, i) => {
      if (answers[i] === q.answer) correct++;
    });
    const wrong = quiz.length - correct;
    const pct = Math.round((correct / quiz.length) * 100);

    const resultData = { correct, wrong, total: quiz.length };
    setResults(resultData);
    setSubmitted(true);
    setActiveSection("Results");

    // ── Persist result to history ──
    const topic = file
      ? file.name.replace(/\.(pdf|pptx)$/i, "").replace(/[-_]/g, " ")
      : "General";

    const entry = {
      date: new Date().toISOString(),
      topic,
      difficulty,
      correct,
      wrong,
      total: quiz.length,
      pct,
      timeTaken: elapsed,
    };
    saveResult(entry);
    setHistory(loadHistory());
  };

  const resetQuiz = () => {
    setQuiz(null);
    setAnswers({});
    setCurrentQ(0);
    setSubmitted(false);
    setResults(null);
    setFile(null);
    setUploadStatus("idle");
    setTimeTaken(null);
    setActiveSection("Dashboard");
  };

  const progress = quiz ? ((currentQ + 1) / quiz.length) * 100 : 0;

  return (
    <div className={`app ${theme}`}>
      {/* Background */}
      <div className="bg-image" />
      <div className="bg-overlay" />

      {/* Navbar */}
      <Navbar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        theme={theme}
        setTheme={setTheme}
      />

      {/* Main content */}
      <main className="main-content">
        <AnimatePresence mode="wait">
          {activeSection === "Dashboard" && (
            <motion.div key="dashboard" initial="hidden" animate="visible" exit={{ opacity: 0, y: -20 }} className="section-wrapper">
              <HeroSection setActiveSection={setActiveSection} analyticsData={analyticsData} />
              <DashboardCards data={analyticsData} />
            </motion.div>
          )}

          {activeSection === "Generate Quiz" && !quiz && (
            <motion.div key="upload" initial="hidden" animate="visible" exit={{ opacity: 0, y: -20 }} className="section-wrapper">
              <SectionHeader
                eyebrow="Step 1"
                title="Upload Your Material"
                sub="Drop a PDF or PowerPoint and let AI do the heavy lifting."
              />
              <UploadSection
                file={file}
                dragOver={dragOver}
                setDragOver={setDragOver}
                handleDrop={handleDrop}
                validateAndSetFile={validateAndSetFile}
                uploadStatus={uploadStatus}
                fileInputRef={fileInputRef}
              />
              {file && (
                <motion.div initial="hidden" animate="visible" variants={fadeUp}>
                  <QuizSettings
                    difficulty={difficulty}
                    setDifficulty={setDifficulty}
                    questionCount={questionCount}
                    setQuestionCount={setQuestionCount}
                  />
                  <div className="generate-btn-wrap">
                    <motion.button
                      className="btn-primary btn-generate"
                      onClick={generateQuiz}
                      disabled={loading}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {loading ? <LoadingDots /> : <>✦ Generate Quiz</>}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeSection === "Generate Quiz" && quiz && !submitted && (
            <motion.div key="quiz" initial="hidden" animate="visible" exit={{ opacity: 0 }} className="section-wrapper">
              <QuizExperience
                quiz={quiz}
                currentQ={currentQ}
                setCurrentQ={setCurrentQ}
                answers={answers}
                selectAnswer={selectAnswer}
                progress={progress}
                submitQuiz={submitQuiz}
              />
            </motion.div>
          )}

          {activeSection === "Results" && results && (
            <motion.div key="results" initial="hidden" animate="visible" exit={{ opacity: 0 }} className="section-wrapper">
              <ResultsPage results={results} timeTaken={timeTaken} quiz={quiz} answers={answers} resetQuiz={resetQuiz} analyticsData={analyticsData} />
            </motion.div>
          )}

          {activeSection === "Analytics" && (
            <motion.div key="analytics" initial="hidden" animate="visible" exit={{ opacity: 0 }} className="section-wrapper">
              <AnalyticsPage data={analyticsData} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ─── NAVBAR ──────────────────────────────────────────────────────────────────
function Navbar({ activeSection, setActiveSection, theme, setTheme }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`navbar ${scrolled ? "navbar-scrolled" : ""}`}>
      <div className="navbar-inner">
        <div className="navbar-logo" onClick={() => setActiveSection("Dashboard")}>
          <span className="logo-icon">⬡</span>
          <span className="logo-text">QuizAI</span>
        </div>

        <div className={`navbar-links ${menuOpen ? "open" : ""}`}>
          {NAV_LINKS.map((link) => (
            <button
              key={link}
              className={`nav-link ${activeSection === link ? "active" : ""}`}
              onClick={() => { setActiveSection(link); setMenuOpen(false); }}
            >
              {link}
            </button>
          ))}
        </div>

        <div className="navbar-actions">
          <motion.button
            className="theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            title="Toggle theme"
          >
            {theme === "dark" ? "☀︎" : "☽"}
          </motion.button>
          <motion.div className="avatar" whileHover={{ scale: 1.08 }}>
            <span>AQ</span>
            <div className="avatar-ring" />
          </motion.div>
          <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
            <span /><span /><span />
          </button>
        </div>
      </div>
    </nav>
  );
}

// ─── HERO ────────────────────────────────────────────────────────────────────
function HeroSection({ setActiveSection, analyticsData }) {
  return (
    <section className="hero">
      <div className="hero-mesh" />
      <motion.div className="hero-content" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.12 } } }}>
        <motion.div variants={fadeUp} className="hero-eyebrow">
          <span className="badge-dot" />
          Powered by OpenRouter AI
        </motion.div>
        <motion.h1 variants={fadeUp} className="hero-title">
          AI Learning<br />
          <span className="gradient-text">Analytics Platform</span>
        </motion.h1>
        <motion.p variants={fadeUp} className="hero-sub">
          Upload PDFs and PowerPoint presentations and generate<br className="hero-br" />
          AI-powered quizzes instantly. Study smarter.
        </motion.p>
        <motion.div variants={fadeUp} className="hero-cta-row">
          <motion.button
            className="btn-primary btn-hero"
            onClick={() => setActiveSection("Generate Quiz")}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="btn-shimmer" />
            Generate Your Quiz →
          </motion.button>
          <motion.button
            className="btn-ghost"
            onClick={() => setActiveSection("Analytics")}
            whileHover={{ scale: 1.03 }}
          >
            View Analytics
          </motion.button>
        </motion.div>
        {/* Live stats derived from real history */}
        <motion.div variants={fadeUp} className="hero-stats-row">
          {[
            [String(analyticsData.totalQuizzes), "Quizzes Created"],
            [String(analyticsData.attempted), "Questions Done"],
            [analyticsData.totalQuizzes === 0 ? "—" : `${analyticsData.avgScore}%`, "Avg Score"],
          ].map(([val, label]) => (
            <div key={label} className="hero-stat">
              <span className="hero-stat-val">{val}</span>
              <span className="hero-stat-label">{label}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}

// ─── DASHBOARD CARDS ─────────────────────────────────────────────────────────
function DashboardCards({ data }) {
  const cards = [
    {
      label: "Total Quizzes",
      value: data.totalQuizzes,
      icon: "◈",
      color: "indigo",
      sub: data.totalQuizzes === 0 ? "No quizzes yet" : `${data.totalQuizzes} session${data.totalQuizzes !== 1 ? "s" : ""} completed`,
    },
    {
      label: "Average Score",
      value: data.totalQuizzes === 0 ? "—" : `${data.avgScore}%`,
      icon: "◎",
      color: "cyan",
      sub: data.totalQuizzes === 0 ? "Take a quiz to see your score" : data.avgScore >= 70 ? "↑ Good performance" : "Keep practising!",
    },
    {
      label: "Best Topic",
      value: data.totalQuizzes === 0 ? "—" : data.bestTopic,
      icon: "✦",
      color: "violet",
      sub: data.totalQuizzes === 0 ? "No data yet" : "Your highest-scoring subject",
    },
    {
      label: "Learning Streak",
      value: data.streak === 0 ? "0 days" : `${data.streak} day${data.streak !== 1 ? "s" : ""}`,
      icon: "⚡",
      color: "amber",
      sub: data.streak === 0 ? "Start today!" : data.streak >= 7 ? "🔥 On fire!" : "Keep it up!",
    },
    {
      label: "Questions Done",
      value: data.attempted,
      icon: "❋",
      color: "green",
      sub: "Lifetime total",
    },
  ];

  return (
    <section className="dashboard-section">
      <SectionHeader eyebrow="Overview" title="Your Learning Dashboard" sub="Track your progress and performance at a glance." />
      <div className="cards-grid">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            className={`stat-card stat-card--${card.color}`}
            custom={i}
            variants={scaleIn}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            whileHover={{ y: -6, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <div className="stat-card-top">
              <span className="stat-icon">{card.icon}</span>
              <div className="stat-glow" />
            </div>
            <div className="stat-value">{card.value}</div>
            <div className="stat-label">{card.label}</div>
            <div className="stat-sub">{card.sub}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ─── UPLOAD SECTION ──────────────────────────────────────────────────────────
function UploadSection({ file, dragOver, setDragOver, handleDrop, validateAndSetFile, uploadStatus, fileInputRef }) {
  const fmt = (bytes) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <motion.div
      className={`upload-zone ${dragOver ? "drag-active" : ""} ${uploadStatus === "success" ? "upload-success" : ""} ${uploadStatus === "error" ? "upload-error" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      whileHover={{ scale: 1.01 }}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.pptx"
        style={{ display: "none" }}
        onChange={(e) => e.target.files[0] && validateAndSetFile(e.target.files[0])}
      />

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div key="empty" className="upload-placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="upload-icon-wrap">
              <motion.div
                className="upload-icon"
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
              >
                ⬆
              </motion.div>
              <div className="upload-ring upload-ring--1" />
              <div className="upload-ring upload-ring--2" />
            </div>
            <p className="upload-title">{dragOver ? "Drop it here" : "Drag & drop your file"}</p>
            <p className="upload-sub">Supports PDF and PPTX · Click to browse</p>
            <div className="upload-badges">
              <span className="file-badge">PDF</span>
              <span className="file-badge">PPTX</span>
            </div>
          </motion.div>
        ) : uploadStatus === "error" ? (
          <motion.div key="error" className="upload-state" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <span className="upload-state-icon error">✕</span>
            <p className="upload-state-title">Unsupported format</p>
            <p className="upload-sub">Only PDF and PPTX files are accepted.</p>
          </motion.div>
        ) : (
          <motion.div key="success" className="upload-state" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <motion.span
              className="upload-state-icon success"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >✓</motion.span>
            <p className="upload-state-title">{file.name}</p>
            <p className="upload-sub">{fmt(file.size)} · Ready to generate</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── QUIZ SETTINGS ───────────────────────────────────────────────────────────
function QuizSettings({ difficulty, setDifficulty, questionCount, setQuestionCount }) {
  return (
    <motion.div className="settings-panel" variants={fadeUp} initial="hidden" animate="visible">
      <div className="settings-row">
        <div className="settings-group">
          <label className="settings-label">Difficulty</label>
          <div className="difficulty-pills">
            {DIFFICULTIES.map((d) => (
              <motion.button
                key={d}
                className={`difficulty-pill difficulty-pill--${d.toLowerCase()} ${difficulty === d ? "active" : ""}`}
                onClick={() => setDifficulty(d)}
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.95 }}
              >
                {d === "Easy" ? "🟢" : d === "Medium" ? "🟡" : "🔴"} {d}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="settings-group">
          <label className="settings-label">
            Number of Questions <span className="slider-val">{questionCount}</span>
          </label>
          <div className="slider-wrap">
            <input
              type="range"
              min={3}
              max={10}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="styled-slider"
            />
            <div className="slider-track-fill" style={{ width: `${((questionCount - 3) / 7) * 100}%` }} />
          </div>
          <div className="slider-ticks">
            <span>3</span><span>5</span><span>7</span><span>10</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── QUIZ EXPERIENCE ─────────────────────────────────────────────────────────
function QuizExperience({ quiz, currentQ, setCurrentQ, answers, selectAnswer, progress, submitQuiz }) {
  const q = quiz[currentQ];
  const answered = answers[currentQ];
  const isLast = currentQ === quiz.length - 1;

  return (
    <div className="quiz-wrapper">
      <SectionHeader eyebrow={`Question ${currentQ + 1} of ${quiz.length}`} title="Answer the Question" sub="" />

      {/* Progress */}
      <div className="progress-track">
        <motion.div className="progress-fill" animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
        <div className="progress-label">{Math.round(progress)}% Complete</div>
      </div>

      {/* Question bubbles */}
      <div className="q-bubbles">
        {quiz.map((_, i) => (
          <motion.div
            key={i}
            className={`q-bubble ${i === currentQ ? "current" : ""} ${answers[i] !== undefined ? "answered" : ""}`}
            onClick={() => setCurrentQ(i)}
            whileHover={{ scale: 1.15 }}
          >
            {i + 1}
          </motion.div>
        ))}
      </div>

      {/* Question card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQ}
          className="question-card"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="question-number">Q{currentQ + 1}</div>
          <p className="question-text">{q.question}</p>

          <div className="options-grid">
            {q.options.map((option, i) => (
              <motion.button
                key={option}
                className={`option-btn ${answered === option ? "selected" : ""}`}
                onClick={() => selectAnswer(option)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
              >
                <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                <span className="option-text">{option}</span>
                {answered === option && <span className="option-check">✓</span>}
              </motion.button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Nav buttons */}
      <div className="quiz-nav">
        <motion.button
          className="btn-ghost"
          onClick={() => setCurrentQ((p) => Math.max(0, p - 1))}
          disabled={currentQ === 0}
          whileHover={{ scale: 1.03 }}
        >
          ← Previous
        </motion.button>

        {!isLast ? (
          <motion.button
            className="btn-primary"
            onClick={() => setCurrentQ((p) => p + 1)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
          >
            Next →
          </motion.button>
        ) : (
          <motion.button
            className="btn-primary btn-submit"
            onClick={submitQuiz}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
          >
            Submit Quiz ✓
          </motion.button>
        )}
      </div>
    </div>
  );
}

// ─── RESULTS PAGE ────────────────────────────────────────────────────────────
function ResultsPage({ results, timeTaken, quiz, answers, resetQuiz, analyticsData }) {
  const pct = Math.round((results.correct / results.total) * 100);
  const grade = pct >= 90 ? "Excellent" : pct >= 70 ? "Good" : pct >= 50 ? "Fair" : "Needs Work";
  const gradeColor = pct >= 90 ? "green" : pct >= 70 ? "cyan" : pct >= 50 ? "amber" : "red";

  return (
    <div className="results-wrapper">
      <motion.div className="results-hero" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
        <motion.div variants={fadeUp} className={`grade-badge grade-badge--${gradeColor}`}>{grade}</motion.div>
        <motion.h2 variants={fadeUp} className="results-score">{pct}<span>%</span></motion.h2>
        <motion.p variants={fadeUp} className="results-sub">You scored {results.correct} out of {results.total} questions</motion.p>

        <div className="results-stats">
          {[
            { icon: "✓", label: "Correct", value: results.correct, color: "green" },
            { icon: "✕", label: "Wrong", value: results.wrong, color: "red" },
            { icon: "⏱", label: "Time", value: `${timeTaken}s`, color: "cyan" },
            { icon: "◎", label: "Total", value: results.total, color: "indigo" },
          ].map((s, i) => (
            <motion.div key={s.label} className={`result-stat result-stat--${s.color}`} variants={scaleIn} custom={i}>
              <span className="result-stat-icon">{s.icon}</span>
              <span className="result-stat-val">{s.value}</span>
              <span className="result-stat-label">{s.label}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Review section */}
      <div className="review-section">
        <h3 className="review-title">Review Your Answers</h3>
        <div className="review-list">
          {quiz.map((q, i) => {
            const isCorrect = answers[i] === q.answer;
            return (
              <motion.div
                key={i}
                className={`review-card ${isCorrect ? "review-correct" : "review-wrong"}`}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
              >
                <div className="review-q-row">
                  <span className={`review-icon ${isCorrect ? "green" : "red"}`}>{isCorrect ? "✓" : "✕"}</span>
                  <p className="review-question">Q{i + 1}: {q.question}</p>
                </div>
                {!isCorrect && (
                  <div className="review-detail">
                    <span className="review-wrong-ans">Your answer: {answers[i] || "Skipped"}</span>
                    <span className="review-correct-ans">Correct: {q.answer}</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Charts */}
      <div className="results-charts">
        <div className="chart-card">
          <h4 className="chart-title">Score Breakdown</h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={[{ name: "Correct", value: results.correct }, { name: "Wrong", value: results.wrong }]} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                {["#10B981", "#EF4444"].map((color, i) => <Cell key={i} fill={color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "rgba(10,14,26,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h4 className="chart-title">Weekly Progress</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={analyticsData.lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="day" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "rgba(10,14,26,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }} />
              <Line type="monotone" dataKey="score" stroke="#6366F1" strokeWidth={2.5} dot={{ fill: "#6366F1", r: 4 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="results-actions">
        <motion.button className="btn-primary" onClick={resetQuiz} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
          ✦ Generate New Quiz
        </motion.button>
      </div>
    </div>
  );
}

// ─── ANALYTICS PAGE ──────────────────────────────────────────────────────────
function AnalyticsPage({ data }) {
  return (
    <div className="analytics-wrapper">
      <SectionHeader eyebrow="Insights" title="Your Learning Analytics" sub="Deep dive into your performance across topics." />

      {data.totalQuizzes === 0 ? (
        <motion.div
          className="chart-card"
          style={{ textAlign: "center", padding: "3rem 2rem" }}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
        >
          <p style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📊</p>
          <p style={{ color: "var(--ghost)", fontSize: "1.1rem", fontWeight: 600 }}>No quiz data yet</p>
          <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
            Complete your first quiz to see analytics here.
          </p>
        </motion.div>
      ) : (
        <>
          <div className="analytics-grid">
            {/* Pie */}
            <motion.div className="chart-card chart-card--wide" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <h4 className="chart-title">Overall Performance</h4>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={data.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={5} dataKey="value">
                    {CHART_COLORS.map((color, i) => <Cell key={i} fill={color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "rgba(10,14,26,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }} />
                  <Legend formatter={(val) => <span style={{ color: "#94A3B8" }}>{val}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Bar */}
            <motion.div className="chart-card chart-card--wide" variants={fadeUp} custom={1} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <h4 className="chart-title">Score by Topic</h4>
              {data.barData.length === 0 ? (
                <p style={{ color: "var(--muted)", padding: "2rem 0" }}>No topic data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.barData} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="topic" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: "rgba(10,14,26,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }} />
                    <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                      {data.barData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </motion.div>

            {/* Line */}
            <motion.div className="chart-card chart-card--full" variants={fadeUp} custom={2} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <h4 className="chart-title">Weekly Score Trend</h4>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="day" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "rgba(10,14,26,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }} />
                  <Line type="monotone" dataKey="score" stroke="#6366F1" strokeWidth={2.5} dot={{ fill: "#6366F1", r: 4 }} activeDot={{ r: 6 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {/* Topic cards */}
          <div className="topic-insights">
            {[
              { title: "Strong Topics", items: data.strongTopics, color: "green", icon: "▲" },
              { title: "Weak Topics", items: data.weakTopics, color: "red", icon: "▼" },
              { title: "Recommended", items: data.recommended, color: "indigo", icon: "✦" },
            ].map((group, i) => (
              <motion.div key={group.title} className="topic-card" variants={scaleIn} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <div className={`topic-card-header topic-card-header--${group.color}`}>
                  <span>{group.icon}</span> {group.title}
                </div>
                <ul className="topic-list">
                  {group.items.map((item) => (
                    <li key={item} className="topic-item">
                      <span className={`topic-dot topic-dot--${group.color}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          {/* Dynamic study suggestions */}
          <motion.div className="suggestions-panel" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <h4 className="chart-title">Study Suggestions</h4>
            <div className="suggestions-list">
              {data.suggestions.map((tip, i) => (
                <motion.div key={i} className="suggestion-item" initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                  <span className="suggestion-num">{String(i + 1).padStart(2, "0")}</span>
                  <span>{tip}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function SectionHeader({ eyebrow, title, sub }) {
  return (
    <motion.div className="section-header" variants={fadeUp} initial="hidden" animate="visible">
      {eyebrow && <div className="section-eyebrow">{eyebrow}</div>}
      {title && <h2 className="section-title">{title}</h2>}
      {sub && <p className="section-sub">{sub}</p>}
    </motion.div>
  );
}

function LoadingDots() {
  return (
    <span className="loading-dots">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
        >•</motion.span>
      ))}
    </span>
  );
}