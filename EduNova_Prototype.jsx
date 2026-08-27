import React, { useState } from "react";
import {
  Brain, GraduationCap, Camera, HelpCircle,
  TrendingUp, Sparkles, ArrowRight, Loader2, CheckCircle2, AlertTriangle,
  RotateCcw, Users, Target, Zap, ArrowLeft, ChevronRight,
  FileText, Search, ImagePlus, X
} from "lucide-react";

// ---------- Design tokens (match the EduNova deck identity) ----------
const INK = "#1B1F3B";
const CORE = "#5D5FEF";
const TEACH = "#2F6FED";
const STUD = "#00B39F";
const AMBER = "#FFB020";
const LIGHT = "#F7F8FC";
const MUTED = "#8A8FA8";

// ---------- Claude API helper ----------
async function askClaude(systemPrompt, userPrompt, wantJSON = false, images = []) {
  const content =
    images.length > 0
      ? [
          ...images.map((img) => ({
            type: "image",
            source: { type: "base64", media_type: img.mediaType, data: img.data },
          })),
          { type: "text", text: userPrompt },
        ]
      : userPrompt;

  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content }],
      }),
    });
  } catch (networkErr) {
    throw new Error("Couldn't reach the AI — check your internet connection and try again.");
  }

  let data;
  try {
    data = await res.json();
  } catch (parseErr) {
    throw new Error(`AI request failed (status ${res.status}). Try again.`);
  }

  if (!res.ok || data.error) {
    const msg = data.error?.message || `Request failed with status ${res.status}.`;
    throw new Error(`AI error: ${msg}`);
  }

  const text = (data.content || [])
    .map((b) => (b.type === "text" ? b.text : ""))
    .filter(Boolean)
    .join("\n");
  if (!wantJSON) return text;
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Fall back: extract the outermost {...} block in case the model added stray text around it.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch (e2) {
        // fall through to the error below
      }
    }
    throw new Error("The AI's response wasn't in the expected format. Try again.");
  }
}

// Reads a File into { mediaType, data } (base64, no data-url prefix)
function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result; // "data:image/png;base64,AAAA..."
      const [prefix, data] = result.split(",");
      const mediaType = prefix.match(/data:(.*);base64/)?.[1] || "image/png";
      resolve({ mediaType, data, previewUrl: result, name: file.name });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- Small shared UI ----------
function Loading({ label }) {
  return (
    <div className="flex items-center gap-2 text-sm" style={{ color: MUTED }}>
      <Loader2 className="animate-spin" size={16} />
      <span>{label || "Thinking..."}</span>
    </div>
  );
}

function ErrorNote({ message }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 text-sm rounded-lg p-3 mt-2" style={{ background: "#FDECEC", color: "#B3261E" }}>
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function Card({ children, style, className = "" }) {
  return (
    <div
      className={`rounded-2xl border p-5 ${className}`}
      style={{ background: "#fff", borderColor: "#E3E6F3", ...style }}
    >
      {children}
    </div>
  );
}

function Pill({ color, children }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide"
      style={{ background: color + "1A", color }}
    >
      {children}
    </span>
  );
}

function PrimaryButton({ onClick, disabled, children, color = CORE, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-opacity disabled:opacity-50"
      style={{ background: color }}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className={"w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 " + (props.className || "")}
      style={{ borderColor: "#D6D9E8", ...props.style }}
    />
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={"w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 " + (props.className || "")}
      style={{ borderColor: "#D6D9E8", ...props.style }}
    />
  );
}

function Label({ children }) {
  return <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>{children}</label>;
}

