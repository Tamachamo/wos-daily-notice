const DEFAULT_SECTION_ORDER_JSON = '["free_top","schedule","events","free_bottom"]';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function normalizeId(raw) {
  const cleaned = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return cleaned.slice(0, 32);
}

function generateId() {
  return 'al_' + Math.random().toString(36).slice(2, 8);
}

function generateShareToken() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return jsonResponse({ error: 'D1バインディング(DB)が設定されていません' }, 500);
  }
  try {
    const url = new URL(request.url);
    const shareToken = (url.searchParams.get('share_token') || '').trim();

    if (shareToken) {
      const row = await env.DB.prepare(
        'SELECT id, name, default_free_text, sort_order FROM alliances WHERE share_token = ?'
      )
        .bind(shareToken)
        .first();

      if (!row) {
        return jsonResponse({ error: '無効な共有URLです。管理者に最新のURLを確認してください。' }, 404);
      }
      return jsonResponse([row]);
    }

    let { results } = await env.DB.prepare(
      'SELECT id, name, default_free_text, sort_order, share_token FROM alliances ORDER BY sort_order ASC, created_at ASC'
    ).all();

    if (results.length === 0) {
      const token = generateShareToken();
      await env.DB.prepare(
        "INSERT OR IGNORE INTO alliances (id, name, default_free_text, sort_order, share_token) VALUES ('default', 'メイン同盟', '', 1, ?)"
      )
        .bind(token)
        .run();
      const retry = await env.DB.prepare(
        'SELECT id, name, default_free_text, sort_order, share_token FROM alliances ORDER BY sort_order ASC, created_at ASC'
      ).all();
      results = retry.results;
    }

    return jsonResponse(results);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return jsonResponse({ error: 'D1バインディング(DB)が設定されていません' }, 500);
  }
  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) {
      return jsonResponse({ error: '同盟名は必須です' }, 400);
    }

    let id = normalizeId(body.id);
    if (!id) {
      id = generateId();
    }

    const exists = await env.DB.prepare('SELECT id FROM alliances WHERE id = ?').bind(id).first();
    if (exists) {
      return jsonResponse({ error: `URL用ID「${id}」はすでに使われています` }, 409);
    }

    const maxRow = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM alliances').first();
    const sortOrder = (maxRow?.max_order || 0) + 1;
    const shareToken = generateShareToken();

    const copyFromId = String(body.copy_from_id || '').trim();
    let initialTopFreeText = '';
    let initialFreeText = '';
    let initialSectionOrderJson = DEFAULT_SECTION_ORDER_JSON;
    let sourceEvents = [];

    if (copyFromId) {
      const srcAlliance = await env.DB.prepare(
        'SELECT default_top_free_text, default_free_text, section_order_json FROM alliances WHERE id = ?'
      )
        .bind(copyFromId)
        .first();
      if (srcAlliance) {
        initialTopFreeText = srcAlliance.default_top_free_text || '';
        initialFreeText = srcAlliance.default_free_text || '';
        initialSectionOrderJson = srcAlliance.section_order_json || DEFAULT_SECTION_ORDER_JSON;
      }

      const srcEventsRes = await env.DB.prepare(
        'SELECT title, content_type, template_text, choices_json, sort_order FROM events WHERE alliance_id = ? ORDER BY sort_order ASC, id ASC'
      )
        .bind(copyFromId)
        .all();
      sourceEvents = srcEventsRes.results || [];
    }

    const statements = [
      env.DB.prepare(
        'INSERT INTO alliances (id, name, default_top_free_text, default_free_text, section_order_json, sort_order, share_token) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        id,
        name,
        initialTopFreeText,
        initialFreeText,
        initialSectionOrderJson,
        sortOrder,
        shareToken
      )
    ];

    for (const ev of sourceEvents) {
      statements.push(
        env.DB.prepare(
          'INSERT INTO events (alliance_id, title, content_type, template_text, choices_json, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(id, ev.title, ev.content_type, ev.template_text, ev.choices_json, ev.sort_order)
      );
    }

    await env.DB.batch(statements);

    return jsonResponse(
      {
        id,
        name,
        default_top_free_text: initialTopFreeText,
        default_free_text: initialFreeText,
        sort_order: sortOrder,
        share_token: shareToken,
        copied_events_count: sourceEvents.length
      },
      201
    );
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
