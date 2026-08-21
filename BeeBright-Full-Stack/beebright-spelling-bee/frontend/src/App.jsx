import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Flame,
  Headphones,
  Keyboard,
  Lightbulb,
  RotateCcw,
  Settings,
  Sparkles,
  Upload,
  Volume2,
  X,
} from "lucide-react";

import {
  deleteSavedProgress,
  getDictionary,
  getLevels,
  getPracticeSet,
  getSavedProgress,
  saveProgress,
  uploadWordPdf,
} from "./api.js";

const SESSION_KEY = "beebright-session-v2";

const MODES = [
  { key: "flash", name: "Flash Cards", description: "Reveal the word, then move forward.", icon: Sparkles },
  { key: "blank", name: "Fill in the Blank", description: "Complete the missing word in context.", icon: BookOpen },
  { key: "choice", name: "Multiple Choice", description: "Listen, then choose the right spelling.", icon: Headphones },
  { key: "type", name: "Type the Word", description: "Listen and spell the whole word yourself.", icon: Keyboard },
];

const EMPTY_DICTIONARY = {
  definition: "Loading definition...",
  origin: "Loading word origin...",
  sentence: "Loading example sentence...",
  pronunciation: "",
  audio_url: "",
  found: false,
};

function labelForLevel(key) {
  return ({ one_bee: "One Bee", two_bee: "Two Bee", three_bee: "Three Bee", random: "Random" })[key] || key;
}

function hideSpelling(text, word, replacement) {
  if (!text || !word) return text;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`\\b${escaped}(?:s|es|ed|ing|ly)?\\b`, "gi"), replacement);
}

function speakWithBrowser(word) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.rate = 0.72;
  window.speechSynthesis.speak(utterance);
}

