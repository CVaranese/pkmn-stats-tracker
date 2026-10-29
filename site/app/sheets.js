/* Team sheets: the boxes, the saved sheets (site/mock/, index.json "sheets"), max HP from sheets or guesses. */
"use strict";

// team sheets: one box each, remembered like the links
let savedSheets = [];
// a game's saved team sheets (site/mock/<id>-<player>.txt), filled in when it loads: index.json "sheets" lists the players
const sheetsOf = (id) => (library.find((g) => g.id === id) || {}).sheets || [];
// hand-made sets for a game (site/mock/<id>-<player>.fix.txt: pieced together from the game when the paste had another
// Pokémon), read before the paste so the paste file stays as the player gave it: index.json "fixes" lists the players
const fixesOf = (id) => (library.find((g) => g.id === id) || {}).fixes || [];
// every saved sheet, parsed, by player ID (draft aliases resolved): for guessing max HP in their other games
let mockPoolLoad = null;  // the load itself, so two callers at once share it
const mockSheets = [];  // [{ gameId, player, sets, text, from }]: the same sheets and the hand-made sets, per game
function loadMockPool() {
  return mockPoolLoad || (mockPoolLoad = readMockSheets());
}
async function readMockSheets() {
  await libraryReady;
  await loadDraft();  // playerKey files each sheet under the draft name (DEJIME17 -> DEJIME)
  const pool = new Map();
  const files = library.flatMap((g) => [...fixesOf(g.id).map((p) => [g.id, p, "pieced"]), ...sheetsOf(g.id).map((p) => [g.id, p, "sheet"])]);
  const read = await Promise.all(files.map(async ([id, player, from]) => {
    try {
      const resp = await fetch(`${DIR}mock/${id}-${player}${from === "pieced" ? ".fix" : ""}.txt`);
      if (!resp.ok) return null;
      const text = (await resp.text()).trim();
      return { gameId: id, player, sets: TS.parseTeam(text), text, from };
    } catch (e) { return null; }  // missing file: just fewer guesses
  }));
  // in file order: a game's hand-made sets before its pastes, so they win in TS.attachSets
  for (const s of read.filter(Boolean)) {
    mockSheets.push(s);
    if (s.from === "sheet") addToPool(pool, s.player, s.gameId, s.sets);  // pieced sets have no EVs: no use for guesses
  }
  return pool;
}
/** Max HP on each row: its sheet (row.set), else a guess (Smogon, the player's other sheets, base stats);
    item / ability / moves from the sheet, else what the game showed. Then raw HP from the % figures. */
function fillMaxHp(rows, dex, smogon, pool) {
  for (const r of rows) {
    const s = r.set;
    r.max_hp = ""; r.max_hp_from = ""; r.max_hp_note = "";
    if (s && dex && s.evsListed !== false) {
      r.max_hp = TS.maxHp(s, dex) ?? "";
      if (r.max_hp) { r.max_hp_from = "sheet"; r.max_hp_note = r.set_from === "pieced" ? "From a set put together by hand." : "From the team sheet."; }
    } else if (dex && r.mon_key) {
      // no sheet for this side, or a set with no EVs: Smogon's spreads, the same player's other sheets, then base stats
      const others = (pool.get(playerKey(r.player)) || []).filter((p) => p.gameId !== r.replay_id);
      const g = TS.guessMaxHp(r.pokemon, others, smogon, dex);
      if (g) { r.max_hp = g.max_hp; r.max_hp_from = HP_FROM[g.from]; r.max_hp_note = (s ? "Guess, the set has no EVs: " : "Guess, no sheet: ") + g.note + "."; }
    }
    // without a sheet: what the game showed (first item / ability revealed, moves used)
    const seenMoves = (r.move_stats || []).filter((m) => !m.source && !m.z && m.uses > 0 && m.move).map((m) => m.move);
    r.item = s ? s.item : r.seen_item || "";
    r.ability = s ? s.ability : r.seen_ability || "";
    r.moves = s ? s.moves.join(" / ") : seenMoves.join(" / ");
    r.set_from = s ? r.set_from || "sheet" : r.item || r.ability || r.moves ? "seen" : "";
  }
  RS.addDamageHp(rows);
}
function addToPool(pool, player, gameId, sets) {
  const k = playerKey(player);
  if (!pool.has(k)) pool.set(k, []);
  const g = library.find((x) => x.id === gameId);
  const label = g && g.week ? g.week : gameId;
  for (const set of sets) {
    if (!pool.get(k).some((p) => p.gameId === gameId && p.set.species === set.species)) pool.get(k).push({ set, gameId, label });
  }
}
async function addMockSheets(ids) {
  const have = new Set(sheetInputs().map((t) => t.trim()));
  for (const id of ids) {
    for (const player of sheetsOf(id)) {
      try {
        const resp = await fetch(`${DIR}mock/${id}-${player}.txt`);
        const text = resp.ok ? (await resp.text()).trim() : "";
        if (text && !have.has(text)) { addSheetBox(text); have.add(text); }
      } catch (e) { /* no saved sheet: the game still loads */ }
    }
  }
  saveSheets();
}
function addSheetBox(text) {
  const box = document.createElement("div");
  box.className = "sheet";
  const ta = document.createElement("textarea");
  ta.rows = 3;
  ta.spellcheck = false;
  ta.setAttribute("aria-label", "Team sheet: Pokepaste link or Showdown export");
  ta.placeholder = "https://pokepast.es/…  or paste the export:\nGarchomp @ Rocky Helmet\nAbility: Rough Skin\n…";
  ta.value = text;
  ta.addEventListener("input", saveSheets);
  const status = Object.assign(document.createElement("span"), { className: "status" });
  const remove = Object.assign(document.createElement("button"), { type: "button", textContent: "Remove" });
  remove.addEventListener("click", () => { box.remove(); saveSheets(); });
  const row = document.createElement("div");
  row.className = "row";
  row.append(remove, status);
  box.append(ta, row);
  $("sheets").appendChild(box);
  return box;
}
function sheetInputs() {
  return [...$("sheets").querySelectorAll("textarea")].map((t) => t.value);
}
function saveSheets() {
  try { localStorage.setItem(SHEETS_KEY, JSON.stringify(sheetInputs().filter((t) => t.trim()))); } catch (e) { /* storage blocked */ }
}
/** Sets for the rows of library games, one Pokémon at a time (TS.attachSets): their hand-made sets, and each saved paste
    that `keep` allows (Main viewer: only while its box is still there). Returns mockSheets' entries used and how. */
