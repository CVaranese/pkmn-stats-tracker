// The Discord sign-in's membership check (S-1; site-wide since S-2: site/app/account.js). The page calls this right
// after a Discord sign-in with the Discord token Supabase hands it (provider_token, scopes "identify guilds"). It
// checks the token belongs to the signed-in user, asks Discord which servers they're in, and writes their people row
// (Discord display name) and, when they're in a league's server (table leagues), their guild_members row, with the
// secret key. The picks write policy needs that row, so the page alone can't let anyone in. Nothing else from Discord is kept (not the token, not the server list).
//
// Deployed with verify_jwt off: the new sb_ API keys aren't JWTs, so the user's session is checked here instead
// (auth.getUser on the Authorization header).
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGINS = ["https://cvaranese.github.io", "http://127.0.0.1:8765", "http://localhost:8765"];

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function reply(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}

async function discord(path: string, token: string): Promise<any> {
  const r = await fetch("https://discord.com/api/v10" + path, { headers: { Authorization: "Bearer " + token } });
  if (!r.ok) throw new Error(`Discord ${path}: ${r.status}`);
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return reply(req, 405, { error: "POST only" });

  const secrets = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, secrets.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !auth?.user) return reply(req, 401, { error: "Not signed in" });
  const user = auth.user;
  const identity = user.identities?.find((i) => i.provider === "discord");
  const discordId = identity?.identity_data?.provider_id ?? identity?.identity_data?.sub ?? user.user_metadata?.provider_id;
  if (!discordId) return reply(req, 400, { error: "Not a Discord sign-in" });

  let body: { provider_token?: string } = {};
  try { body = await req.json(); } catch { /* empty body */ }
  if (!body.provider_token) return reply(req, 400, { error: "No Discord token" });

  let me: any, guilds: any[];
  try {
    me = await discord("/users/@me", body.provider_token);
    guilds = await discord("/users/@me/guilds", body.provider_token);
  } catch (e) {
    return reply(req, 502, { error: String(e) });
  }
  // the token must be the signed-in user's own, else anyone's token could let another account in
  if (String(me.id) !== String(discordId)) return reply(req, 403, { error: "That Discord token isn't yours" });

  const name = String(me.global_name || me.username || "").slice(0, 64) || "Unknown";
  const { error: pErr } = await admin.from("people").upsert({ id: user.id, discord_id: String(me.id), name });
  if (pErr) return reply(req, 500, { error: pErr.message });

  // the leagues' servers this person is in; memberships of servers they've left go
  const { data: leagues, error: cErr } = await admin.from("leagues").select("guild_id");
  if (cErr) return reply(req, 500, { error: cErr.message });
  const theirs = new Set(guilds.map((g) => String(g.id)));
  const servers = [...new Set((leagues ?? []).map((l) => l.guild_id))];
  const inside = servers.filter((g) => theirs.has(g));
  const outside = servers.filter((g) => !theirs.has(g));
  if (inside.length) {
    const { error } = await admin.from("guild_members").upsert(inside.map((g) => ({ guild_id: g, person_id: user.id })));
    if (error) return reply(req, 500, { error: error.message });
  }
  if (outside.length) {
    const { error } = await admin.from("guild_members").delete().eq("person_id", user.id).in("guild_id", outside);
    if (error) return reply(req, 500, { error: error.message });
  }
  return reply(req, 200, { name, guilds: inside });
});