function App({ userId, getToken, onOpenSettings }) {
  const [screen, setScreen] = useState("home");
  const [mode, setMode] = useState("choice");
  const [levels, setLevels] = useState([]);
  const [level, setLevel] = useState("one_bee");
  const [setOffset, setSetOffset] = useState(0);
  const [words, setWords] = useState([]);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [dictionary, setDictionary] = useState(EMPTY_DICTIONARY);
  const [hint, setHint] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [savedSession, setSavedSession] = useState(null);
  const [imported, setImported] = useState(null);
  const audioRef = useRef(null);
  const saveTimerRef = useRef(null);
  const sessionKey = `${SESSION_KEY}:${userId}`;

  const current = words[index];
  const currentWord = current?.word || "";
  const choices = current?.options || [];
  const activeMode = MODES.find((item) => item.key === mode) || MODES[2];

  useEffect(() => {
    getLevels().then(setLevels).catch(() => setMessage("Backend is not connected yet. Check VITE_API_BASE_URL."));
    const local = localStorage.getItem(sessionKey);
    if (local) setResumeAvailable(true);

    let cancelled = false;
    getToken()
      .then((token) => token && getSavedProgress(token))
      .then((result) => {
        if (!cancelled && result?.session?.words?.length) {
          setSavedSession(result.session);
          setResumeAvailable(true);
        }
      })
      .catch(() => {
        // A local per-user copy remains available when Neon is waking up.
      });
    return () => { cancelled = true; };
  }, [getToken, sessionKey]);

  useEffect(() => {
    if (!currentWord || screen !== "practice") return;
    let cancelled = false;
    setDictionary(EMPTY_DICTIONARY);
    getDictionary(currentWord)
      .then((result) => !cancelled && setDictionary(result))
      .catch(() => !cancelled && setDictionary({ ...EMPTY_DICTIONARY, definition: "Dictionary information is temporarily unavailable." }));
    return () => { cancelled = true; };
  }, [currentWord, screen]);

  useEffect(() => {
    if (screen !== "practice" || !words.length) return;
    const session = {
      mode, level, setOffset, words, index, correct, streak, bestStreak,
    };
    localStorage.setItem(sessionKey, JSON.stringify(session));
    setSavedSession(session);
    setResumeAvailable(true);
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        const token = await getToken();
        if (token) await saveProgress(token, session);
      } catch {
        // Local storage remains a same-device fallback.
      }
    }, 350);
    return () => window.clearTimeout(saveTimerRef.current);
  }, [screen, mode, level, setOffset, words, index, correct, streak, bestStreak, getToken, sessionKey]);

  function playWord() {
    if (dictionary.audio_url) {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(dictionary.audio_url);
      audioRef.current = audio;
      audio.play().catch(() => speakWithBrowser(currentWord));
    } else {
      speakWithBrowser(currentWord);
    }
  }

  async function startPractice(nextOffset = 0) {
    setBusy(true);
    setMessage("");
    try {
      let selectedWords;
      if (imported) {
        const matching = imported.words.filter((item) => item.level === level);
        const source = matching.length ? matching : imported.words;
        selectedWords = source.slice(nextOffset, nextOffset + 100);
        if (!selectedWords.length) selectedWords = source.slice(0, 100);
      } else {
        const response = await getPracticeSet(level, nextOffset, false);
        selectedWords = response.words;
      }
      setWords(selectedWords);
      setSetOffset(nextOffset);
      setIndex(0);
      setCorrect(0);
      setStreak(0);
      setBestStreak(0);
      setAnswer("");
      setFeedback(null);
      setRevealed(false);
      setHint(null);
      setScreen("practice");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  function resume() {
    try {
      const saved = savedSession || JSON.parse(localStorage.getItem(sessionKey));
      if (!saved?.words?.length) return;
      setMode(saved.mode);
      setLevel(saved.level);
      setSetOffset(saved.setOffset || 0);
      setWords(saved.words);
      setIndex(saved.index || 0);
      setCorrect(saved.correct || 0);
      setStreak(saved.streak || 0);
      setBestStreak(saved.bestStreak || 0);
      setScreen("practice");
    } catch {
      localStorage.removeItem(sessionKey);
      setResumeAvailable(false);
    }
  }

  function checkAnswer(value = answer) {
    if (!value.trim() || feedback) return;
    const isCorrect = value.trim().toLocaleLowerCase() === currentWord.toLocaleLowerCase();
    setAnswer(value);
    setFeedback(isCorrect ? "correct" : "incorrect");
    if (isCorrect) {
      setCorrect((count) => count + 1);
      setStreak((value) => {
        const next = value + 1;
        setBestStreak((best) => Math.max(best, next));
        return next;
      });
    } else {
      setStreak(0);
    }
  }

  function nextQuestion() {
    if (index >= words.length - 1) {
      localStorage.removeItem(sessionKey);
      setResumeAvailable(false);
      setSavedSession(null);
      getToken().then((token) => token && deleteSavedProgress(token)).catch(() => {});
      setScreen("results");
      return;
    }
    setIndex((value) => value + 1);
    setAnswer("");
    setFeedback(null);
    setRevealed(false);
    setHint(null);
  }

  async function importPdf(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage("Reading levels and words from your PDF...");
    try {
      const result = await uploadWordPdf(file);
      setImported(result);
      setLevels(result.levels);
      setLevel(result.levels[0]?.key || "random");
      localStorage.setItem("beebright-imported-list-v1", JSON.stringify(result));
      setMessage(`Loaded ${result.words.length.toLocaleString()} words from ${result.filename}.`);
      setScreen("setup");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  const progress = words.length ? ((index + 1) / words.length) * 100 : 0;
  const fillSentence = dictionary.sentence && dictionary.sentence !== "Example sentence unavailable."
    ? hideSpelling(dictionary.sentence, currentWord, "__________")
    : "Complete this short sentence with the word you hear: __________.";
  const safeDefinition = hideSpelling(dictionary.definition, currentWord, "this word");
  const safeOrigin = hideSpelling(dictionary.origin, currentWord, "this word");
  const safeSentence = hideSpelling(dictionary.sentence, currentWord, "__________");
  const safeHints = { definition: safeDefinition, origin: safeOrigin, sentence: safeSentence };

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setScreen("home")}><span>bee</span>bright</button>
        <div className="top-actions"><div className="top-tag">SPELL WITH CONFIDENCE <span className="top-dot" /></div><button className="settings-button" onClick={onOpenSettings}><Settings size={17} /> Settings</button></div>
      </header>

      {screen === "home" && (
        <section className="home-page page-width">
          <div className="hero-copy">
            <p className="eyebrow">YOUR PERSONAL SPELLING STUDIO</p>
            <h1>Practice words.<br /><em>Own the stage.</em></h1>
            <p className="lead">A focused, encouraging way to prepare for your next spelling bee. Pick a mode, build your streak, and learn from every answer.</p>
            <div className="hero-buttons">
              <button className="primary" onClick={() => setScreen("setup")}>Start a practice set <ArrowRight size={17} /></button>
              {resumeAvailable && <button className="outline" onClick={resume}><RotateCcw size={15} /> Resume where I left off</button>}
            </div>
            <label className="upload-link"><Upload size={16} /><span>Import a PDF word list</span><input type="file" accept="application/pdf" onChange={importPdf} /></label>
            {message && <p className="status-message">{message}</p>}
          </div>

          <aside className="warmup-card">
            <Sparkles className="warmup-spark" size={46} />
            <p>QUICK WARM-UP</p>
            <h2>100 words.<br />One focused set.</h2>
            <button onClick={() => setScreen("setup")}>Choose your mode <ArrowRight size={17} /></button>
            <div><span>✓ Learn as you go</span><span>✓ Progress saved</span></div>
          </aside>

          <div className="mode-grid">
            {MODES.map(({ key, name, description, icon: Icon }) => (
              <button key={key} onClick={() => { setMode(key); setScreen("setup"); }}>
                <Icon size={25} /><strong>{name}</strong><small>{description}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {screen === "setup" && (
        <section className="setup-page page-width narrow">
          <button className="text-button" onClick={() => setScreen("home")}><ArrowLeft size={15} /> Back home</button>
          <p className="eyebrow setup-eyebrow">BUILD YOUR PRACTICE SET</p>
          <h1>How do you want to <em>practice?</em></h1>
          <div className="setup-layout">
            <div className="mode-list">
              {MODES.map(({ key, name, description, icon: Icon }) => (
                <button key={key} className={mode === key ? "selected" : ""} onClick={() => setMode(key)}>
                  <Icon size={24} /><span><strong>{name}</strong><small>{description}</small></span>{mode === key && <i><Check size={13} /></i>}
                </button>
              ))}
            </div>
            <aside className="set-panel">
              <div className="hundred">100</div>
              <h2>One focused set</h2>
              <p>Your score and winning streak stay visible without taking over the screen.</p>
              <div className="level-picker"><span>WORD LIST LEVEL</span><div className="level-buttons">{levels.map((item) => <button key={item.key} className={level === item.key ? "selected" : ""} onClick={() => setLevel(item.key)}>{item.label}<small>{item.count.toLocaleString()} words</small></button>)}</div></div>
              <button className="primary full" disabled={busy || !levels.length} onClick={() => startPractice(0)}>{busy ? "Loading..." : "Start 100 questions"}<ArrowRight size={17} /></button>
              {imported && <p className="imported-note"><Check size={13} /> Using {imported.filename}</p>}
            </aside>
          </div>
          {message && <p className="status-message centered">{message}</p>}
        </section>
      )}

      {screen === "practice" && current && (
        <section className="practice-page">
          <div className="practice-header">
            <button className="text-button" onClick={() => setScreen("home")}><ArrowLeft size={14} /> Save & exit</button>
            <div className="progress-area"><div><span>QUESTION {index + 1} OF {words.length}</span><span>{Math.round(progress)}%</span></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div></div>
            <div className="score-pill"><span><b>{correct}</b> correct</span><i /><span><Flame size={13} fill="currentColor" /> <b>{streak}</b> streak</span></div>
            <button className="icon-button" aria-label="Open settings" onClick={onOpenSettings}><Settings size={17} /></button>
          </div>

          <div className="practice-content">
            <p className="eyebrow">{activeMode.name.toUpperCase()} · {labelForLevel(level).toUpperCase()}</p>

            {mode === "flash" ? (
              <div className={`flash-card ${revealed ? "revealed" : ""}`} onDoubleClick={() => setRevealed(true)} tabIndex="0" onKeyDown={(event) => event.key === "Enter" && setRevealed(true)}>
                <small>DOUBLE CLICK OR PRESS ENTER TO {revealed ? "REVIEW" : "REVEAL"}</small>
                <h2>{revealed ? currentWord : safeDefinition}</h2>
                <p>{revealed ? safeDefinition : safeSentence}</p>
                {revealed && <button className="primary" onClick={nextQuestion}>Next word <ArrowRight size={16} /></button>}
              </div>
            ) : (
              <>
                <button className="listen-card" onClick={playWord}><span><Volume2 size={19} /></span><div><strong>Listen closely</strong><small>Merriam-Webster audio when available</small></div></button>
                {mode === "blank" && <h2 className="prompt-sentence">{fillSentence}</h2>}
                {mode === "choice" && <h2 className="question-title">Which spelling is correct?</h2>}
                {mode === "type" && <h2 className="question-title">Type the word you hear.</h2>}

                {mode === "choice" ? (
                  <div className="choice-wrap">
                    <div className="choices">
                      {choices.map((choice, choiceIndex) => {
                        const isCorrectChoice = feedback && choice.toLowerCase() === currentWord.toLowerCase();
                        const isWrongChoice = feedback === "incorrect" && answer === choice;
                        return <button key={`${choice}-${choiceIndex}`} className={`${answer === choice ? "picked " : ""}${isCorrectChoice ? "right " : ""}${isWrongChoice ? "wrong" : ""}`} disabled={Boolean(feedback)} onClick={() => setAnswer(choice)}><b>{String.fromCharCode(65 + choiceIndex)}</b>{choice}</button>;
                      })}
                    </div>
                    {!feedback && <button className="primary check-button" disabled={!answer} onClick={() => checkAnswer()}>Check answer</button>}
                  </div>
                ) : (
                  <div className="type-row"><input autoFocus value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => event.key === "Enter" && checkAnswer()} placeholder="Type your spelling here" disabled={Boolean(feedback)} /><button className="primary" onClick={() => checkAnswer()}>Check answer</button></div>
                )}

                {(mode === "choice" || mode === "type") && (
                  <div className="hint-controls"><span><Lightbulb size={14} /> Need a hint?</span><button onClick={() => setHint("definition")}>Definition</button><button onClick={() => setHint("origin")}>Word origin</button><button onClick={() => setHint("sentence")}>In a sentence</button><button onClick={playWord}><Volume2 size={13} /> Say again</button></div>
                )}

                {hint && <div className="hint-box"><b>{hint === "definition" ? "Definition" : hint === "origin" ? "Word origin" : "In a sentence"}</b><p>{safeHints[hint]}</p></div>}

                {feedback && (
                  <div className={`feedback ${feedback}`}>
                    <div className="feedback-copy"><span>{feedback === "correct" ? <Check size={18} /> : <X size={18} />}</span><div><strong>{feedback === "correct" ? "Correct! Beautiful spelling." : "Not quite — let’s learn from it."}</strong>{feedback === "incorrect" && <p>You chose <em>{answer}</em> · Correct spelling: <b>{currentWord}</b></p>}</div></div>
                    <button onClick={nextQuestion}>{index === words.length - 1 ? "See results" : "Next word"}<ArrowRight size={15} /></button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {screen === "results" && (
        <section className="results-page">
          <Sparkles size={50} />
          <p className="eyebrow">SET COMPLETE</p>
          <h1>You finished strong.</h1>
          <p className="lead">You completed {words.length} questions in {activeMode.name}. Your next set is ready when you are.</p>
          <div className="result-grid"><div><b>{correct}</b><span>correct answers</span></div><div><b>{bestStreak}</b><span>best streak</span></div><div><b>{words.length ? Math.round((correct / words.length) * 100) : 0}%</b><span>score</span></div></div>
          <button className="primary" onClick={() => startPractice(setOffset + 100)}>Start next set <ArrowRight size={16} /></button>
          <button className="text-button center-button" onClick={() => setScreen("setup")}>Choose another mode</button>
        </section>
      )}
    </main>
  );
}

export default App;
