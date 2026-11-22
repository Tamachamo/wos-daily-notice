function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return jsonResponse({ error: 'D1バインディング(DB)が設定されていません' }, 500);
  }
  try {
    const url = new URL(request.url);
    const allianceId = (url.searchParams.get('alliance_id') || 'default').trim();
    const row = await env.DB.prepare(
      'SELECT default_free_text FROM alliances WHERE id = ?'
    )
      .bind(allianceId)
      .first();

    return jsonResponse({ default_free_text: row?.default_free_text ?? '' });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  if (!env.DB) {
    return jsonResponse({ error: 'D1バインディング(DB)が設定されていません' }, 500);
  }
  try {
    const body = await request.json();
    const allianceId = String(body.alliance_id || 'default').trim() || 'default';
    const value = String(body.default_free_text ?? '');

    await env.DB.prepare(
      "UPDATE alliances SET default_free_text = ?, updated_at = datetime('now') WHERE id = ?"
    )
      .bind(value, allianceId)
      .run();

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
