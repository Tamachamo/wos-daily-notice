function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function parseChoices(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return jsonResponse({ error: 'D1バインディング(DB)が設定されていません' }, 500);
  }
  try {
    const url = new URL(request.url);
    const allianceId = (url.searchParams.get('alliance_id') || 'default').trim();

    const { results } = await env.DB.prepare(
      'SELECT id, alliance_id, title, content_type, template_text, choices_json, sort_order FROM events WHERE alliance_id = ? ORDER BY sort_order ASC, id ASC'
    )
      .bind(allianceId)
      .all();

    const events = results.map((row) => ({
      id: row.id,
      alliance_id: row.alliance_id,
      title: row.title,
      content_type: row.content_type === 'choices' ? 'choices' : 'template',
      template_text: row.template_text || '',
      choices: parseChoices(row.choices_json),
      sort_order: row.sort_order ?? 0
    }));

    return jsonResponse(events);
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
    const allianceId = String(body.alliance_id || 'default').trim() || 'default';
    const title = String(body.title || '').trim();
    if (!title) {
      return jsonResponse({ error: 'タイトルは必須です' }, 400);
    }

    const contentType = body.content_type === 'choices' ? 'choices' : 'template';
    const templateText = String(body.template_text || '');
    const choices = Array.isArray(body.choices)
      ? body.choices
          .map((c) => ({
            label: String(c.label || '').trim(),
            text: String(c.text || '')
          }))
          .filter((c) => c.label || c.text)
      : [];

    let sortOrder = Number(body.sort_order);
    if (!Number.isFinite(sortOrder)) {
      const maxRow = await env.DB.prepare(
        'SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM events WHERE alliance_id = ?'
      )
        .bind(allianceId)
        .first();
      sortOrder = (maxRow?.max_order || 0) + 1;
    }

    const result = await env.DB.prepare(
      'INSERT INTO events (alliance_id, title, content_type, template_text, choices_json, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(allianceId, title, contentType, templateText, JSON.stringify(choices), sortOrder)
      .run();

    return jsonResponse(
      {
        id: result.meta.last_row_id,
        alliance_id: allianceId,
        title,
        content_type: contentType,
        template_text: templateText,
        choices,
        sort_order: sortOrder
      },
      201
    );
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
