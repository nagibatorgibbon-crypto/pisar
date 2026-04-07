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

function SectionCard({ title, content, idx, showHints }) {
  const [copied, setCopied] = useState(false);
  const isMissing = showHints && (!content || content === "Данные не предоставлены" || content.trim() === "");
  const copy = () => { navigator.clipboard.writeText(`${title}\n${content}`); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className={`sec-card ${isMissing ? "sec-missing" : ""}`} style={{ animationDelay: `${idx * 0.06}s` }}>
      <div className="sec-head">
        <h3 className="sec-title">{isMissing && <span className="missing-dot">!</span>}{title}</h3>
        <button onClick={copy} className={`sec-copy ${copied ? "ok" : ""}`}>{copied ? "\u2713" : "Копировать"}</button>
      </div>
      <p className="sec-text">{content}</p>
      {isMissing && <div className="missing-hint">Врач не предоставил данные для этого раздела</div>}
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
  const authHeaders = {};

  // ─── App state ───
  const [view, setView] = useState("editor");
  const [spec, setSpec] = useState("therapist");
  const [uziType, setUziType] = useState("uzi_abdominal");
  const [psyMode, setPsyMode] = useState("exam");
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
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [tplUploading, setTplUploading] = useState(false);

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

  useEffect(() => { fetchRecords(); fetchTemplates(); }, []);
  const fetchRecords = async () => { try { const r = await fetch(`${API}/records`, { headers: authHeaders }); if (r.ok) setRecords(await r.json()); } catch(e){} };
  const fetchTemplates = async () => { try { const r = await fetch(`${API}/templates`, { headers: authHeaders }); if (r.ok) setTemplates(await r.json()); } catch(e){} };

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

  const renderSections = (data, showHints = false) => (
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
      <div className="sections">{(data.sections || []).map((s, i) => <SectionCard key={i} title={s.title} content={s.content} idx={i} showHints={showHints} />)}</div>
    </>
  );

  return (
    <div className="app-wrap">
      <div className="app">
        <>
          <div className="header">
            <div className="header-icon"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="7" y="2" width="4" height="14" rx="1" fill="white" opacity="0.9"/><rect x="2" y="7" width="14" height="4" rx="1" fill="white" opacity="0.9"/></svg></div>
            <div style={{flex:1}}><div className="header-title">Писарь</div><div className="header-sub">ИИ-ассистент врача</div></div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {records.length > 0 && <div className="header-badge" onClick={() => setView(view === "history" || view === "detail" ? "editor" : "history")}>{view === "history" || view === "detail" ? "← Назад" : `Пациенты (${records.length})`}</div>}
            </div>
          </div>

          {view === "editor" && (
            <>
              {/* Specialty selector */}
              <div className="card">
                <div className="section-label">Специальность</div>
                <select className="spec-select" value={spec} onChange={e => { setSpec(e.target.value); setPsyMode("exam"); setResult(null); setDiagnosis(null); }}>
                  {SPECIALTIES.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* УЗИ sub-type selector */}
              {isUzi && (
                <div className="card">
                  <div className="section-label">Тип исследования</div>
                  <select className="spec-select" value={uziType} onChange={e => { setUziType(e.target.value); setResult(null); }}>
                    {UZI_TYPES.map(u => (
                      <option key={u.key} value={u.key}>{u.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Template selector */}
              <div className="card">
                <div className="section-label">Шаблон документа</div>
                <div className="tpl-row">
                  <select className="spec-select" value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}>
                    <option value="">Стандартный (встроенный)</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.sections_count} разд.)</option>
                    ))}
                  </select>
                </div>
                <div className="tpl-actions">
                  <input ref={tplFileRef} type="file" accept=".docx" style={{display:"none"}} onChange={e => { const f = e.target.files?.[0]; if (f) uploadTemplate(f); }} />
                  <button className="tpl-upload-btn" onClick={() => tplFileRef.current?.click()} disabled={tplUploading}>
                    {tplUploading ? "Загружаю..." : "+ Загрузить свой шаблон (.docx)"}
                  </button>
                  {selectedTemplate && (
                    <button className="tpl-delete-btn" onClick={() => { if (window.confirm("Удалить шаблон?")) deleteTemplate(selectedTemplate); }}>Удалить</button>
                  )}
                </div>
              </div>

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

              {/* Source selector (not for diary) */}
              {!isDiary && (
                <div className="card">
                  <div className="section-label">Источник</div>
                  <div className="tabs">
                    <div className={`tab ${source === "mic" ? "active" : ""}`} onClick={() => setSource("mic")}><MicIcon /> Записать</div>
                    <div className={`tab ${source === "file" ? "active" : ""}`} onClick={() => setSource("file")}><UploadIcon /> Загрузить</div>
                  </div>
                  <input ref={fileRef} type="file" accept=".mp3,.wav,.m4a,.ogg,.flac,.webm,.aac,.wma,.mp4" style={{ display: "none" }} onChange={handleFile} />
                  <div className={`source-hint ${rec ? "recording" : ""} ${(transcribing || uploading) ? "processing" : ""}`} onClick={handleHintClick}>
                    {(transcribing || uploading) && <span className="hint-spinner" />}{rec && <span className="hint-dot" />}{getHint()}
                  </div>
                </div>
              )}

              {/* Text area */}
              <div className="card">
                <div className="textarea-header">
                  <div className="section-label" style={{ marginBottom: 0 }}>{isDiary ? "Данные пациента" : "Текст записи"}</div>
                  <div className="textarea-actions">
                    {wordCount > 0 && <span className="word-count">{wordCount} слов</span>}
                    {text && <button onClick={clear} className="clear-btn">Очистить</button>}
                  </div>
                </div>
                <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={isDiary ? "Введите данные пациента:\n\n1. ФИО, возраст\n2. Диагноз\n3. Терапия\n4. Анамнез\n5. Состояние" : isUzi ? "Диктуйте или вставьте описание УЗ-исследования..." : "Вставьте текст записи или используйте запись голоса..."} />
              </div>

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
                {renderSections(result, true)}
                {!isDiary && !isUzi && (
                  <>
                    <button onClick={() => getDiagnosis()} disabled={diagLoading} className="diag-btn">
                      {diagLoading ? <><span className="spinner" />Анализирую...</> : "Помощь с диагнозом"}
                    </button>
                    {diagnosis && (() => {
                      const d = diagnosis;
                      const s = (v) => (v && typeof v === 'object') ? JSON.stringify(v) : (v || '');
                      return (
                      <div className="diag-panel">
                        <div className="diag-header-row">
                          <div className="diag-header">Предварительный диагноз</div>
                          <div className="diag-warn-badge">ИИ · не окончательный</div>
                        </div>
                        <div className="diag-main">
                          <div className="diag-main-code">{s(d.icd_code)}</div>
                          <div className="diag-main-name">{s(d.diagnosis)}</div>
                        </div>
                        {d.justification && <div className="diag-section"><div className="diag-label">Обоснование</div><div className="diag-value">{s(d.justification)}</div></div>}
                        {d.differential && <div className="diag-section"><div className="diag-label">Дифф. диагноз</div><div className="diag-value">{s(d.differential)}</div></div>}
                        {d.treatment && <div className="diag-section"><div className="diag-label">Лечение</div><div className="diag-value">{s(d.treatment)}</div></div>}
                        {d.examinations && <div className="diag-section"><div className="diag-label">Обследования</div><div className="diag-value">{s(d.examinations)}</div></div>}
                      </div>
                      );
                    })()}
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
                  !saved ? <button onClick={saveRecord} className="save-btn">Сохранить в историю</button> : <div className="saved-msg">✓ Сохранено</div>
                )}
              </div>)}
            </>
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
              {result && (<div className="result">{renderSections(result, true)}{!saved ? <button onClick={saveRecord} className="save-btn">Сохранить</button> : <div className="saved-msg">✓ Сохранено</div>}</div>)}
            </div>
          )}

          {view === "history" && (
            <div className="history">
              <div className="card">
                <div className="section-label">История пациентов</div>
                {records.length === 0 ? <div className="empty-history">Записей пока нет.</div> : <div className="patient-list">{records.map((r) => <PatientItem key={r.id} record={r} onClick={() => viewRecord(r.id)} />)}</div>}
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

          {loadingRecords && <div className="loading-overlay"><span className="spinner" /></div>}

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
        </>
      </div>
    </div>
  );
}
