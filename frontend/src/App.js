import React, { useState, useRef, useCallback, useEffect } from "react";
import "./App.css";

const API = process.env.REACT_APP_API_URL || (window.location.hostname === "localhost" ? "http://localhost:8000" : "");

const SPECS = { psychiatrist: { label: "Психиатр" }, therapist: { label: "Терапевт" }, pediatrician: { label: "Педиатр" } };

const DEMOS = {
  psychiatrist: `Пациент Иванов Сергей Петрович, 42 года, обратился самостоятельно. Жалобы на сниженное настроение в течение последних трёх месяцев, нарушения сна, снижение аппетита, потерю интереса. Отмечает трудности концентрации, чувство вины. Суицидальные мысли отрицает. Анамнез: первый эпизод два года назад после развода. Текущий эпизод связывает с увольнением. Наследственность: мать — депрессия. Курит 10 сигарет/день. Алкоголь умеренно. Психический статус: сознание ясное, ориентирован верно. Настроение сниженное, мышление замедленное, идеи самообвинения. Галлюцинаций нет. Критика сохранена. АД 130/85, пульс 72. Диагноз: F33.1 рекуррентное депрессивное расстройство, средней степени. Назначения: сертралин 50 мг утром, миртазапин 15 мг на ночь. КПТ 1 раз/нед. Повтор через 2 недели.`,
  psychiatrist_diary: `Пациент Воронович, 25 лет. Диагноз: F32.1 Депрессивный эпизод средней степени. Терапия: сертралин 100 мг утром, кветиапин 25 мг на ночь.\n\nАнамнез: Рос замкнутым ребёнком, в школе подвергался издевательствам из-за лишнего веса. Работает удалённо программистом. Не женат, в отношениях. Жалобы при поступлении: отсутствие настроения и эмоций, нарушения сна, фантазии о причинении вреда себе и окружающим. Курит 1 пачку в день.\n\nТекущее состояние: На фоне терапии отмечает улучшение сна, засыпает легче. Сохраняется некоторая сонливость днём. Фантазии стали менее навязчивыми. Аппетит нестабильный. Настроение ровное, без выраженных колебаний.`,
  therapist: `Пациентка Козлова Мария Ивановна 56 лет, давящие головные боли, АД до 160/100, головокружение. Гипертензия 5 лет, лозартан 50 мг нерегулярно. Аллергия на пенициллин. Мать — инсульт. ИМТ 31, АД 155/95, пульс 78. Диагноз: ГБ II ст., I11.9. Назначения: лозартан 100 мг, амлодипин 5 мг. Повтор через 2 нед.`,
  pediatrician: `Ребёнок Петров Алексей, 4 года, t 38.5, кашель, насморк 2 дня. Аллергия на амоксициллин. Осмотр: t 37.8, зев гиперемирован, дыхание жёсткое. Вес 17 кг, рост 104 см. Диагноз: ОРВИ, трахеобронхит J20.9. Назначения: ибупрофен, ингаляции, амброксол. Повтор через 3 дня.`,
};

