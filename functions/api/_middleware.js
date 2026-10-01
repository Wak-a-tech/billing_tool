// Authentification de toutes les routes /api/*.
//
// En production, le site est protégé par Cloudflare Access : chaque requête
// porte un jeton signé (en-tête Cf-Access-Jwt-Assertion). On vérifie ici sa
// signature, son audience et son expiration, puis que l'email fait partie de
// ALLOWED_EMAILS. Sans configuration valide, l'API refuse tout (fail closed).
//
// En local (`wrangler pages dev`), DEV_USER_EMAIL dans .dev.vars remplace
// Access ; il n'est accepté que si ACCESS_AUD n'est pas défini.

let certsCache = { url: null, keys: null, fetchedAt: 0 };

function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlToJson(s) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));
}

async function getCerts(teamDomain, force) {
  const url = teamDomain.replace(/\/+$/, "") + "/cdn-cgi/access/certs";
  const fresh = Date.now() - certsCache.fetchedAt < 60 * 60 * 1000;
  if (!force && certsCache.url === url && certsCache.keys && fresh) return certsCache.keys;
  const res = await fetch(url);
  if (!res.ok) throw new Error("certs Access indisponibles (" + res.status + ")");
  const body = await res.json();
  certsCache = { url, keys: body.keys || [], fetchedAt: Date.now() };
  return certsCache.keys;
}

async function verifyAccessJwt(token, env) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("jeton mal formé");
  const header = b64urlToJson(parts[0]);
  const payload = b64urlToJson(parts[1]);
  if (header.alg !== "RS256") throw new Error("algorithme inattendu");

  let keys = await getCerts(env.ACCESS_TEAM_DOMAIN, false);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await getCerts(env.ACCESS_TEAM_DOMAIN, true); // rotation de clés
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) throw new Error("clé inconnue");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1])
  );
  if (!ok) throw new Error("signature invalide");

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) throw new Error("jeton expiré");
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.ACCESS_AUD)) throw new Error("audience invalide");
  const iss = env.ACCESS_TEAM_DOMAIN.replace(/\/+$/, "");
  if (payload.iss !== iss) throw new Error("émetteur invalide");
  return String(payload.email || "").toLowerCase();
}

function allowedEmails(env) {
  return String(env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function deny(status, message) {
  return Response.json({ error: message }, { status });
}

export async function onRequest(context) {
  const { request, env } = context;
  let email = null;

  if (env.ACCESS_AUD && env.ACCESS_TEAM_DOMAIN) {
    const token = request.headers.get("Cf-Access-Jwt-Assertion");
    if (!token) return deny(401, "Non authentifié");
    try {
      email = await verifyAccessJwt(token, env);
    } catch (e) {
      return deny(401, "Authentification refusée : " + e.message);
    }
  } else if (env.DEV_USER_EMAIL) {
    email = String(env.DEV_USER_EMAIL).toLowerCase();
  } else {
    return deny(500, "Authentification non configurée (ACCESS_AUD / ACCESS_TEAM_DOMAIN)");
  }

  if (!allowedEmails(env).includes(email)) return deny(403, "Accès non autorisé pour " + email);

  context.data.user = email;
  try {
    return await context.next();
  } catch (e) {
    return deny(500, "Erreur serveur : " + (e && e.message ? e.message : String(e)));
  }
}
