/* Gambling tab (leagues with bets in site/leagues.json): one slate of play-money bets on the whole playoffs, read from
   the Supabase store with the outcomes (written by tools/bets.py; wording from Bet.PROPS), picked after the Discord
   sign-in (app/account.js). The store enforces who can bet (members of the league's Discord server) and the lock, which
   is the Pick'em contest's; everyone's slips open after it. Other leagues keep the "Under construction" box. */
"use strict";

const BT = LEAGUE.bets;
// { sb, lockAt, props, user, member, mine, lock, saved, savedLock, viewing, slips } (mine / lock: this person's, as
// clicked; saved / savedLock: as the store has them; viewing: { name, mine, lock }, someone else's slip)
let bt = null;
let btStarted = null;
let btSaving = Promise.resolve();
let btTimer = null;  // the countdown's ticking

const btLocked = () => Date.now() >= bt.lockAt.getTime();
const btStatus = (text) => { $("bet-status-line").textContent = text; };
const btProp = (id) => Bet.PROPS.find((p) => p.id === id);
const btCan = () => bt.user && bt.member && !btLocked();
const btPoints = (n) => (n > 0 ? "+" : "") + n;

async function renderBets() {
  if (!BT) return;
  if (!btStarted) btStarted = btStart().catch((e) => { btStarted = null; btStatus(e.message || String(e)); });
  await btStarted;
}

async function btStart() {
  document.querySelector("#gamble .soon").hidden = true;
  if (!$("bet-draw").childElementCount) btBuild();
  $("bet-draw").hidden = false;
  btStatus("Loading the bets…");
  const store = accountClient().then((sb) => Promise.all([sb,
    sb.from("contests").select("lock_at").eq("id", BT.contest).single(),
    sb.from("bet_props").select("bet_id, kind, line, outcome, detail").eq("contest_id", BT.contest).order("position")]));
  const [[sb, { data: contest, error }, { data: props, error: pErr }]] = await Promise.all([store, accountReady()]);
  if (error || pErr) throw new Error("The bets store didn't answer. Reload the page to try again.");
  bt = { sb, lockAt: new Date(contest.lock_at), props, user: acct.user, member: acct.member, mine: {}, lock: null, saved: {}, savedLock: null, viewing: null, slips: null };
  if (bt.user) await btLoadMine();
  btCountdown();
  btDraw();
  btStatus(acct.error || btPlacedText());
  await btBoard();
}

async function btLoadMine() {
  const [{ data: picks, error }, { data: locks, error: lErr }] = await Promise.all([
    bt.sb.from("bets").select("bet_id, pick").eq("contest_id", BT.contest).eq("person_id", bt.user.id),
    bt.sb.from("bet_locks").select("bet_id").eq("contest_id", BT.contest).eq("person_id", bt.user.id)]);
  if (error || lErr) throw new Error("Your bets didn't load. Reload the page to try again.");
  bt.saved = Object.fromEntries(picks.map((r) => [r.bet_id, r.pick]));
  bt.savedLock = locks.length ? locks[0].bet_id : null;
  bt.mine = { ...bt.saved };
  bt.lock = bt.savedLock;
}

/** The parts of the block, made here: the page itself is the same for leagues with no bets. */
function btBuild() {
  const part = (tag, cls, id) => Object.assign(el(tag, cls), { id });
  const status = part("p", "muted", "bet-status-line");
  status.setAttribute("role", "status");
  const wrap = el("div", "table-wrap");
  wrap.hidden = true;
  wrap.append(part("table", "", "bet-board"));
  $("bet-draw").replaceChildren(el("h2", "section-title", "Playoff bets"), part("p", "hint", "bet-intro"),
    part("p", "pk-countdown", "bet-countdown"), part("div", "pl-bar", "bet-account"), status,
    part("p", "hint", "bet-viewing"), part("div", "award-grid", "bet-list"),
    el("h2", "section-title", "Leaderboard"), part("p", "hint", "bet-board-note"), wrap);
}

/** The time left until bets lock; the store enforces the lock whatever the visitor's clock says. */
function btCountdown() {
  const box = $("bet-countdown");
  clearInterval(btTimer);
  box.hidden = btLocked();
  if (box.hidden) return;
  const tick = () => {
    if (!btLocked()) { box.textContent = "Bets lock in " + League.countdown(bt.lockAt.getTime() - Date.now()); return; }
    clearInterval(btTimer);
    box.hidden = true;
    btLockNow("Bets are locked now.");
  };
  tick();
  btTimer = setInterval(tick, 1000);
}
/** The lock passed with the page open: back to what was saved, and redraw it locked. */
function btLockNow(message) {
  bt.mine = { ...bt.saved };
  bt.lock = bt.savedLock;
  bt.viewing = null;
  btDraw();
  btStatus(message);
  btBoard().catch((e) => btStatus(e.message || String(e)));
}

