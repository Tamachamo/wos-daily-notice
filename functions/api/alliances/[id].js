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
  const id = String(params.id || '').trim();
  if (!id) {
    return jsonResponse({ error: '不正なIDです' }, 400);
  }

  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) {
      return jsonResponse({ error: '同盟名は必須です' }, 400);
    }

    await env.DB.prepare(
      "UPDATE alliances SET name = ?, updated_at = datetime('now') WHERE id = ?"
    )
      .bind(name, id)
      .run();

    return jsonResponse({ ok: true, id, name });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestDelete({ params, env }) {
  if (!env.DB) {
    return jsonResponse({ error: 'D1バインディング(DB)が設定されていません' }, 500);
  }
  const id = String(params.id || '').trim();
  if (!id) {
    return jsonResponse({ error: '不正なIDです' }, 400);
  }

  try {
    const countRow = await env.DB.prepare('SELECT COUNT(*) AS cnt FROM alliances').first();
    if ((countRow?.cnt || 0) <= 1) {
      return jsonResponse({ error: '最後の1つの同盟は削除できません' }, 400);
    }

    await env.DB.batch([
      env.DB.prepare('DELETE FROM events WHERE alliance_id = ?').bind(id),
      env.DB.prepare('DELETE FROM alliances WHERE id = ?').bind(id)
    ]);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
