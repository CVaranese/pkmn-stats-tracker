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
  const status = part("p", "muted bet-slip-status", "bet-status-line");
  status.setAttribute("role", "status");
  const wrap = el("div", "table-wrap");
  wrap.hidden = true;
  wrap.append(part("table", "", "bet-board"));
  // the tickets on the left; on the right the slip they fill in, and the leaderboard
  const slip = el("section", "bet-slip");
  slip.append(part("h3", "", "bet-slip-title"), part("p", "hint", "bet-viewing"), part("ul", "bet-slip-list", "bet-slip-list"), status);
  const side = el("aside", "bet-side");
  side.append(slip, el("h2", "section-title", "Leaderboard"), part("p", "hint", "bet-board-note"), wrap);
  const cols = el("div", "bet-cols");
  cols.append(part("div", "bet-cards", "bet-list"), side);
  $("bet-draw").replaceChildren(el("h2", "section-title", "Playoff bets"), part("div", "lock-band", "bet-countdown"),
    part("p", "hint bet-note", "bet-intro"), part("div", "bet-note", "bet-account"), cols);
}

/** The time left until bets lock; the store enforces the lock whatever the visitor's clock says. */
function btCountdown() {
  const box = $("bet-countdown");
  clearInterval(btTimer);
  box.hidden = btLocked();
  if (box.hidden) return;
  const tick = () => {
    if (!btLocked()) { drawLockBand(box, "Bets lock in", bt.lockAt); return; }
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
  const s = Bet.BET_STAKE;
  $("bet-intro").textContent = (btLocked() ? "Bets are locked: anyone's slip opens from the leaderboard. " : "") +
    `These bets cover the whole playoffs, every game of every round added up. Play money, ${s} points a bet: right +${s}, wrong -${s}, ` +
    `and a void bet gives its ${s} back. Your lock counts double, won or lost.`;
  const bar = $("bet-account");
  if (btLocked() || (bt.user && bt.member)) bar.replaceChildren();
  else if (bt.user) {
    bar.replaceChildren(el("span", "", "Signed in, but not as a member of this league's Discord server, so bets can't be saved. Just joined it? Sign out and sign in again."));
  } else {
    // the button is the header's (user 2026-11-06: one sign-in button, not two)
    bar.replaceChildren(el("span", "muted", "Sign in with Discord at the top of the page to bet. Bets are for members of this league's Discord server."));
  }
  const v = $("bet-viewing");
  v.hidden = !bt.viewing;
  if (bt.viewing) {
    const back = el("button", "small", bt.user ? "Back to mine" : "Close");
    back.type = "button";
    back.addEventListener("click", () => {
      bt.viewing = null;
      btDraw();
      // the button just went: on to the slip it came back to
      $("bet-slip-title").tabIndex = -1;
      $("bet-slip-title").focus();
    });
    v.replaceChildren(`Showing ${bt.viewing.name}'s slip. `, back);
  }
  $("bet-slip-title").textContent = "Your slip";
  $("bet-slip-title").hidden = !!bt.viewing;
  const slip = bt.viewing || bt, placed = bt.props.filter((x) => slip.mine[x.bet_id]);
  $("bet-slip-list").replaceChildren(...(placed.length ? placed.map((x) => btSlipRow(x, slip)) : [el("li", "muted", "Nothing picked yet.")]));
  // the cards are rebuilt: a keyboard user stays on the button they pressed
  const focused = document.activeElement && document.activeElement.dataset.focus;
  $("bet-list").replaceChildren(...bt.props.map(btCard));
  if (focused) {
    const again = [...$("bet-list").querySelectorAll("button")].find((b) => b.dataset.focus === focused);
    if (again) again.focus();
  }
}

/** A bet's wording as [name, what's in brackets (a smaller line under it)]. */
function btWording(x) {
  const prop = btProp(x.bet_id);
  return (prop ? prop.text : x.bet_id).match(/^(.*?)(?: \((.*)\))?$/).slice(1);
}
/** One line of the slip: the bet, the pick and, once settled, what it scored. */
function btSlipRow(x, slip) {
  const pick = slip.mine[x.bet_id], isLock = slip.lock === x.bet_id;
  const li = el("li");
  li.append(el("span", "", btWording(x)[0] + (isLock ? " (lock)" : "")));
  const worth = Bet.BET_STAKE * (isLock ? 2 : 1);
  const scored = !x.outcome ? "" : x.outcome === "void" ? ", void" : `, ${btPoints(pick === x.outcome ? worth : -worth)}`;
  li.append(el("b", "", pick + (x.kind === "ou" ? ` ${Number(x.line)}` : "") + scored));
  return li;
}

/** One ticket: the stripe (style.css) and the bet's wording, then the line between its two sides (read-only on someone
    else's slip, signed out, or after the lock), and at the foot the lock as a tear-off stub or how it came out. */
function btCard(x) {
  const prop = btProp(x.bet_id);
  const slip = bt.viewing || bt;
  const pick = slip.mine[x.bet_id];
  const fixed = !!bt.viewing || !btCan();
  const isLock = slip.lock === x.bet_id;
  const card = el("article", "bet");
  const [title, note] = btWording(x);
  const top = el("div", "bet-top");
  top.append(el("h3", "", title));
  if (note) top.append(el("p", "bet-sub", note));
  if (isLock) {
    const tag = el("p", "bet-lock-tag");
    tag.append(el("span", "badge win", "Lock: counts double"));
    top.append(tag);
  }
  card.append(top);
  const sides = el("div", "bet-sides");
  sides.setAttribute("role", "group");
  sides.setAttribute("aria-label", prop ? prop.text : x.bet_id);
  const sideButton = (side) => {
    const b = el("button", "pk-side", side);
    b.type = "button";
    b.dataset.focus = x.bet_id + "|" + side;
    b.setAttribute("aria-pressed", String(pick === side));
    if (fixed) b.setAttribute("aria-disabled", "true");
    else b.addEventListener("click", () => btPick(x.bet_id, side));
    return b;
  };
  // the buttons around the number say what it is, so "Over / under" is only for screen readers
  const mid = el("span", x.kind === "ou" ? "bet-num" : "bet-or", x.kind === "ou" ? "" : "or");
  if (x.kind === "ou") mid.append(el("span", "sr-only", "Over / under "), String(Number(x.line)));
  sides.append(...(x.kind === "ou" ? [sideButton("Over"), mid, sideButton("Under")] : [sideButton("Yes"), mid, sideButton("No")]));
  card.append(sides);
  if (!fixed) {
    const b = el("button", "small bet-lock", isLock ? "Remove my lock" : "Make this my lock");
    b.type = "button";
    b.dataset.focus = x.bet_id + "|lock";
    b.setAttribute("aria-pressed", String(isLock));
    // always at full strength (user 2026-11-06: it should pop), so with no pick it says what to do first
    b.addEventListener("click", () => {
      if (pick) btSetLock(isLock ? null : x.bet_id);
      else btStatus(`Pick ${x.kind === "ou" ? "Over or Under" : "Yes or No"} on that bet first, then make it your lock.`);
    });
    card.append(b);
  } else if (x.outcome || x.detail || btLocked()) card.append(btResult(x, pick, isLock));
  return card;
}

function btResult(x, pick, isLock) {
  const out = el("p", "bet-result");
  if (!x.outcome) {
    out.append(el("span", "muted", x.detail ? `${x.detail} so far` : "Not settled yet"));
    return out;
  }
  if (x.outcome === "void") {
    out.append(el("span", "badge", "Void"), " A game has no replay: stake back.");
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
    // a delete the store's rules refuse removes nothing and gives no error, so count what came back
    if (gone.length) {
      const { data, error } = await bt.sb.from("bets").delete().eq("contest_id", BT.contest).eq("person_id", bt.user.id).in("bet_id", gone).select("bet_id");
      if (error) throw error;
      if (data.length !== gone.length) throw new Error("the store kept it; reload the page");
    }
    if (wantLock && wantLock !== bt.savedLock) {
      const { error } = await bt.sb.from("bet_locks").upsert({ ...key, bet_id: wantLock });
      if (error) throw error;
    } else if (!wantLock && bt.savedLock && !gone.includes(bt.savedLock)) {  // else it went with its pick
      const { data, error } = await bt.sb.from("bet_locks").delete().eq("contest_id", BT.contest).eq("person_id", bt.user.id).select("bet_id");
      if (error) throw error;
      if (!data.length) throw new Error("the store kept it; reload the page");
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
  // again while someone's is missing: a clock a little fast asks before the store has locked, and gets only your own
  if (locked && (!bt.slips || data.some((e) => !bt.slips[e.person_id]))) bt.slips = await btLoadSlips();
  const ranks = League.pickemRanks(data.map((e) => ({ ...e, points: e.score })));
  $("bet-board").parentNode.hidden = !ranks.length;
  $("bet-board-note").textContent = !ranks.length ? "Nobody has bet yet."
    : btHouseText(data) + (locked ? "Record is right-wrong-void. Equal scores share a place." : "Everyone who has bet so far. Slips open to everyone when bets lock.");
  const all = bt.props.length;
  const you = (e) => e.name + (bt.user && e.person_id === bt.user.id ? " (you)" : "");
  // a narrow column: before the lock nobody has a score yet, so who has bet and how many
  if (!locked) {
    simpleTable($("bet-board"), [["Player", ""], ["Placed", "num"]], ranks.map((e) => [[you(e), ""], [`${e.picked} of ${all}`, "num"]]));
    return;
  }
  simpleTable($("bet-board"), [["Place", "num"], ["Player", ""], ["Score", "num"], ["Record", "num"], ["", ""]],
    ranks.map((e) => {
      const theirs = bt.slips && bt.slips[e.person_id];
      const open = el("button", "small", "Slip");
      open.type = "button";
      open.addEventListener("click", () => {
        bt.viewing = { name: e.name, ...theirs };
        btDraw();
        $("bet-viewing").scrollIntoView({ block: "nearest" });
      });
      return [[String(e.place), "num"], [you(e), ""], [btPoints(e.score), "num"], [`${e.won}-${e.lost}-${e.voided}`, "num"], [theirs ? open : "", ""]];
    }));
}
