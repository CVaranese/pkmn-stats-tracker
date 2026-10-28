/* Team sheets: the boxes, the saved sheets (site/mock/, index.json "sheets"), max HP from sheets or guesses. */
"use strict";

// team sheets: one box each, remembered like the links
let savedSheets = [];
// a game's saved team sheets (site/mock/<id>-<player>.txt), filled in when it loads: index.json "sheets" lists the players
const sheetsOf = (id) => (library.find((g) => g.id === id) || {}).sheets || [];
// every saved sheet, parsed, by player ID (draft aliases resolved): for guessing max HP in their other games
let mockPoolLoad = null;  // the load itself, so two callers at once share it
const mockSheets = [];  // [{ gameId, sets }]: the same sheets, per game (the Fantasy tab matches them itself)
function loadMockPool() {
  return mockPoolLoad || (mockPoolLoad = readMockSheets());
}
async function readMockSheets() {
  await libraryReady;
  await loadDraft();  // playerKey files each sheet under the draft name (DEJIME17 -> DEJIME)
  const pool = new Map();
  await Promise.all(library.flatMap((g) => sheetsOf(g.id).map(async (player) => {
    const id = g.id;
    try {
      const resp = await fetch(`${DIR}mock/${id}-${player}.txt`);
      if (!resp.ok) return;
      const sets = TS.parseTeam(await resp.text());
      addToPool(pool, player, id, sets);
      mockSheets.push({ gameId: id, sets });
    } catch (e) { /* missing file: just fewer guesses */ }
  })));
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
      if (r.max_hp) { r.max_hp_from = "sheet"; r.max_hp_note = "From the team sheet."; }
    } else if (dex && r.mon_key) {
      // no sheet for this side, or a set with no EVs: Smogon's spreads, the same player's other sheets, then base stats
      const others = (pool.get(playerKey(r.player)) || []).filter((p) => p.gameId !== r.replay_id);
      const g = TS.guessMaxHp(r.pokemon, others, smogon, dex);
      if (g) { r.max_hp = g.max_hp; r.max_hp_from = HP_FROM[g.from]; r.max_hp_note = "Guess, no sheet: " + g.note + "."; }
    }
    // without a sheet: what the game showed (first item / ability revealed, moves used)
    const seenMoves = (r.move_stats || []).filter((m) => !m.source && !m.z && m.uses > 0 && m.move).map((m) => m.move);
    r.item = s ? s.item : r.seen_item || "";
    r.ability = s ? s.ability : r.seen_ability || "";
    r.moves = s ? s.moves.join(" / ") : seenMoves.join(" / ");
    r.set_from = s ? "sheet" : r.item || r.ability || r.moves ? "seen" : "";
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
  const matches = TS.attachSheets(rows, sheets);

  let dex = null, smogon = null, pool = new Map();
  if (rows.length) {
    try { dex = await TS.loadDex(); } catch (e) { errors.push(`Pokédex (for max HP): ${e.message || e}`); }
    [smogon, pool] = await Promise.all([TS.loadSmogonHp("data/smogon_hp.json"), loadMockPool()]);
    pool = new Map([...pool].map(([k, v]) => [k, v.slice()]));
    sheets.forEach((sh, i) => matches[i].forEach(([id, player]) => addToPool(pool, player, id, sh.sets)));
  }
  fillMaxHp(rows, dex, smogon, pool);

  boxes.forEach((box, i) => {
    const st = box.querySelector(".status");
    const sh = sheets[i];
    let used = "";
    if (sh.sets.length && rows.length) {
      const players = [...new Set(matches[i].map(([, p]) => p))];
      used = matches[i].length
        ? ` · used for ${players.join(", ")} in ${matches[i].length} game${matches[i].length === 1 ? "" : "s"}`
        : " · no loaded game has exactly this team";
    }
    st.textContent = sh.note + used;
    st.classList.toggle("bad", !!sh.bad);
  });
}
