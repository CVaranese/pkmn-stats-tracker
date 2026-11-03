/* Pick'em tab (leagues with pickem in site/leagues.json): the playoff bracket drawn round by round, a winner picked for
   every match, saved to the Supabase store (supabase/migrations/) after a Discord sign-in, and the leaderboard. Bracket
   maths in league.js (pickemClean / pickemSlots / pickemScore / pickemRanks). The store enforces who can pick (members
   of the league's Discord server, checked by supabase/functions/pickem-join) and the lock; everyone's brackets open
   after the lock. */
"use strict";

const PK = LEAGUE.pickem;
// supabase-js, pinned with its hash (2.118.0, 2026-10-15); loaded only when the tab opens
const PK_LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.min.js";
const PK_LIB_HASH = "sha384-UagCvVPT5XXA0Hx+nJYUAGBFseHT9zBgpJMSebsAxl9lciTwbT+39j5VfRjdP5Tp";
const PK_DRAFT_KEY = KEYS + "pickem";  // picks made before signing in (this browser only), saved once signed in
// { sb, bracket, lockAt, guild, user, name, member, mine, saved, viewing, board, all }
let pk = null;
let pkStarted = null;
let pkSaving = Promise.resolve();

if (PK) document.querySelector('.modes [data-mode="pickem"]').hidden = false;

async function renderPickem() {
  if (!PK) return;
  if (!pkStarted) pkStarted = pkStart().catch((e) => { pkStarted = null; pkStatus(e.message || String(e)); });
  await pkStarted;
}
const pkStatus = (text) => { $("pk-status").textContent = text; };
const pkLocked = () => pk && Date.now() >= pk.lockAt.getTime();
const pkName = (seed) => (pk.bracket.players.find((p) => p.seed === seed) || { name: "?" }).name;

function pkLoadLib() {
  if (window.supabase) return Promise.resolve();
  return new Promise((ok, fail) => {
    const s = Object.assign(document.createElement("script"), { src: PK_LIB, integrity: PK_LIB_HASH, crossOrigin: "anonymous" });
    s.onload = ok;
    s.onerror = () => fail(new Error("The sign-in library didn't load. Reload the page to try again."));
    document.head.append(s);
  });
}

async function pkStart() {
  pkStatus("Loading the bracket…");
  const [bracket] = await Promise.all([
    fetch(DIR + PK.bracket, { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error("The bracket didn't load.");
      return r.json();
    }),
    pkLoadLib()]);
  // PKCE: Discord sends the visitor back with ?code=, which the library swaps for a session on its own
  const sb = window.supabase.createClient(PK.supabase_url, PK.supabase_key, { auth: { flowType: "pkce" } });
  pk = { sb, bracket, lockAt: null, guild: "", user: null, name: "", member: false, mine: {}, saved: {}, viewing: null, board: [], all: null };
  const { data: contest, error } = await sb.from("contests").select("lock_at, guild_id").eq("id", PK.contest).single();
  if (error) throw new Error("The picks store didn't answer. Reload the page to try again.");
  pk.lockAt = new Date(contest.lock_at);
  pk.guild = contest.guild_id;
  // winners only from the store, which also scores the leaderboard (the file's are the same once the admin has run
  // tools/challonge_bracket.py --sql; until then the page and the leaderboard must not disagree)
  const { data: results, error: rErr } = await sb.from("pickem_matches").select("match_id, winner").eq("contest_id", PK.contest);
  if (rErr) throw new Error("The picks store didn't answer. Reload the page to try again.");
  const won = Object.fromEntries(results.map((r) => [r.match_id, r.winner]));
  for (const m of bracket.matches) m.winner = won[m.id] ?? null;
  const { data: { session } } = await sb.auth.getSession();
  pkDropCode();
  // a failed Discord check still draws the bracket and the Sign out button (the way to retry)
  let joinError = "";
  if (session) await pkJoin(session).catch((e) => { joinError = e.message || String(e); });
  await pkLoadPicks();
  pkIntro();
  pkAccount();
  pkDraw();
  pkStatus(joinError || pkPickedText());
  await pkBoard();
}
/** Discord's sign-in comes back with ?code= (already swapped for a session by now): out of the address, so it isn't
    in links people copy or tried again on a reload. */
function pkDropCode() {
  const u = new URL(location.href);
  if (!u.searchParams.has("code")) return;
  u.searchParams.delete("code");
  try { history.replaceState(history.state, "", u.pathname + u.search + u.hash); } catch (e) { /* sandboxed frame */ }
}

/** The signed-in person's name and membership; right after a Discord sign-in (the Discord token is there), the
    pickem-join function checks the server and writes them in. */
