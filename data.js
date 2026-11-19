// 献血できる？の問題を作る（ブラウザと node の両方で使う）。
// 中身は、安全な血液製剤の安定供給の確保等に関する法律施行規則 別表第二（採血の基準。下の SRC）に書いてあることだけ
// （2026-11-19 に e-Gov で読んだ。要点は共有フォルダ games/kenketsu-research.md）。体の健康の助言にしない。
// 1問は、架空の人（性別・年齢・体重・前の献血・この1年の献血）がしたい献血を見て「今日できる／日をあければできる／いまの年齢・体重ではできない」を選ぶ
// （できないときは、正解したら2段目「どの基準？」）か、献血のしくみの問いに答える。人はすべて架空。
// 血圧・血色素量（ヘモグロビン）・血小板数・体調は当日の検査と問診で決まるので問わない。65歳以上も問わない（60〜64歳の献血の経験で変わるため）。
// 期間のちょうど境目（4週間ちょうど など）は作らない（「以内」の数え方で迷わせないため）。
// 乱数 R は呼ぶ回数が毎回同じになるように使う（sort の比較の中では引かない）。同じ tag なら、どの端末でも同じ問題になる。
// KINDS・言い回し・まちがいの選び肢は、足すだけでも過去の日の問題が変わる（選ぶ範囲が変わるため）。公開したあとは変えず、変えるときは qa/run.mjs の PINS を作り直して PR に理由を書く。
(function (root) {
  "use strict";
  const LV = ["やさしい", "ふつう", "むずかしい"];

  // 出典（画面の「なぜ」に出す）
  const SRC = {
    law: ["安全な血液製剤の安定供給の確保等に関する法律施行規則 別表第二（e-Gov 法令検索）", "https://laws.e-gov.go.jp/law/331M50000100022"],
    jrc: ["日本赤十字社「献血基準」", "https://www.jrc.or.jp/donation/about/terms/"],
  };

  // 1段目の3つ（いつも3つとも出す）
  const LEVELS = ["今日できる", "日をあければできる", "いまの年齢・体重ではできない"];
  const OK = 0, MATSU = 1, NG = 2;

  // 2段目「どの基準？」の4つ（できないときだけ）
  const GROUPS = {
    nenrei: { name: "年齢", sub: "何歳から・何歳まで" },
    taiju: { name: "体重", sub: "何kg以上" },
    kankaku: { name: "前の献血からの間", sub: "何週間あける" },
    nenkan: { name: "年間の量・回数", sub: "52週で数える" },
  };
  const GRP_WHY = {
    nenrei: "年齢の基準は種類でちがいます。200mLは16歳から、400mLは男性17歳・女性18歳から、成分献血は18歳から。女性の血小板成分献血は54歳までです。",
    taiju: "400mLは男女とも50kg以上です。200mLと成分献血は、男性45kg以上・女性40kg以上です。",
    kankaku: "200mLのあとは4週間、成分献血のあとは2週間あけます（血小板のあとの血小板だけは1週間）。400mLのあとは、全血なら男性12週・女性16週、成分献血なら8週です。",
    nenkan: "1年は52週で数えます。全血は今日の分を足して男性1,200mL・女性800mLまで。成分献血は血小板を2回分に数え、今日の分を足して24回までです。",
  };
  const ANS_OF = { nenrei: NG, taiju: NG, kankaku: MATSU, nenkan: MATSU };

  // 献血の種類
  const TY = {
    z2: { name: "200mL献血", ml: 200, whole: true },
    z4: { name: "400mL献血", ml: 400, whole: true },
    pl: { name: "血漿成分献血", ml: 0, whole: false },
    pc: { name: "血小板成分献血", ml: 0, whole: false },
  };
  const SEX = { M: "男性", F: "女性" };

  // 基準（別表第二）。人 p と したい種類 t から、当てはまらない基準の名前を全部返す（空ならできる）
  // p = { sex, age, w, prev: null | { t, wk }, vol（この1年の全血の合計mL・前の分をふくむ）, pl, pc（この1年の成分献血の回数・前の分をふくむ） }
  function judge(p, t) {
    const out = [], M = p.sex === "M";
    const ageOk = { z2: p.age >= 16, z4: p.age >= (M ? 17 : 18), pl: p.age >= 18, pc: p.age >= 18 && (M || p.age < 55) }[t] && p.age < 65;
    if (!ageOk) out.push("nenrei");
    const wOk = t === "z4" ? p.w >= 50 : p.w >= (M ? 45 : 40);
    if (!wOk) out.push("taiju");
    if (p.prev) {
      const { t: pt, wk } = p.prev, whole = TY[t].whole;
      const need = pt === "z2" ? 4 : pt === "z4" ? (whole ? (M ? 12 : 16) : 8) : pt === "pl" ? 2 : (t === "pc" ? 1 : 2);
      if (wk <= need) out.push("kankaku");
    }
    const c = p.pl + 2 * p.pc;
    const yOk = t === "z2" ? p.vol <= (M ? 1000 : 600) : t === "z4" ? p.vol <= (M ? 800 : 400) : t === "pl" ? c < 24 : c < 23;
    if (!yOk) out.push("nenkan");
    return out;
  }

  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, a) => a[ri(R, 0, a.length - 1)];
  function shuffle(R, a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = ri(R, 0, i); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  function pickN(R, a, n) { return shuffle(R, a).slice(0, n); }
  const MEDIA = { kibou: "献血したい人", shikumi: "献血のしくみ" };

  // 架空の人（名前だけで性別を決めつけない）
  const NAMES = ["ハル", "ソラ", "ユウ", "アオイ", "ヒカル", "マコト", "ミナト", "レン"];

  // 人を作る。o は種類ごとの範囲：sex（"M"・"F"・"*"）・age・w（[下, 上]）・prev（null か [種類, 下の週, 上の週]）・
  // vol（この1年の全血の合計の候補。前の分をふくむ）・cc（成分の回数 pl＋2×pc の [下, 上]）
  function person(R, o, t) {
    const sex = o.sex === "*" ? pick(R, ["M", "F"]) : o.sex;
    const age = ri(R, o.age[0], o.age[1]);
    const wr = o.w || (t === "z4" ? [50, 75] : sex === "M" ? [52, 80] : [46, 68]);
    const w = ri(R, wr[0], wr[1]);
    let prev = null;
    if (o.prev) { const pt = Array.isArray(o.prev[0]) ? pick(R, o.prev[0]) : o.prev[0]; prev = { t: pt, wk: ri(R, o.prev[1], o.prev[2]) }; }
    const pml = prev && TY[prev.t].whole && prev.wk < 52 ? TY[prev.t].ml : 0;
    const vols = (o.vol || [0, 200, 400]).filter((v) => v >= pml);
    const vol = pick(R, vols.length ? vols : [pml]);
    const pcomp = prev && !TY[prev.t].whole && prev.wk < 52 ? prev.t : null;
    const cr = o.cc || [0, 6];
    const c = ri(R, cr[0], cr[1]);
    let pc = Math.min(ri(R, 0, Math.floor(c / 2)), 3);
    if (pcomp === "pc" && pc < 1) pc = Math.min(1, Math.floor(c / 2));
    let pl = c - 2 * pc;
    if (pcomp === "pl" && pl < 1) { if (pc > 0) { pc -= 1; pl += 2; } else pl = 1; }
    if (pcomp === "pc" && pc < 1) { pc = 1; pl = Math.max(0, pl - 2); }
    return { sex, age, w, prev, vol, pl, pc };
  }
  function story(p, t, ni) {
    const head = `${NAMES[ni]}さん（${SEX[p.sex]}・${p.age}歳・体重${p.w}kg）。`;
    const before = p.prev ? `前の献血は${TY[p.prev.t].name}で${p.prev.wk}週間前。` : "献血は今日が初めて。";
    const year = !p.prev ? "" : TY[t].whole ? `この1年の全血は合計${p.vol}mL。` : `この1年の成分献血は血漿${p.pl}回・血小板${p.pc}回。`;
    return `${head}${before}${year}${TY[t].name}をしたい。どうなる？`;
  }
  // 基準の1行（ヒント2と説明に使う）
  function ruleLine(g, p, t) {
    const M = p.sex === "M", n = TY[t].name;
    if (g === "nenrei") return t === "z2" ? `${n}は16歳から。` : t === "z4" ? `${n}は男性17歳・女性18歳から。` : t === "pl" ? `${n}は18歳から。` : `${n}は18歳から（女性は54歳まで）。`;
    if (g === "taiju") return t === "z4" ? `${n}は50kg以上。` : `${n}は男性45kg・女性40kg以上。`;
    if (g === "kankaku") {
      const pt = p.prev.t, pn = TY[pt].name;
      const need = pt === "z2" ? 4 : pt === "z4" ? (TY[t].whole ? (M ? 12 : 16) : 8) : pt === "pl" ? 2 : (t === "pc" ? 1 : 2);
      return `${pn}のあとの${n}は、${need}週間より後から。`;
    }
    return TY[t].whole ? `全血は今日の分を足して1年に${M ? "1,200" : "800"}mLまで（${SEX[p.sex]}）。` : `成分献血は血小板を2回分に数え、今日の分を足して1年に24回まで。`;
  }
  function whyOf(p, t, fail) {
    if (!fail) return `年齢・体重・前の献血からの間・この1年の量が、どれも${TY[t].name}の基準に合います。あとは当日の検査と問診で決まります。`;
    const g = fail, line = ruleLine(g, p, t);
    if (g === "nenrei") return `${line}${p.age}歳の${SEX[p.sex]}は当てはまりません。${p.age >= 55 ? "ほかの種類の献血ならできます。" : "年齢が来るまで、この献血はできません。"}`;
    if (g === "taiju") return `${line}体重${p.w}kgでは足りません。体を守るための基準です。`;
    if (g === "kankaku") return `${line}まだ${p.prev.wk}週間なので、日をあければできます。`;
    const now = TY[t].whole ? `今日の分を足すと${p.vol + TY[t].ml}mL` : `今日の分を足すと${p.pl + 2 * p.pc + (t === "pc" ? 2 : 1)}回`;
    return `${line}${now}で超えるので、1年の数が減るまで待ちます。`;
  }

  // したい人の問題。fail：当てはまらない基準（null ならできる）。o：人の範囲
  function want(id, lv, t, fail, o) {
    const a = fail ? ANS_OF[fail] : OK;
    return {
      id, lv, a, ans: LEVELS[a], grp: fail, col: "kibou", t,
      name: `${TY[t].name}：${fail ? GROUPS[fail].name + "で" + LEVELS[a] : "今日できる"}`,
      look: `${TY[t].name}の年齢・体重・前の献血からの間・この1年の量を、順に見ます。`,
      key: "", why: "", src: ["law", "jrc"], o,
      make: (R) => {
        const ni = ri(R, 0, NAMES.length - 1), p = person(R, o, t);
        const fails = judge(p, t), g = fails[0] || null;
        return { type: "act", media: MEDIA.kibou, q: story(p, t, ni), opts: shuffle(R, [0, 1, 2]).map((i) => LEVELS[i]), ans: LEVELS[a], rev: false,
          v: `${ni}:${p.sex}:${p.age}:${p.w}:${p.prev ? p.prev.t + p.prev.wk : "-"}:${p.vol}:${p.pl}.${p.pc}`, person: p, fails,
          key: g ? ruleLine(g, p, t) : ruleLine("nenrei", p, t) + ruleLine("taiju", p, t),
          why: whyOf(p, t, g) };
      },
    };
  }
  // しくみの問題。ans：答え、ws：まちがいの選び肢の候補（やさしいは2つ、ほかは3つ使う）、sit：問いの言い方
  function fact(col, sit, ans, ws) {
    return (R, lv) => {
      const si = ri(R, 0, sit.length - 1), ds = pickN(R, ws, lv === 0 ? 2 : 3);
      return { type: "fact", media: MEDIA[col], q: sit[si], opts: shuffle(R, [ans, ...ds]), ans, rev: false, v: `${si}:${ds.map((d) => ws.indexOf(d)).join(".")}` };
    };
  }
  const F = (id, lv, name, look, key, why, sit, ans, ws) => ({ id, lv, a: -1, ans, grp: null, col: "shikumi", name, look, key, why, src: ["law", "jrc"], make: fact("shikumi", sit, ans, ws) });

  const A = [20, 60], AF = [20, 50];
  const KINDS = [
    // ---- やさしい ----
    want("ok200", 0, "z2", null, { sex: "*", age: [18, 60], prev: null }),
    want("age200", 0, "z2", "nenrei", { sex: "*", age: [14, 15], prev: null }),
    want("gap200", 0, "z2", "kankaku", { sex: "*", age: A, prev: ["z2", 1, 3], vol: [200, 400] }),
    want("w400", 0, "z4", "taiju", { sex: "*", age: A, w: [42, 49], prev: null }),
    want("ok400", 0, "z4", null, { sex: "*", age: A, prev: ["z2", 10, 30], vol: [200, 400] }),
    want("agepl", 0, "pl", "nenrei", { sex: "*", age: [16, 17], prev: null }),
    F("start200", 0, "200mL献血は16歳から", "いちばん若くからできる献血です。", "200mL献血は16歳からできます。",
      "200mL献血は16歳からできます。400mLは男性17歳・女性18歳から、成分献血は18歳からです。",
      ["200mL献血は何歳からできる？", "いちばん若くからできる200mL献血。何歳から？", "高校生でもできる200mL献血は、何歳から？"], "16歳", ["15歳", "18歳", "20歳", "12歳", "17歳"]),
    F("m400", 0, "400mLのあと男性は12週あける", "全血どうしの間です。", "男性は、400mL献血のあと12週間は全血の献血ができません。",
      "男性が400mL献血をしたら、次の全血献血（200mL・400mL）まで12週間あけます。女性は16週間です。",
      ["男性が400mL献血をしたら、次の全血献血まで何週間あける？", "400mL献血のあと、男性が次に全血献血できるまでの間は？", "男性の400mLのあとの全血献血。あける間は？"], "12週間", ["2週間", "4週間", "1週間", "26週間", "52週間"]),
    // ---- ふつう ----
    want("age400f", 1, "z4", "nenrei", { sex: "F", age: [17, 17], prev: null }),
    want("ok400m17", 1, "z4", null, { sex: "M", age: [17, 17], prev: null }),
    want("gap400m", 1, "z4", "kankaku", { sex: "M", age: A, prev: ["z4", 5, 11], vol: [400, 800] }),
    want("gap400f", 1, "z4", "kankaku", { sex: "F", age: A, prev: ["z4", 12, 15], vol: [400] }),
    want("ok400m13", 1, "z4", null, { sex: "M", age: A, prev: ["z4", 13, 24], vol: [400, 800] }),
    want("gappl", 1, "pl", "kankaku", { sex: "*", age: A, prev: ["pl", 1, 1], cc: [1, 8] }),
    want("okpl400", 1, "pl", null, { sex: "*", age: A, prev: ["z4", 9, 11], cc: [0, 6] }),
    want("w200f", 1, "z2", "taiju", { sex: "F", age: A, w: [36, 39], prev: null }),
    want("ok200f", 1, "z2", null, { sex: "F", age: A, w: [40, 44], prev: null }),
    want("year200f", 1, "z2", "nenkan", { sex: "F", age: A, prev: ["z4", 17, 30], vol: [800] }),
    F("pc2", 1, "血小板成分献血は2回分に数える", "1年の回数の数え方です。", "1年の成分献血の回数は、血小板成分献血1回を2回分に数えます。",
      "成分献血の1年の回数は、血漿成分献血の回数に、血小板成分献血の回数を2倍にして足して数えます。",
      ["1年の成分献血の回数を数えるとき、血小板成分献血1回は何回分？", "成分献血の回数の数え方。血小板成分献血1回は？", "血漿と血小板の成分献血を合わせて数えるとき、血小板1回は何回分？"], "2回分", ["1回分", "3回分", "0.5回分", "4回分", "数えない"]),
    F("52w", 1, "1年は52週で数える", "暦の1月〜12月ではありません。", "1年の量・回数は、過去52週で数えます。",
      "1年の量・回数は、1月〜12月ではなく、過去52週で数えます。期間は献血をした日から数えます。",
      ["献血の「1年の量」は、何で数える？", "1年に献血できる量・回数。1年をどう数える？", "献血の基準の「1年」は？"], "過去52週", ["1月から12月まで", "4月から3月まで", "誕生日から1年", "過去50週", "過去12か月の月の数"]),
    F("f400", 1, "400mLのあと女性は16週あける", "男性より長く間をあけます。", "女性は、400mL献血のあと16週間は全血の献血ができません。",
      "女性が400mL献血をしたら、次の全血献血まで16週間あけます。男性は12週間です。",
      ["女性が400mL献血をしたら、次の全血献血まで何週間あける？", "400mL献血のあと、女性が次に全血献血できるまでの間は？", "女性の400mLのあとの全血献血。あける間は？"], "16週間", ["4週間", "8週間", "12週間", "2週間", "26週間"]),
    // ---- むずかしい ----
    want("agepcf", 2, "pc", "nenrei", { sex: "F", age: [55, 62], prev: null }),
    want("okpcm", 2, "pc", null, { sex: "M", age: [55, 64], prev: null }),
    want("okpcpc", 2, "pc", null, { sex: "*", age: [20, 50], prev: ["pc", 2, 4], cc: [2, 8] }),
    want("gappcpl", 2, "pc", "kankaku", { sex: "*", age: [20, 50], prev: ["pl", 1, 1], cc: [1, 8] }),
    want("gap200pc", 2, "z2", "kankaku", { sex: "*", age: A, prev: ["pc", 1, 1], vol: [0, 200, 400] }),
    want("year400m", 2, "z4", "nenkan", { sex: "M", age: A, prev: ["z4", 13, 30], vol: [1000, 1200] }),
    want("ok200m1000", 2, "z2", null, { sex: "M", age: A, prev: ["z4", 13, 30], vol: [1000] }),
    want("year400f", 2, "z4", "nenkan", { sex: "F", age: A, prev: ["z4", 17, 30], vol: [600, 800] }),
    want("yearpl", 2, "pl", "nenkan", { sex: "*", age: A, prev: ["pl", 3, 10], cc: [24, 24] }),
    want("yearpc", 2, "pc", "nenkan", { sex: "*", age: [20, 50], prev: ["pl", 3, 10], cc: [23, 23] }),
    want("okpl23", 2, "pl", null, { sex: "*", age: A, prev: ["pl", 3, 10], cc: [22, 23] }),
    want("w400f", 2, "z4", "taiju", { sex: "F", age: A, w: [45, 49], prev: null }),
    want("gappl200", 2, "pl", "kankaku", { sex: "*", age: A, prev: ["z2", 1, 3], cc: [0, 6] }),
    want("okpc400", 2, "pc", null, { sex: "*", age: [20, 50], prev: ["z4", 9, 11], cc: [0, 6] }),
    F("over65", 2, "65〜69歳は60〜64歳の献血の経験が要る", "はじめての献血は64歳までです。", "65歳から69歳の人は、60歳から64歳までに献血したことがあればできます。",
      "65歳から69歳までの人は、60歳から64歳までに献血したことがある人に限られます。",
      ["65歳から69歳の人が献血できるのは、どんなとき？", "67歳の人が献血できるのは？", "65歳以上の人の献血の基準は？"], "60〜64歳に献血したことがある", ["40歳までに献血したことがある", "家族の同意がある", "体重が60kg以上ある", "どんなときもできない", "毎年1回献血している"]),
    F("kisan", 2, "期間は献血をした日から数える", "日付の数え方です。", "前の献血からの間は、献血をした日から数えます。",
      "基準の期間は、採血を行った日から数えます（省令 第十四条）。",
      ["「前の献血から何週間」は、いつから数える？", "献血の基準の期間は、どの日から数える？", "次の献血までの間。数えはじめる日は？"], "献血をした日", ["献血の次の日", "結果の手紙が届いた日", "その月の1日", "献血を申し込んだ日", "その週の月曜日"]),
    F("seibun", 2, "成分献血のあとの全血は2週間あける", "成分献血は間が短くてすみます。", "成分献血のあと、全血献血まで2週間あけます。",
      "血漿・血小板の成分献血のあとは、200mL・400mLの全血献血まで2週間あけます。",
      ["成分献血のあと、全血献血まで何週間あける？", "血漿成分献血をした人。次の400mL献血までの間は？", "血小板成分献血のあとの200mL献血。あける間は？"], "2週間", ["1週間", "4週間", "8週間", "12週間", "16週間"]),
  ];
  const BY = Object.fromEntries(KINDS.map((k) => [k.id, k]));
  const kindsOf = (lv) => KINDS.filter((k) => k.lv === lv).map((k) => k.id);

  function seedOf(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // 1問を作る。tag は「種類|種」（例 "gap400m|2026-11-19:d0"）。同じ tag ならいつも同じ問題
  function make(tag) {
    const [kind] = String(tag).split("|"), k = BY[kind];
    if (!k) return null;
    const p = k.make(rng(seedOf(tag)), k.lv);
    return { tag, kind, lv: k.lv, name: k.name, look: k.look, key: k.key, why: k.why, grp: k.grp, gwhy: k.grp ? GRP_WHY[k.grp] : "", src: k.src.map((s) => SRC[s]), ...p };
  }
  const keyOf = (P) => `${P.kind}:${P.q}:${P.opts.slice().sort().join("/")}`;

  function dailyTags(date) {
    const R = rng(seedOf("day:" + date)), e = pickN(R, kindsOf(0), 2), n = pickN(R, kindsOf(1), 2), h = pickN(R, kindsOf(2), 1);
    return [...e, ...n, ...h].map((id, i) => `${id}|${date}:d${i}`);
  }
  function hardTags(date) {
    const dh = dailyTags(date)[4].split("|")[0], R = rng(seedOf("hard:" + date)), h = pickN(R, kindsOf(2).filter((x) => x !== dh), 3);
    return h.map((id, i) => `${id}|${date}:h${i}`);
  }

  const KKS = { KINDS, BY, GROUPS, GRP_WHY, LV, SRC, LEVELS, TY, ORGS: LEVELS, MEDIA, judge, kindsOf, seedOf, rng, make, keyOf, dailyTags, hardTags, pickN };
  if (typeof module !== "undefined" && module.exports) module.exports = KKS; else root.KKS = KKS;
})(typeof self !== "undefined" ? self : this);