// Small image-attach control: native <label htmlFor> linkage instead of a synthetic .click() —
// far more reliable inside sandboxed preview iframes. Each usage site must pass a unique `id`.
function ImageUpload({ id, image, onChange, accent = CORE, label = "Attach a photo" }) {
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = await fileToImage(file);
    onChange(img);
    e.target.value = ""; // allow re-selecting the same file later
  };

  if (image) {
    return (
      <div className="flex items-center gap-3 rounded-xl border p-2" style={{ borderColor: accent }}>
        <img src={image.previewUrl} alt={image.name} className="w-14 h-14 object-cover rounded-lg" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate" style={{ color: INK }}>{image.name}</div>
          <div className="text-xs" style={{ color: MUTED }}>Photo attached</div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0"
          aria-label="Remove photo"
        >
          <X size={15} color={MUTED} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        id={id}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
      />
      <label
        htmlFor={id}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 text-sm font-medium cursor-pointer"
        style={{ borderColor: "#D6D9E8", color: MUTED }}
      >
        <ImagePlus size={16} />
        {label}
      </label>
    </div>
  );
}

// ================= LANDING =================
function Landing({ onPick }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: INK }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute rounded-full" style={{ width: 500, height: 500, background: CORE, opacity: 0.12, top: -180, right: -150 }} />
        <div className="absolute rounded-full" style={{ width: 400, height: 400, background: STUD, opacity: 0.12, bottom: -160, left: -140 }} />
      </div>
      <div className="relative z-10 flex flex-col items-center text-center max-w-xl">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6" style={{ background: CORE }}>
          <Brain color="#fff" size={30} />
        </div>
        <h1 className="text-4xl font-bold text-white mb-3" style={{ fontFamily: "Fraunces, Georgia, serif" }}>EduNova</h1>
        <p className="mb-10" style={{ color: "#B7BBE0" }}>One AI core. Two doors — for teachers, and for students. Choose one to try the live prototype.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <button
            onClick={() => onPick("teacher")}
            className="group rounded-2xl p-6 text-left transition-transform hover:-translate-y-1"
            style={{ background: "#22264A", border: `1px solid ${TEACH}55` }}
          >
            <div className="w-11 h-11 rounded-full flex items-center justify-center mb-4" style={{ background: TEACH }}>
              <Users color="#fff" size={20} />
            </div>
            <div className="text-white font-semibold mb-1 flex items-center gap-1">Teacher Portal <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" /></div>
            <div className="text-sm" style={{ color: "#9AA0C8" }}>Generate worksheets & find weak areas</div>
          </button>
          <button
            onClick={() => onPick("student")}
            className="group rounded-2xl p-6 text-left transition-transform hover:-translate-y-1"
            style={{ background: "#22264A", border: `1px solid ${STUD}55` }}
          >
            <div className="w-11 h-11 rounded-full flex items-center justify-center mb-4" style={{ background: STUD }}>
              <GraduationCap color="#fff" size={20} />
            </div>
            <div className="text-white font-semibold mb-1 flex items-center gap-1">Student Portal <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" /></div>
            <div className="text-sm" style={{ color: "#9AA0C8" }}>Trace mistakes, forecast risk, SeedStep</div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ================= SHELL (top bar + tabs) =================