function attachSaved(rows, keep = () => true) {
  const ids = new Set(rows.map((r) => r.replay_id));
  const sources = mockSheets.filter((s) => ids.has(s.gameId) && (s.from === "pieced" || keep(s)));
  for (const r of rows) { delete r.set; delete r.set_from; }
  const used = TS.attachSets(rows, sources);
  return sources.map((s, i) => ({ ...s, used: used[i] }));
}
/** Read every sheet box, match the sheets to the loaded games, add max HP / item / ability / moves to rows. */
async function applySheets(rows, errors) {
  const boxes = [...$("sheets").querySelectorAll(".sheet")];
  const sheets = await Promise.all(boxes.map(async (box) => {
    const text = box.querySelector("textarea").value;
    if (!text.trim()) return { sets: [], note: "" };
    const id = TS.pokepasteIdFrom(text);
    try {
      if (id && !pasteCache.has(id)) pasteCache.set(id, await TS.fetchPokepaste(id));
      const sets = TS.parseTeam(id ? pasteCache.get(id) : text);
      if (!sets.length) return { sets, bad: true, note: "No Pokémon found. Paste a Pokepaste link or a Showdown export." };
      return { sets, note: (id ? "Pokepaste: " : "") + sets.map((s) => s.species).join(", ") };
    } catch (e) {
      return { sets: [], bad: true, note: String(e.message || e) };
    }
  }));
  let dex = null, smogon = null, pool = new Map();
  if (rows.length) [smogon, pool] = await Promise.all([TS.loadSmogonHp("data/smogon_hp.json"), loadMockPool()]);
  // a library game's saved paste goes per Pokémon on its own side; any other sheet only on a side all 6 fit
  const texts = sheets.map((sh, i) => (sh.sets.length ? boxes[i].querySelector("textarea").value.trim() : ""));
  const saved = attachSaved(rows, (s) => texts.includes(s.text));
  const sideKey = (id, player) => id + "|" + player;
  const done = new Set(rows.filter((r) => r.set).map((r) => sideKey(r.replay_id, r.player)));
  const matches = TS.attachSheets(rows.filter((r) => !done.has(sideKey(r.replay_id, r.player))), sheets);

  if (rows.length) {
    try { dex = await TS.loadDex(); } catch (e) { errors.push(`Pokédex (for max HP): ${e.message || e}`); }
    pool = new Map([...pool].map(([k, v]) => [k, v.slice()]));
    sheets.forEach((sh, i) => matches[i].forEach(([id, player]) => addToPool(pool, player, id, sh.sets)));
  }
  fillMaxHp(rows, dex, smogon, pool);

  boxes.forEach((box, i) => {
    const st = box.querySelector(".status");
    const sh = sheets[i];
    let used = "";
    if (sh.sets.length && rows.length) {
      // sides it gave sets to: all 6 (a pasted sheet), or some (a library game's saved paste, per Pokémon)
      const got = [...matches[i].map(([id, player]) => ({ replay_id: id, player })),
        ...saved.filter((s) => s.from === "sheet" && s.text === texts[i]).flatMap((s) => s.used)];
      const players = [...new Set(got.map((g) => g.player))];
      const part = got.filter((g) => g.paired < g.of).map((g) => `${g.paired} of its ${g.of} Pokémon`);
      used = got.length
        ? ` · used for ${players.join(", ")} in ${got.length} game${got.length === 1 ? "" : "s"}${part.length ? ` (${part.join(", ")})` : ""}`
        : " · no loaded game has exactly this team";
    }
    st.textContent = sh.note + used;
    st.classList.toggle("bad", !!sh.bad);
  });
}
