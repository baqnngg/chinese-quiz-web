"use client";
import { useState } from "react";
import vocab from "./vocab.json";

/* 퀴즈 유형: [질문 필드, 정답 필드] — p=병음, m=뜻 (한자는 화면에 표시하지 않음) */
const F = { py2m: ["p", "m"], m2py: ["m", "p"] };
const MODES = [
  ["mix", "🎲 혼합"],
  ["py2m", "병음 → 뜻"],
  ["m2py", "뜻 → 병음"],
];
const ASK = {
  py2m: "이 병음의 뜻은?",
  m2py: "다음 뜻에 해당하는 병음은?",
};
const COUNTS = [10, 20, 30];

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/* 한 유형의 문제 전체 생성 (hái처럼 병음은 같고 뜻이 다른 모호한 문제는 제외) */
function pool(m) {
  const [qk, ak] = F[m];
  const seen = new Set();
  return vocab
    .filter((v) => !vocab.some((u) => u[qk] === v[qk] && u[ak] !== v[ak]))
    .filter((v) => {
      const k = v[qk] + "|" + v[ak];
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((v) => {
      // 오답 보기: 같은 질문에도 정답이 될 수 있는 단어는 제외
      const others = [...new Set(vocab.filter((u) => u[qk] !== v[qk] && u[ak] !== v[ak]).map((u) => u[ak]))];
      const o = shuffle([v[ak], ...shuffle(others).slice(0, 3)]);
      return { m, v, q: v[qk], o, a: o.indexOf(v[ak]) };
    });
}

function makeQuiz(mode, n) {
  const modes = mode === "mix" ? Object.keys(F) : [mode];
  const seen = new Set();
  const out = [];
  for (const q of shuffle(modes.flatMap(pool))) {
    const k = q.v.p + "|" + q.v.m;
    if (mode === "mix" && seen.has(k)) continue;
    seen.add(k);
    out.push(q);
    if (out.length >= n) break;
  }
  return out;
}

const speak = (t) => {
  try {
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "zh-CN";
    u.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {}
};

export default function Page() {
  const [mode, setMode] = useState("mix");
  const [count, setCount] = useState(20);
  const [qs, setQs] = useState([]);
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState(null);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState(0);
  const [wrongs, setWrongs] = useState([]);
  const [phase, setPhase] = useState("landing");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [genCount, setGenCount] = useState(0);
  const cur = qs[idx];

  const start = (list) => {
    setQs(list); setIdx(0); setSel(null); setDone(false);
    setScore(0); setWrongs([]); setPhase("quiz");
  };
  const begin = () => start(makeQuiz(mode, count));
  const generate = async () => {
    setGenerating(true); setGenError("");
    try {
      const res = await fetch("/api/generate", { method: "POST" });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error("서버 응답 파싱 실패: " + text.slice(0, 100)); }
      if (data.error) throw new Error(data.error);
      if (!data.questions?.length) throw new Error("문제가 생성되지 않았습니다");
      setGenCount((c) => c + 1);
      start(data.questions);
    } catch (e) {
      setGenError(e.message || "생성 실패");
    } finally {
      setGenerating(false);
    }
  };
  const retryWrong = () => start(shuffle(wrongs.map(({ picked, ...q }) => q)));

  const check = () => {
    if (sel === null) return;
    setDone(true);
    if (sel === cur.a) setScore((s) => s + 1);
    else setWrongs((w) => [...w, { ...cur, picked: sel }]);
  };
  const next = () => {
    if (idx + 1 >= qs.length) return setPhase("result");
    setIdx((i) => i + 1); setSel(null); setDone(false);
  };

  const pct = qs.length ? Math.round((score / qs.length) * 100) : 0;

  if (phase === "landing")
    return (
      <div className="wrap"><div className="center">
        <div className="bar">
          <span style={{ background: "#DE2910" }} /><span style={{ background: "#FFDE00" }} />
        </div>
        <h1 className="hero">中文 Quiz</h1>
        <p className="sub">중국어 병음·뜻 연습 · 1~7과 · 총 {vocab.length}단어</p>
        <p className="label">퀴즈 유형</p>
        <div className="chips">
          {MODES.map(([k, l]) => (
            <button key={k} className={"chip" + (mode === k ? " on" : "")} onClick={() => setMode(k)}>{l}</button>
          ))}
        </div>
        <p className="label">문제 수</p>
        <div className="chips">
          {COUNTS.map((c) => (
            <button key={c} className={"chip" + (count === c ? " on" : "")} onClick={() => setCount(c)}>{c}문제</button>
          ))}
        </div>
        <button className="btn" style={{ marginTop: 28 }} onClick={begin}>기본 문제로 시작</button>
        <button className="btn accent" style={{ opacity: generating ? .6 : 1 }} onClick={generate} disabled={generating}>
          {generating ? "⏳ AI로 새 문제 생성 중..." : "🤖 AI로 새 문제 생성하기"}
        </button>
        {genError && <p style={{ marginTop: 12, fontSize: 14, color: "#ef4444" }}>{genError}</p>}
      </div></div>
    );

  if (phase === "result") {
    const grade = pct >= 90 ? "🏆 太棒了!" : pct >= 70 ? "👍 不错!" : pct >= 50 ? "📖 再练练!" : "💪 加油!";
    return (
      <div className="wrap"><div className="center">
        <p style={{ fontSize: 22, fontWeight: 700 }}>{grade}</p>
        <h2 className="score">{score}<small>/{qs.length}</small></h2>
        <div className="meter"><div style={{ width: pct + "%", background: pct >= 70 ? "#22c55e" : pct >= 50 ? "#FFDE00" : "#ef4444" }} /></div>
        <p style={{ fontSize: 18, fontWeight: 600, color: "#888", marginBottom: 24 }}>{pct}%</p>
        {wrongs.length > 0 && <button className="btn ghost" onClick={() => setPhase("review")}>오답 노트 ({wrongs.length})</button>}
        {wrongs.length > 0 && <button className="btn accent" onClick={retryWrong}>틀린 문제만 다시 풀기</button>}
        <button className="btn" onClick={begin}>기본 문제로 다시</button>
        <button className="btn accent" style={{ opacity: generating ? .6 : 1 }} onClick={generate} disabled={generating}>
          {generating ? "⏳ AI로 새 문제 생성 중..." : "🤖 AI로 새 문제 생성하기"}
        </button>
        {genError && <p style={{ marginTop: 12, fontSize: 14, color: "#ef4444" }}>{genError}</p>}
        <button className="btn ghost" onClick={() => setPhase("landing")}>처음으로</button>
        {genCount > 0 && <p style={{ marginTop: 16, fontSize: 12, color: "#FFDE00", opacity: .6 }}>AI 생성 #{genCount}</p>}
      </div></div>
    );
  }

  if (phase === "review")
    return (
      <div className="wrap top"><div className="col">
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 20 }}>
          오답 노트 <span style={{ fontSize: 16, color: "#ef4444" }}>{wrongs.length}문제</span>
        </h2>
        {wrongs.map((w, i) => (
          <div className="rev" key={i}>
            <p style={{ fontWeight: 600, marginBottom: 10 }}>
              <span style={{ color: "#ef4444", fontWeight: 800, marginRight: 8 }}>Q{i + 1}</span>{w.m === "ai" ? "" : ASK[w.m] + " "}{w.q}
            </p>
            <p style={{ color: "#ef4444", opacity: .8, textDecoration: "line-through" }}>✕ 내 답: {w.o[w.picked]}</p>
            <p style={{ color: "#22c55e", fontWeight: 600 }}>✓ 정답: {w.o[w.a]}</p>
            {w.v && <span className="tag">{w.v.p} · {w.v.m}</span>}
          </div>
        ))}
        <button className="btn accent" onClick={retryWrong}>틀린 문제만 다시 풀기</button>
        <button className="btn" onClick={begin}>기본 문제로 다시</button>
        <button className="btn accent" style={{ opacity: generating ? .6 : 1 }} onClick={generate} disabled={generating}>
          {generating ? "⏳ AI로 새 문제 생성 중..." : "🤖 AI로 새 문제 생성하기"}
        </button>
        {genError && <p style={{ marginTop: 12, fontSize: 14, color: "#ef4444" }}>{genError}</p>}
        <button className="btn ghost" style={{ marginBottom: 40 }} onClick={() => setPhase("landing")}>처음으로</button>
      </div></div>
    );

  /* QUIZ */
  const isAi = cur.m === "ai";
  const big = cur.m === "m2py";
  const qSize = isAi ? 20 : cur.m === "py2m" ? 40 : 22;
  return (
    <div className="wrap top"><div className="col">
      <div className="top-row"><span>{idx + 1} / {qs.length}</span><span style={{ color: "#22c55e" }}>✓ {score}</span></div>
      <div className="prog"><div style={{ width: ((idx + 1) / qs.length) * 100 + "%" }} /></div>
      <p className="ask">{ASK[cur.m]}{isAi && genCount > 0 ? ` #${genCount}` : ""}</p>
      <div className="prompt">
        <h2 style={{ fontSize: qSize, lineHeight: 1.5 }}>{cur.q}</h2>
        {cur.v && <button className="speak" onClick={() => speak(cur.v.w)} aria-label="발음 듣기">🔊</button>}
      </div>
      <div className="opts">
        {cur.o.map((opt, i) => {
          let c = "opt" + (big ? " big" : "");
          if (done) { if (i === cur.a) c += " ok"; else if (i === sel) c += " no"; }
          else if (i === sel) c += " sel";
          return (
            <button key={i} className={c} onClick={() => !done && setSel(i)}>
              <i>{String.fromCharCode(65 + i)}</i><span>{opt}</span>
              {done && i === cur.a && <b style={{ color: "#22c55e" }}>✓</b>}
              {done && i === sel && i !== cur.a && <b style={{ color: "#ef4444" }}>✕</b>}
            </button>
          );
        })}
      </div>
      {done && cur.v && (
        <div className="info">
          <b>{cur.v.p}</b>{cur.v.pos}<br />{cur.v.m}
        </div>
      )}
      {!done
        ? <button className="btn" style={{ marginTop: 24 }} disabled={sel === null} onClick={check}>정답 확인</button>
        : <button className="btn" style={{ marginTop: 24 }} onClick={next}>{idx + 1 >= qs.length ? "결과 보기" : "다음 문제 →"}</button>}
    </div></div>
  );
}
