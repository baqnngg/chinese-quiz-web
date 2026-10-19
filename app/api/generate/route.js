import vocab from "../../vocab.json";

// Edge 런타임은 응답 제한이 짧아 타임아웃이 나므로 Node 런타임 + 최대 60초 사용
export const maxDuration = 60;

const N = 20; // 한 번에 생성할 문제 수
const CJK = /[\u3400-\u9fff]/;

const TYPES = [
  "병음→뜻 고르기",
  "뜻→병음 고르기",
  "품사 맞히기 (예: '다음 중 양사는?')",
  "성조·발음 구별 (비슷한 병음 중 정확한 것 고르기)",
  "뜻이 비슷하거나 헷갈리는 보기 중에서 고르기",
  "주제별 분류 (인사·가족·날짜·숫자·장소·의문사 등에 속하는 단어 고르기)",
  "짧은 한국어 상황 설명에 어울리는 단어(병음) 고르기",
  "'다음 중 뜻이 틀린 것은?' / '다음 중 짝이 맞는 것은?' 유형",
];

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
const line = (v) => `${v.p} = ${v.m}${v.pos ? ` (${v.pos})` : ""}`;

// 호출할 때마다 정답 단어·유형·단어 순서를 새로 뽑아 매번 다른 문제가 나오게 함
function buildPrompt(avoid) {
  const focus = shuffle(vocab).slice(0, N);
  const types = shuffle(TYPES).slice(0, 5);
  const topics = ["일상 대화", "가족과 친구", "날짜와 시간", "자기소개", "숫자와 양사"];
  const theme = topics[Math.floor(Math.random() * topics.length)];
  return `중국어 초급(1~7과) 단어 퀴즈 출제자입니다. 4지선다 ${N}문제를 만드세요.

[전체 단어 목록: 한어병음 = 뜻 (품사)]
${shuffle(vocab).map(line).join("\n")}

[이번에 반드시 정답으로 삼을 단어 ${N}개 — 단어마다 정확히 1문제씩]
${focus.map(line).join("\n")}

[이번에 중점적으로 쓸 문제 유형]
${types.map((t) => "- " + t).join("\n")}
(분위기 참고: ${theme})

규칙:
- 한자는 절대 쓰지 말고, 한어병음(성조 부호 포함)과 한국어 뜻만 사용
- 보기 4개는 모두 그럴듯하게, 정답은 정확히 1개, 정답 위치는 무작위
- 전체 단어 목록에 없는 단어는 출제하지 않기
- 문제 순서는 섞고, 같은 유형이 연속되지 않게 하기
${avoid.length ? "- 아래 문제와 같거나 비슷한 문제는 만들지 않기:\n" + avoid.map((q) => "  · " + q).join("\n") : ""}
JSON만 출력: [{"q":"문제","o":["A","B","C","D"],"a":정답인덱스0~3}]`;
}

export async function POST(req) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

  let avoid = [];
  try {
    const body = await req.json();
    if (Array.isArray(body?.avoid)) avoid = body.avoid.slice(-40).map((q) => String(q).slice(0, 120));
  } catch {}

  // 모델이 바뀌면 코드 수정 없이 Vercel 환경 변수 GEMINI_MODEL 로 교체 가능
  const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent?key=" + apiKey;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(avoid) }] }],
        generationConfig: {
          temperature: 1.0,
          maxOutputTokens: 6000,
          responseMimeType: "application/json",
          responseSchema: {
            type: "array",
            items: {
              type: "object",
              properties: { q: { type: "string" }, o: { type: "array", items: { type: "string" } }, a: { type: "integer" } },
              required: ["q", "o", "a"],
            },
          },
        },
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      let msg = res.status + " " + res.statusText;
      try { msg = JSON.parse(t)?.error?.message || msg; } catch { if (t) msg = t.slice(0, 200); }
      return Response.json({ error: msg }, { status: 500 });
    }

    const data = await res.json();
    if (data.candidates?.[0]?.finishReason === "SAFETY") {
      return Response.json({ error: "Safety filter triggered, try again" }, { status: 500 });
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty response");

    let clean = text.replace(/```json\s*|```\s*/g, "").trim();
    const s = clean.indexOf("["), e = clean.lastIndexOf("]");
    if (s !== -1 && e !== -1) clean = clean.slice(s, e + 1);
    let raw;
    try {
      raw = JSON.parse(clean);
    } catch {
      raw = JSON.parse(clean.replace(/,\s*([}\]])/g, "$1"));
    }

    // 형식이 잘못되었거나 한자가 섞인 문제는 버림
    const questions = (Array.isArray(raw) ? raw : []).filter(
      (x) =>
        x && typeof x.q === "string" && Array.isArray(x.o) && x.o.length === 4 &&
        Number.isInteger(x.a) && x.a >= 0 && x.a < 4 &&
        ![x.q, ...x.o].some((t) => CJK.test(String(t)))
    ).map((x) => ({ q: x.q, o: x.o.map(String), a: x.a, m: "ai" }));

    if (!questions.length) throw new Error("유효한 문제가 생성되지 않았습니다");
    return Response.json({ questions });
  } catch (err) {
    return Response.json({ error: err.message || "퀴즈 생성 실패" }, { status: 500 });
  }
}
