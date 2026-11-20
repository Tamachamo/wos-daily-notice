function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export async function onRequestPut({ params, request, env }) {
  if (!env.DB) {
    return jsonResponse({ error: 'D1バインディング(DB)が設定されていません' }, 500);
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return jsonResponse({ error: '不正なIDです' }, 400);
  }

  try {
    const body = await request.json();
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
    const sortOrder = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0;

    await env.DB.prepare(
      `UPDATE events
       SET title = ?, content_type = ?, template_text = ?, choices_json = ?, sort_order = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(title, contentType, templateText, JSON.stringify(choices), sortOrder, id)
      .run();

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestDelete({ params, env }) {
  if (!env.DB) {
    return jsonResponse({ error: 'D1バインディング(DB)が設定されていません' }, 500);
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return jsonResponse({ error: '不正なIDです' }, 400);
  }

  try {
    await env.DB.prepare('DELETE FROM events WHERE id = ?').bind(id).run();
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
