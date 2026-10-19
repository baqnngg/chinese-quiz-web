import vocab from "../../vocab.json";

export const runtime = "edge";

const WORDS = vocab.map((v) => `${v.p} = ${v.m}${v.pos ? ` (${v.pos})` : ""}`).join("\n");

const PROMPT = `중국어 초급(1~7과) 단어 퀴즈 출제자입니다. 아래 단어 목록만 근거로 4지선다 30문제를 만드세요.

[단어 목록: 한어병음 = 뜻 (품사)]
${WORDS}

규칙:
- 한자는 절대 쓰지 말고, 한어병음(성조 부호 포함)과 한국어 뜻만 사용
- 매번 다르게, 아래 유형을 골고루 섞기: 병음→뜻, 뜻→병음, 품사 맞히기("다음 중 양사는?"), 성조/발음 구별, 뜻이 비슷한 보기 중 고르기, 인사·가족·날짜·숫자 등 주제별 분류, 빈칸/상황에 맞는 표현 고르기
- 보기 4개는 모두 그럴듯하게, 정답은 정확히 1개, 정답 위치는 무작위
- 목록에 없는 단어는 출제하지 않기
JSON만 출력: [{"q":"문제","o":["A","B","C","D"],"a":정답인덱스0~3}]`;

const CJK = /[\u3400-\u9fff]/;

export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

  // 모델이 바뀌면 코드 수정 없이 Vercel 환경 변수 GEMINI_MODEL 로 교체 가능
  const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent?key=" + apiKey;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: PROMPT }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 8192,
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