function btPlacedText() {
  if (btLocked()) return "";
  const n = Object.keys(bt.mine).length, all = bt.props.length;
  if (!n) return `No bets placed yet: ${all} to pick.`;
  return `${btCan() ? "Saved" : "Not saved"}: ${n} of ${all} bets placed, ${bt.lock ? "lock set" : "no lock set"}. You can change them until bets lock.`;
}

function btDraw() {
  const n = bt.props.length, s = Bet.BET_STAKE;
  $("bet-intro").textContent = (btLocked() ? "Bets are locked: anyone's slip opens from the leaderboard. " : "") +
    `${n} bets on the whole playoffs, every game of every round added up. Play money, ${s} points a bet: right +${s}, wrong -${s}, ` +
    `and a bet that can't be settled gives its ${s} back. Your lock counts double, won or lost.`;
  const bar = $("bet-account");
  if (btLocked() || (bt.user && bt.member)) bar.replaceChildren();
  else if (bt.user) {
    bar.replaceChildren(el("span", "", "Signed in, but not as a member of this league's Discord server, so bets can't be saved. Just joined it? Sign out and sign in again."));
  } else {
    const b = el("button", "primary", "Sign in with Discord");
    b.type = "button";
    b.addEventListener("click", async () => {
      btStatus("Opening Discord…");
      btStatus(await accountSignIn());
    });
    bar.replaceChildren(b, el("span", "muted", "Bets are for members of this league's Discord server."));
  }
  const v = $("bet-viewing");
  v.hidden = !bt.viewing;
  if (bt.viewing) {
    const back = el("button", "small", bt.user ? "Back to mine" : "Close");
    back.type = "button";
    back.addEventListener("click", () => { bt.viewing = null; btDraw(); });
    v.replaceChildren(`Showing ${bt.viewing.name}'s slip. `, back);
  }
  $("bet-list").replaceChildren(...bt.props.map(btCard));
}

/** One bet: its wording and line, the two sides (read-only on someone else's slip, signed out, or after the lock), the
    lock button, and how it came out. */
function btCard(x) {
  const prop = btProp(x.bet_id);
  const slip = bt.viewing || bt;
  const pick = slip.mine[x.bet_id];
  const fixed = !!bt.viewing || !btCan();
  const isLock = slip.lock === x.bet_id;
  const card = el("article", "award bet");
  card.append(el("h3", "", prop ? prop.text : x.bet_id));
  card.append(el("p", "bet-line", x.kind === "ou" ? `Over / under ${Number(x.line)}` : "Yes or no"));
  const sides = el("div", "bet-sides");
  sides.setAttribute("role", "group");
  sides.setAttribute("aria-label", prop ? prop.text : x.bet_id);
  for (const side of x.kind === "ou" ? ["Over", "Under"] : ["Yes", "No"]) {
    const b = el("button", "pk-side", side);
    b.type = "button";
    b.setAttribute("aria-pressed", String(pick === side));
    if (fixed) b.setAttribute("aria-disabled", "true");
    else b.addEventListener("click", () => btPick(x.bet_id, side));
    sides.append(b);
  }
  card.append(sides);
  if (!fixed) {
    const b = el("button", "small bet-lock", isLock ? "Your lock: counts double" : "Make this my lock");
    b.type = "button";
    b.setAttribute("aria-pressed", String(isLock));
    b.disabled = !pick;
    b.addEventListener("click", () => btSetLock(isLock ? null : x.bet_id));
    card.append(b);
  } else if (isLock) card.append(el("p", "bet-line", "Lock: counts double"));
  card.append(btResult(x, pick, isLock));
  return card;
}

function btResult(x, pick, isLock) {
  const out = el("p", "bet-result");
  if (!x.outcome) {
    out.append(el("span", "muted", x.detail ? `${x.detail} so far` : "Not settled yet"));
    return out;
  }
  if (x.outcome === "void") {
    out.append(el("span", "badge", "Void"), " A game has no saved replay, so the stake goes back.");
    return out;
  }
  const worth = Bet.BET_STAKE * (isLock ? 2 : 1);
  if (pick === x.outcome) out.append(el("span", "badge win", `Right, +${worth}`), " ");
  else if (pick) out.append(el("span", "badge", `Wrong, -${worth}`), " ");
  out.append(x.kind === "ou" ? `${x.outcome}: ${x.detail}` : x.outcome + (x.detail ? `: ${x.detail}` : ""));
  return out;
}

