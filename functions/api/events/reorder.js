function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export async function onRequestPut({ request, env }) {
  if (!env.DB) {
    return jsonResponse({ error: 'D1バインディング(DB)が設定されていません' }, 500);
  }

  try {
    const body = await request.json();
    const orderedIds = Array.isArray(body.orderedIds)
      ? body.orderedIds.map(Number).filter((id) => Number.isInteger(id))
      : [];

    if (orderedIds.length === 0) {
      return jsonResponse({ error: '並び替え対象がありません' }, 400);
    }

    const statements = orderedIds.map((id, idx) =>
      env.DB.prepare(
        "UPDATE events SET sort_order = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(idx + 1, id)
    );

    await env.DB.batch(statements);
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
