import React, { useState, useRef, useCallback, useEffect } from "react";
import "./App.css";

const API = process.env.REACT_APP_API_URL || (window.location.hostname === "localhost" ? "http://localhost:8000" : "");

// ─── Specialty configuration (alphabetical) ───

const SPECIALTIES = [
  { key: "allergist", label: "Аллерголог" },
  { key: "gastroenterologist", label: "Гастроэнтеролог" },
  { key: "gynecologist", label: "Гинеколог" },
  { key: "dermatologist", label: "Дерматолог" },
  { key: "cardiologist", label: "Кардиолог" },
  { key: "neurologist", label: "Невролог" },
  { key: "ophthalmologist", label: "Офтальмолог" },
  { key: "orthopedist", label: "Ортопед-травматолог" },
  { key: "ent", label: "Оториноларинголог" },
  { key: "pediatrician", label: "Педиатр" },
  { key: "psychiatrist", label: "Психиатр ПНД", hasDiary: true, diaryKey: "psychiatrist_pnd_diary" },
  { key: "psychiatrist_stac", label: "Психиатр стационар", hasDiary: true, diaryKey: "psychiatrist_stac_diary" },
  { key: "pulmonologist", label: "Пульмонолог" },
  { key: "radiologist", label: "Рентгенолог" },
  { key: "therapist", label: "Терапевт" },
  { key: "uzi", label: "УЗИ" },
  { key: "urologist", label: "Уролог" },
  { key: "surgeon", label: "Хирург" },
  { key: "endocrinologist", label: "Эндокринолог" },
];

const findSpec = (key) => SPECIALTIES.find(s => s.key === key) || { key, label: key };

// ─── Simple markdown renderer for AI answers ───
// Supports **bold**, * italic *, bullet lists (- or •), numbered lists, paragraphs
const MarkdownText = ({ text }) => {
  if (!text) return null;

  // Render inline formatting: **bold** and *italic*
  const renderInline = (s) => {
    const parts = [];
    let i = 0;
    let key = 0;
    while (i < s.length) {
      // **bold**
      if (s[i] === "*" && s[i+1] === "*") {
        const end = s.indexOf("**", i + 2);
        if (end !== -1) {
          parts.push(<strong key={key++}>{s.slice(i + 2, end)}</strong>);
          i = end + 2;
          continue;
        }
      }
      // *italic* (single star, not followed by another star)
      if (s[i] === "*" && s[i+1] !== "*" && i > 0 && s[i-1] !== "*") {
        const end = s.indexOf("*", i + 1);
        if (end !== -1 && s[end+1] !== "*") {
          parts.push(<em key={key++}>{s.slice(i + 1, end)}</em>);
          i = end + 1;
          continue;
        }
      }
      // Plain text — collect until next marker
      let j = i;
      while (j < s.length && s[j] !== "*") j++;
      parts.push(s.slice(i, j));
      i = j;
    }
    return parts;
  };

  // Split into blocks: group consecutive list items, separate paragraphs by blank lines
  const lines = text.split("\n");
  const blocks = [];
  let currentList = null;
  let currentPara = [];

  const flushPara = () => {
    if (currentPara.length > 0) {
      blocks.push({ type: "p", lines: currentPara });
      currentPara = [];
    }
  };
  const flushList = () => {
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    // Bullet list item
    const bulletMatch = line.match(/^[-•*]\s+(.+)/);
    if (bulletMatch) {
      flushPara();
      if (!currentList || currentList.type !== "ul") currentList = { type: "ul", items: [] };
      currentList.items.push(bulletMatch[1]);
      continue;
    }
    // Numbered list item
    const numMatch = line.match(/^(\d+)[.)]\s+(.+)/);
    if (numMatch) {
      flushPara();
      if (!currentList || currentList.type !== "ol") currentList = { type: "ol", items: [] };
      currentList.items.push(numMatch[2]);
      continue;
    }
    // Regular paragraph line
    flushList();
    currentPara.push(line);
  }
  flushPara();
  flushList();

  return (
    <>
      {blocks.map((block, idx) => {
        if (block.type === "p") {
          return <p key={idx} className="md-p">{renderInline(block.lines.join(" "))}</p>;
        }
        if (block.type === "ul") {
          return (<ul key={idx} className="md-ul">{block.items.map((it, i) => (<li key={i}>{renderInline(it)}</li>))}</ul>);
        }
        if (block.type === "ol") {
          return (<ol key={idx} className="md-ol">{block.items.map((it, i) => (<li key={i}>{renderInline(it)}</li>))}</ol>);
        }
        return null;
      })}
    </>
  );
};

const UZI_TYPES = [
  { key: "uzi_abdominal", label: "Органы бр. полости" },
  { key: "uzi_kidneys", label: "Почки" },
  { key: "uzi_thyroid", label: "Щитовидная железа" },
  { key: "uzi_breast", label: "Молочные железы" },
  { key: "uzi_gynecology_ta", label: "Гинекология (ТА)" },
  { key: "uzi_gynecology_tavs", label: "Гинекология (ТА+ТВ)" },
  { key: "uzi_pregnancy", label: "Беременность" },
  { key: "uzi_arteries_upper", label: "Артерии верх. кон." },
  { key: "uzi_arteries_lower", label: "Артерии ниж. кон." },
  { key: "uzi_veins_upper", label: "Вены верх. кон." },
  { key: "uzi_veins_lower", label: "Вены ниж. кон." },
  { key: "uzi_knee", label: "Коленные суставы" },
];



const DEMOS = {
  psychiatrist: `Пациент Иванов Сергей Петрович, 42 года, обратился самостоятельно. Жалобы на сниженное настроение в течение последних трёх месяцев, нарушения сна, снижение аппетита, потерю интереса. Суицидальные мысли отрицает. Наследственность: мать — депрессия. Курит 10 сигарет/день. Психический статус: сознание ясное, ориентирован верно. Настроение сниженное, мышление замедленное. Галлюцинаций нет. Критика сохранена. АД 130/85, пульс 72. Диагноз: F33.1. Назначения: сертралин 50 мг утром, миртазапин 15 мг на ночь.`,
  psychiatrist_stac: `Пациентка Смирнова Ольга, 44 года, доставлена СМП. В течение 2 недель ведёт себя неадекватно, не спит ночами. Наблюдается с 2019 года, F20.0. Последняя выписка 6 мес назад на галоперидоле 5 мг. Терапию прекратила 3 недели назад. Психический статус: возбуждена, бредовые идеи величия, мышление разорванное, критика отсутствует. АД 125/80, пульс 88.`,
  neurologist: `Пациент П, 58 лет. Жалобы на снижение слуха правого уха 3 года, шум в ухе, головокружение, онемение правой половины лица 3-4 месяца. Нейросенсорная тугоухость справа диагностирована ранее. На МРТ — образование правого мосто-мозжечкового угла 3.2x2.0x2.2 см. Неврологический осмотр: снижение чувствительности V2 справа, периферический парез VII нерва справа, нистагм вправо.`,
  therapist: `Пациентка Козлова Мария Ивановна, 65 лет. Жалобы на одышку при подъёме на 2 этаж, отёки ног к вечеру, повышение АД до 170/100. Болеет 10 лет, наблюдается у кардиолога. Принимает амлодипин 10 мг, индапамид 2.5 мг. Объективно: состояние удовлетворительное. АД 155/95, ЧСС 78. Акцент 2 тона на аорте. Пастозность голеней.`,
};

