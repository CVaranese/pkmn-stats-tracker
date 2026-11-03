/* The Discord sign-in, on every tab of a league with discord in site/leagues.json: one Supabase client and session for
   the whole page, the control in the header's top right, and the check that the person is in the league's Discord
   server (supabase/functions/pickem-join, which writes it to the store). Tabs that need the store (Pick'em) take the
   client from accountClient(), wait for accountReady() and read acct. */
"use strict";

const ACCT = LEAGUE.discord;  // { server, guild, supabase: { url, key } }
// supabase-js, pinned with its hash (2.118.0, 2026-10-15); loaded only for a stored session, a sign-in or a tab that needs it
const ACCT_LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.min.js";
const ACCT_LIB_HASH = "sha384-UagCvVPT5XXA0Hx+nJYUAGBFseHT9zBgpJMSebsAxl9lciTwbT+39j5VfRjdP5Tp";
// sb: the client once loaded; user / name / member: the signed-in person and whether they're in the league's server;
// error: why the sign-in or the Discord check didn't work (shown by the tabs that need it)
const acct = { sb: null, user: null, name: "", member: false, error: "" };
let acctClient = null, acctReady = null;

/** The shared client; the first call loads the library. PKCE: Discord sends the visitor back with ?code=, which the
    library swaps for a session on its own. */
function accountClient() {
  if (!acctClient) acctClient = new Promise((ok, fail) => {
    if (window.supabase) { ok(); return; }
    const s = Object.assign(document.createElement("script"), { src: ACCT_LIB, integrity: ACCT_LIB_HASH, crossOrigin: "anonymous" });
    s.onload = ok;
    s.onerror = () => fail(new Error("The sign-in library didn't load. Reload the page to try again."));
    document.head.append(s);
  }).then(() => (acct.sb = window.supabase.createClient(ACCT.supabase.url, ACCT.supabase.key, { auth: { flowType: "pkce" } })))
    .catch((e) => { acctClient = null; throw e; });
  return acctClient;
}

/** Who is signed in, once per page. Signed-out visitors (no stored session, no ?code= coming back from Discord) don't
    load the library at all. */
function accountReady() {
  if (!acctReady) acctReady = acctStart().catch((e) => { acct.error = e.message || String(e); }).then(() => acctDraw());
  return acctReady;
}
async function acctStart() {
  if (!acctStored()) return;
  acctDraw("Signing in…");
  const sb = await accountClient();
  const { data: { session } } = await sb.auth.getSession();
  acctDropCode();
  // a failed Discord check still shows the name and Sign out (the way to retry)
  if (session) await acctJoin(session);
}
/** A session saved by the library (its storage key: sb-<project ref>-auth-token) or a sign-in coming back. */
function acctStored() {
  if (new URL(location.href).searchParams.has("code")) return true;
  try { return !!localStorage.getItem("sb-" + new URL(ACCT.supabase.url).hostname.split(".")[0] + "-auth-token"); }
  catch (e) { return false; }  // storage blocked: the library can't keep a session either
}
/** Discord's sign-in comes back with ?code= (already swapped for a session by now): out of the address, so it isn't
    in links people copy or tried again on a reload. */
function acctDropCode() {
  const u = new URL(location.href);
  if (!u.searchParams.has("code")) return;
  u.searchParams.delete("code");
  try { history.replaceState(history.state, "", u.pathname + u.search + u.hash); } catch (e) { /* sandboxed frame */ }
}

/** The signed-in person's name and membership; right after a Discord sign-in (the Discord token is there), the
    pickem-join function checks the servers and writes them in. */
async function acctJoin(session) {
  const sb = acct.sb;
  acct.user = session.user;
  acct.name = (session.user.user_metadata || {}).full_name || "";  // until the people row says otherwise
  const [{ data: me }, { data: mem }] = await Promise.all([
    sb.from("people").select("name").eq("id", acct.user.id).maybeSingle(),
    sb.from("guild_members").select("guild_id").eq("guild_id", ACCT.guild)]);
  if (me) acct.name = me.name;
  acct.member = !!(mem && mem.length);
  if ((acct.member && me) || !session.provider_token) return;
  acctDraw("Checking the Discord server…");
  const r = await fetch(ACCT.supabase.url + "/functions/v1/pickem-join", {
    method: "POST",
    headers: { apikey: ACCT.supabase.key, Authorization: "Bearer " + session.access_token, "Content-Type": "application/json" },
    body: JSON.stringify({ provider_token: session.provider_token }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("The Discord check didn't work (" + (j.error || r.status) + "). Sign out and sign in again to retry.");
  acct.name = j.name;
  acct.member = (j.guilds || []).includes(ACCT.guild);
}

/** Off to Discord, coming back to this same view; the error text when it didn't start ("" when it did). */
async function accountSignIn() {
  try {
    const sb = await accountClient();
    const back = new URL(location.href);
    back.searchParams.delete("code");
    const { error } = await sb.auth.signInWithOAuth({ provider: "discord", options: { scopes: "identify guilds", redirectTo: back.href } });
    return error ? "Discord sign-in didn't start: " + error.message : "";
  } catch (e) { return e.message || String(e); }
}
async function accountSignOut() {
  if (acct.sb) await acct.sb.auth.signOut();
  location.reload();
}

/** The header's top right: Sign in with Discord, or the name and Sign out; busy: what it's doing meanwhile. */
function acctDraw(busy) {
  const box = $("account");
  box.hidden = false;
  if (typeof busy === "string") { box.replaceChildren(el("span", "muted", busy)); return; }
  if (!acct.user) {
    const b = el("button", "small", "Sign in with Discord");
    b.type = "button";
    const note = el("span", "muted", acct.error);
    b.addEventListener("click", async () => {
      note.textContent = "Opening Discord…";
      note.textContent = await accountSignIn();
    });
    box.replaceChildren(b, note);
    return;
  }
  const out = el("button", "small", "Sign out");
  out.type = "button";
  out.addEventListener("click", accountSignOut);
  const who = el("span", "", `Signed in as ${acct.name || "you"}`);
  box.replaceChildren(who, out);
  const why = acct.error || (acct.member ? "" : `Not a member of the ${ACCT.server} server`);
  if (why) box.insertBefore(el("span", "muted", why), out);
}
