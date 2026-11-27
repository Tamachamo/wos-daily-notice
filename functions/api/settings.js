const DEFAULT_SECTION_ORDER = ['free_top', 'schedule', 'events', 'free_bottom'];
const DEFAULT_SECTION_ORDER_JSON = JSON.stringify(DEFAULT_SECTION_ORDER);
let settingsSchemaReady = false;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function normalizeSectionOrder(raw) {
  let list = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      list = [];
    }
  }

  const valid = [];
  for (const key of list) {
    if (DEFAULT_SECTION_ORDER.includes(key) && !valid.includes(key)) {
      valid.push(key);
    }
  }
  for (const key of DEFAULT_SECTION_ORDER) {
    if (!valid.includes(key)) {
      valid.push(key);
    }
  }
  return valid;
}

async function ensureSettingsSchema(db) {
  if (settingsSchemaReady) return;
  const { results } = await db.prepare('PRAGMA table_info(alliances)').all();
  const cols = new Set(results.map((c) => c.name));
  if (!cols.has('default_top_free_text')) {
    try {
      await db.prepare("ALTER TABLE alliances ADD COLUMN default_top_free_text TEXT NOT NULL DEFAULT ''").run();
    } catch {
      // 無視
    }
  }
  if (!cols.has('section_order_json')) {
    try {
      await db.prepare(`ALTER TABLE alliances ADD COLUMN section_order_json TEXT NOT NULL DEFAULT '${DEFAULT_SECTION_ORDER_JSON}'`).run();
    } catch {
      // 無視
    }
  }
  settingsSchemaReady = true;
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return jsonResponse({ error: 'D1バインディング(DB)が設定されていません' }, 500);
  }
  try {
    await ensureSettingsSchema(env.DB);
    const url = new URL(request.url);
    const allianceId = (url.searchParams.get('alliance_id') || 'default').trim();
    const row = await env.DB.prepare(
      'SELECT default_top_free_text, default_free_text, section_order_json FROM alliances WHERE id = ?'
    )
      .bind(allianceId)
      .first();

    return jsonResponse({
      default_top_free_text: row?.default_top_free_text ?? '',
      default_free_text: row?.default_free_text ?? '',
      section_order: normalizeSectionOrder(row?.section_order_json)
    });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  if (!env.DB) {
    return jsonResponse({ error: 'D1バインディング(DB)が設定されていません' }, 500);
  }
  try {
    await ensureSettingsSchema(env.DB);
    const body = await request.json();
    const allianceId = String(body.alliance_id || 'default').trim() || 'default';

    const sets = [];
    const binds = [];

    if (Object.prototype.hasOwnProperty.call(body, 'default_top_free_text')) {
      sets.push('default_top_free_text = ?');
      binds.push(String(body.default_top_free_text ?? ''));
    }

    if (Object.prototype.hasOwnProperty.call(body, 'default_free_text')) {
      sets.push('default_free_text = ?');
      binds.push(String(body.default_free_text ?? ''));
    }

    if (Object.prototype.hasOwnProperty.call(body, 'section_order')) {
      const normalized = normalizeSectionOrder(body.section_order);
      sets.push('section_order_json = ?');
      binds.push(JSON.stringify(normalized));
    }

    if (sets.length === 0) {
      return jsonResponse({ error: '更新する項目がありません' }, 400);
    }

    sets.push("updated_at = datetime('now')");
    binds.push(allianceId);

    await env.DB.prepare(`UPDATE alliances SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...binds)
      .run();

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