const MicIcon = () => (<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3.5" fill="currentColor"/><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/></svg>);
const UploadIcon = () => (<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 10V3M5.5 5.5L8 3l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 12h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>);

// ─── Default snippets ───
const DEFAULT_SNIPPETS = [
  { id: "s1", label: "Сознание ясное", text: "Сознание формально не помрачено. Ориентирован в месте, времени и собственной личности верно." },
  { id: "s2", label: "Психостатус норма", text: "Контакт продуктивен. Речь нормального темпа, по существу. Мышление последовательное, целенаправленное. Бредовых идей не высказывает. Обманы восприятия отрицает. Настроение ровное. Критика к состоянию сохранена." },
  { id: "s3", label: "Сон и аппетит норма", text: "Сон достаточный, засыпает хорошо, пробуждений нет. Аппетит достаточный." },
  { id: "s4", label: "Без суицидальных мыслей", text: "Суицидальные мысли и намерения отрицает. Агрессивных тенденций не выявлено." },
  { id: "s5", label: "Соматика без особенностей", text: "Соматически без острой патологии. АД в норме. ЧСС в норме. Жалоб соматического характера не предъявляет." },
  { id: "s6", label: "Назначения продолжить", text: "Терапию продолжить в прежних дозировках. Коррекция лечения не проводилась." },
];

function SectionCard({ title, content, idx, showHints, onContentChange }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(content);
  const isMissing = showHints && (!content || content === "Данные не предоставлены" || content.trim() === "");
  const copy = () => { navigator.clipboard.writeText(`${title}\n${content}`); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const saveEdit = () => { onContentChange && onContentChange(idx, editVal); setEditing(false); };
  const cancelEdit = () => { setEditVal(content); setEditing(false); };
  return (
    <div className={`sec-card ${isMissing ? "sec-missing" : ""}`} style={{ animationDelay: `${idx * 0.06}s` }}>
      <div className="sec-head">
        <h3 className="sec-title">{isMissing && <span className="missing-dot">!</span>}{title}</h3>
        <div className="sec-actions">
          {!editing && <button onClick={() => { setEditVal(content); setEditing(true); }} className="sec-edit-btn">✏️</button>}
          <button onClick={copy} className={`sec-copy ${copied ? "ok" : ""}`}>{copied ? "\u2713" : "Копировать"}</button>
        </div>
      </div>
      {editing ? (
        <div className="sec-edit-area">
          <textarea className="sec-edit-input" value={editVal} onChange={e => setEditVal(e.target.value)} autoFocus />
          <div className="sec-edit-btns">
            <button className="sec-edit-save" onClick={saveEdit}>✓ Сохранить</button>
            <button className="sec-edit-cancel" onClick={cancelEdit}>Отмена</button>
          </div>
        </div>
      ) : (
        <p className="sec-text">{content}</p>
      )}
      {isMissing && !editing && <div className="missing-hint">Врач не предоставил данные для этого раздела</div>}
    </div>
  );
}

function HamburgerMenu({ onSnippets, onSession, sessionLabel, onLogout }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="hamburger-wrap">
      <button className="hamburger-btn" onClick={() => setOpen(o => !o)}>
        <span /><span /><span />
      </button>
      {open && (
        <div className="hamburger-menu" onClick={() => setOpen(false)}>
          <div className="hamburger-item" onClick={onSnippets}>⚡ Быстрые фразы</div>
          <div className="hamburger-item" onClick={onSession}>📡 {sessionLabel}</div>
          <div className="hamburger-item hamburger-logout" onClick={onLogout}>← Выйти</div>
        </div>
      )}
    </div>
  );
}

function PatientItem({ record, onClick }) {
  return (
    <div className="patient-row" onClick={onClick}>
      <div className="patient-row-name">{record.patient_name || "Без имени"}</div>
      <div className="patient-row-meta">
        {record.diagnosis_code && <span className="patient-row-code">{record.diagnosis_code}</span>}
        <span className="patient-row-spec">{record.specialty}</span>
      </div>
      <div className="patient-row-date">{record.created_at}</div>
    </div>
  );
}

export default function App() {
  // ─── Auth state ───
  const [user, setUser] = useState(() => { try { const u = localStorage.getItem("pisar_user"); return u ? JSON.parse(u) : null; } catch { return null; } });
  const [token, setToken] = useState(() => localStorage.getItem("pisar_token") || "");
  const [authView, setAuthView] = useState("login");
  const [authLogin, setAuthLogin] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authName, setAuthName] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const authHeaders = token ? { "Authorization": `Bearer ${token}` } : {};

  const doAuth = async (endpoint) => {
    setAuthErr(""); setAuthLoading(true);
    try {
      const fd = new FormData();
      fd.append("login", authLogin); fd.append("password", authPass);
      if (endpoint === "/auth/register") fd.append("name", authName || authLogin);
      const res = await fetch(`${API}${endpoint}`, { method: "POST", body: fd });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Ошибка"); }
      const data = await res.json();
      setToken(data.token); setUser(data.user);
      localStorage.setItem("pisar_token", data.token);
      localStorage.setItem("pisar_user", JSON.stringify(data.user));
    } catch(e) { setAuthErr(e.message); } finally { setAuthLoading(false); }
  };

  const logout = () => {
    setUser(null); setToken(""); setRecords([]);
    localStorage.removeItem("pisar_token"); localStorage.removeItem("pisar_user");
  };

  // ─── App state ───
  const [view, setView] = useState("home");
  const [spec, setSpec] = useState("therapist");
  const [uziType, setUziType] = useState("uzi_abdominal");
  const [psyMode, setPsyMode] = useState("exam");
  const [editorHint, setEditorHint] = useState("");
  const [askQuestion, setAskQuestion] = useState("");
  const [askAnswer, setAskAnswer] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [source, setSource] = useState("mic");
  const [rec, setRec] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [allCop, setAllCop] = useState(false);
  const [time, setTime] = useState(0);
  const [uploadName, setUploadName] = useState("");
  const [saved, setSaved] = useState(false);
  const [diaryDateFrom, setDiaryDateFrom] = useState("");
  const [diaryDateTo, setDiaryDateTo] = useState("");
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [savedAudio, setSavedAudio] = useState(null);
  const [savedAudioName, setSavedAudioName] = useState("");
  const [templateFile, setTemplateFile] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [showDiaryModal, setShowDiaryModal] = useState(false);
  const [diaryPatientId, setDiaryPatientId] = useState("");
  const [diarySaving, setDiarySaving] = useState(false);
  const [diarySaved, setDiarySaved] = useState(false);

  // ─── Diary Samples (обучение) ───
  const [diarySamples, setDiarySamples] = useState([]);
  const [showSamples, setShowSamples] = useState(false);
  const [sampleText, setSampleText] = useState("");
  const [sampleSaving, setSampleSaving] = useState(false);

  // ─── Live Session (phone↔computer sync) ───
  const [sessionCode, setSessionCode] = useState("");
  const [sessionRole, setSessionRole] = useState(""); // "phone" | "computer"
  const [sessionConnected, setSessionConnected] = useState(false);
  const [sessionText, setSessionText] = useState("");
  const [sessionInput, setSessionInput] = useState("");
  const sessionWsRef = useRef(null);

  // Snippets
  const [snippets, setSnippets] = useState(() => {
    try { const s = localStorage.getItem("pisar_snippets"); return s ? JSON.parse(s) : DEFAULT_SNIPPETS; } catch { return DEFAULT_SNIPPETS; }
  });
  const [showSnippets, setShowSnippets] = useState(false);
  const [snippetTarget, setSnippetTarget] = useState(null); // idx of section to insert into
  const [newSnipLabel, setNewSnipLabel] = useState("");
  const [newSnipText, setNewSnipText] = useState("");
  const [showSnipManager, setShowSnipManager] = useState(false);

  const saveSnippets = (arr) => { setSnippets(arr); localStorage.setItem("pisar_snippets", JSON.stringify(arr)); };
  const addSnippet = () => {
    if (!newSnipLabel.trim() || !newSnipText.trim()) return;
    const arr = [...snippets, { id: `u_${Date.now()}`, label: newSnipLabel.trim(), text: newSnipText.trim() }];
    saveSnippets(arr); setNewSnipLabel(""); setNewSnipText("");
  };
  const deleteSnippet = (id) => saveSnippets(snippets.filter(s => s.id !== id));

  // Edit section content
  const handleSectionEdit = (idx, newContent) => {
    if (!result) return;
    const newSections = result.sections.map((s, i) => i === idx ? { ...s, content: newContent } : s);
    setResult({ ...result, sections: newSections });
  };

  // Insert snippet into section
  const insertSnippet = (sectionIdx, snippetText) => {
    if (!result) return;
    const sec = result.sections[sectionIdx];
    const current = sec?.content || "";
    const joined = current && current !== "Данные не предоставлены" ? current + " " + snippetText : snippetText;
    handleSectionEdit(sectionIdx, joined);
    setShowSnippets(false); setSnippetTarget(null);
  };
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [tplUploading, setTplUploading] = useState(false);
  const [tplPreview, setTplPreview] = useState(null);

  // Live assist state
  const [liveMode, setLiveMode] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [liveListening, setLiveListening] = useState(false);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [liveChecking, setLiveChecking] = useState(false);
  const recognitionRef = useRef(null);
  const liveCheckTimerRef = useRef(null);
  const lastCheckedRef = useRef(""); // {id, name, sections: [...]}

  const mrRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const templateRef = useRef(null);
  const tplFileRef = useRef(null);

  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  const specInfo = findSpec(spec);
  const isPsychiatry = spec === "psychiatrist" || spec === "psychiatrist_stac";
  const isUzi = spec === "uzi";
  const isDiary = isPsychiatry && psyMode === "diary" && !!specInfo.hasDiary;

  // Map spec key → template specialty filter
  const getTemplateFilter = () => {
    if (isUzi) return "УЗИ";
    if (spec === "psychiatrist" || spec === "psychiatrist_stac") return "Психиатр";
    if (spec === "orthopedist") return "Травматолог";
    return specInfo.label;
  };

  const filteredTemplates = templates.filter(t => {
    const filter = getTemplateFilter();
    return t.specialty === filter || t.specialty === specInfo.label;
  });

  const getSpecKey = () => {
    if (isUzi) return uziType;
    if (isDiary) return specInfo.diaryKey || "psychiatrist_pnd_diary";
    if (spec === "psychiatrist_stac") return "psychiatrist_stac_exam";
    if (spec === "psychiatrist") return "psychiatrist_pnd";
    return spec;
  };

  const getSpecLabel = () => {
    if (isUzi) {
      const u = UZI_TYPES.find(t => t.key === uziType);
      return `УЗИ — ${u?.label || ""}`;
    }
    return specInfo.label + (isDiary ? " (дневник)" : "");
  };

  const getErrMsg = async (res) => {
    try {
      const d = await res.json();
      return d.detail || d.message || `Ошибка ${res.status}`;
    } catch {
      return `Ошибка сервера ${res.status}`;
    }
  };

  useEffect(() => { if (token) { fetchRecords(); fetchTemplates(); } }, [token]);
  useEffect(() => { if (token && isDiary) fetchDiarySamples(getSpecKey()); }, [token, psyMode, spec]);
  const fetchRecords = async () => { try { const r = await fetch(`${API}/records`, { headers: authHeaders }); if (r.ok) setRecords(await r.json()); } catch(e){} };
  const fetchTemplates = async () => { try { const r = await fetch(`${API}/templates`, { headers: authHeaders }); if (r.ok) setTemplates(await r.json()); } catch(e){} };

  const sendAskQuestion = async () => {
    if (!askQuestion.trim() || askLoading) return;
    setAskLoading(true);
    setAskAnswer("");
    try {
      const fd = new FormData();
      fd.append("question", askQuestion);
      const r = await fetch(`${API}/ask`, { method: "POST", body: fd, headers: authHeaders });
      if (r.ok) {
        const data = await r.json();
        setAskAnswer(data.answer || "");
      } else {
        const err = await r.json().catch(() => ({}));
        setAskAnswer("Ошибка: " + (err.detail || "не удалось получить ответ"));
      }
    } catch (e) {
      setAskAnswer("Ошибка сети: " + e.message);
    } finally {
      setAskLoading(false);
    }
  };

  const fetchDiarySamples = async (specKey) => {
    try {
      const r = await fetch(`${API}/diary-samples?specialty_key=${specKey || ""}`, { headers: authHeaders });
      if (r.ok) setDiarySamples(await r.json());
    } catch(e){}
  };

  const saveDiarySample = async () => {
    if (!sampleText.trim()) return;
    setSampleSaving(true);
    try {
      const fd = new FormData();
      fd.append("specialty_key", getSpecKey());
      fd.append("sample_text", sampleText.trim());
      const r = await fetch(`${API}/diary-samples`, { method: "POST", body: fd, headers: authHeaders });
      if (r.ok) {
        setSampleText("");
        fetchDiarySamples(getSpecKey());
      }
    } catch(e) {}
    finally { setSampleSaving(false); }
  };

  const deleteDiarySample = async (id) => {
    try {
      await fetch(`${API}/diary-samples/${id}`, { method: "DELETE", headers: authHeaders });
      fetchDiarySamples(getSpecKey());
    } catch(e) {}
  };

  const uploadTemplate = async (file) => {
    if (!file) return;
    setTplUploading(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("template", file);
      fd.append("name", file.name.replace(".docx", ""));
      fd.append("specialty", getSpecLabel());
      const res = await fetch(`${API}/templates`, { method: "POST", body: fd, headers: authHeaders });
      if (!res.ok) throw new Error(await getErrMsg(res));
      const tpl = await res.json();
      fetchTemplates();
      setSelectedTemplate(tpl.id);
    } catch (e) { setErr(`Ошибка загрузки шаблона: ${e.message}`); }
    finally { setTplUploading(false); if (tplFileRef.current) tplFileRef.current.value = ""; }
  };

  const deleteTemplate = async (id) => {
    try {
      await fetch(`${API}/templates/${id}`, { method: "DELETE", headers: authHeaders });
      if (selectedTemplate === id) setSelectedTemplate("");
      fetchTemplates();
    } catch(e){}
  };

  const viewTemplate = async (id) => {
    if (!id) { setTplPreview(null); return; }
    try {
      const r = await fetch(`${API}/templates/${id}`, { headers: authHeaders });
      if (r.ok) {
        const data = await r.json();
        setTplPreview(data);
        setView("tpl-preview");
      }
    } catch(e) { setErr("Не удалось загрузить шаблон"); }
  };

  // ─── Recording ───
  const startRec = useCallback(async () => {
    setErr("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr("Запись голоса недоступна. Откройте через HTTPS или загрузите файл.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac", "audio/ogg", ""];
      let selectedMime = "";
      for (const mime of mimeTypes) {
        if (!mime || MediaRecorder.isTypeSupported(mime)) { selectedMime = mime; break; }
      }
      const mrOptions = selectedMime ? { mimeType: selectedMime } : {};
      const mr = new MediaRecorder(stream, mrOptions);
      const ext = selectedMime.includes("mp4") || selectedMime.includes("aac") ? "m4a" : "webm";
      chunksRef.current = [];

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      mr.onstop = async () => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: selectedMime || "audio/webm" });
          setSavedAudio(blob); setSavedAudioName(`recording.${ext}`);
          await sendAudio(blob, `recording.${ext}`, "mic");
        }
      };

      mrRef.current = mr; mr.start(1000); setRec(true); setTime(0);
      timerRef.current = setInterval(() => setTime((p) => p + 1), 1000);
    } catch (e) { setErr(e.name === "NotAllowedError" ? "Доступ к микрофону запрещён." : `Ошибка: ${e.message}`); }
  }, []);

  const stopRec = useCallback(() => {
    if (mrRef.current?.state !== "inactive") mrRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop()); setRec(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const handleFile = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setUploadName(f.name); setSavedAudio(f); setSavedAudioName(f.name);
    await sendAudio(f, f.name, "file");
    if (fileRef.current) fileRef.current.value = "";
  };

  const sendAudio = async (blob, filename, src = "mic") => {
    if (src === "mic") setTranscribing(true);
    else if (src === "file") setUploading(true);
    if (src !== "chunk") setErr("");
    try {
      const fd = new FormData(); fd.append("audio", blob, filename);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000);
      const res = await fetch(`${API}/transcribe`, { method: "POST", body: fd, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) { throw new Error(await getErrMsg(res)); }
      const d = await res.json(); setText((prev) => (prev ? prev + " " + d.text : d.text));
      if (src !== "chunk") { setSavedAudio(null); setSavedAudioName(""); }
    } catch (e) {
      if (e.name === "AbortError") setErr("Превышено время ожидания (10 мин).");
      else setErr(`Ошибка распознавания: ${e.message}`);
    } finally {
      if (src === "mic") setTranscribing(false);
      if (src === "file") { setUploading(false); setUploadName(""); }
    }
  };

  const retryAudio = async () => { if (savedAudio) await sendAudio(savedAudio, savedAudioName, "file"); };

  // ─── Process ───
  const process = async (customSpecialty) => {
    const t = text.trim(); if (!t) return setErr("Нет текста.");
    setLoading(true); setErr(""); setResult(null); setSaved(false); setDiagnosis(null);
    try {
      let sendText = t;
      if (isDiary) {
        const from = diaryDateFrom || new Date().toISOString().split("T")[0];
        const to = diaryDateTo || new Date(Date.now() + 14*24*60*60*1000).toISOString().split("T")[0];
        const msFrom = new Date(from).getTime();
        const msTo = new Date(to).getTime();
        const days = Math.round((msTo - msFrom) / (1000*60*60*24));
        const count = Math.max(1, Math.round(days / 3));
        const dates = [];
        for (let i = 0; i < count; i++) {
          const d = new Date(msFrom + i * 3 * 24*60*60*1000);
          dates.push(`${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`);
        }
        sendText = `ОБЯЗАТЕЛЬНЫЕ ДАТЫ ДНЕВНИКА (${count} записей):\n${dates.join(', ')}\n\nДАНЫЕ ПАЦИЕНТА:\n${t}`;
      }
      const fd = new FormData(); fd.append("text", sendText); fd.append("specialty", customSpecialty || getSpecKey());
      if (selectedTemplate) fd.append("template_id", selectedTemplate);
      const res = await fetch(`${API}/structure`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await getErrMsg(res));
      setResult(await res.json()); setView("editor");
    } catch (e) { setErr(`Ошибка: ${e.message}`); } finally { setLoading(false); }
  };

  const processWithTemplate = async () => {
    if (!templateFile || !text.trim()) return setErr("Загрузите шаблон и текст.");
    setLoading(true); setErr(""); setResult(null); setSaved(false); setDiagnosis(null);
    try {
      const fd = new FormData();
      fd.append("text", text.trim());
      fd.append("template", templateFile);
      const res = await fetch(`${API}/structure-template`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await getErrMsg(res));
      setResult(await res.json()); setView("editor"); setTemplateFile(null);
    } catch (e) { setErr(`Ошибка: ${e.message}`); } finally { setLoading(false); }
  };

  const saveRecord = async () => {
    if (!result) return;
    try {
      const fd = new FormData();
      fd.append("patient_name", result.patient_name || "");
      fd.append("diagnosis_code", result.diagnosis_code || "");
      fd.append("specialty", getSpecLabel());
      fd.append("summary", result.summary || "");
      fd.append("sections", JSON.stringify(result.sections || []));
      fd.append("transcript", text);
      const res = await fetch(`${API}/records`, { method: "POST", body: fd, headers: authHeaders });
      if (res.ok) { setSaved(true); fetchRecords(); }
    } catch (e) { setErr(`Ошибка сохранения: ${e.message}`); }
  };

  const saveDiaryToPatient = async () => {
    if (!result || !diaryPatientId) return;
    setDiarySaving(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("sections", JSON.stringify(result.sections || []));
      fd.append("transcript", text);
      fd.append("summary", result.summary || "");
      const res = await fetch(`${API}/records/${diaryPatientId}/diary`, { method: "PATCH", body: fd, headers: authHeaders });
      if (!res.ok) throw new Error(await getErrMsg(res));
      setDiarySaved(true); setShowDiaryModal(false); fetchRecords();
      setTimeout(() => setDiarySaved(false), 3000);
    } catch (e) { setErr(`Ошибка: ${e.message}`); }
    finally { setDiarySaving(false); }
  };

  const getDiagnosis = async (resultData) => {
    const r = resultData || result;
    if (!r) return;
    setDiagLoading(true); setDiagnosis(null); setErr("");
    try {
      const fd = new FormData();
      fd.append("sections", JSON.stringify(r.sections || []));
      fd.append("patient_name", r.patient_name || "");
      fd.append("transcript", text);
      const res = await fetch(`${API}/diagnose`, { method: "POST", body: fd, headers: authHeaders });
      if (!res.ok) throw new Error(await getErrMsg(res));
      setDiagnosis(await res.json());
    } catch (e) { setErr(`Ошибка диагностики: ${e.message}`); }
    finally { setDiagLoading(false); }
  };

  const viewRecord = async (id) => {
    setLoadingRecords(true);
    try { const r = await fetch(`${API}/records/${id}`, { headers: authHeaders }); if (r.ok) { setSelectedRecord(await r.json()); setView("detail"); } }
    catch (e) { setErr("Не удалось загрузить."); } finally { setLoadingRecords(false); }
  };

  const deleteRecord = async (id) => {
    try { await fetch(`${API}/records/${id}`, { method: "DELETE", headers: authHeaders }); fetchRecords(); if (selectedRecord?.id === id) { setSelectedRecord(null); setView("history"); } } catch(e){}
  };

  // ─── Session functions ───
  const WS_BASE = (() => {
    if (API) return API.replace("https://", "wss://").replace("http://", "ws://");
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}`;
  })();

  const createSession = async () => {
    try {
      const res = await fetch(`${API}/session/create`, { method: "POST" });
      const data = await res.json();
      setSessionCode(data.code);
      setSessionRole("phone");
      connectSessionWs("phone", data.code);
    } catch(e) { setErr("Ошибка создания сессии"); }
  };

  const joinSession = (code) => {
    setSessionCode(code.toUpperCase());
    setSessionRole("computer");
    connectSessionWs("computer", code.toUpperCase());
  };

  const connectSessionWs = (role, code) => {
    const url = `${WS_BASE}/ws/${role}/${code}`;
    console.log("Connecting WebSocket:", url);
    const ws = new WebSocket(url);
    sessionWsRef.current = ws;
    ws.onopen = () => { console.log("WS connected"); setSessionConnected(true); };
    ws.onerror = (e) => { console.error("WS error", e); setErr("WebSocket ошибка — проверьте соединение"); };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "text") {
        setSessionText(msg.text);
        if (role === "computer") setText(msg.text);
      } else if (msg.type === "connected" || msg.type === "computer_connected") {
        setSessionConnected(true);
      }
    };
    ws.onclose = (e) => { console.log("WS closed", e.code, e.reason); setSessionConnected(false); };
  };

  const sendSessionText = (t) => {
    if (sessionWsRef.current?.readyState === 1) {
      sessionWsRef.current.send(JSON.stringify({ type: "text", text: t }));
    }
  };

  const closeSession = () => {
    sessionWsRef.current?.close();
    setSessionCode(""); setSessionRole(""); setSessionConnected(false); setSessionText(""); setSessionInput("");
  };

  const loadDemo = (e) => {
    e.preventDefault();
    const key = getSpecKey();
    setText(DEMOS[key] || DEMOS[spec] || DEMOS["therapist"] || "");
    setResult(null); setErr(""); setSaved(false);
  };

  const copyAll = () => {
    const r = view === "detail" ? selectedRecord : result; if (!r) return;
    const p = [];
    if (r.patient_name) p.push(`Пациент: ${r.patient_name}`);
    if (r.diagnosis_code) p.push(`Код МКБ-10: ${r.diagnosis_code}`);
    p.push("");
    (r.sections || []).forEach((s) => {
      if (s.content && s.content !== "Данные не предоставлены") p.push(`${s.title}: ${s.content}`);
    });
    if (r.summary) p.push(`\nРезюме: ${r.summary}`);
    navigator.clipboard.writeText(p.join("\n")); setAllCop(true); setTimeout(() => setAllCop(false), 2000);
  };

  const downloadWord = async () => {
    const r = view === "detail" ? selectedRecord : result; if (!r) return;
    try {
      const fd = new FormData();
      fd.append("patient_name", r.patient_name || "");
      fd.append("diagnosis_code", r.diagnosis_code || "");
      fd.append("specialty", r.specialty || getSpecLabel());
      fd.append("summary", r.summary || "");
      fd.append("sections", JSON.stringify(r.sections || []));
      if (selectedTemplate) fd.append("template_id", selectedTemplate);
      const res = await fetch(`${API}/export-word`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Ошибка");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `${r.patient_name?.split(" ")[0] || "doc"}.docx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) { setErr(`Ошибка: ${e.message}`); }
  };

  const clear = () => { setText(""); setResult(null); setErr(""); setTime(0); setSaved(false); setDiagnosis(null); };
  const newRecord = () => { clear(); setView("editor"); };
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  // ─── Live Assist ───
  const startLiveAssist = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErr("Распознавание речи не поддерживается в этом браузере. Используйте Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ru-RU";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalText = liveText;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += " " + t;
          setLiveText(finalText.trim());
        } else {
          interim = t;
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== "no-speech") {
        console.error("Speech error:", event.error);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still in live mode
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch(e) {}
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setLiveListening(true);

    // Start periodic legal checks every 20 seconds
    liveCheckTimerRef.current = setInterval(() => {
      checkLegalAlerts();
    }, 20000);
  };

  const stopLiveAssist = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // Prevent auto-restart
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (liveCheckTimerRef.current) {
      clearInterval(liveCheckTimerRef.current);
      liveCheckTimerRef.current = null;
    }
    setLiveListening(false);
  };

  const checkLegalAlerts = async () => {
    // Get current live text from DOM since state might be stale in interval
    const textEl = document.getElementById("live-text-content");
    const currentText = textEl ? textEl.textContent : "";
    if (!currentText || currentText.length < 30 || currentText === lastCheckedRef.current) return;

    lastCheckedRef.current = currentText;
    setLiveChecking(true);
    try {
      const fd = new FormData();
      fd.append("text", currentText);
      const res = await fetch(`${API}/analyze-legal`, { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        if (data.alerts && data.alerts.length > 0) {
          setLiveAlerts(prev => [...data.alerts.map(a => ({...a, id: Date.now() + Math.random(), time: new Date().toLocaleTimeString("ru-RU", {hour:"2-digit", minute:"2-digit"})})), ...prev]);
        }
      }
    } catch(e) {}
    finally { setLiveChecking(false); }
  };

  const dismissAlert = (id) => {
    setLiveAlerts(prev => prev.filter(a => a.id !== id));
  };

  const transferToEditor = () => {
    setText(liveText);
    setLiveMode(false);
    stopLiveAssist();
    setView("editor");
  };

  const getPlaceholder = () => {
    if (isDiary) return "Введите данные пациента:\n\n1. ФИО, возраст\n2. Диагноз (МКБ-10)\n3. Текущая терапия\n4. Анамнез (кратко)\n5. Текущее состояние";
    if (isUzi) return "Диктуйте результаты УЗ-исследования:\n\nНазовите ФИО пациента, затем описывайте каждый орган — размеры, структуру, эхогенность, наличие образований, сосудистый рисунок. В конце — заключение.";
    if (spec === "psychiatrist" || spec === "psychiatrist_stac") return "Диктуйте осмотр пациента:\n\nЖалобы, анамнез жизни, анамнез заболевания, психический статус (сознание, ориентировка, мышление, восприятие, эмоции, критика), соматический и неврологический статус, диагноз, назначения.";
    if (spec === "therapist") return "Диктуйте приём пациента:\n\nЖалобы (локализация, характер, длительность), анамнез заболевания, анамнез жизни, объективный осмотр (АД, ЧСС, аускультация, пальпация), данные обследований, диагноз, назначения.";
    if (spec === "neurologist") return "Диктуйте осмотр пациента:\n\nЖалобы, анамнез. Неврологический статус: черепные нервы (I–XII), двигательная сфера, рефлексы, чувствительность, координация, менингеальные симптомы. Данные МРТ/КТ. Диагноз, лечение.";
    if (spec === "cardiologist") return "Диктуйте приём:\n\nЖалобы (боли, одышка, отёки), анамнез. Осмотр: АД на обеих руках, ЧСС, пульс, аускультация (тоны, шумы), перкуссия. Данные ЭКГ, ЭхоКГ. Диагноз, назначения.";
    if (spec === "surgeon") return "Диктуйте осмотр:\n\nЖалобы, анамнез. Status localis: локализация, размеры, консистенция, болезненность, состояние кожи. Живот: перитонеальные симптомы. Диагноз, тактика лечения.";
    return "Диктуйте или вставьте текст приёма:\n\nЖалобы пациента, анамнез заболевания, анамнез жизни, данные осмотра, результаты обследований, диагноз, назначения.";
  };

  const renderOnboarding = () => (
    <div className="onboarding card">
      <div className="onboarding-title">Как это работает</div>
      <div className="onboarding-steps">
        <div className="onboarding-step">
          <div className="step-num">1</div>
          <div className="step-text"><span className="step-bold">Выберите специальность</span> и шаблон документа (если есть)</div>
        </div>
        <div className="onboarding-step">
          <div className="step-num">2</div>
          <div className="step-text"><span className="step-bold">Запишите приём</span> через микрофон, загрузите аудио или вставьте текст</div>
        </div>
        <div className="onboarding-step">
          <div className="step-num">3</div>
          <div className="step-text"><span className="step-bold">Получите документ</span> — скопируйте в МИС или скачайте Word</div>
        </div>
      </div>
      <div className="onboarding-tips">
        <div className="section-label" style={{marginTop: 12}}>Советы для лучшего результата</div>
        <div className="tip-text">Называйте ФИО и возраст пациента в начале записи</div>
        <div className="tip-text">Диктуйте структурно: жалобы → анамнез → осмотр → диагноз → назначения</div>
        <div className="tip-text">Числовые значения (АД, ЧСС, размеры) произносите чётко</div>
        <div className="tip-text">Для УЗИ — описывайте каждый орган отдельно</div>
      </div>
    </div>
  );

  const getHint = () => {
    if (source === "mic") {
      if (transcribing) return "Распознаю запись...";
      if (rec) return `Идёт запись — ${fmt(time)}. Нажмите для остановки.`;
      return "Нажмите, чтобы начать запись голоса";
    }
    if (uploading) return `Распознаю: ${uploadName || "файл"}...`;
    return "Нажмите, чтобы выбрать аудиофайл";
  };
  const handleHintClick = () => { if (source === "mic") { rec ? stopRec() : startRec(); } else { if (!uploading) fileRef.current?.click(); } };

  const renderSections = (data, showHints = false, editable = false) => (
    <>
      {(data.patient_name || data.diagnosis_code) && (
        <div className="patient-bar card">
          {data.patient_name && <div className="patient-item"><span className="p-label">Пациент</span><span className="p-value">{data.patient_name}</span></div>}
          {data.diagnosis_code && <div className="patient-item"><span className="p-label">МКБ-10</span><span className="p-value code">{data.diagnosis_code}</span></div>}
          {data.specialty && <div className="patient-item"><span className="p-label">Специальность</span><span className="p-value">{data.specialty}</span></div>}
          {data.created_at && <div className="patient-item"><span className="p-label">Дата</span><span className="p-value">{data.created_at}</span></div>}
        </div>
      )}
      <div className="result-head"><h2 className="result-title">Документ</h2>
        <div className="result-actions">
          <button onClick={copyAll} className={`copy-all ${allCop ? "ok" : ""}`}>{allCop ? "\u2713 Скопировано" : "Копировать всё"}</button>
          <button onClick={downloadWord} className="download-word">Скачать Word</button>
        </div>
      </div>
      {showHints && (data.sections || []).some(s => !s.content || s.content === "Данные не предоставлены") && (
        <div className="hints-banner">Разделы, отмеченные красным, не заполнены — врач не предоставил данные.</div>
      )}
      {data.summary && <div className="summary">{data.summary}</div>}
      <div className="sections">{(data.sections || []).map((s, i) => (
        <div key={i}>
          <SectionCard title={s.title} content={s.content} idx={i} showHints={showHints} onContentChange={editable ? handleSectionEdit : null} />
          {editable && (
            <button className="snip-insert-btn" onClick={() => { setSnippetTarget(i); setShowSnippets(true); }}>
              + Вставить сниппет
            </button>
          )}
        </div>
      ))}</div>
    </>
  );

  return (
    <div className="app-wrap">
      {!user ? (
        // ═══ LOGIN SCREEN ═══
        <div className="auth-wrap">
          <div className="auth-card">
            <div className="auth-logo">
              <div className="auth-logo-icon"><svg width="20" height="20" viewBox="0 0 18 18" fill="none"><rect x="7" y="2" width="4" height="14" rx="1" fill="white" opacity="0.9"/><rect x="2" y="7" width="14" height="4" rx="1" fill="white" opacity="0.9"/></svg></div>
              <div className="auth-logo-text">Писарь</div>
            </div>
            <div className="card">
              <div className="section-label">{authView === "login" ? "Вход" : "Регистрация"}</div>
              {authView === "register" && <input className="auth-input" placeholder="Имя врача" autoComplete="name" value={authName} onChange={e => setAuthName(e.target.value)} />}
              <input className="auth-input" placeholder="Логин" autoComplete="username" value={authLogin} onChange={e => setAuthLogin(e.target.value)} onInput={e => setAuthLogin(e.target.value)} />
              <input className="auth-input" type="password" placeholder="Пароль" autoComplete="current-password" value={authPass}
                onChange={e => setAuthPass(e.target.value)}
                onInput={e => setAuthPass(e.target.value)}
                onKeyDown={e => e.key === "Enter" && doAuth(authView === "login" ? "/auth/login" : "/auth/register")} />
              {authErr && <div className="error" style={{marginTop:8}}>{authErr}</div>}
              <button onClick={() => doAuth(authView === "login" ? "/auth/login" : "/auth/register")}
                disabled={authLoading}
                className={`cta ${authLoading ? "off" : ""}`} style={{marginTop:12}}>
                {authLoading ? <><span className="spinner" />Загрузка...</> : authView === "login" ? "Войти" : "Зарегистрироваться"}
              </button>
              <div className="auth-switch" onClick={() => { setAuthView(authView === "login" ? "register" : "login"); setAuthErr(""); }}>
                {authView === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
              </div>
            </div>
          </div>
        </div>
      ) : (
      <div className="app">
        {/* ═══ SIDEBAR (desktop only) ═══ */}
        <div className="sidebar">
          <div className="sidebar-top">
            <button className="sidebar-plus-btn" onClick={() => { setView("editor"); setResult(null); setText(""); setDiagnosis(null); setSaved(false); }} title="Новый приём">+</button>
            <div className="sidebar-brand" onClick={() => setView("home")} style={{cursor: "pointer"}}>Писарь</div>
          </div>
          <button className="sidebar-new-btn" onClick={() => { setView("editor"); setResult(null); setText(""); setDiagnosis(null); setSaved(false); }}>+ Новый приём</button>
          <div className="sidebar-menu">
            <div className={`sidebar-menu-item ${view === "home" ? "active" : ""}`} onClick={() => { setView("home"); setEditorHint(""); }}>Главная</div>
            <div className={`sidebar-menu-item ${view === "editor" ? "active" : ""}`} onClick={() => { stopLiveAssist(); setView("editor"); setEditorHint(""); }}>Документация</div>
            <div className={`sidebar-menu-item ${view === "my-patients" ? "active" : ""}`} onClick={() => { setView("my-patients"); setEditorHint(""); }}>Мои пациенты</div>
            <div className={`sidebar-menu-item ${view === "template" ? "active" : ""}`} onClick={() => { setView("template"); setEditorHint(""); }}>Шаблоны</div>
            <div className="sidebar-menu-item" onClick={() => { setView("editor"); setShowSamples(true); setEditorHint("samples"); }}>Обучение стилю</div>
          </div>
          {records.length > 0 && (
            <>
              <div className="sidebar-section-label">Недавние пациенты</div>
              <div className="sidebar-recent">
                {records.slice(0, 5).map(r => (
                  <div key={r.id} className="sidebar-recent-item" onClick={() => viewRecord(r.id)}>
                    <div className="sidebar-recent-name">{r.patient_name || "Без имени"}</div>
                    <div className="sidebar-recent-meta">{r.diagnosis_code || ""} · {r.created_at}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          {records.length === 0 && <div className="sidebar-recent" />}
          <div className="sidebar-footer">
            <div className="sidebar-footer-item" onClick={logout}>Настройки</div>
          </div>
        </div>

        {/* ═══ MOBILE HEADER ═══ */}
        <div className="header">
          <div className="header-icon"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="7" y="2" width="4" height="14" rx="1" fill="white" opacity="0.9"/><rect x="2" y="7" width="14" height="4" rx="1" fill="white" opacity="0.9"/></svg></div>
          <div style={{flex:1}}><div className="header-title">Писарь</div><div className="header-sub">{user.name}</div></div>
          <div className="header-actions">
            <div className="header-badges-desktop">
              <div className="header-badge" onClick={() => setShowSnipManager(true)}>Быстрые фразы</div>
              <div className="header-badge session-badge" onClick={() => setView(view === "session" ? "editor" : "session")}>
                {view === "session" ? "← Назад" : "Сессия"}
              </div>
              <div className="header-badge" onClick={logout}>Выйти</div>
            </div>
            <HamburgerMenu
              onSnippets={() => setShowSnipManager(true)}
              onSession={() => setView(view === "session" ? "editor" : "session")}
              sessionLabel={view === "session" ? "← Назад" : "Сессия"}
              onLogout={logout}
            />
          </div>
        </div>

        {/* ═══ MAIN CONTENT ═══ */}
        <div className="main-content">
          {/* Top bar (desktop only, hidden on home) */}
          {view !== "home" && (
            <div className="topbar">
              <div className="topbar-tabs">
                <div className={`topbar-tab ${view === "editor" ? "active" : ""}`} onClick={() => { stopLiveAssist(); setView("editor"); }}>
                  {isDiary ? "Дневник" : "Документация"}
                </div>
                <div className={`topbar-tab ${view === "my-patients" ? "active" : ""}`} onClick={() => setView("my-patients")}>Мои пациенты</div>
              </div>
              <div className="topbar-right">
                <div className="topbar-badge clickable" onClick={() => { const el = document.querySelector('.spec-select'); if (el) { el.scrollIntoView({behavior: 'smooth', block: 'center'}); el.focus(); } }}>{specInfo.label} ▾</div>
              </div>
            </div>
          )}

          {/* Mobile tabs - shown only on mobile via CSS */}
          {view !== "home" && (
            <div className="card mobile-tabs" style={{padding: "12px 16px"}}>
              <div className="tabs">
                <div className={`tab ${view !== "my-patients" ? "active" : ""}`} onClick={() => { stopLiveAssist(); setView("editor"); }}>Документация</div>
                <div className={`tab ${view === "my-patients" ? "active" : ""}`} onClick={() => setView("my-patients")}>Мои пациенты</div>
              </div>
            </div>
          )}

          <div className={`page-content ${view === "home" ? "is-home" : ""}`}>
            <div className="page-inner">

          {/* ═══ HOME (WELCOME) SCREEN ═══ */}
          {view === "home" && (
            <div className="welcome">
              <div className="welcome-greeting">Добрый день{user.name ? `, ${user.name}` : ""}</div>
              <button className="welcome-cta" onClick={() => { setView("editor"); setResult(null); setText(""); setDiagnosis(null); setSaved(false); }}>+ Новый приём</button>
              <div className="welcome-or">или выберите действие</div>
              <div className="welcome-grid">
                <div className="welcome-card" onClick={() => { setView("editor"); setEditorHint("transcribe"); }}>
                  <div className="welcome-card-dot"></div>
                  <div className="welcome-card-title">Расшифровка</div>
                  <div className="welcome-card-desc">Запишите приём и получите готовый документ</div>
                </div>
                <div className="welcome-card" onClick={() => { setView("editor"); setEditorHint("diagnose"); }}>
                  <div className="welcome-card-dot blue"></div>
                  <div className="welcome-card-title">Помощь с диагнозом</div>
                  <div className="welcome-card-desc">МКБ-10, обоснование и лечение по КР</div>
                </div>
                <div className="welcome-card" onClick={() => { setView("editor"); setPsyMode("diary"); setEditorHint("diary"); }}>
                  <div className="welcome-card-dot purple"></div>
                  <div className="welcome-card-title">Дневники</div>
                  <div className="welcome-card-desc">Генерация дневников за выбранный период</div>
                </div>
                <div className="welcome-card" onClick={() => setView("template")}>
                  <div className="welcome-card-dot amber"></div>
                  <div className="welcome-card-title">Шаблоны</div>
                  <div className="welcome-card-desc">Создайте или загрузите свой шаблон документа</div>
                </div>
                <div className="welcome-card" onClick={() => setView("my-patients")}>
                  <div className="welcome-card-dot"></div>
                  <div className="welcome-card-title">Экспорт в Word</div>
                  <div className="welcome-card-desc">Скачайте готовый документ в формате .docx</div>
                </div>
                <div className="welcome-card" onClick={() => { setView("editor"); setShowSamples(true); setEditorHint("samples"); }}>
                  <div className="welcome-card-dot purple"></div>
                  <div className="welcome-card-title">Обучение стилю</div>
                  <div className="welcome-card-desc">Нейросеть пишет в вашей манере</div>
                </div>
              </div>
              <div className="welcome-ask">
                <div className="ask-row">
                  <input
                    className="ask-input"
                    placeholder="Задайте медицинский вопрос..."
                    value={askQuestion}
                    onChange={e => setAskQuestion(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") sendAskQuestion(); }}
                    disabled={askLoading}
                  />
                  <button
                    className="ask-send-btn"
                    onClick={sendAskQuestion}
                    disabled={!askQuestion.trim() || askLoading}
                  >
                    {askLoading ? <span className="spinner" /> : "Спросить"}
                  </button>
                </div>
                {askAnswer && (
                  <div className="ask-answer">
                    <div className="ask-answer-label">ИИ-ассистент</div>
                    <div className="ask-answer-text"><MarkdownText text={askAnswer} /></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ DOCUMENTATION MODE ═══ */}
          {view !== "my-patients" && view === "editor" && (
            <>
              {/* Contextual onboarding hint banner */}
              {editorHint && (
                <div className={`hint-banner hint-${editorHint}`}>
                  <div className="hint-banner-icon">
                    {editorHint === "transcribe" && "🎤"}
                    {editorHint === "diagnose" && "🩺"}
                    {editorHint === "diary" && "📔"}
                    {editorHint === "samples" && "✨"}
                  </div>
                  <div className="hint-banner-body">
                    <div className="hint-banner-title">
                      {editorHint === "transcribe" && "Расшифровка приёма"}
                      {editorHint === "diagnose" && "Помощь с диагнозом"}
                      {editorHint === "diary" && "Генерация дневников"}
                      {editorHint === "samples" && "Обучение стилю"}
                    </div>
                    <div className="hint-banner-text">
                      {editorHint === "transcribe" && "1) Выберите специальность ниже  2) Запишите голос или вставьте текст приёма в поле «Текст записи»  3) Нажмите «Структурировать» — получите готовый документ."}
                      {editorHint === "diagnose" && "Сначала структурируйте приём (запишите голос или вставьте текст и нажмите «Структурировать»). После этого под результатом появится кнопка «Получить диагноз» — ИИ предложит МКБ-10, обоснование и лечение."}
                      {editorHint === "diary" && "Режим дневников включён. Выберите специальность, заполните данные пациента и период — ИИ составит дневники наблюдения за выбранные даты."}
                      {editorHint === "samples" && "Панель «Обучение стилю» открыта ниже. Загрузите несколько ваших готовых документов — нейросеть запомнит вашу манеру письма и будет составлять документы в вашем стиле."}
                    </div>
                  </div>
                  <button className="hint-banner-close" onClick={() => setEditorHint("")}>✕</button>
                </div>
              )}

              {/* Specialty selector */}
              <div className={`card ${editorHint === "transcribe" || editorHint === "diary" ? "card-highlight" : ""}`}>
                <div className="section-label">Специальность</div>
                <select className="spec-select" value={spec} onChange={e => { setSpec(e.target.value); setPsyMode("exam"); setResult(null); setDiagnosis(null); setSelectedTemplate(""); }}>
                  {SPECIALTIES.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* УЗИ sub-type selector */}
              {/* Template selector */}
              {!isDiary && (
                <div className="card">
                  <div className="section-label">Шаблон документа</div>
                  {filteredTemplates.length > 0 ? (
                    <>
                      <div className="tpl-row">
                        <select className="spec-select" value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}>
                          <option value="">Без шаблона (стандартный)</option>
                          {filteredTemplates.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                      {selectedTemplate && (
                        <div className="tpl-actions">
                          <button className="tpl-preview-btn" onClick={() => viewTemplate(selectedTemplate)}>Просмотр</button>
                          <button className="tpl-delete-btn" onClick={() => { if (window.confirm("Удалить шаблон?")) deleteTemplate(selectedTemplate); }}>Удалить</button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="tpl-empty">Нет шаблонов для этой специальности</div>
                  )}
                  <div className="tpl-actions" style={{marginTop: 6}}>
                    <input ref={tplFileRef} type="file" accept=".docx" style={{display:"none"}} onChange={e => { const f = e.target.files?.[0]; if (f) uploadTemplate(f); }} />
                    <button className="tpl-upload-btn" onClick={() => tplFileRef.current?.click()} disabled={tplUploading}>
                      {tplUploading ? "Загружаю..." : "+ Свой шаблон (.docx)"}
                    </button>
                  </div>
                </div>
              )}

              {/* Psychiatry: exam/diary toggle */}
              {isPsychiatry && specInfo.hasDiary && (
                <div className="card">
                  <div className="section-label">Тип документа</div>
                  <div className="tabs">
                    <div className={`tab ${psyMode === "exam" ? "active" : ""}`} onClick={() => setPsyMode("exam")}>Первичный осмотр</div>
                    <div className={`tab ${psyMode === "diary" ? "active" : ""}`} onClick={() => setPsyMode("diary")}>Дневник</div>
                  </div>
                </div>
              )}

              {/* Diary date range */}
              {isDiary && (
                <div className="card">
                  <div className="section-label">Период дневника</div>
                  <div className="diary-dates">
                    <div className="diary-date-field">
                      <label className="diary-date-label">С какого числа</label>
                      <input type="date" className="diary-date-input" value={diaryDateFrom} onChange={e => setDiaryDateFrom(e.target.value)} />
                    </div>
                    <div className="diary-date-sep">—</div>
                    <div className="diary-date-field">
                      <label className="diary-date-label">По какое число</label>
                      <input type="date" className="diary-date-input" value={diaryDateTo} onChange={e => setDiaryDateTo(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Diary training section */}
              {isDiary && (
                <div className="card">
                  <div className="section-label" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span>Обучение стилю</span>
                    <span className="train-badge" onClick={() => setShowSamples(!showSamples)}>
                      {diarySamples.length > 0 ? `${diarySamples.length} ${diarySamples.length === 1 ? "пример" : diarySamples.length < 5 ? "примера" : "примеров"}` : "Нет примеров"}
                      {showSamples ? " ▲" : " ▼"}
                    </span>
                  </div>
                  <div className="train-hint">Добавьте примеры ваших дневников — нейросеть будет писать в вашем стиле</div>

                  {showSamples && (
                    <div className="train-panel">
                      <textarea
                        className="train-textarea"
                        placeholder={"Вставьте пример вашего дневника, например:\n15.03.2025 Состояние стабильное. Сон улучшился. Аппетит достаточный. Фон настроения ровный. Продолжить терапию в прежних дозировках."}
                        value={sampleText}
                        onChange={e => setSampleText(e.target.value)}
                        rows={5}
                      />
                      <button
                        className="train-save-btn"
                        onClick={saveDiarySample}
                        disabled={sampleSaving || !sampleText.trim()}
                      >
                        {sampleSaving ? "Сохраняю..." : "+ Добавить пример"}
                      </button>

                      {diarySamples.length > 0 && (
                        <div className="train-samples-list">
                          {diarySamples.map(s => (
                            <div key={s.id} className="train-sample">
                              <div className="train-sample-text">{s.sample_text.length > 150 ? s.sample_text.slice(0, 150) + "..." : s.sample_text}</div>
                              <div className="train-sample-meta">
                                <span>{s.created_at}</span>
                                <span className="train-sample-del" onClick={() => deleteDiarySample(s.id)}>Удалить</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Source selector (not for diary) */}
              {!isDiary && (
                <div className="card">
                  <div className="section-label">Источник</div>
                  <div className="tabs">
                    <div className={`tab ${source === "mic" ? "active" : ""}`} onClick={() => setSource("mic")}><MicIcon /> Записать</div>
                    <div className={`tab ${source === "file" ? "active" : ""}`} onClick={() => setSource("file")}><UploadIcon /> Загрузить</div>
                  </div>
                  <input ref={fileRef} type="file" accept=".mp3,.wav,.m4a,.ogg,.flac,.webm,.aac,.wma,.mp4" style={{ display: "none" }} onChange={handleFile} />
                  <button
                    type="button"
                    className={`record-btn ${rec ? "recording" : ""} ${(transcribing || uploading) ? "processing" : ""}`}
                    onClick={handleHintClick}
                    disabled={transcribing || uploading}
                  >
                    {(transcribing || uploading) ? (
                      <><span className="hint-spinner" />{getHint()}</>
                    ) : rec ? (
                      <><span className="hint-dot" /><span className="record-btn-icon">⏹</span><span>{getHint()}</span></>
                    ) : source === "mic" ? (
                      <><span className="record-btn-icon">🎤</span><span>Нажмите, чтобы начать запись</span></>
                    ) : (
                      <><span className="record-btn-icon">📁</span><span>Нажмите, чтобы выбрать аудиофайл</span></>
                    )}
                  </button>
                </div>
              )}

              {/* Text area */}
              <div className={`card ${editorHint === "transcribe" || editorHint === "diagnose" ? "card-highlight" : ""}`}>
                <div className="textarea-header">
                  <div className="section-label" style={{ marginBottom: 0 }}>{isDiary ? "Данные пациента" : "Текст записи"}</div>
                  <div className="textarea-actions">
                    {wordCount > 0 && <span className="word-count">{wordCount} слов</span>}
                    {text && <button onClick={clear} className="clear-btn">Очистить</button>}
                  </div>
                </div>
                <textarea className="text-area" value={text} onChange={(e) => setText(e.target.value)} placeholder={getPlaceholder()} />
              </div>

              {/* Onboarding — shows when no text and no result */}
              {!text.trim() && !result && !rec && !transcribing && renderOnboarding()}

              {/* CTA buttons */}
              <div className="cta-group">
                <button onClick={() => process()} disabled={loading || !text.trim()} className={`cta ${loading || !text.trim() ? "off" : ""}`}>
                  {loading ? <><span className="spinner" />{isDiary ? "Составляю дневники..." : "Структурирую..."}</> : (isDiary ? "Составить дневники" : selectedTemplate ? "Структурировать по шаблону" : isUzi ? "Создать протокол" : "Структурировать")}
                </button>
              </div>
              <a href="#" className="demo-link" onClick={loadDemo}>Попробовать демо-запись →</a>

              {savedAudio && !transcribing && !uploading && (
                <div className="retry-bar">
                  <span>Аудио сохранено ({savedAudioName})</span>
                  <button onClick={retryAudio} className="retry-btn">Повторить</button>
                </div>
              )}

              {err && <div className="error">{err}</div>}
              {result && (<div className="result">
                {renderSections(result, true, true)}
                {!isDiary && !isUzi && (
                  <>
                    <button onClick={() => getDiagnosis()} disabled={diagLoading} className="diag-btn">
                      {diagLoading ? <><span className="spinner" />Анализирую...</> : "Помощь с диагнозом"}
                    </button>
                    {diagnosis && (
                      <div className="diag-panel">
                        <div className="diag-header-row">
                          <div className="diag-header">Предварительный диагноз</div>
                          <div className="diag-warn-badge">ИИ · не окончательный</div>
                        </div>
                        <div className="diag-main">
                          <div className="diag-main-code">{typeof diagnosis.icd_code === 'object' ? JSON.stringify(diagnosis.icd_code) : (diagnosis.icd_code || '')}</div>
                          <div className="diag-main-name">{typeof diagnosis.diagnosis === 'object' ? JSON.stringify(diagnosis.diagnosis) : (diagnosis.diagnosis || '')}</div>
                        </div>
                        {diagnosis.justification && <div className="diag-section"><div className="diag-label">Обоснование</div><div className="diag-value">{typeof diagnosis.justification === 'object' ? JSON.stringify(diagnosis.justification) : (diagnosis.justification || '')}</div></div>}
                        {diagnosis.differential && <div className="diag-section"><div className="diag-label">Дифф. диагноз</div><div className="diag-value">{typeof diagnosis.differential === 'object' ? JSON.stringify(diagnosis.differential) : (diagnosis.differential || '')}</div></div>}
                        {diagnosis.treatment && <div className="diag-section"><div className="diag-label">Лечение</div><div className="diag-value">{typeof diagnosis.treatment === 'object' ? JSON.stringify(diagnosis.treatment) : (diagnosis.treatment || '')}</div></div>}
                        {diagnosis.examinations && <div className="diag-section"><div className="diag-label">Обследования</div><div className="diag-value">{typeof diagnosis.examinations === 'object' ? JSON.stringify(diagnosis.examinations) : (diagnosis.examinations || '')}</div></div>}
                      </div>
                    )}
                  </>
                )}
                {isDiary ? (
                  <div className="diary-save-row">
                    {diarySaved && <div className="saved-msg">✓ Дневник добавлен</div>}
                    {!diarySaved && (
                      <>
                        <button onClick={() => { setShowDiaryModal(true); setDiaryPatientId(""); }} className="save-btn">Сохранить к пациенту</button>
                        {!saved && <button onClick={saveRecord} className="save-btn save-btn-new">Сохранить как нового</button>}
                        {saved && <div className="saved-msg">✓ Сохранено</div>}
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="disclaimer">Документ сформирован ИИ-ассистентом. Проверьте данные перед использованием.</div>
                    {!saved ? <button onClick={saveRecord} className="save-btn">Сохранить в историю</button> : <div className="saved-msg">✓ Сохранено</div>}
                  </>
                )}
              </div>)}
            </>
          )}

          {view === "session" && (
            <div className="session-view">
              {!sessionRole ? (
                <>
                  <div className="card">
                    <div className="section-label">Синхронизация телефон → компьютер</div>
                    <p className="session-desc">Запишите речь на телефоне — текст появится на компьютере в реальном времени.</p>
                    <button className="cta" onClick={createSession}>📱 Создать сессию (с телефона)</button>
                  </div>
                  <div className="card">
                    <div className="section-label">Подключиться к сессии (с компьютера)</div>
                    <p className="session-desc">Введите код который показан на телефоне.</p>
                    <div className="session-join-row">
                      <input className="session-code-input" placeholder="ABC123" maxLength={6} value={sessionInput} onChange={e => setSessionInput(e.target.value.toUpperCase())} />
                      <button className="cta" style={{flex:1}} onClick={() => joinSession(sessionInput)} disabled={sessionInput.length < 4}>Подключиться</button>
                    </div>
                  </div>
                </>
              ) : sessionRole === "phone" ? (
                <div className="card">
                  <div className="session-code-display">
                    <div className="session-code-label">Код сессии</div>
                    <div className="session-code-big">{sessionCode}</div>
                    <div className="session-code-hint">Введите этот код на компьютере в разделе «Сессия»</div>
                  </div>
                  <div className={`session-status ${sessionConnected ? "connected" : "waiting"}`}>
                    {sessionConnected ? "✓ Компьютер подключён" : "⏳ Ожидание компьютера..."}
                  </div>
                  <div className="section-label" style={{marginTop:16}}>Текст для передачи</div>
                  <textarea
                    className="session-textarea"
                    placeholder="Говорите — или печатайте здесь. Текст отправится на компьютер..."
                    value={sessionText}
                    onChange={e => { setSessionText(e.target.value); sendSessionText(e.target.value); }}
                  />
                  <div className="session-phone-hint">💡 Используйте микрофон клавиатуры телефона для диктовки</div>
                  <button className="cta" style={{marginTop:12}} onClick={() => { const blob = new Blob([sessionText]); setResult(null); setText(sessionText); setView("editor"); closeSession(); }}>
                    Перенести текст и структурировать →
                  </button>
                  <button className="sec-edit-cancel" style={{marginTop:8,width:"100%",padding:10}} onClick={closeSession}>Завершить сессию</button>
                </div>
              ) : (
                <div className="card">
                  <div className={`session-status ${sessionConnected ? "connected" : "waiting"}`} style={{marginBottom:16}}>
                    {sessionConnected ? "✓ Телефон подключён — текст появится ниже" : "⏳ Ожидание телефона..."}
                  </div>
                  <div className="section-label">Текст с телефона</div>
                  <div className="session-live-text">{sessionText || "Текст появится здесь когда врач начнёт говорить на телефоне..."}</div>
                  {sessionText && (
                    <button className="cta" style={{marginTop:12}} onClick={() => { setText(sessionText); setView("editor"); closeSession(); }}>
                      Перенести в редактор и структурировать →
                    </button>
                  )}
                  <button className="sec-edit-cancel" style={{marginTop:8,width:"100%",padding:10}} onClick={closeSession}>Отключиться</button>
                </div>
              )}
            </div>
          )}

          {view === "template" && (
            <div className="template-view">
              <button className="back-btn" onClick={() => setView("editor")}>← Назад</button>
              <div className="card">
                <div className="section-label">Расшифрованный текст</div>
                <div className="template-text">{text || "Нет текста"}</div>
              </div>
              <div className="card">
                <div className="section-label">Загрузите шаблон</div>
                <p className="template-desc">Загрузите пример документа (.docx или .txt) — программа извлечёт структуру и заполнит её.</p>
                <input type="file" ref={templateRef} accept=".docx,.txt,.doc" style={{display:"none"}} onChange={(e) => { const f = e.target.files?.[0]; if (f) setTemplateFile(f); }} />
                <div className="template-upload" onClick={() => templateRef.current?.click()}>
                  {templateFile ? (
                    <div className="template-file-info">
                      <span className="template-file-name">{templateFile.name}</span>
                      <span className="template-file-change">Изменить</span>
                    </div>
                  ) : "Нажмите, чтобы загрузить шаблон"}
                </div>
                <button onClick={processWithTemplate} disabled={loading || !templateFile} className={`cta ${loading || !templateFile ? "off" : ""}`} style={{marginTop: 12}}>
                  {loading ? <><span className="spinner" />Структурирую...</> : "Структурировать по шаблону"}
                </button>
              </div>
              {err && <div className="error">{err}</div>}
              {result && (<div className="result">{renderSections(result, true, true)}{!saved ? <button onClick={saveRecord} className="save-btn">Сохранить</button> : <div className="saved-msg">✓ Сохранено</div>}</div>)}
            </div>
          )}

          {view === "my-patients" && (
            <div className="history">
              <div className="card">
                <div className="section-label">Мои пациенты</div>
                {records.length === 0 ? (
                  <div className="empty-history">Пока нет сохранённых пациентов. После структурирования нажмите «Сохранить» чтобы добавить пациента.</div>
                ) : (
                  <div className="patient-list">{records.map((r) => (<PatientItem key={r.id} record={r} onClick={() => viewRecord(r.id)} />))}</div>
                )}
              </div>
            </div>
          )}

          {view === "history" && (
            <div className="history">
              <div className="card">
                <div className="section-label">История пациентов</div>
                {records.length === 0 ? (
                  <div className="empty-history">Записей пока нет.</div>
                ) : (
                  <div className="patient-list">{records.map((r) => (<PatientItem key={r.id} record={r} onClick={() => viewRecord(r.id)} />))}</div>
                )}
              </div>
              <button onClick={newRecord} className="cta">+ Новая запись</button>
            </div>
          )}

          {view === "detail" && selectedRecord && (
            <div className="result">
              <button className="back-btn" onClick={() => setView("history")}>← Назад к списку</button>
              {renderSections(selectedRecord)}
              {selectedRecord.transcript && (<details className="transcript-details"><summary>Исходная расшифровка</summary><p className="transcript-text">{selectedRecord.transcript}</p></details>)}
              <button onClick={() => deleteRecord(selectedRecord.id)} className="delete-btn">Удалить запись</button>
            </div>
          )}

          {view === "tpl-preview" && tplPreview && (
            <div className="tpl-preview-view">
              <button className="back-btn" onClick={() => setView("editor")}>← Назад к редактору</button>
              <div className="card">
                <div className="tpl-preview-header">
                  <div>
                    <div className="tpl-preview-title">{tplPreview.name}</div>
                    <div className="tpl-preview-meta">{tplPreview.specialty} · {tplPreview.sections_count} разделов</div>
                  </div>
                </div>
              </div>
              <div className="tpl-sections-list">
                {(tplPreview.sections || []).map((sec, i) => (
                  <div key={i} className="card tpl-section-card">
                    <div className="tpl-section-title">{sec.title}</div>
                    <pre className="tpl-section-text">{sec.template_text || "(пусто)"}</pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loadingRecords && <div className="loading-overlay"><span className="spinner" /></div>}

          {/* ─── Snippet insert modal ─── */}
          {showSnippets && snippetTarget !== null && (
            <div className="modal-overlay" onClick={() => { setShowSnippets(false); setSnippetTarget(null); }}>
              <div className="modal-card" onClick={e => e.stopPropagation()}>
                <div className="modal-title">Вставить сниппет</div>
                <div className="modal-subtitle">в раздел: {result?.sections?.[snippetTarget]?.title}</div>
                <div className="modal-list">
                  {snippets.map(s => (
                    <div key={s.id} className="snip-item" onClick={() => insertSnippet(snippetTarget, s.text)}>
                      <div className="snip-label">{s.label}</div>
                      <div className="snip-preview">{s.text.slice(0, 80)}...</div>
                    </div>
                  ))}
                </div>
                <button className="modal-cancel" onClick={() => { setShowSnippets(false); setSnippetTarget(null); }}>Отмена</button>
              </div>
            </div>
          )}

          {/* ─── Snippet manager modal ─── */}
          {showSnipManager && (
            <div className="modal-overlay" onClick={() => setShowSnipManager(false)}>
              <div className="modal-card snip-manager" onClick={e => e.stopPropagation()}>
                <div className="modal-title">Мои сниппеты</div>
                <div className="snip-manager-list">
                  {snippets.map(s => (
                    <div key={s.id} className="snip-manager-item">
                      <div className="snip-manager-info">
                        <div className="snip-label">{s.label}</div>
                        <div className="snip-preview">{s.text.slice(0, 60)}...</div>
                      </div>
                      <button className="snip-delete" onClick={() => deleteSnippet(s.id)}>✕</button>
                    </div>
                  ))}
                </div>
                <div className="snip-add-form">
                  <div className="snip-add-title">Добавить сниппет</div>
                  <input className="auth-input" placeholder="Название (например: Сознание ясное)" value={newSnipLabel} onChange={e => setNewSnipLabel(e.target.value)} />
                  <textarea className="sec-edit-input" placeholder="Текст сниппета..." value={newSnipText} onChange={e => setNewSnipText(e.target.value)} style={{minHeight:80}} />
                  <button className="modal-confirm" onClick={addSnippet} disabled={!newSnipLabel.trim() || !newSnipText.trim()}>Добавить</button>
                </div>
                <button className="modal-cancel" onClick={() => setShowSnipManager(false)}>Закрыть</button>
              </div>
            </div>
          )}

          {showDiaryModal && (
            <div className="modal-overlay" onClick={() => setShowDiaryModal(false)}>
              <div className="modal-card" onClick={e => e.stopPropagation()}>
                <div className="modal-title">Выберите пациента</div>
                <div className="modal-subtitle">Дневник будет добавлен к карточке</div>
                {records.length === 0 ? (
                  <div className="modal-empty">Нет сохранённых пациентов.</div>
                ) : (
                  <div className="modal-list">
                    {records.map(r => (
                      <div key={r.id} className={`modal-patient ${diaryPatientId === r.id ? "selected" : ""}`} onClick={() => setDiaryPatientId(r.id)}>
                        <div className="modal-patient-name">{r.patient_name || "Без имени"}</div>
                        <div className="modal-patient-meta">{r.diagnosis_code && <span className="modal-code">{r.diagnosis_code}</span>}<span>{r.created_at}</span></div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="modal-actions">
                  <button className="modal-cancel" onClick={() => setShowDiaryModal(false)}>Отмена</button>
                  <button className={`modal-confirm ${!diaryPatientId || diarySaving ? "off" : ""}`} disabled={!diaryPatientId || diarySaving} onClick={saveDiaryToPatient}>
                    {diarySaving ? <><span className="spinner" />Сохраняю...</> : "Сохранить"}
                  </button>
                </div>
              </div>
            </div>
          )}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
