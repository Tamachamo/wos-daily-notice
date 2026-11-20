function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export async function onRequestGet({ env }) {
  if (!env.DB) {
    return jsonResponse({ error: 'D1バインディング(DB)が設定されていません' }, 500);
  }
  try {
    const row = await env.DB.prepare(
      "SELECT value FROM app_settings WHERE key = 'default_free_text'"
    ).first();
    return jsonResponse({ default_free_text: row?.value ?? '' });
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
    const value = String(body.default_free_text ?? '');
    await env.DB.prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ('default_free_text', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    )
      .bind(value)
      .run();
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