function Shell({ role, tabs, active, setActive, onBack, children }) {
  const color = role === "teacher" ? TEACH : STUD;
  return (
    <div className="min-h-screen" style={{ background: LIGHT }}>
      <div className="sticky top-0 z-20 border-b" style={{ background: "#fff", borderColor: "#E3E6F3" }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Back">
              <ArrowLeft size={18} color={INK} />
            </button>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: CORE }}>
              <Brain size={16} color="#fff" />
            </div>
            <span className="font-bold" style={{ color: INK, fontFamily: "Fraunces, Georgia, serif" }}>EduNova</span>
          </div>
          <Pill color={color}>{role === "teacher" ? "Teacher Portal" : "Student Portal"}</Pill>
        </div>
        <div className="max-w-5xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className="px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors"
              style={{
                borderColor: active === t.key ? color : "transparent",
                color: active === t.key ? color : MUTED,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
    </div>
  );
}

// ================= TEACHER: Worksheet Generator =================
function WorksheetGenerator() {
  const [subject, setSubject] = useState("Mathematics");
  const [chapter, setChapter] = useState("Trigonometric Identities");
  const [notes, setNotes] = useState("");
  const [pageImage, setPageImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const loadExample = () => {
    setSubject("Physics");
    setChapter("Kinematics — Distance vs Displacement");
    setNotes("Class 11, students often confuse scalar and vector quantities.");
    setPageImage(null);
  };

  const generate = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const images = pageImage ? [{ mediaType: pageImage.mediaType, data: pageImage.data }] : [];
      const data = await askClaude(
        "You are an assistant inside a teacher tool called EduNova. Given a subject/chapter and optionally a photographed textbook page, identify the core concept and produce a differentiated worksheet. If a photo is attached, read the concept directly from it — the photo takes priority over the typed chapter name. Respond with ONLY strict JSON, no markdown fences, no preamble, matching exactly this shape: {\"concept\":\"short concept name\",\"easy\":[\"q1\",\"q2\",\"q3\"],\"medium\":[\"q1\",\"q2\",\"q3\"],\"hard\":[\"q1\",\"q2\",\"q3\"],\"answerKey\":{\"easy\":[\"a1\",\"a2\",\"a3\"],\"medium\":[\"a1\",\"a2\",\"a3\"],\"hard\":[\"a1\",\"a2\",\"a3\"]}}. Keep each question one line, age-appropriate for Indian CBSE/ICSE curriculum.",
        `Subject: ${subject}\nChapter/topic: ${chapter}${pageImage ? " (see attached photo — prefer this)" : ""}\nTeacher notes: ${notes || "none"}`,
        true,
        images
      );
      setResult(data);
    } catch (e) {
      setError(e.message || "Something went wrong generating the worksheet.");
    } finally {
      setLoading(false);
    }
  };

  const tiers = [
    { key: "easy", label: "Easy", color: "#3FA65B" },
    { key: "medium", label: "Medium", color: AMBER },
    { key: "hard", label: "Hard", color: "#E1553F" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <Camera size={18} color={TEACH} />
          <h2 className="font-semibold text-lg" style={{ color: INK }}>Adaptive Worksheet Generator</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: MUTED }}>
          Photograph a textbook page, or just tell it the subject and chapter — the AI core generates three difficulty tiers with an answer key.
        </p>
        <Label>Photograph of the textbook page (optional — takes priority if attached)</Label>
        <div className="mt-1 mb-4">
          <ImageUpload id="worksheet-page-photo" image={pageImage} onChange={setPageImage} accent={TEACH} label="Attach a photo of the textbook page" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mb-3">
          <div>
            <Label>Subject</Label>
            <TextInput value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Chapter / Topic</Label>
            <TextInput value={chapter} onChange={(e) => setChapter(e.target.value)} className="mt-1" />
          </div>
        </div>
        <Label>Notes for the AI (optional)</Label>
        <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 mb-4" placeholder="e.g. common mistakes in this class, question style to match..." />
        <div className="flex items-center gap-3">
          <PrimaryButton onClick={generate} disabled={loading} color={TEACH} icon={loading ? Loader2 : Sparkles}>
            {loading ? "Generating..." : "Generate Worksheet"}
          </PrimaryButton>
          <button onClick={loadExample} className="text-sm underline" style={{ color: MUTED }}>Load an example</button>
        </div>
        {loading && <div className="mt-3"><Loading label="Reading the concept and drafting three tiers..." /></div>}
        <ErrorNote message={error} />
      </Card>

      {result && (
        <div className="grid sm:grid-cols-3 gap-4">
          {tiers.map((tier) => (
            <Card key={tier.key}>
              <Pill color={tier.color}>{tier.label}</Pill>
              <div className="text-xs mt-2 mb-3" style={{ color: MUTED }}>{result.concept}</div>
              <ol className="space-y-2 text-sm list-decimal list-inside" style={{ color: INK }}>
                {(result[tier.key] || []).map((q, i) => <li key={i}>{q}</li>)}
              </ol>
              <details className="mt-4">
                <summary className="text-xs font-semibold cursor-pointer" style={{ color: tier.color }}>Answer key</summary>
                <ol className="space-y-1 text-xs mt-2 list-decimal list-inside" style={{ color: MUTED }}>
                  {(result.answerKey?.[tier.key] || []).map((a, i) => <li key={i}>{a}</li>)}
                </ol>
              </details>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ================= TEACHER: Doubts → Custom Practice =================
function DoubtsToPractice() {
  const [doubts, setDoubts] = useState("");
  const [marks, setMarks] = useState("");
  const [sheetImage, setSheetImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const loadExample = () => {
    setDoubts(
      "Why is the derivative of sin(x) equal to cos(x) and not -cos(x)?\nI don't get why we flip the inequality sign.\nHow do I know when to use substitution vs integration by parts?\nWhy does my answer for velocity come out negative?"
    );
    setMarks("Class average 62%, weakest section: differentiation rules (41%)");
    setSheetImage(null);
  };

  const canSubmit = doubts.trim() || sheetImage;

  const generate = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const images = sheetImage ? [{ mediaType: sheetImage.mediaType, data: sheetImage.data }] : [];
      const data = await askClaude(
        "You are the EduNova teacher assistant. Given a list of raw student doubts (one per line, and/or a photographed doubts/marks sheet) and optional exam performance notes, cluster the doubts by underlying concept and propose 2 targeted practice questions per cluster. Respond with ONLY strict JSON: {\"clusters\":[{\"concept\":\"name\",\"doubtCount\":number,\"practiceQuestions\":[\"q1\",\"q2\"]}]}. No markdown fences.",
        `Doubts:\n${doubts || "(see attached photo)"}\n\nMarks/performance notes: ${marks || "none"}`,
        true,
        images
      );
      setResult(data);
    } catch (e) {
      setError(e.message || "Something went wrong clustering the doubts.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <HelpCircle size={18} color={TEACH} />
          <h2 className="font-semibold text-lg" style={{ color: INK }}>Doubts & Marks → Custom Practice</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: MUTED }}>
          Paste doubts students have submitted (one per line), or attach a photo of a doubts/marks sheet. The AI core groups them by concept and drafts targeted practice.
        </p>
        <Label>Student doubts (one per line)</Label>
        <TextArea rows={5} value={doubts} onChange={(e) => setDoubts(e.target.value)} className="mt-1 mb-2" placeholder="Paste doubts here, or attach a photo below..." />
        <ImageUpload id="doubts-sheet-photo" image={sheetImage} onChange={setSheetImage} accent={TEACH} label="Attach a photo of a doubts/marks sheet" />
        <div className="mt-4">
          <Label>Marks / performance notes (optional)</Label>
          <TextArea rows={2} value={marks} onChange={(e) => setMarks(e.target.value)} className="mt-1" />
        </div>
        <div className="flex items-center gap-3 mt-4">
          <PrimaryButton onClick={generate} disabled={loading || !canSubmit} color={TEACH} icon={loading ? Loader2 : Search}>
            {loading ? "Clustering..." : "Find Weak Areas"}
          </PrimaryButton>
          <button onClick={loadExample} className="text-sm underline" style={{ color: MUTED }}>Load an example</button>
        </div>
        {loading && <div className="mt-3"><Loading label="Grouping doubts by concept..." /></div>}
        <ErrorNote message={error} />
      </Card>

      {result?.clusters && (
        <div className="space-y-4">
          {result.clusters.map((c, i) => (
            <Card key={i}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold" style={{ color: INK }}>{c.concept}</div>
                <Pill color={TEACH}>{c.doubtCount} doubt{c.doubtCount === 1 ? "" : "s"}</Pill>
              </div>
              <div className="text-xs font-semibold uppercase mb-1" style={{ color: MUTED }}>Suggested practice</div>
              <ul className="text-sm space-y-1 list-disc list-inside" style={{ color: INK }}>
                {c.practiceQuestions.map((q, j) => <li key={j}>{q}</li>)}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ================= STUDENT: Mistake Analyzer (Misconception Trace + Where Did I Go Wrong, merged) =================
function MistakeAnalyzer() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [history, setHistory] = useState("");
  const [questionImage, setQuestionImage] = useState(null);
  const [answerImage, setAnswerImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const loadExample = () => {
    setQuestion("Solve for x: 2x + 5 = 15 - 3x");
    setAnswer("2x + 5 = 15 - 3x\n2x - 3x = 15 - 5\n-x = 10\nx = 10");
    setHistory("Mixed up sign flips on a similar linear equation question two weeks ago.");
    setQuestionImage(null);
    setAnswerImage(null);
  };

  const canSubmit = (question.trim() || questionImage) && (answer.trim() || answerImage);

  const generate = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const images = [questionImage, answerImage].filter(Boolean).map((i) => ({ mediaType: i.mediaType, data: i.data }));
      const data = await askClaude(
        "You are EduNova's mistake analyzer. Given a question and the student's full worked answer (as text and/or photographed images, in that order if both are present) and optional history of past struggles, do four things: (1) identify exactly which syllabus topic/concept this question belongs to, (2) determine if the working is fully correct, and if not, find the precise step where it first went wrong and the root misconception behind it, (3) judge whether this looks like a weak area for the student (weight both this mistake and any past-struggle history mentioning the same or a related topic), (4) explain the underlying topic simply for revision, with 2-3 realistic generic study references (e.g. an NCERT chapter name, a well-known textbook chapter, or a suggested search term for Khan Academy/YouTube — do not invent specific URLs). Respond with ONLY strict JSON, no markdown fences: {\"topic\":\"specific topic/concept name\",\"correct\":true|false,\"isWeakArea\":true|false,\"mistakeStep\":\"which step/line the error is in, empty if correct\",\"rootCause\":\"short misconception name, empty if correct\",\"explanation\":\"1-3 sentences on what went wrong there, empty if correct\",\"correctApproach\":\"correct working from that step onward, empty if correct\",\"topicExplanation\":\"2-4 sentence plain-language explanation of the topic itself\",\"studyReferences\":[\"reference 1\",\"reference 2\",\"reference 3\"]}",
        `Question: ${question || "(see attached photo)"}\n\nStudent's full worked answer:\n${answer || "(see attached photo)"}\n\nPast struggle history: ${history || "none provided"}`,
        true,
        images
      );
      setResult(data);
    } catch (e) {
      setError(e.message || "Something went wrong analyzing this.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <Target size={18} color={STUD} />
          <h2 className="font-semibold text-lg" style={{ color: INK }}>Mistake & Misconception Analyzer</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: MUTED }}>
          Not just "wrong answer" — pinpoints the exact step, traces the root misconception, tells you which topic it belongs to, and whether that topic is a weak area for you. Type it out or upload a photo.
        </p>

        <Label>The question</Label>
        <TextArea rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} className="mt-1 mb-2" placeholder="Type the question, or attach a photo below..." />
        <ImageUpload id="mistake-question-photo" image={questionImage} onChange={setQuestionImage} accent={STUD} label="Attach a photo of the question" />

        <div className="mt-4">
          <Label>Your full worked answer</Label>
          <TextArea rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} className="mt-1 mb-2" placeholder="Write each step on its own line, or attach a photo below..." />
          <ImageUpload id="mistake-answer-photo" image={answerImage} onChange={setAnswerImage} accent={STUD} label="Attach a photo of your worked answer" />
        </div>

        <div className="mt-4">
          <Label>Anything you've struggled with before (optional)</Label>
          <TextArea rows={2} value={history} onChange={(e) => setHistory(e.target.value)} className="mt-1" />
        </div>

        <div className="flex items-center gap-3 mt-4">
          <PrimaryButton onClick={generate} disabled={loading || !canSubmit} color={STUD} icon={loading ? Loader2 : Search}>
            {loading ? "Analyzing..." : "Analyze My Answer"}
          </PrimaryButton>
          <button onClick={loadExample} className="text-sm underline" style={{ color: MUTED }}>Load an example</button>
        </div>
        {loading && <div className="mt-3"><Loading label="Checking your steps and tracing the concept..." /></div>}
        <ErrorNote message={error} />
      </Card>

      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Pill color={CORE}>Topic: {result.topic}</Pill>
            {result.isWeakArea && <Pill color="#E1553F">Weak area</Pill>}
            {result.correct && <Pill color="#3FA65B">Correct</Pill>}
          </div>

          {!result.correct && (
            <Card style={{ background: "#FFF7E8", borderColor: AMBER }}>
              <Pill color={AMBER}>Mistake found</Pill>
              <div className="font-semibold mt-2 mb-1" style={{ color: INK }}>{result.mistakeStep}</div>
              <p className="text-xs font-semibold uppercase mt-2 mb-1" style={{ color: MUTED }}>Root misconception</p>
              <p className="text-sm mb-2" style={{ color: INK }}>{result.rootCause} — {result.explanation}</p>
              <p className="text-xs font-semibold uppercase mt-3 mb-1" style={{ color: MUTED }}>Correct approach from here</p>
              <p className="text-sm whitespace-pre-line" style={{ color: INK }}>{result.correctApproach}</p>
            </Card>
          )}

          {result.correct && (
            <Card style={{ background: "#EAF7EE", borderColor: "#3FA65B" }}>
              <div className="flex items-center gap-2 font-semibold" style={{ color: "#3FA65B" }}>
                <CheckCircle2 size={18} /> Your working is fully correct!
              </div>
            </Card>
          )}

          <Card style={{ background: "#E6F7F4", borderColor: STUD }}>
            <div className="text-xs font-semibold uppercase mb-1" style={{ color: STUD }}>About this topic — {result.topic}</div>
            <p className="text-sm mb-3" style={{ color: INK }}>{result.topicExplanation}</p>
            <div className="text-xs font-semibold uppercase mb-1" style={{ color: MUTED }}>Study references</div>
            <ul className="text-sm space-y-1 list-disc list-inside" style={{ color: INK }}>
              {(result.studyReferences || []).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}

// ================= STUDENT: Curriculum-Drift Detector =================
function CurriculumDrift() {
  const [current, setCurrent] = useState("");
  const [upcoming, setUpcoming] = useState("");
  const [syllabusImage, setSyllabusImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const loadExample = () => {
    setCurrent("Confident in limits. Shaky on chain rule and implicit differentiation.");
    setUpcoming("Applications of derivatives, then integration, then differential equations.");
    setSyllabusImage(null);
  };

  const canSubmit = (current.trim() || syllabusImage) && (upcoming.trim() || syllabusImage);

  const generate = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const images = syllabusImage ? [{ mediaType: syllabusImage.mediaType, data: syllabusImage.data }] : [];
      const data = await askClaude(
        "You are EduNova's curriculum-drift detector. Given a student's current understanding and the upcoming syllabus order (as text and/or a photographed syllabus page or progress report), flag which upcoming topics are at risk because of today's gaps. For each at-risk topic, also give a simple explanation of that topic for early revision and 2-3 realistic generic study references (e.g. an NCERT chapter name, a well-known textbook chapter, or a suggested search term for Khan Academy/YouTube — do not invent specific URLs). Also propose a short practice set to shore up the weakest current gap before it compounds. Respond with ONLY strict JSON: {\"atRiskTopics\":[{\"topic\":\"name\",\"reason\":\"short reason tied to a current gap\",\"riskLevel\":\"High|Medium|Low\",\"topicExplanation\":\"2-3 sentence plain-language explanation of the topic\",\"studyReferences\":[\"reference 1\",\"reference 2\"]}],\"practiceSet\":[\"q1\",\"q2\",\"q3\"]}",
        `Current understanding: ${current || "(see attached photo)"}\nUpcoming topics in order: ${upcoming || "(see attached photo)"}`,
        true,
        images
      );
      setResult(data);
    } catch (e) {
      setError(e.message || "Something went wrong forecasting risk.");
    } finally {
      setLoading(false);
    }
  };

  const riskColor = (r) => (r === "High" ? "#E1553F" : r === "Medium" ? AMBER : "#3FA65B");

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={18} color={STUD} />
          <h2 className="font-semibold text-lg" style={{ color: INK }}>Curriculum-Drift Detector</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: MUTED }}>A fragility forecast — which future topics are you at risk on, before you even get there.</p>
        <Label>What you understand well / shakily right now</Label>
        <TextArea rows={2} value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-1 mb-3" />
        <Label>Upcoming topics, in order</Label>
        <TextArea rows={2} value={upcoming} onChange={(e) => setUpcoming(e.target.value)} className="mt-1 mb-2" />
        <ImageUpload id="drift-syllabus-photo" image={syllabusImage} onChange={setSyllabusImage} accent={STUD} label="Attach a photo of a syllabus page or progress report" />
        <div className="flex items-center gap-3 mt-4">
          <PrimaryButton onClick={generate} disabled={loading || !canSubmit} color={STUD} icon={loading ? Loader2 : Zap}>
            {loading ? "Forecasting..." : "Forecast My Risk"}
          </PrimaryButton>
          <button onClick={loadExample} className="text-sm underline" style={{ color: MUTED }}>Load an example</button>
        </div>
        {loading && <div className="mt-3"><Loading label="Mapping current gaps onto the syllabus ahead..." /></div>}
        <ErrorNote message={error} />
      </Card>

      {result && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            {result.atRiskTopics?.map((t, i) => (
              <Card key={i}>
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold" style={{ color: INK }}>{t.topic}</div>
                  <Pill color={riskColor(t.riskLevel)}>{t.riskLevel} risk</Pill>
                </div>
                <p className="text-sm mb-3" style={{ color: MUTED }}>{t.reason}</p>
                <details>
                  <summary className="text-xs font-semibold cursor-pointer" style={{ color: STUD }}>Explain this topic + study references</summary>
                  <p className="text-sm mt-2 mb-2" style={{ color: INK }}>{t.topicExplanation}</p>
                  <div className="text-xs font-semibold uppercase mb-1" style={{ color: MUTED }}>Study references</div>
                  <ul className="text-xs space-y-1 list-disc list-inside" style={{ color: INK }}>
                    {(t.studyReferences || []).map((r, j) => <li key={j}>{r}</li>)}
                  </ul>
                </details>
              </Card>
            ))}
          </div>
          {result.practiceSet && (
            <Card style={{ background: "#E6F7F4", borderColor: STUD }}>
              <div className="text-xs font-semibold uppercase mb-2" style={{ color: STUD }}>Practice to close the gap now</div>
              <ol className="text-sm space-y-1 list-decimal list-inside" style={{ color: INK }}>
                {result.practiceSet.map((q, i) => <li key={i}>{q}</li>)}
              </ol>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ================= STUDENT: SeedStep AI =================
function SeedStep() {
  const [subject, setSubject] = useState("");
  const [work, setWork] = useState("");
  const [workImage, setWorkImage] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const loadExample = () => {
    setSubject("Essay writing — Class 10 English");
    setWork("My intro paragraph: 'Pollution is a big problem in cities today.' I don't know what to write next.");
    setWorkImage(null);
  };

  const reset = () => { setSteps([]); setDone(false); setError(""); };

  const nextStep = async () => {
    setLoading(true); setError("");
    try {
      const priorSteps = steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
      const images = workImage ? [{ mediaType: workImage.mediaType, data: workImage.data }] : [];
      const text = await askClaude(
        "You are SeedStep AI, part of EduNova. You NEVER give the final answer or solve the whole task. You only ever give the smallest possible single next step the student should take, based on exactly what they've done so far (as text and/or a photographed image of their work). Keep it to 1-2 short sentences, encouraging, specific, and achievable right now. If the work already looks complete, say so warmly instead of inventing a step.",
        `Subject/task: ${subject}\n\nStudent's work so far:\n${work || "(see attached photo)"}\n\nSeeds already given:\n${priorSteps || "none yet"}\n\nGive exactly one small next step.`,
        false,
        images
      );
      if (/already (looks|seems) complete|nothing more to add|well done|finished/i.test(text) && steps.length > 0) {
        setDone(true);
      }
      setSteps((s) => [...s, text.trim()]);
    } catch (e) {
      setError(e.message || "Something went wrong generating the next step.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={18} color={STUD} />
          <h2 className="font-semibold text-lg" style={{ color: INK }}>SeedStep AI</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: MUTED }}>Never the full answer — just the smallest next step, so you stay the one solving it.</p>
        <Label>Subject / task</Label>
        <TextInput value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 mb-3" />
        <Label>Describe your unfinished work so far</Label>
        <TextArea rows={3} value={work} onChange={(e) => { setWork(e.target.value); }} className="mt-1 mb-2" placeholder="Type it out, or attach a photo below..." />
        <ImageUpload id="seedstep-work-photo" image={workImage} onChange={setWorkImage} accent={STUD} label="Attach a photo of your work" />
        <div className="flex items-center gap-3 mt-4">
          <PrimaryButton onClick={nextStep} disabled={loading || (!work.trim() && !workImage) || done} color={STUD} icon={loading ? Loader2 : ChevronRight}>
            {loading ? "Thinking..." : steps.length === 0 ? "Give me the first step" : "Give me the next step"}
          </PrimaryButton>
          {steps.length > 0 && (
            <button onClick={reset} className="text-sm underline inline-flex items-center gap-1" style={{ color: MUTED }}>
              <RotateCcw size={13} /> Start over
            </button>
          )}
          <button onClick={loadExample} className="text-sm underline" style={{ color: MUTED }}>Load an example</button>
        </div>
        {loading && <div className="mt-3"><Loading label="Studying only what you've done so far..." /></div>}
        <ErrorNote message={error} />
      </Card>

      {steps.length > 0 && (
        <div className="space-y-3">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-3 items-start rounded-xl p-4" style={{ background: "#E6F7F4", border: `1px dashed ${STUD}` }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: STUD }}>{i + 1}</div>
              <p className="text-sm" style={{ color: INK }}>{s}</p>
            </div>
          ))}
          {done && (
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "#3FA65B" }}>
              <CheckCircle2 size={16} /> Looks complete — nice work!
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ================= APP =================
export default function App() {
  const [view, setView] = useState("landing"); // landing | teacher | student
  const [teacherTab, setTeacherTab] = useState("worksheet");
  const [studentTab, setStudentTab] = useState("mistake");

  if (view === "landing") return <Landing onPick={setView} />;

  if (view === "teacher") {
    const tabs = [
      { key: "worksheet", label: "Worksheet Generator" },
      { key: "doubts", label: "Doubts → Practice" },
    ];
    return (
      <Shell role="teacher" tabs={tabs} active={teacherTab} setActive={setTeacherTab} onBack={() => setView("landing")}>
        {teacherTab === "worksheet" ? <WorksheetGenerator /> : <DoubtsToPractice />}
      </Shell>
    );
  }

  const tabs = [
    { key: "mistake", label: "Mistake Analyzer" },
    { key: "drift", label: "Curriculum Drift" },
    { key: "seedstep", label: "SeedStep AI" },
  ];
  return (
    <Shell role="student" tabs={tabs} active={studentTab} setActive={setStudentTab} onBack={() => setView("landing")}>
      {studentTab === "mistake" && <MistakeAnalyzer />}
      {studentTab === "drift" && <CurriculumDrift />}
      {studentTab === "seedstep" && <SeedStep />}
    </Shell>
  );
}
