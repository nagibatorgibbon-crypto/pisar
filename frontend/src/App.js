import React, { useState, useRef, useCallback, useEffect } from "react";
import "./App.css";

const API = process.env.REACT_APP_API_URL || (window.location.hostname === "localhost" ? "http://localhost:8000" : "");

const SPECS = {
  psychiatrist:       { label: "Психиатр ПНД",       hasDiary: true,  diaryKey: "psychiatrist_pnd_diary" },
  psychiatrist_stac:  { label: "Психиатр стационара", hasDiary: true,  diaryKey: "psychiatrist_stac_diary" },
};

const DEMOS = {
  psychiatrist: `Пациент Иванов Сергей Петрович, 42 года, обратился самостоятельно. Жалобы на сниженное настроение в течение последних трёх месяцев, нарушения сна, снижение аппетита, потерю интереса. Отмечает трудности концентрации, чувство вины. Суицидальные мысли отрицает. Анамнез: первый эпизод два года назад после развода. Текущий эпизод связывает с увольнением. Наследственность: мать — депрессия. Курит 10 сигарет/день. Алкоголь умеренно. Психический статус: сознание ясное, ориентирован верно. Настроение сниженное, мышление замедленное, идеи самообвинения. Галлюцинаций нет. Критика сохранена. АД 130/85, пульс 72. Диагноз: F33.1 рекуррентное депрессивное расстройство, средней степени. Назначения: сертралин 50 мг утром, миртазапин 15 мг на ночь. КПТ 1 раз/нед. Повтор через 2 недели.`,
  psychiatrist_stac: `Пациентка Смирнова Ольга Фанасьевна, 44 года, доставлена бригадой СМП в сопровождении соседей. Со слов соседей: в течение 2 недель ведёт себя неадекватно, не спит ночами, кричит, называет себя известными именами. Анамнез жизни: уроженка г. Тобольска, образование среднее, работала оператором на заводе, в данный момент не работает, живёт одна. Анамнез заболевания: наблюдается у психиатра с 2019 года, диагноз F20.0, неоднократные госпитализации. Последняя выписка 6 месяцев назад на галоперидоле 5 мг. Терапию принимала нерегулярно, 3 недели назад самостоятельно прекратила. Психический статус: возбуждена, дурашлива, называет себя дочерью Григория Распутина, высказывает идеи особого происхождения и родства с историческими личностями, мышление разорванное, обманы восприятия отрицает, критика отсутствует. АД 125/80, пульс 88.`,
  psychiatrist_pnd_diary: `Пациент Воронович, 25 лет. Диагноз: F32.1 Депрессивный эпизод средней степени. Терапия: сертралин 100 мг утром, кветиапин 25 мг на ночь. Анамнез: работает программистом удалённо, не женат. Жалобы при поступлении: отсутствие настроения, нарушения сна. Текущее состояние: на фоне терапии сон улучшился, сохраняется эмоциональное уплощение, тревожность снизилась.`,
  psychiatrist_stac_diary: `Пациентка Смирнова О.Ф., 44 года. Диагноз: F20.0 Параноидная шизофрения, непрерывный тип течения, параноидный синдром. Терапия: галоперидол 10 мг/сут, циклодол 4 мг/сут, феназепам 1 мг на ночь. Поступила в возбуждённом состоянии с бредовыми идеями величия и особого происхождения, разорванностью мышления.`,
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
  // ─── No auth — open access ───
  const authHeaders = {};

  // ─── App state ───
  const [view, setView] = useState("editor");
  const [spec, setSpec] = useState("psychiatrist");
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

  const mrRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const templateRef = useRef(null);

  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const isDiary = psyMode === "diary" && !!SPECS[spec]?.hasDiary;
  const getSpecKey = () => {
    if (isDiary) return SPECS[spec]?.diaryKey || "psychiatrist_pnd_diary";
    if (spec === "psychiatrist_stac") return "psychiatrist_stac_exam";
    if (spec === "psychiatrist") return "psychiatrist_pnd";
    return spec;
  };
  // Даты дневника
  const today = new Date().toISOString().split("T")[0];

  // Безопасное чтение ошибки — если сервер вернул не JSON (например "Service Unavailable")
  const getErrMsg = async (res) => {

    try {
      const d = await res.json();
      return d.detail || d.message || `Ошибка ${res.status}`;
    } catch {
      return `Ошибка сервера ${res.status} — попробуйте ещё раз`;
    }
  };

  // ─── Auth functions ───


  useEffect(() => { fetchRecords(); }, []);
  const fetchRecords = async () => { try { const r = await fetch(`${API}/records`, { headers: authHeaders }); if (r.ok) setRecords(await r.json()); } catch(e){} };

  const startRec = useCallback(async () => {
    setErr("");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErr("Запись голоса недоступна. Для записи с микрофона откройте приложение через HTTPS или используйте загрузку файла.");
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
      let chunkNum = 0;

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      // Автоотправка каждые 5 минут (не прерывая запись)
      const autoSendInterval = setInterval(() => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: selectedMime || "audio/webm" });
          chunksRef.current = [];
          chunkNum++;
          sendAudio(blob, `chunk_${chunkNum}.${ext}`, "chunk");
        }
      }, 5 * 60 * 1000); // 5 минут

      mr.onstop = async () => {
        clearInterval(autoSendInterval);
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: selectedMime || "audio/webm" });
          setSavedAudio(blob); setSavedAudioName(`recording.${ext}`);
          await sendAudio(blob, `recording_final.${ext}`, "mic");
        }
      };

      mrRef.current = mr; mr.start(1000); setRec(true); setTime(0);
      timerRef.current = setInterval(() => setTime((p) => p + 1), 1000);
    } catch (e) { setErr(e.name === "NotAllowedError" ? "Доступ к микрофону запрещён. Разрешите в настройках браузера." : `Ошибка: ${e.message}`); }
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
    // src === "chunk" — фоновая отправка, не меняем состояние UI
    if (src !== "chunk") setErr("");
    try {
      const fd = new FormData(); fd.append("audio", blob, filename);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 мин таймаут
      const res = await fetch(`${API}/transcribe`, { method: "POST", body: fd, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) { throw new Error(await getErrMsg(res)); }
      const d = await res.json(); setText((prev) => (prev ? prev + " " + d.text : d.text));
      if (src !== "chunk") { setSavedAudio(null); setSavedAudioName(""); }
    } catch (e) {
      if (e.name === "AbortError") {
        setErr("Превышено время ожидания (10 мин). Попробуйте записать короче или загрузить файл меньшего размера.");
      } else {
        setErr(`Ошибка распознавания: ${e.message}. Аудио сохранено — нажмите "Повторить".`);
      }
    }
    finally {
      if (src === "mic") setTranscribing(false);
      if (src === "file") { setUploading(false); setUploadName(""); }
    }
  };

  const retryAudio = async () => {
    if (!savedAudio) return;
    await sendAudio(savedAudio, savedAudioName, "file");
  };

  const process = async (customSpecialty) => {
    const t = text.trim(); if (!t) return setErr("Нет текста.");
    setLoading(true); setErr(""); setResult(null); setSaved(false); setDiagnosis(null);
    try {
      let sendText = t;
      if (isDiary) {
        const from = diaryDateFrom || new Date().toISOString().split("T")[0];
        const to = diaryDateTo || new Date(Date.now() + 14*24*60*60*1000).toISOString().split("T")[0];
        // Считаем количество записей (раз в 3 дня)
        const msFrom = new Date(from).getTime();
        const msTo = new Date(to).getTime();
        const days = Math.round((msTo - msFrom) / (1000*60*60*24));
        const count = Math.max(1, Math.round(days / 3));
        sendText = `Период ведения дневника: с ${from} по ${to} включительно.\nКоличество записей: ${count} (одна запись каждые 3 дня).\nДаты записей: равномерно распределить ${count} записей между ${from} и ${to}, через каждые 3 дня.\n\n${t}`;
      }
      }
      const fd = new FormData(); fd.append("text", sendText); fd.append("specialty", customSpecialty || getSpecKey());
      const res = await fetch(`${API}/structure`, { method: "POST", body: fd });
      if (!res.ok) { throw new Error(await getErrMsg(res)); }
      const r = await res.json();
      setResult(r); setView("editor");
    } catch (e) { setErr(`Ошибка: ${e.message}`); } finally { setLoading(false); }
  };

  const processWithTemplate = async () => {
    if (!templateFile || !text.trim()) return setErr("Загрузите шаблон и убедитесь, что есть текст.");
    setLoading(true); setErr(""); setResult(null); setSaved(false); setDiagnosis(null);
    try {
      const fd = new FormData();
      fd.append("text", text.trim());
      fd.append("template", templateFile);
      const res = await fetch(`${API}/structure-template`, { method: "POST", body: fd });
      if (!res.ok) { throw new Error(await getErrMsg(res)); }
      const r = await res.json();
      setResult(r); setView("editor"); setTemplateFile(null);
    } catch (e) { setErr(`Ошибка: ${e.message}`); } finally { setLoading(false); }
  };

  const saveRecord = async () => {
    if (!result) return;
    try {
      const fd = new FormData();
      fd.append("patient_name", result.patient_name || "");
      fd.append("diagnosis_code", result.diagnosis_code || "");
      fd.append("specialty", SPECS[spec]?.label + (isDiary ? " (дневник)" : "") || spec);
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
      if (!res.ok) { throw new Error(await getErrMsg(res)); }
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
      if (!res.ok) { throw new Error(await getErrMsg(res)); }
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

  const loadDemo = (e) => { e.preventDefault(); setText(DEMOS[getSpecKey()] || DEMOS[spec]); setResult(null); setErr(""); setSaved(false); };
  const copyAll = () => {
    const r = view === "detail" ? selectedRecord : result; if (!r) return;
    const p = [];
    if (r.patient_name) p.push(`Пациент: ${r.patient_name}`);
    if (r.diagnosis_code) p.push(`Код МКБ-10: ${r.diagnosis_code}`);
    p.push("");
    (r.sections || []).forEach((s) => {
      if (s.content && s.content !== "Данные не предоставлены") {
        p.push(`${s.title}: ${s.content}`);
      }
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
      fd.append("specialty", r.specialty || SPECS[spec]?.label || "");
      fd.append("summary", r.summary || "");
      fd.append("sections", JSON.stringify(r.sections || []));
      const res = await fetch(`${API}/export-word`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Ошибка генерации документа");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `ПО_${r.patient_name?.split(" ")[0] || "пациент"}.docx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) { setErr(`Ошибка скачивания: ${e.message}`); }
  };
  const clear = () => { setText(""); setResult(null); setErr(""); setTime(0); setSaved(false); setDiagnosis(null); };
  const newRecord = () => { clear(); setView("editor"); };
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const getHint = () => {
    if (source === "mic") { if (transcribing) return "Распознаю запись..."; if (rec) return `Идёт запись — ${fmt(time)}. Нажмите для остановки.`; return "Нажмите, чтобы начать запись голоса"; }
    if (uploading) return `Распознаю: ${uploadName || "файл"}...`; return "Нажмите, чтобы выбрать аудиофайл (MP3, WAV, M4A)";
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
        <div className="hints-banner">Разделы, отмеченные красным, не заполнены — врач не предоставил данные. При копировании и скачивании в Word они не будут включены.</div>
      )}
      {data.summary && <div className="summary">{data.summary}</div>}
      <div className="sections">{(data.sections || []).map((s, i) => <SectionCard key={i} title={s.title} content={s.content} idx={i} showHints={showHints} />)}</div>
    </>
  );

  return (
    <div className="app-wrap">
      <div className="app">

        {/* ═══ MAIN APP ═══ */}
        <>
            <div className="header">
              <div className="header-icon"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="7" y="2" width="4" height="14" rx="1" fill="white" opacity="0.9"/><rect x="2" y="7" width="14" height="4" rx="1" fill="white" opacity="0.9"/></svg></div>
              <div style={{flex:1}}><div className="header-title">Писарь</div><div className="header-sub">ИИ-ассистент психиатра</div></div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {records.length > 0 && <div className="header-badge" onClick={() => setView(view === "history" || view === "detail" ? "editor" : "history")}>{view === "history" || view === "detail" ? "← Назад" : `Пациенты (${records.length})`}</div>}
              </div>
            </div>

        {view === "editor" && (
          <>
            <div className="card">
              <div className="section-label">Специальность</div>
              <div className="chips">
                <div className="chip active">Психиатр</div>
              </div>
              <div className="tabs" style={{marginTop:10}}>
                <div className={`tab ${spec === "psychiatrist" ? "active" : ""}`} onClick={() => { setSpec("psychiatrist"); setPsyMode("exam"); setResult(null); setDiagnosis(null); }}>ПНД</div>
                <div className={`tab ${spec === "psychiatrist_stac" ? "active" : ""}`} onClick={() => { setSpec("psychiatrist_stac"); setPsyMode("exam"); setResult(null); setDiagnosis(null); }}>Стационар</div>
              </div>
            </div>

            {SPECS[spec]?.hasDiary && (
              <div className="card">
                <div className="section-label">Тип документа</div>
                <div className="tabs">
                  <div className={`tab ${psyMode === "exam" ? "active" : ""}`} onClick={() => setPsyMode("exam")}>Первичный осмотр</div>
                  <div className={`tab ${psyMode === "diary" ? "active" : ""}`} onClick={() => setPsyMode("diary")}>Дневник</div>
                </div>
              </div>
            )}

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

            <div className="card">
              <div className="textarea-header">
                <div className="section-label" style={{ marginBottom: 0 }}>{isDiary ? "Данные пациента" : "Текст записи"}</div>
                <div className="textarea-actions">
                  {wordCount > 0 && <span className="word-count">{wordCount} слов</span>}
                  {text && <button onClick={clear} className="clear-btn">Очистить</button>}
                </div>
              </div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={isDiary ? "Введите данные пациента:\n\n1. ФИО, возраст\n2. Диагноз (МКБ-10)\n3. Текущая терапия (препараты, дозировки)\n4. Анамнез (кратко)\n5. Текущее состояние" : "Вставьте текст медицинской записи или используйте запись голоса..."} />
            </div>

            {isDiary ? (
              <div className="cta-group">
                <button onClick={() => process()} disabled={loading || !text.trim()} className={`cta ${loading || !text.trim() ? "off" : ""}`}>
                  {loading ? <><span className="spinner" />Составляю дневники...</> : "Составить дневники"}
                </button>
                <button onClick={() => setView("template")} disabled={loading || !text.trim()} className={`cta cta-alt ${loading || !text.trim() ? "off" : ""}`}>
                  По загруженному шаблону
                </button>
              </div>
            ) : (
              <div className="cta-group">
                <button onClick={() => process()} disabled={loading || !text.trim()} className={`cta ${loading || !text.trim() ? "off" : ""}`}>
                  {loading ? <><span className="spinner" />Структурирую...</> : "Структурировать по стандарту"}
                </button>
                <button onClick={() => setView("template")} disabled={loading || !text.trim()} className={`cta cta-alt ${loading || !text.trim() ? "off" : ""}`}>
                  По загруженному шаблону
                </button>
              </div>
            )}
            <a href="#" className="demo-link" onClick={loadDemo}>{isDiary ? "Загрузить пример для дневника →" : "Попробовать демо-запись →"}</a>

            {savedAudio && !transcribing && !uploading && (
              <div className="retry-bar">
                <span>Аудио сохранено ({savedAudioName})</span>
                <button onClick={retryAudio} className="retry-btn">Повторить расшифровку</button>
              </div>
            )}

            {err && <div className="error">{err}</div>}
            {result && (<div className="result">
              {renderSections(result, true)}
              {!isDiary && (
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
                      {d.differential && <div className="diag-section"><div className="diag-label">Дифференциальный диагноз</div><div className="diag-value">{s(d.differential)}</div></div>}
                      {d.treatment && <div className="diag-section"><div className="diag-label">Рекомендованное лечение</div><div className="diag-value">{s(d.treatment)}</div></div>}
                      {d.examinations && <div className="diag-section"><div className="diag-label">Рекомендуемые обследования</div><div className="diag-value">{s(d.examinations)}</div></div>}
                    </div>
                    );
                  })()}
                </>
              )}
              {isDiary ? (
                <div className="diary-save-row">
                  {diarySaved && <div className="saved-msg">✓ Дневник добавлен к пациенту</div>}
                  {!diarySaved && (
                    <>
                      <button onClick={() => { setShowDiaryModal(true); setDiaryPatientId(""); }} className="save-btn">
                        Сохранить дневник к пациенту
                      </button>
                      {!saved && <button onClick={saveRecord} className="save-btn save-btn-new">Сохранить как нового пациента</button>}
                      {saved && <div className="saved-msg">✓ Сохранено</div>}
                    </>
                  )}
                </div>
              ) : (
                !saved ? <button onClick={saveRecord} className="save-btn">Сохранить в историю пациентов</button> : <div className="saved-msg">✓ Сохранено в историю</div>
              )}
            </div>)}
          </>
        )}

        {view === "template" && (
          <div className="template-view">
            <button className="back-btn" onClick={() => setView("editor")}>← Назад к редактору</button>
            <div className="card">
              <div className="section-label">Расшифрованный текст</div>
              <div className="template-text">{text || "Нет текста"}</div>
            </div>
            <div className="card">
              <div className="section-label">Загрузите шаблон документа</div>
              <p className="template-desc">Загрузите пример документа (.docx или .txt) — программа извлечёт структуру разделов и заполнит их на основе расшифрованного текста.</p>
              <input type="file" ref={templateRef} accept=".docx,.txt,.doc" style={{display:"none"}} onChange={(e) => { const f = e.target.files?.[0]; if (f) setTemplateFile(f); }} />
              <div className="template-upload" onClick={() => templateRef.current?.click()}>
                {templateFile ? (
                  <div className="template-file-info">
                    <span className="template-file-name">{templateFile.name}</span>
                    <span className="template-file-change">Изменить</span>
                  </div>
                ) : "Нажмите, чтобы загрузить шаблон (.docx, .txt)"}
              </div>
              <button onClick={processWithTemplate} disabled={loading || !templateFile} className={`cta ${loading || !templateFile ? "off" : ""}`} style={{marginTop: 12}}>
                {loading ? <><span className="spinner" />Структурирую по шаблону...</> : "Структурировать по шаблону"}
              </button>
            </div>
            {err && <div className="error">{err}</div>}
            {result && (<div className="result">{renderSections(result, true)}{!saved ? <button onClick={saveRecord} className="save-btn">Сохранить в историю пациентов</button> : <div className="saved-msg">✓ Сохранено в историю</div>}</div>)}
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
              <div className="modal-subtitle">Дневниковая запись будет добавлена к карточке пациента</div>
              {records.length === 0 ? (
                <div className="modal-empty">Нет сохранённых пациентов. Сначала создайте карточку через «Первичный осмотр».</div>
              ) : (
                <div className="modal-list">
                  {records.map(r => (
                    <div
                      key={r.id}
                      className={`modal-patient ${diaryPatientId === r.id ? "selected" : ""}`}
                      onClick={() => setDiaryPatientId(r.id)}
                    >
                      <div className="modal-patient-name">{r.patient_name || "Без имени"}</div>
                      <div className="modal-patient-meta">{r.diagnosis_code && <span className="modal-code">{r.diagnosis_code}</span>}<span>{r.created_at}</span></div>
                    </div>
                  ))}
                </div>
              )}
              <div className="modal-actions">
                <button className="modal-cancel" onClick={() => setShowDiaryModal(false)}>Отмена</button>
                <button
                  className={`modal-confirm ${!diaryPatientId || diarySaving ? "off" : ""}`}
                  disabled={!diaryPatientId || diarySaving}
                  onClick={saveDiaryToPatient}
                >
                  {diarySaving ? <><span className="spinner" />Сохраняю...</> : "Сохранить дневник"}
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