const MicIcon = () => (<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3.5" fill="currentColor"/><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/></svg>);
const UploadIcon = () => (<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 10V3M5.5 5.5L8 3l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 12h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>);

function SectionCard({ title, content, idx }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(`${title}\n${content}`); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="sec-card" style={{ animationDelay: `${idx * 0.06}s` }}>
      <div className="sec-head">
        <h3 className="sec-title">{title}</h3>
        <button onClick={copy} className={`sec-copy ${copied ? "ok" : ""}`}>{copied ? "\u2713" : "Копировать"}</button>
      </div>
      <p className="sec-text">{content}</p>
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
  const [diaryPeriod, setDiaryPeriod] = useState("1week");
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const mrRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);

  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const isDiary = spec === "psychiatrist" && psyMode === "diary";
  const getSpecKey = () => isDiary ? "psychiatrist_diary" : spec;
  const DIARY_PERIODS = { "1week": "1 неделя", "2weeks": "2 недели", "1month": "1 месяц" };

  useEffect(() => { fetchRecords(); }, []);
  const fetchRecords = async () => { try { const r = await fetch(`${API}/records`); if (r.ok) setRecords(await r.json()); } catch(e){} };

  const startRec = useCallback(async () => {
    setErr("");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErr("Запись голоса недоступна. Для записи с микрофона откройте приложение через HTTPS или используйте загрузку файла.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Определяем поддерживаемый формат (Safari/iOS не поддерживает webm)
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
      mr.onstop = async () => { await sendAudio(new Blob(chunksRef.current, { type: selectedMime || "audio/webm" }), `recording.${ext}`, "mic"); };
      mrRef.current = mr; mr.start(1000); setRec(true); setTime(0);
      timerRef.current = setInterval(() => setTime((p) => p + 1), 1000);
    } catch (e) { setErr(e.name === "NotAllowedError" ? "Доступ к микрофону запрещён. Разрешите в настройках браузера." : `Ошибка: ${e.message}`); }
  }, []);

  const stopRec = useCallback(() => {
    if (mrRef.current?.state !== "inactive") mrRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop()); setRec(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const handleFile = async (e) => { const f = e.target.files?.[0]; if (!f) return; setUploadName(f.name); await sendAudio(f, f.name, "file"); if (fileRef.current) fileRef.current.value = ""; };

  const sendAudio = async (blob, filename, src = "mic") => {
    if (src === "mic") setTranscribing(true); else setUploading(true); setErr("");
    try {
      const fd = new FormData(); fd.append("audio", blob, filename);
      const res = await fetch(`${API}/transcribe`, { method: "POST", body: fd });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Ошибка"); }
      const d = await res.json(); setText((prev) => (prev ? prev + " " + d.text : d.text));
    } catch (e) { setErr(`Ошибка распознавания: ${e.message}`); }
    finally { setTranscribing(false); setUploading(false); setUploadName(""); }
  };

  const process = async () => {
    const t = text.trim(); if (!t) return setErr("Нет текста.");
    setLoading(true); setErr(""); setResult(null); setSaved(false);
    try {
      let sendText = t;
      if (isDiary) {
        sendText = `Период генерации дневников: ${DIARY_PERIODS[diaryPeriod]}.\n\n${t}`;
      }
      const fd = new FormData(); fd.append("text", sendText); fd.append("specialty", getSpecKey());
      const res = await fetch(`${API}/structure`, { method: "POST", body: fd });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Ошибка"); }
      setResult(await res.json());
    } catch (e) { setErr(`Ошибка: ${e.message}`); } finally { setLoading(false); }
  };

  const saveRecord = async () => {
    if (!result) return;
    try {
      const fd = new FormData();
      fd.append("patient_name", result.patient_name || "");
      fd.append("diagnosis_code", result.diagnosis_code || "");
      fd.append("specialty", isDiary ? "Психиатр (дневник)" : (SPECS[spec]?.label || spec));
      fd.append("summary", result.summary || "");
      fd.append("sections", JSON.stringify(result.sections || []));
      fd.append("transcript", text);
      const res = await fetch(`${API}/records`, { method: "POST", body: fd });
      if (res.ok) { setSaved(true); fetchRecords(); }
    } catch (e) { setErr(`Ошибка сохранения: ${e.message}`); }
  };

  const viewRecord = async (id) => {
    setLoadingRecords(true);
    try { const r = await fetch(`${API}/records/${id}`); if (r.ok) { setSelectedRecord(await r.json()); setView("detail"); } }
    catch (e) { setErr("Не удалось загрузить."); } finally { setLoadingRecords(false); }
  };

  const deleteRecord = async (id) => {
    try { await fetch(`${API}/records/${id}`, { method: "DELETE" }); fetchRecords(); if (selectedRecord?.id === id) { setSelectedRecord(null); setView("history"); } } catch(e){}
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
  const clear = () => { setText(""); setResult(null); setErr(""); setTime(0); setSaved(false); };
  const newRecord = () => { clear(); setView("editor"); };
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const getHint = () => {
    if (source === "mic") { if (transcribing) return "Распознаю запись..."; if (rec) return `Идёт запись — ${fmt(time)}. Нажмите для остановки.`; return "Нажмите, чтобы начать запись голоса"; }
    if (uploading) return `Распознаю: ${uploadName || "файл"}...`; return "Нажмите, чтобы выбрать аудиофайл (MP3, WAV, M4A)";
  };
  const handleHintClick = () => { if (source === "mic") { rec ? stopRec() : startRec(); } else { if (!uploading) fileRef.current?.click(); } };

  const renderSections = (data) => (
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
      {data.summary && <div className="summary">{data.summary}</div>}
      <div className="sections">{(data.sections || []).map((s, i) => <SectionCard key={i} title={s.title} content={s.content} idx={i} />)}</div>
    </>
  );

  return (
    <div className="app-wrap">
      <div className="app">
        <div className="header">
          <div className="header-icon"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="7" y="2" width="4" height="14" rx="1" fill="white" opacity="0.9"/><rect x="2" y="7" width="14" height="4" rx="1" fill="white" opacity="0.9"/></svg></div>
          <div style={{flex:1}}><div className="header-title">Писарь</div><div className="header-sub">ИИ-структурирование медицинских записей</div></div>
          {records.length > 0 && <div className="header-badge" onClick={() => setView(view === "history" || view === "detail" ? "editor" : "history")}>{view === "history" || view === "detail" ? "← Назад" : `Пациенты (${records.length})`}</div>}
        </div>

        {view === "editor" && (
          <>
            <div className="card">
              <div className="section-label">Специальность</div>
              <div className="chips">{Object.entries(SPECS).map(([k, v]) => (<div key={k} className={`chip ${spec === k ? "active" : ""}`} onClick={() => setSpec(k)}>{v.label}</div>))}</div>
            </div>

            {spec === "psychiatrist" && (
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
                <div className="section-label">Период дневников</div>
                <div className="chips">
                  <div className={`chip ${diaryPeriod === "1week" ? "active" : ""}`} onClick={() => setDiaryPeriod("1week")}>1 неделя</div>
                  <div className={`chip ${diaryPeriod === "2weeks" ? "active" : ""}`} onClick={() => setDiaryPeriod("2weeks")}>2 недели</div>
                  <div className={`chip ${diaryPeriod === "1month" ? "active" : ""}`} onClick={() => setDiaryPeriod("1month")}>1 месяц</div>
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
                <div className="section-label" style={{ marginBottom: 0 }}>{isDiary ? "Анамнез + текущее состояние" : "Текст записи"}</div>
                <div className="textarea-actions">
                  {wordCount > 0 && <span className="word-count">{wordCount} слов</span>}
                  {text && <button onClick={clear} className="clear-btn">Очистить</button>}
                </div>
              </div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={isDiary ? "Вставьте данные пациента:\n\n1. ФИО, возраст\n2. Диагноз (МКБ-10)\n3. Текущая терапия (препараты, дозировки)\n4. Анамнез (кратко)\n5. Текущее состояние\n\nНа основе этих данных будут сгенерированы дневники за выбранный период." : "Вставьте текст медицинской записи или используйте запись голоса..."} />
            </div>

            <button onClick={process} disabled={loading || !text.trim()} className={`cta ${loading || !text.trim() ? "off" : ""}`}>
              {loading ? <><span className="spinner" />{isDiary ? `Составляю дневники за ${DIARY_PERIODS[diaryPeriod]}...` : "Структурирую..."}</> : isDiary ? `Составить дневники за ${DIARY_PERIODS[diaryPeriod]}` : "Структурировать запись"}
            </button>
            <a href="#" className="demo-link" onClick={loadDemo}>{isDiary ? "Загрузить пример для дневника →" : "Попробовать демо-запись →"}</a>

            {err && <div className="error">{err}</div>}
            {result && (<div className="result">{renderSections(result)}{!saved ? <button onClick={saveRecord} className="save-btn">Сохранить в историю пациентов</button> : <div className="saved-msg">✓ Сохранено в историю</div>}</div>)}
          </>
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
      </div>
    </div>
  );
}