async function pkJoin(session) {
  const sb = pk.sb;
  pk.user = session.user;
  pk.name = (session.user.user_metadata || {}).full_name || "";  // until the people row says otherwise
  const [{ data: me }, { data: mem }] = await Promise.all([
    sb.from("people").select("name").eq("id", pk.user.id).maybeSingle(),
    sb.from("guild_members").select("guild_id").eq("guild_id", pk.guild)]);
  if (me) pk.name = me.name;
  pk.member = !!(mem && mem.length);
  if ((pk.member && me) || !session.provider_token) return;
  pkStatus("Checking the Discord server…");
  const r = await fetch(PK.supabase_url + "/functions/v1/pickem-join", {
    method: "POST",
    headers: { apikey: PK.supabase_key, Authorization: "Bearer " + session.access_token, "Content-Type": "application/json" },
    body: JSON.stringify({ provider_token: session.provider_token }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("The Discord check didn't work (" + (j.error || r.status) + "). Sign out and sign in again to retry.");
  pk.name = j.name;
  pk.member = (j.guilds || []).includes(pk.guild);
}

async function pkLoadPicks() {
  let draft = {};
  try { draft = JSON.parse(localStorage.getItem(PK_DRAFT_KEY) || "{}"); } catch (e) { /* storage blocked */ }
  // signed out: the draft in this browser while picks are open; after the lock it never counted, so nothing shows
  if (!pk.user) { pk.mine = pkLocked() ? {} : League.pickemClean(pk.bracket, draft); return; }
  const { data, error } = await pk.sb.from("picks").select("match_id, pick").eq("contest_id", PK.contest).eq("person_id", pk.user.id);
  if (error) throw new Error("Your picks didn't load. Reload the page to try again.");
  pk.saved = Object.fromEntries(data.map((r) => [r.match_id, r.pick]));
  pk.mine = League.pickemClean(pk.bracket, pk.saved);
  // picks made before signing in go in, when nothing was saved yet
  if (!data.length && Object.keys(draft).length && pk.member && !pkLocked()) {
    pk.mine = League.pickemClean(pk.bracket, draft);
    pkSave();
  }
}

function pkIntro() {
  const r = pk.bracket.rounds;
  // "1 point in Round 1, 2 points in the Quarterfinals, ... and 8 in the Final"
  const pts = r.map((x, i) => `${i === r.length - 1 ? "and " : ""}${x.points} point${x.points === 1 ? "" : "s"} in ` +
    (/^Round /.test(x.name) ? x.name : "the " + x.name)).join(", ");
  const lock = pk.lockAt.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" })
    .replace(":00", "");
  $("pk-intro").textContent = pkLocked()
    ? `Picks are locked. A right pick earns ${pts}. Open anyone's bracket from the leaderboard.`
    : `Pick a winner for every playoff match: click a player, and they move on to the next round. A right pick earns ${pts}. ` +
      `You can change picks until ${lock} Pacific time. Only members of the ${PK.server} Discord server can enter.`;
}

function pkAccount() {
  const bar = $("pk-account");
  const out = el("button", "small", "Sign out");
  out.type = "button";
  out.addEventListener("click", async () => { await pk.sb.auth.signOut(); location.reload(); });
  if (!pk.user) {
    if (pkLocked()) { bar.replaceChildren(); return; }
    const b = el("button", "primary", "Sign in with Discord");
    b.type = "button";
    b.addEventListener("click", async () => {
      pkStatus("Opening Discord…");
      const { error } = await pk.sb.auth.signInWithOAuth({ provider: "discord",
        options: { scopes: "identify guilds", redirectTo: location.origin + location.pathname + "?tab=pickem" } });
      if (error) pkStatus("Discord sign-in didn't start: " + error.message);
    });
    bar.replaceChildren(b, el("span", "muted", "Picks made before signing in stay in this browser until you sign in."));
  } else if (!pk.member) {
    bar.replaceChildren(el("span", "", `Signed in as ${pk.name || "you"}, but not as a member of the ${PK.server} Discord server, ` +
      "so picks can't be saved. Just joined it? Sign out and sign in again."), out);
  } else bar.replaceChildren(el("span", "", `Signed in as ${pk.name}.`), out);
}

function pkPickedText() {
  if (pkLocked()) return "";
  const n = Object.keys(pk.mine).length, all = pk.bracket.matches.length;
  const saved = pk.user && pk.member ? "Saved" : "Not saved yet";
  return n ? `${saved}: ${n} of ${all} matches picked.` : `No picks yet: ${all} matches to pick.`;
}

function pkPick(matchId, seed) {
  if (pk.viewing || pk.mine[matchId] === seed) return;
  if (pkLocked()) {  // the lock passed with the page open: redraw it locked (what was saved) and say so
    pk.mine = pk.user ? League.pickemClean(pk.bracket, pk.saved) : {};
    pkIntro();
    pkAccount();
    pkDraw();
    pk.all = null;
    pkBoard();
    pkStatus("Picks are locked now, so that change wasn't made.");
    return;
  }
  pk.mine = League.pickemClean(pk.bracket, { ...pk.mine, [matchId]: seed });
  pkDraw();
  if (pk.user && pk.member) { pkSave(); return; }
  try { localStorage.setItem(PK_DRAFT_KEY, JSON.stringify(pk.mine)); } catch (e) { /* storage blocked */ }
  pkStatus(pkPickedText() + (pk.user ? "" : " Sign in with Discord to save them."));
}

/** Sends what changed since the last save (new or changed picks, and picks an earlier change knocked out), one save
    at a time; a failed save is sent again with the next click. */
function pkSave() {
  pkSaving = pkSaving.then(async () => {
    const want = { ...pk.mine };
    const up = Object.entries(want).filter(([id, s]) => pk.saved[id] !== s)
      .map(([id, s]) => ({ person_id: pk.user.id, contest_id: PK.contest, match_id: id, pick: s }));
    const gone = Object.keys(pk.saved).filter((id) => !(id in want));
    pkStatus("Saving…");
    if (up.length) {
      const { error } = await pk.sb.from("picks").upsert(up);
      if (error) throw error;
    }
    if (gone.length) {
      const { error } = await pk.sb.from("picks").delete().eq("contest_id", PK.contest).eq("person_id", pk.user.id).in("match_id", gone);
      if (error) throw error;
    }
    pk.saved = want;
    try { localStorage.removeItem(PK_DRAFT_KEY); } catch (e) { /* storage blocked */ }
    pkStatus(pkPickedText());
    pkBoard();
  }).catch((e) => {
    pkStatus(pkLocked() ? "Picks are locked, so that change wasn't saved." : "Not saved (" + (e.message || e) + "). Pick again to retry.");
  });
}

/** The bracket: a column per round, each match a card with its two players (click one to pick them); lines from each
    match to the slot its winner moves into. Someone else's bracket (after the lock) or a locked one is read-only. */
function pkDraw() {
  const b = pk.bracket, picks = pk.viewing ? pk.viewing.picks : pk.mine;
  const clean = League.pickemClean(b, picks), slots = League.pickemSlots(b, picks);
  const fixed = !!pk.viewing || pkLocked();
  const byId = Object.fromEntries(b.matches.map((m) => [m.id, m]));
  // up and down: first-round matches in order from the final down, a later match level with the matches feeding it
  const y = {};
  let leaves = 0;
  const place = (id) => {
    const from = [byId[id].p1, byId[id].p2].filter((s) => s.from).map((s) => s.from);
    from.forEach(place);
    y[id] = from.length ? from.reduce((t, f) => t + y[f], 0) / from.length : leaves++;
  };
  place(b.matches[b.matches.length - 1].id);
  const box = el("div", "bracket");
  box.style.setProperty("--pk-rows", leaves);
  for (const r of b.rounds) {
    const col = el("div", "pk-round");
    col.append(el("h3", "", r.name), el("p", "muted", `${r.points} point${r.points === 1 ? "" : "s"} each`));
    const body = el("div", "pk-col");
    for (const m of b.matches.filter((x) => x.round === r.round)) {
      const card = el("div", "pk-match");
      card.dataset.id = m.id;
      card.style.setProperty("--pk-y", y[m.id]);
      card.setAttribute("role", "group");
      card.setAttribute("aria-label", `${r.name}, match ${m.id}`);
      slots[m.id].forEach((seed, i) => {
        // a player is a button either way, so the pick is announced the same (pressed); read-only ones say unavailable
        const side = el(seed == null ? "span" : "button", "pk-side");
        side.dataset.side = i ? "p2" : "p1";
        if (seed == null) side.append(el("span", "muted", "Not picked yet"));
        else {
          side.type = "button";
          side.append(el("span", "pk-seed", String(seed)), el("span", "", pkName(seed)));
          side.setAttribute("aria-pressed", String(clean[m.id] === seed));
          if (fixed) side.setAttribute("aria-disabled", "true");
          else side.addEventListener("click", () => pkPick(m.id, seed));
        }
        card.append(side);
      });
      if (m.winner != null) {
        const res = el("p", "pk-result");
        if (clean[m.id] === m.winner) res.append(el("span", "badge win", `Right, +${r.points}`), " ");
        else if (clean[m.id] != null) res.append(el("span", "badge", "Wrong"), " ");
        res.append(`${pkName(m.winner)} won`);
        card.append(res);
      }
      body.append(card);
    }
    col.append(body);
    box.append(col);
  }
  $("pk-bracket").replaceChildren(box);
  pkLines(box);
  const v = $("pk-viewing");
  v.hidden = !pk.viewing;
  if (pk.viewing) {
    const back = el("button", "small", pk.user ? "Back to mine" : "Close");
    back.type = "button";
    back.addEventListener("click", () => { pk.viewing = null; pkDraw(); });
    v.replaceChildren(`Showing ${pk.viewing.name}'s bracket. `, back);
  }
}
/** Lines from each match's right edge to the player slot its winner moves into, drawn over the laid-out cards. */
function pkLines(box) {
  const NS = "http://www.w3.org/2000/svg";
  const draw = () => {
    if (!box.isConnected) return;
    box.querySelector("svg.pk-lines")?.remove();
    const o = box.getBoundingClientRect();
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "pk-lines");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", box.scrollWidth);
    svg.setAttribute("height", box.scrollHeight);
    for (const m of pk.bracket.matches) {
      for (const [k, s] of [["p1", m.p1], ["p2", m.p2]]) {
        if (!s.from) continue;
        const a = box.querySelector(`.pk-match[data-id="${s.from}"]`)?.getBoundingClientRect();
        const t = box.querySelector(`.pk-match[data-id="${m.id}"] [data-side="${k}"]`)?.getBoundingClientRect();
        if (!a || !t) continue;
        const x1 = a.right - o.left, y1 = a.top + a.height / 2 - o.top, x2 = t.left - o.left, y2 = t.top + t.height / 2 - o.top;
        const mid = Math.round((x1 + x2) / 2);
        const p = document.createElementNS(NS, "path");
        p.setAttribute("d", `M${x1} ${y1}H${mid}V${y2}H${x2}`);
        svg.append(p);
      }
    }
    box.prepend(svg);
  };
  requestAnimationFrame(draw);
  if (pkObserver) pkObserver.disconnect();
  if (window.ResizeObserver) (pkObserver = new ResizeObserver(() => requestAnimationFrame(draw))).observe(box);
}
let pkObserver = null;  // redraws the lines when the bracket's size changes (the window, the fonts loading)

/** The leaderboard: everyone who has picked, by points (equal points share a place). After the lock everyone's
    picks can be read, so it adds what each can still reach and a button to open their bracket. */
async function pkBoard() {
  const { data, error } = await pk.sb.rpc("pickem_leaderboard", { c: PK.contest });
  if (error) { $("pk-board-note").textContent = "The leaderboard didn't load."; return; }
  const locked = pkLocked(), all = pk.bracket.matches.length;
  if (locked && !pk.all) {
    const { data: picks } = await pk.sb.from("picks").select("person_id, match_id, pick").eq("contest_id", PK.contest);
    pk.all = {};
    for (const r of picks || []) (pk.all[r.person_id] = pk.all[r.person_id] || {})[r.match_id] = r.pick;
  }
  const ranks = League.pickemRanks(data);
  $("pk-board").parentNode.hidden = !ranks.length;
  $("pk-board-note").textContent = !ranks.length ? "Nobody has picked yet."
    : locked ? "Equal points share a place. Can still reach: the points if every pick still in it wins."
    : "Everyone who has picked so far. Brackets open to everyone when picks lock.";
  simpleTable($("pk-board"), [["Place", "num"], ["Player", ""], ["Points", "num"], ["Picked", "num"],
    ...(locked ? [["Can still reach", "num"], ["", ""]] : [])],
    ranks.map((e) => {
      const theirs = pk.all && pk.all[e.person_id];
      const open = el("button", "small", "Bracket");
      open.type = "button";
      open.addEventListener("click", () => {
        pk.viewing = { name: e.name, picks: theirs || {} };
        pkDraw();
        $("pk-viewing").scrollIntoView({ block: "nearest" });
      });
      return [[String(e.place), "num"], [e.name + (pk.user && e.person_id === pk.user.id ? " (you)" : ""), ""], [String(e.points), "num"],
        [`${e.picked} of ${all}`, "num"],
        ...(locked ? [[theirs ? String(League.pickemScore(pk.bracket, theirs).possible) : "–", "num"], [theirs ? open : "", ""]] : [])];
    }));
}
