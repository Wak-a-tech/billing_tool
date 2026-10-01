// API partagée du générateur de factures (Cloudflare Pages Functions + D1).
// L'utilisateur authentifié est fourni par _middleware.js (context.data.user).

const MAX_LOGO_CHARS = 1_500_000; // D1 limite une valeur à ~2 Mo
const MAX_PARTY_CHARS = 20_000;
const MAX_SNAPSHOT_CHARS = 200_000;
const ISSUER_FIELDS = ["raisonSociale", "rue", "cp", "ville", "pays", "formeJuridique", "capital", "siren", "siret", "rcs"];
const CLIENT_FIELDS = ["raisonSociale", "nomPrenom", "adresse", "telephone", "email"];
const CURRENCIES = ["EUR", "USD", "GBP", "CHF"];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (e) {
    throw new HttpError(400, "Corps JSON invalide");
  }
}

function normPrefix(p) {
  const v = String(p || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12);
  return v || "WAK";
}

function cleanParty(kind, data) {
  const fields = kind === "issuer" ? ISSUER_FIELDS : CLIENT_FIELDS;
  const out = {};
  fields.forEach((f) => {
    out[f] = data && data[f] != null ? String(data[f]).slice(0, 2000) : "";
  });
  return out;
}

function isIsoDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z"));
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Valide le contenu d'une facture et recalcule les totaux côté serveur.
function cleanSnapshot(s) {
  if (!s || typeof s !== "object") throw new HttpError(400, "Facture manquante");
  if (!isIsoDate(s.issueDate) || !isIsoDate(s.dueDate)) throw new HttpError(400, "Dates invalides");
  const currency = CURRENCIES.includes(s.currency) ? s.currency : "EUR";
  const noTva = !!s.noTva;
  const lines = (Array.isArray(s.lines) ? s.lines : []).slice(0, 500).map((l) => ({
    description: String((l && l.description) || "").slice(0, 2000),
    qty: num(l && l.qty),
    pu: num(l && l.pu),
    tva: num(l && l.tva),
  }));
  const snapshot = {
    issueDate: s.issueDate,
    dueDate: s.dueDate,
    currency,
    noTva,
    issuer: cleanParty("issuer", s.issuer),
    client: cleanParty("client", s.client),
    lines,
  };

  let subtotal = 0;
  let tvaTotal = 0;
  lines.forEach((l) => {
    const amt = l.qty * l.pu;
    subtotal += amt;
    if (!noTva && l.tva > 0) tvaTotal += amt * (l.tva / 100);
  });
  return { snapshot, subtotal, tvaTotal, total: subtotal + (noTva ? 0 : tvaTotal) };
}

async function getSetting(db, key, fallback) {
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first();
  return row ? JSON.parse(row.value) : fallback;
}

async function putSetting(db, key, value, user) {
  await db
    .prepare(
      `INSERT INTO settings (key, value, updated_by) VALUES (?1, ?2, ?3)
       ON CONFLICT (key) DO UPDATE SET value = ?2, updated_by = ?3,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
    )
    .bind(key, JSON.stringify(value), user)
    .run();
}

async function upsertParty(db, id, kind, data, user) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new HttpError(400, "Identifiant invalide");
  if (kind !== "issuer" && kind !== "client") throw new HttpError(400, "Type d'entreprise invalide");
  const clean = JSON.stringify(cleanParty(kind, data));
  if (clean.length > MAX_PARTY_CHARS) throw new HttpError(413, "Entreprise trop volumineuse");
  await db
    .prepare(
      `INSERT INTO parties (id, kind, data, updated_by) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (id) DO UPDATE SET kind = ?2, data = ?3, updated_by = ?4,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
    )
    .bind(id, kind, clean, user)
    .run();
}

async function getState(db, user) {
  const [counter, parties, prefix, logo] = await Promise.all([
    db.prepare("SELECT next_seq FROM counter WHERE id = 1").first(),
    db.prepare("SELECT id, kind, data FROM parties ORDER BY rowid").all(),
    getSetting(db, "prefix", "WAK"),
    getSetting(db, "logo", null),
  ]);
  const issuers = [];
  const clients = [];
  parties.results.forEach((r) => {
    const item = Object.assign({ id: r.id }, JSON.parse(r.data));
    (r.kind === "issuer" ? issuers : clients).push(item);
  });
  return { user, nextSeq: counter.next_seq, prefix, logo, issuers, clients };
}