/** A click on a side: picks it, or takes the pick back (and the lock with it, as the store does). */
function btPick(id, side) {
  if (btLocked()) { btLockNow("Bets are locked now, so that change wasn't made."); return; }
  if (bt.mine[id] === side) {
    delete bt.mine[id];
    if (bt.lock === id) bt.lock = null;
  } else bt.mine[id] = side;
  btDraw();
  btSave();
}
function btSetLock(id) {
  if (btLocked()) { btLockNow("Bets are locked now, so that change wasn't made."); return; }
  bt.lock = id;
  btDraw();
  btSave();
}
/** Sends what changed since the last save, one save at a time, picks before the lock (the store's lock needs its pick).
    A failed save is sent again with the next click. */
function btSave() {
  btSaving = btSaving.then(async () => {
    const want = { ...bt.mine }, wantLock = bt.lock;
    const key = { person_id: bt.user.id, contest_id: BT.contest };
    const up = Object.entries(want).filter(([id, pick]) => bt.saved[id] !== pick).map(([bet_id, pick]) => ({ ...key, bet_id, pick }));
    const gone = Object.keys(bt.saved).filter((id) => !(id in want));
    btStatus("Saving…");
    if (up.length) {
      const { error } = await bt.sb.from("bets").upsert(up);
      if (error) throw error;
    }
    if (gone.length) {
      const { error } = await bt.sb.from("bets").delete().eq("contest_id", BT.contest).eq("person_id", bt.user.id).in("bet_id", gone);
      if (error) throw error;
    }
    if (wantLock && wantLock !== bt.savedLock) {
      const { error } = await bt.sb.from("bet_locks").upsert({ ...key, bet_id: wantLock });
      if (error) throw error;
    } else if (!wantLock && bt.savedLock) {
      const { error } = await bt.sb.from("bet_locks").delete().eq("contest_id", BT.contest).eq("person_id", bt.user.id);
      if (error) throw error;
    }
    bt.saved = want;
    bt.savedLock = wantLock;
    btStatus(btPlacedText());
    await btBoard();
  }).catch((e) => {
    btStatus(btLocked() ? "Bets are locked, so that change wasn't saved." : "Not saved (" + (e.message || e) + "). Pick again to retry.");
  });
}

/** Everyone's slips, after the lock: { person id: { mine, lock } }. */
async function btLoadSlips() {
  const [{ data: picks, error }, { data: locks, error: lErr }] = await Promise.all([
    bt.sb.from("bets").select("person_id, bet_id, pick").eq("contest_id", BT.contest),
    bt.sb.from("bet_locks").select("person_id, bet_id").eq("contest_id", BT.contest)]);
  if (error || lErr) return null;
  const slips = {};
  const of = (id) => slips[id] || (slips[id] = { mine: {}, lock: null });
  for (const r of picks) of(r.person_id).mine[r.bet_id] = r.pick;
  for (const r of locks) of(r.person_id).lock = r.bet_id;
  return slips;
}

/** The house's side of the settled bets: what the players lost, less what they won. */
function btHouseText(rows) {
  if (!rows.some((e) => e.won + e.lost)) return "";
  const up = -rows.reduce((t, e) => t + e.score, 0);
  return up ? `The house is ${up > 0 ? "up" : "down"} ${Math.abs(up)}. ` : "The house is even. ";
}

/** Everyone who has bet, by score (equal scores share a place). After the lock, a button opens each slip. */
async function btBoard() {
  const { data, error } = await bt.sb.rpc("bets_leaderboard", { c: BT.contest });
  if (error) { $("bet-board-note").textContent = "The leaderboard didn't load."; return; }
  const locked = btLocked();
  if (locked && !bt.slips) bt.slips = await btLoadSlips();
  const ranks = League.pickemRanks(data.map((e) => ({ ...e, points: e.score })));
  $("bet-board").parentNode.hidden = !ranks.length;
  $("bet-board-note").textContent = !ranks.length ? "Nobody has bet yet."
    : btHouseText(data) + (locked ? "Equal scores share a place." : "Everyone who has bet so far. Slips open to everyone when bets lock.");
  const all = bt.props.length;
  simpleTable($("bet-board"), [["Place", "num"], ["Player", ""], ["Score", "num"], ["Right", "num"], ["Wrong", "num"], ["Void", "num"], ["Placed", "num"],
    ...(locked ? [["", ""]] : [])],
    ranks.map((e) => {
      const theirs = bt.slips && bt.slips[e.person_id];
      const open = el("button", "small", "Slip");
      open.type = "button";
      open.addEventListener("click", () => {
        bt.viewing = { name: e.name, ...theirs };
        btDraw();
        $("bet-viewing").scrollIntoView({ block: "nearest" });
      });
      return [[String(e.place), "num"], [e.name + (bt.user && e.person_id === bt.user.id ? " (you)" : ""), ""], [btPoints(e.score), "num"],
        [String(e.won), "num"], [String(e.lost), "num"], [String(e.voided), "num"], [`${e.picked} of ${all}`, "num"],
        ...(locked ? [[theirs ? open : "", ""]] : [])];
    }));
}