// Attribue le prochain numéro et enregistre la facture en une seule
// transaction : deux personnes qui génèrent en même temps obtiennent
// forcément deux numéros différents, sans trou.
async function createInvoice(db, body, user) {
  const { snapshot, subtotal, tvaTotal, total } = cleanSnapshot(body && body.snapshot);
  const snapJson = JSON.stringify(snapshot);
  if (snapJson.length > MAX_SNAPSHOT_CHARS) throw new HttpError(413, "Facture trop volumineuse");
  const year = snapshot.issueDate.slice(0, 4);

  const [inserted] = await db.batch([
    db
      .prepare(
        `INSERT INTO invoices (seq, number, issue_date, due_date, issuer_name, client_name,
                               currency, subtotal, tva_total, total, snapshot, created_by)
         SELECT c.next_seq,
                COALESCE((SELECT json_extract(value, '$') FROM settings WHERE key = 'prefix'), 'WAK')
                  || '-' || ?1 || '-' || printf('%04d', c.next_seq),
                ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11
         FROM counter c WHERE c.id = 1
         RETURNING seq, number, created_at`
      )
      .bind(
        year,
        snapshot.issueDate,
        snapshot.dueDate,
        snapshot.issuer.raisonSociale || null,
        snapshot.client.raisonSociale || snapshot.client.nomPrenom || null,
        snapshot.currency,
        subtotal,
        tvaTotal,
        total,
        snapJson,
        user
      ),
    db.prepare("UPDATE counter SET next_seq = next_seq + 1 WHERE id = 1"),
  ]);
  const row = inserted.results[0];
  return { seq: row.seq, number: row.number, createdAt: row.created_at, nextSeq: row.seq + 1 };
}

async function setCounter(db, body) {
  const n = parseInt(body && body.nextSeq, 10);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, "Numéro de séquence invalide");
  const max = await db.prepare("SELECT COALESCE(MAX(seq), 0) AS m FROM invoices").first();
  if (n <= max.m) {
    throw new HttpError(409, "Le numéro " + n + " est déjà utilisé : la facture n°" + max.m + " existe déjà.");
  }
  await db.prepare("UPDATE counter SET next_seq = ? WHERE id = 1").bind(n).run();
  return { nextSeq: n };
}

// Import des données d'une ancienne version locale (fusion, sans écraser le compteur).
async function importLocal(db, body, user) {
  let count = 0;
  for (const kind of ["issuer", "client"]) {
    const list = (body && body[kind === "issuer" ? "issuers" : "clients"]) || [];
    if (!Array.isArray(list)) continue;
    for (const item of list.slice(0, 1000)) {
      if (!item || !item.id) continue;
      await upsertParty(db, String(item.id), kind, item, user);
      count++;
    }
  }
  if (body && body.logo && typeof body.logo.dataUrl === "string") {
    await putLogo(db, body.logo, user);
  }
  return { imported: count };
}

async function putLogo(db, logo, user) {
  if (logo === null) {
    await db.prepare("DELETE FROM settings WHERE key = 'logo'").run();
    return;
  }
  if (!logo || typeof logo.dataUrl !== "string" || !logo.dataUrl.startsWith("data:image/")) {
    throw new HttpError(400, "Logo invalide");
  }
  if (logo.dataUrl.length > MAX_LOGO_CHARS) throw new HttpError(413, "Logo trop lourd (max ~1 Mo)");
  await putSetting(db, "logo", { dataUrl: logo.dataUrl, w: num(logo.w), h: num(logo.h) }, user);
}

async function route(request, env, user, segs) {
  const db = env.DB;
  const m = request.method;
  const [a, b] = segs;

  if (a === "state" && m === "GET") return json(await getState(db, user));

  if (a === "counter" && m === "PUT") return json(await setCounter(db, await readJson(request)));

  if (a === "settings" && b === "prefix" && m === "PUT") {
    const body = await readJson(request);
    const prefix = normPrefix(body.value);
    await putSetting(db, "prefix", prefix, user);
    return json({ prefix });
  }
  if (a === "settings" && b === "logo" && m === "PUT") {
    const body = await readJson(request);
    await putLogo(db, body.value, user);
    return json({ ok: true });
  }

  if (a === "parties" && b && m === "PUT") {
    const body = await readJson(request);
    await upsertParty(db, b, body.kind, body.data, user);
    return json({ ok: true });
  }
  if (a === "parties" && b && m === "DELETE") {
    await db.prepare("DELETE FROM parties WHERE id = ?").bind(b).run();
    return json({ ok: true });
  }

  if (a === "invoices" && !b && m === "GET") {
    const { results } = await db
      .prepare(
        `SELECT seq, number, issue_date, due_date, issuer_name, client_name, currency,
                subtotal, tva_total, total, created_at, created_by
         FROM invoices ORDER BY seq DESC`
      )
      .all();
    return json({ invoices: results });
  }
  if (a === "invoices" && !b && m === "POST") return json(await createInvoice(db, await readJson(request), user), 201);
  if (a === "invoices" && b && m === "GET") {
    const row = await db.prepare("SELECT * FROM invoices WHERE seq = ?").bind(parseInt(b, 10)).first();
    if (!row) throw new HttpError(404, "Facture introuvable");
    row.snapshot = JSON.parse(row.snapshot);
    return json(row);
  }

  if (a === "import" && m === "POST") return json(await importLocal(db, await readJson(request), user));

  throw new HttpError(404, "Route inconnue");
}

export async function onRequest(context) {
  const { request, env, params, data } = context;
  const segs = Array.isArray(params.path) ? params.path : params.path ? [params.path] : [];
  try {
    return await route(request, env, data.user, segs);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    throw e;
  }
}
