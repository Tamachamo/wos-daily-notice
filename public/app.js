(() => {
  const LAST_KEY = 'wos_last_alliance_id';
  const DEF_ORDER = ['free_top', 'schedule', 'events', 'free_bottom'];
  const $ = (id) => document.getElementById(id);

  const state = {
    isShare: false,
    shareToken: '',
    alliances: [],
    allianceId: 'default',
    sectionOrder: [...DEF_ORDER],
    events: [],
    tempEvents: [],
    tempSeq: 1,
    sel: {},
    lastText: ''
  };

  const views = { create: $('view-create'), preview: $('view-preview'), admin: $('view-admin') };
  const tabBtns = document.querySelectorAll('.tab-btn[data-view]');
  const copyShareBtn = $('copyShareUrlBtn') || $('copyAllianceUrlBtn');

  let toastTimer = null;
  const showToast = (msg) => {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
  };

  const api = async (url, method = 'GET', body) => {
    const opt = { method };
    if (body !== undefined) {
      opt.headers = { 'Content-Type': 'application/json' };
      opt.body = JSON.stringify(body);
    }
    const res = await fetch(url, opt);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `通信エラー (HTTP ${res.status})`);
    return data;
  };

  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const fmtDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return '';
    return `${m}月${d}日(${'日月火水木金土'[new Date(y, m - 1, d).getDay()]})`;
  };

  const normOrder = (raw) => {
    const valid = (Array.isArray(raw) ? raw : []).filter((k, i, a) => DEF_ORDER.includes(k) && a.indexOf(k) === i);
    return [...valid, ...DEF_ORDER.filter((k) => !valid.includes(k))];
  };

  const masterTextOf = (ev, idx = 0) =>
    ev.content_type === 'choices' && ev.choices.length > 0 ? ev.choices[idx]?.text ?? '' : ev.template_text ?? '';

  const copyText = async (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  };

  const switchView = (name) => {
    Object.entries(views).forEach(([k, el]) => el?.classList.toggle('active', k === name));
    tabBtns.forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentAlliance = () => state.alliances.find((a) => a.id === state.allianceId) || state.alliances[0] || null;
  const shareUrlOf = (al) => (al?.share_token ? `${location.origin}/?share=${encodeURIComponent(al.share_token)}` : '');

  const makeHandle = () => {
    const s = document.createElement('span');
    s.className = 'drag-handle';
    s.title = 'ドラッグして並び替え';
    s.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
      '<circle cx="5.5" cy="3" r="1.4"/><circle cx="10.5" cy="3" r="1.4"/>' +
      '<circle cx="5.5" cy="8" r="1.4"/><circle cx="10.5" cy="8" r="1.4"/>' +
      '<circle cx="5.5" cy="13" r="1.4"/><circle cx="10.5" cy="13" r="1.4"/></svg>';
    return s;
  };

  const addChoiceRow = (box, label = '', text = '') => {
    if (!box) return;
    const row = document.createElement('div');
    row.className = 'choice-row';
    row.innerHTML =
      '<input type="text" class="input choice-label-input" placeholder="選択肢名（例：1日目）" />' +
      '<textarea class="textarea choice-text-input" rows="2" placeholder="この選択肢の定型文"></textarea>' +
      '<button type="button" class="btn btn-danger btn-sm">削除</button>';
    row.querySelector('.choice-label-input').value = label;
    row.querySelector('.choice-text-input').value = text;
    row.querySelector('button').addEventListener('click', () => row.remove());
    box.appendChild(row);
  };

  const readChoices = (box) =>
    !box
      ? []
      : Array.from(box.querySelectorAll('.choice-row'))
          .map((r) => ({
            label: r.querySelector('.choice-label-input').value.trim(),
            text: r.querySelector('.choice-text-input').value
          }))
          .filter((c) => c.label || c.text);

  // ===== 共通ドラッグ並び替え =====
  const bindDragSort = (container, { handleSel, itemSel, dragClass, phClass, fixedPhHeight, isTarget, getId, onDone }) => {
    if (!container) return;
    let dragEl = null, ph = null, activeHandle = null, pid = null, offY = 0, initIds = [];

    const items = () => Array.from(container.querySelectorAll(itemSel)).filter((el) => !isTarget || isTarget(el));

    const onMove = (e) => {
      if (!dragEl || e.pointerId !== pid) return;
      e.preventDefault();
      dragEl.style.top = `${e.clientY - offY}px`;
      if (e.clientY < 76) window.scrollBy(0, -12);
      else if (e.clientY > window.innerHeight - 76) window.scrollBy(0, 12);

      const sibs = items().filter((el) => el !== dragEl);
      let placed = false;
      for (const s of sibs) {
        const b = s.getBoundingClientRect();
        if (e.clientY < b.top + b.height / 2) {
          container.insertBefore(ph, s);
          placed = true;
          break;
        }
      }
      if (!placed) {
        const last = sibs[sibs.length - 1];
        if (last?.nextSibling) container.insertBefore(ph, last.nextSibling);
        else container.appendChild(ph);
      }
    };

    const onEnd = (e) => {
      if (!dragEl || e.pointerId !== pid) return;
      activeHandle?.removeEventListener('pointermove', onMove);
      activeHandle?.removeEventListener('pointerup', onEnd);
      activeHandle?.removeEventListener('pointercancel', onEnd);
      try { activeHandle?.releasePointerCapture(pid); } catch {}

      dragEl.classList.remove(dragClass);
      Object.assign(dragEl.style, { position: '', top: '', left: '', width: '', zIndex: '', pointerEvents: '' });
      ph?.parentNode && ph.replaceWith(dragEl);
      document.body.classList.remove('is-dragging');

      const nextIds = items().map(getId);
      const changed = nextIds.length === initIds.length && nextIds.some((v, i) => v !== initIds[i]);
      dragEl = ph = activeHandle = pid = null;
      if (changed) onDone(nextIds);
    };

    container.addEventListener('pointerdown', (e) => {
      const handle = e.target.closest(handleSel);
      if (!handle || !container.contains(handle)) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const item = handle.closest(itemSel);
      if (!item || (isTarget && !isTarget(item))) return;

      e.preventDefault();
      dragEl = item;
      activeHandle = handle;
      pid = e.pointerId;
      initIds = items().map(getId);

      const rect = dragEl.getBoundingClientRect();
      offY = fixedPhHeight ? Math.min(e.clientY - rect.top, 36) : e.clientY - rect.top;
      ph = document.createElement('div');
      ph.className = phClass;
      ph.style.height = `${fixedPhHeight || rect.height}px`;
      dragEl.parentNode.insertBefore(ph, dragEl);

      dragEl.classList.add(dragClass);
      Object.assign(dragEl.style, {
        position: 'fixed',
        top: `${e.clientY - offY}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        zIndex: '90',
        pointerEvents: 'none'
      });
      document.body.classList.add('is-dragging');

      try { handle.setPointerCapture(pid); } catch {}
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onEnd);
      handle.addEventListener('pointercancel', onEnd);
    });
  };

  // ===== 大項目の並び替え =====
  const applySectionOrder = (order) => {
    state.sectionOrder = normOrder(order);
    const box = $('sortableSections');
    if (!box) return;
    const map = new Map();
    box.querySelectorAll(':scope > .section-card').forEach((c) => map.set(c.dataset.sectionKey, c));

    state.sectionOrder.forEach((key, idx) => {
      const card = map.get(key);
      if (!card) return;
      box.appendChild(card);
      const num = card.querySelector('.section-num');
      if (num) num.textContent = `${idx + 2}.`;
      const up = card.querySelector('.section-move-btn[data-dir="-1"]');
      const dn = card.querySelector('.section-move-btn[data-dir="1"]');
      if (up) up.disabled = idx === 0;
      if (dn) dn.disabled = idx === state.sectionOrder.length - 1;
    });
  };

  const saveSectionOrder = async (order) => {
    const prev = [...state.sectionOrder];
    const next = normOrder(order);
    applySectionOrder(next);
    try {
      await api('/api/settings', 'PUT', { alliance_id: state.allianceId, section_order: next });
      showToast('項目の並び順を保存しました');
    } catch (err) {
      alert(err.message);
      applySectionOrder(prev);
    }
  };

  // ===== イベント操作（並び替え・上書き・削除） =====
  const saveEventOrder = async (ids) => {
    const map = new Map(state.events.map((e) => [e.id, e]));
    state.events = ids.map((id, i) => (map.has(id) ? { ...map.get(id), sort_order: i + 1 } : null)).filter(Boolean);
    renderCreateEvents();
    renderAdminList();
    try {
      await api('/api/events/reorder', 'PUT', { orderedIds: ids });
      showToast('イベントの並び順を保存しました');
    } catch (err) {
      alert(err.message);
      await fetchEvents();
    }
  };

  const overwriteMaster = async (ev, choiceIdx, newText) => {
    const choices =
      ev.content_type === 'choices'
        ? ev.choices.map((c, i) => (i === choiceIdx ? { ...c, text: newText } : c))
        : [];
    const payload = {
      title: ev.title,
      content_type: ev.content_type,
      template_text: ev.content_type === 'template' ? newText : '',
      choices,
      sort_order: ev.sort_order
    };
    await api(`/api/events/${ev.id}`, 'PUT', payload);
    if (ev.content_type === 'choices') ev.choices = choices.filter((c) => c.label || c.text);
    else ev.template_text = payload.template_text;
    if ($('editEventId')?.value === String(ev.id)) resetAdminForm();
    renderAdminList();
  };

  const deleteMasterEvent = async (ev) => {
    if (!confirm(`「${ev.title}」をマスタから削除しますか？`)) return;
    try {
      await api(`/api/events/${ev.id}`, 'DELETE');
      delete state.sel[String(ev.id)];
      if ($('editEventId')?.value === String(ev.id)) resetAdminForm();
      await fetchEvents();
      showToast(`「${ev.title}」を削除しました`);
    } catch (err) {
      alert(err.message);
    }
  };

  // ===== 同盟（箱）管理 =====
  const showShareError = (msg) => {
    Object.values(views).forEach((el) => el?.classList.remove('active'));
    tabBtns.forEach((b) => b.classList.add('hidden'));
    $('allianceSelect')?.classList.add('hidden');
    $('allianceBarActions')?.classList.add('hidden');
    $('lockedAllianceName')?.classList.add('hidden');
    if ($('shareErrorMessage')) $('shareErrorMessage').textContent = msg;
    $('shareErrorCard')?.classList.remove('hidden');
  };

  const fetchAlliances = async () => {
    const url = state.isShare ? `/api/alliances?share_token=${encodeURIComponent(state.shareToken)}` : '/api/alliances';
    state.alliances = await api(url);
    renderAllianceUI();
  };

  const renderAllianceUI = () => {
    const cur = currentAlliance();
    if ($('adminCurrentAllianceName')) $('adminCurrentAllianceName').textContent = cur?.name || '';

    if (state.isShare) {
      if (cur) {
        $('allianceSelect')?.classList.add('hidden');
        $('allianceBarActions')?.classList.add('hidden');
        if ($('lockedAllianceName')) {
          $('lockedAllianceName').classList.remove('hidden');
          $('lockedAllianceName').textContent = cur.name;
        }
        document.title = `${cur.name}｜ホワサバ 同盟通知メーカー`;
      }
      return;
    }

    const selEl = $('allianceSelect');
    if (selEl) {
      selEl.innerHTML = '';
      state.alliances.forEach((al) => {
        const o = new Option(al.name, al.id, false, al.id === state.allianceId);
        selEl.appendChild(o);
      });
    }

    const copySel = $('copyFromAllianceSelect');
    if (copySel) {
      copySel.innerHTML = '';
      copySel.appendChild(new Option('空の状態から作成', ''));
      state.alliances.forEach((al) => {
        copySel.appendChild(new Option(`「${al.name}」のイベントをコピー`, al.id, false, al.id === state.allianceId));
      });
    }

    const list = $('allianceManageList');
    if (!list) return;
    list.innerHTML = '';
    state.alliances.forEach((al) => {
      const isCur = al.id === state.allianceId;
      const item = document.createElement('div');
      item.className = 'alliance-manage-item' + (isCur ? ' current' : '');

      const meta = document.createElement('div');
      meta.className = 'alliance-manage-meta';
      const nameRow = document.createElement('div');
      nameRow.className = 'alliance-manage-name';
      nameRow.append(Object.assign(document.createElement('span'), { textContent: al.name }));
      if (isCur) nameRow.append(Object.assign(document.createElement('span'), { className: 'badge', textContent: '選択中' }));
      const idEl = Object.assign(document.createElement('div'), {
        className: 'alliance-manage-id',
        textContent: al.share_token ? `共有URL: ?share=${al.share_token}` : `ID: ${al.id}`
      });
      meta.append(nameRow, idEl);

      const acts = document.createElement('div');
      acts.className = 'alliance-manage-actions';
      const mkBtn = (text, cls, fn) => {
        const b = Object.assign(document.createElement('button'), { type: 'button', className: `btn ${cls} btn-sm`, textContent: text });
        b.addEventListener('click', fn);
        return b;
      };

      if (!isCur) {
        acts.appendChild(mkBtn('開く', 'btn-primary', async () => {
          $('allianceModal')?.classList.add('hidden');
          await switchAlliance(al.id);
        }));
      }

      acts.appendChild(mkBtn('🔒 共有URLコピー', 'btn-secondary', async () => {
        const u = shareUrlOf(al);
        if (!u) return alert('共有トークンがありません。URL再発行を実行してください。');
        if (await copyText(u)) showToast(`「${al.name}」の外部共有URLをコピーしました`);
      }));

      acts.appendChild(mkBtn('URL再発行', 'btn-ghost', async () => {
        if (!confirm(`「${al.name}」の外部共有URLを再発行しますか？\n古い共有URLは使えなくなります。`)) return;
        try {
          const r = await api(`/api/alliances/${encodeURIComponent(al.id)}`, 'PUT', { regenerate_token: true });
          await fetchAlliances();
          await copyText(`${location.origin}/?share=${encodeURIComponent(r.share_token)}`);
          showToast('新しい共有URLを発行＆コピーしました');
        } catch (err) { alert(err.message); }
      }));

      acts.appendChild(mkBtn('名前変更', 'btn-ghost', async () => {
        const next = prompt('新しい同盟名を入力してください', al.name)?.trim();
        if (!next || next === al.name) return;
        try {
          await api(`/api/alliances/${encodeURIComponent(al.id)}`, 'PUT', { name: next });
          await fetchAlliances();
          showToast('同盟名を変更しました');
        } catch (err) { alert(err.message); }
      }));

      if (state.alliances.length > 1) {
        acts.appendChild(mkBtn('削除', 'btn-danger', async () => {
          if (!confirm(`「${al.name}」を削除しますか？\n登録済みのイベント等もすべて消えます。`)) return;
          try {
            await api(`/api/alliances/${encodeURIComponent(al.id)}`, 'DELETE');
            await fetchAlliances();
            if (state.allianceId === al.id && state.alliances[0]) await switchAlliance(state.alliances[0].id);
            showToast(`「${al.name}」を削除しました`);
          } catch (err) { alert(err.message); }
        }));
      }

      item.append(meta, acts);
      list.appendChild(item);
    });
  };

  const switchAlliance = async (id, silent = false) => {
    state.allianceId = id;
    state.sel = {};
    state.tempEvents = [];
    if (!state.isShare) {
      try {
        const u = new URL(location.href);
        u.searchParams.delete('share');
        u.searchParams.set('alliance', id);
        history.replaceState({}, '', u.toString());
        localStorage.setItem(LAST_KEY, id);
      } catch {}
    }
    resetAdminForm();
    renderAllianceUI();
    if ($('eventSelectList')) $('eventSelectList').innerHTML = '<p class="loading-text">読み込み中...</p>';
    if ($('adminEventList')) $('adminEventList').innerHTML = '<p class="loading-text">読み込み中...</p>';
    await Promise.all([fetchEvents(), fetchSettings()]);
    if (!silent) {
      const cur = currentAlliance();
      if (cur) showToast(`「${cur.name}」に切り替えました`);
    }
  };

  // ===== イベント・設定取得 =====
  const fetchEvents = async () => {
    state.events = await api(`/api/events?alliance_id=${encodeURIComponent(state.allianceId)}`);
    state.events.forEach((ev) => {
      const k = String(ev.id);
      if (!state.sel[k]) {
        state.sel[k] = { checked: false, choiceIndex: 0, text: masterTextOf(ev, 0), overwrite: false };
      }
    });
    renderCreateEvents();
    renderAdminList();
  };

  const fetchSettings = async () => {
    try {
      const d = await api(`/api/settings?alliance_id=${encodeURIComponent(state.allianceId)}`);
      if ($('topFreeText')) $('topFreeText').value = d.default_top_free_text || '';
      if ($('freeText')) $('freeText').value = d.default_free_text || '';
      applySectionOrder(d.section_order || DEF_ORDER);
    } catch {
      if ($('topFreeText')) $('topFreeText').value = '';
      if ($('freeText')) $('freeText').value = '';
      applySectionOrder(DEF_ORDER);
    }
  };

  // ===== 通知作成画面：イベント一覧描画 =====
  const buildEventRow = (ev, isTemp) => {
    const key = String(ev.id);
    const sel = state.sel[key];
    const row = document.createElement('div');
    row.className = 'event-row' + (sel.checked ? ' checked' : '');
    row.dataset.eventKey = key;
    if (!isTemp) {
      row.dataset.eventId = key;
      row.dataset.draggable = 'true';
    }

    const checkWrap = document.createElement('div');
    checkWrap.className = 'event-check-wrap';
    if (!isTemp) checkWrap.appendChild(makeHandle());

    const checkCol = document.createElement('label');
    checkCol.className = 'event-check-col';
    const cb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: sel.checked });
    const titleWrap = Object.assign(document.createElement('div'), { className: 'event-title-wrap' });
    titleWrap.appendChild(Object.assign(document.createElement('span'), { className: 'event-title-text', textContent: ev.title }));
    if (isTemp) titleWrap.appendChild(Object.assign(document.createElement('span'), { className: 'badge-temp', textContent: '今回限り' }));
    checkCol.append(cb, titleWrap);
    checkWrap.appendChild(checkCol);

    const delBtn = Object.assign(document.createElement('button'), {
      type: 'button',
      className: 'btn btn-danger btn-xs event-delete-btn',
      textContent: isTemp ? '✕' : '🗑',
      title: isTemp ? 'この今回限りイベントを削除' : 'このイベントをマスタから削除'
    });
    delBtn.addEventListener('click', async () => {
      if (isTemp) {
        state.tempEvents = state.tempEvents.filter((t) => t.id !== ev.id);
        delete state.sel[key];
        renderCreateEvents();
      } else {
        await deleteMasterEvent(ev);
      }
    });
    checkWrap.appendChild(delBtn);

    const editorCol = document.createElement('div');
    editorCol.className = 'event-editor-col';
    const ta = Object.assign(document.createElement('textarea'), {
      className: 'textarea',
      rows: 2,
      placeholder: '通知内容（空欄の場合はタイトルのみ出力）',
      value: sel.text
    });

    const canOverwrite = !isTemp && (ev.content_type !== 'choices' || ev.choices.length > 0);
    let footer, owCb, owLbl, acts, badge, saveNowBtn;

    const refreshFooter = () => {
      if (!canOverwrite || !footer) return;
      const dirty = ta.value !== masterTextOf(ev, sel.choiceIndex);
      const willOw = Boolean(sel.overwrite);
      const cName = ev.content_type === 'choices' ? ev.choices[sel.choiceIndex]?.label || `選択肢${sel.choiceIndex + 1}` : '';
      owLbl.textContent = cName ? `「${cName}」を上書き保存` : 'マスタを上書き保存';
      owCb.checked = willOw;
      footer.classList.toggle('is-dirty', dirty);
      footer.classList.toggle('will-overwrite', willOw);
      acts.classList.toggle('hidden', !dirty);
      if (dirty) badge.textContent = willOw ? '作成時に上書き' : '今回のみ反映';
    };

    if (canOverwrite) {
      footer = Object.assign(document.createElement('div'), { className: 'event-item-footer' });
      const tgl = Object.assign(document.createElement('label'), { className: 'overwrite-toggle' });
      owCb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: Boolean(sel.overwrite) });
      owCb.addEventListener('change', () => {
        sel.overwrite = owCb.checked;
        refreshFooter();
      });
      owLbl = document.createElement('span');
      tgl.append(owCb, owLbl);

      acts = Object.assign(document.createElement('div'), { className: 'event-item-footer-actions hidden' });
      badge = Object.assign(document.createElement('span'), { className: 'overwrite-status-badge' });
      saveNowBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn-primary btn-xs', textContent: '💾 今すぐ保存' });
      saveNowBtn.addEventListener('click', async () => {
        saveNowBtn.disabled = true;
        saveNowBtn.textContent = '保存中...';
        try {
          await overwriteMaster(ev, sel.choiceIndex, ta.value);
          refreshFooter();
          showToast(`「${ev.title}」のマスタを上書き保存しました`);
        } catch (err) { alert(err.message); }
        finally {
          saveNowBtn.disabled = false;
          saveNowBtn.textContent = '💾 今すぐ保存';
        }
      });

      const revBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn-ghost btn-xs', textContent: '元に戻す' });
      revBtn.addEventListener('click', () => {
        sel.text = ta.value = masterTextOf(ev, sel.choiceIndex);
        refreshFooter();
      });
      acts.append(badge, saveNowBtn, revBtn);
      footer.append(tgl, acts);
    }

    if (ev.content_type === 'choices' && ev.choices.length > 0) {
      const selBox = Object.assign(document.createElement('select'), { className: 'select' });
      ev.choices.forEach((c, i) => selBox.appendChild(new Option(c.label || `選択肢${i + 1}`, String(i), false, i === sel.choiceIndex)));
      selBox.addEventListener('change', () => {
        const i = Number(selBox.value);
        sel.choiceIndex = i;
        sel.text = ta.value = ev.choices[i]?.text || '';
        sel.overwrite = false;
        if (!sel.checked) {
          sel.checked = cb.checked = true;
          row.classList.add('checked');
        }
        refreshFooter();
      });
      editorCol.appendChild(selBox);
    }

    ta.addEventListener('input', () => {
      sel.text = ta.value;
      if (ta.value.trim() && !sel.checked) {
        sel.checked = cb.checked = true;
        row.classList.add('checked');
      }
      refreshFooter();
    });

    cb.addEventListener('change', () => {
      sel.checked = cb.checked;
      row.classList.toggle('checked', sel.checked);
    });

    editorCol.appendChild(ta);
    if (footer) {
      editorCol.appendChild(footer);
      refreshFooter();
    }
    row.append(checkWrap, editorCol);
    return row;
  };

  const renderCreateEvents = () => {
    const list = $('eventSelectList');
    if (!list) return;
    list.innerHTML = '';
    if (state.events.length === 0 && state.tempEvents.length === 0) {
      list.innerHTML = '<p class="loading-text">この同盟にはまだイベントがありません。「＋ イベント追加」から作成してください。</p>';
      return;
    }
    state.events.forEach((ev) => list.appendChild(buildEventRow(ev, false)));
    state.tempEvents.forEach((ev) => list.appendChild(buildEventRow(ev, true)));
  };

  // ===== 通知テキスト組み立て =====
  const buildNoticeText = () => {
    const trimBlock = (v) => {
      const t = (v || '').replace(/^\s*\n+|\n+\s*$/g, '');
      return t.trim() ? t : '';
    };
    const buildSection = (key) => {
      if (key === 'free_top') return trimBlock($('topFreeText')?.value);
      if (key === 'free_bottom') return trimBlock($('freeText')?.value);
      if (key === 'schedule') {
        const lines = ($('todaySchedule')?.value || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        return lines.length ? `●今日の予定\n${lines.join('\n')}` : '';
      }
      if (key === 'events') {
        const items = [];
        [...state.events, ...state.tempEvents].forEach((ev) => {
          const s = state.sel[String(ev.id)];
          if (!s?.checked) return;
          const body = (s.text || '').trim();
          items.push(body ? `・${ev.title}\n${body}` : `・${ev.title}`);
        });
        return items.length ? `●イベント\n${items.join('\n\n')}` : '';
      }
      return '';
    };

    const dateStr = fmtDate($('noticeDate')?.value);
    const blocks = state.sectionOrder.map(buildSection).filter(Boolean);
    if (!dateStr) return blocks.join('\n\n');
    if (!blocks.length) return dateStr;
    return [`${dateStr}\n${blocks[0]}`, ...blocks.slice(1)].join('\n\n');
  };

  const updateCharCount = () => {
    if ($('charCount') && $('previewTextarea')) {
      $('charCount').textContent = `${$('previewTextarea').value.length}文字`;
    }
  };

  // ===== 管理画面 =====
  const toggleTypeUI = (radioName, tplId, chId, rowsId) => {
    const val = document.querySelector(`input[name="${radioName}"]:checked`)?.value || 'template';
    $(tplId)?.classList.toggle('hidden', val !== 'template');
    $(chId)?.classList.toggle('hidden', val !== 'choices');
    if (val === 'choices' && $(rowsId)?.children.length === 0) addChoiceRow($(rowsId));
  };

  const resetAdminForm = () => {
    if ($('editEventId')) $('editEventId').value = '';
    if ($('formTitle')) $('formTitle').textContent = 'イベント新規登録';
    if ($('masterTitle')) $('masterTitle').value = '';
    if ($('masterSortOrder')) $('masterSortOrder').value = '';
    const r = document.querySelector('input[name="contentType"][value="template"]');
    if (r) r.checked = true;
    if ($('masterTemplateText')) $('masterTemplateText').value = '';
    if ($('choiceRowsContainer')) $('choiceRowsContainer').innerHTML = '';
    $('resetFormBtn')?.classList.add('hidden');
    toggleTypeUI('contentType', 'templateInputArea', 'choicesInputArea', 'choiceRowsContainer');
  };

  const startEditEvent = (ev) => {
    if ($('editEventId')) $('editEventId').value = String(ev.id);
    if ($('formTitle')) $('formTitle').textContent = `イベント編集：${ev.title}`;
    if ($('masterTitle')) $('masterTitle').value = ev.title;
    if ($('masterSortOrder')) $('masterSortOrder').value = String(ev.sort_order ?? '');
    const r = document.querySelector(`input[name="contentType"][value="${ev.content_type}"]`);
    if (r) r.checked = true;
    if ($('masterTemplateText')) $('masterTemplateText').value = ev.template_text || '';
    const box = $('choiceRowsContainer');
    if (box) {
      box.innerHTML = '';
      if (ev.content_type === 'choices') {
        (ev.choices.length ? ev.choices : [{ label: '', text: '' }]).forEach((c) => addChoiceRow(box, c.label, c.text));
      }
    }
    $('resetFormBtn')?.classList.remove('hidden');
    toggleTypeUI('contentType', 'templateInputArea', 'choicesInputArea', 'choiceRowsContainer');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderAdminList = () => {
    const list = $('adminEventList');
    if (!list) return;
    list.innerHTML = '';
    if (!state.events.length) {
      list.innerHTML = '<p class="loading-text">この同盟にはまだイベントが登録されていません。</p>';
      return;
    }

    state.events.forEach((ev) => {
      const item = Object.assign(document.createElement('div'), { className: 'admin-item' });
      item.dataset.eventId = String(ev.id);
      item.dataset.draggable = 'true';

      const left = Object.assign(document.createElement('div'), { className: 'admin-item-left' });
      left.appendChild(makeHandle());

      const info = Object.assign(document.createElement('div'), { className: 'admin-item-info' });
      const titleRow = Object.assign(document.createElement('div'), { className: 'admin-item-title' });
      titleRow.append(
        Object.assign(document.createElement('span'), { textContent: `[順:${ev.sort_order}] ${ev.title}` }),
        Object.assign(document.createElement('span'), {
          className: 'badge',
          textContent: ev.content_type === 'choices' ? `選択肢 (${ev.choices.length}件)` : '定型文'
        })
      );
      const desc = Object.assign(document.createElement('div'), {
        className: 'admin-item-desc',
        textContent:
          ev.content_type === 'choices'
            ? ev.choices.map((c) => `・${c.label}: ${c.text || '（空欄）'}`).join('\n')
            : ev.template_text || '（タイトルのみ出力）'
      });
      info.append(titleRow, desc);
      left.appendChild(info);

      const acts = Object.assign(document.createElement('div'), { className: 'admin-item-actions' });
      const editBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn-secondary btn-sm', textContent: '編集' });
      editBtn.addEventListener('click', () => startEditEvent(ev));
      const delBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn-danger btn-sm', textContent: '削除' });
      delBtn.addEventListener('click', () => deleteMasterEvent(ev));
      acts.append(editBtn, delBtn);

      item.append(left, acts);
      list.appendChild(item);
    });
  };

  // ===== イベント登録 =====
  tabBtns.forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));
  $('allianceSelect')?.addEventListener('change', (e) => switchAlliance(e.target.value));

  copyShareBtn?.addEventListener('click', async () => {
    const cur = currentAlliance();
    const u = shareUrlOf(cur);
    if (!u) return alert('共有トークンが未設定です。「箱を管理」からURL再発行を行ってください。');
    if (await copyText(u)) showToast(`「${cur.name}」の外部共有URLをコピーしました`);
  });

  $('openAllianceModalBtn')?.addEventListener('click', () => {
    if (state.isShare) return;
    if ($('newAllianceName')) $('newAllianceName').value = '';
    if ($('newAllianceSlug')) $('newAllianceSlug').value = '';
    renderAllianceUI();
    $('allianceModal')?.classList.remove('hidden');
    setTimeout(() => $('newAllianceName')?.focus(), 50);
  });
  $('closeAllianceModalBtn')?.addEventListener('click', () => $('allianceModal')?.classList.add('hidden'));
  $('allianceModal')?.addEventListener('click', (e) => {
    if (e.target === $('allianceModal')) $('allianceModal').classList.add('hidden');
  });

  $('createAllianceForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('newAllianceName')?.value.trim();
    if (!name) return;
    const btn = $('createAllianceSubmitBtn');
    if (btn) btn.disabled = true;
    try {
      const created = await api('/api/alliances', 'POST', {
        name,
        id: $('newAllianceSlug')?.value.trim() || '',
        copy_from_id: $('copyFromAllianceSelect')?.value || ''
      });
      await fetchAlliances();
      $('allianceModal')?.classList.add('hidden');
      await switchAlliance(created.id, true);
      showToast(
        created.copied_events_count > 0
          ? `「${created.name}」を作成しました（イベント${created.copied_events_count}件コピー）`
          : `「${created.name}」を作成しました`
      );
    } catch (err) { alert(err.message); }
    finally { if (btn) btn.disabled = false; }
  });

  $('noticeDate')?.addEventListener('change', () => {
    if ($('datePreview')) $('datePreview').textContent = fmtDate($('noticeDate').value);
  });

  $('uncheckAllBtn')?.addEventListener('click', () => {
    Object.values(state.sel).forEach((s) => (s.checked = false));
    renderCreateEvents();
  });

  $('saveTopFreeTextDefaultBtn')?.addEventListener('click', async () => {
    try {
      await api('/api/settings', 'PUT', { alliance_id: state.allianceId, default_top_free_text: $('topFreeText')?.value || '' });
      showToast(`「${currentAlliance()?.name || '現在'}」の自由記述欄（上）を保存しました`);
    } catch (err) { alert(err.message); }
  });

  $('saveFreeTextDefaultBtn')?.addEventListener('click', async () => {
    try {
      await api('/api/settings', 'PUT', { alliance_id: state.allianceId, default_free_text: $('freeText')?.value || '' });
      showToast(`「${currentAlliance()?.name || '現在'}」の自由記述欄（下）を保存しました`);
    } catch (err) { alert(err.message); }
  });

  const openQuick = () => {
    if ($('quickTitle')) $('quickTitle').value = '';
    const r = document.querySelector('input[name="quickContentType"][value="template"]');
    if (r) r.checked = true;
    if ($('quickTemplateText')) $('quickTemplateText').value = '';
    if ($('quickChoiceRowsContainer')) $('quickChoiceRowsContainer').innerHTML = '';
    if ($('quickSaveToMaster')) $('quickSaveToMaster').checked = true;
    toggleTypeUI('quickContentType', 'quickTemplateArea', 'quickChoicesArea', 'quickChoiceRowsContainer');
    $('quickAddModal')?.classList.remove('hidden');
    setTimeout(() => $('quickTitle')?.focus(), 50);
  };
  const closeQuick = () => $('quickAddModal')?.classList.add('hidden');

  $('openQuickAddBtn')?.addEventListener('click', openQuick);
  $('openQuickAddBottomBtn')?.addEventListener('click', openQuick);
  $('closeQuickAddBtn')?.addEventListener('click', closeQuick);
  $('cancelQuickAddBtn')?.addEventListener('click', closeQuick);
  $('quickAddModal')?.addEventListener('click', (e) => { if (e.target === $('quickAddModal')) closeQuick(); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeQuick();
      $('allianceModal')?.classList.add('hidden');
    }
  });

  document.querySelectorAll('input[name="quickContentType"]').forEach((r) =>
    r.addEventListener('change', () => toggleTypeUI('quickContentType', 'quickTemplateArea', 'quickChoicesArea', 'quickChoiceRowsContainer'))
  );
  $('quickAddChoiceRowBtn')?.addEventListener('click', () => addChoiceRow($('quickChoiceRowsContainer')));

  $('quickAddForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = $('quickTitle')?.value.trim();
    if (!title) return;
    const type = document.querySelector('input[name="quickContentType"]:checked')?.value || 'template';
    const tpl = type === 'template' ? $('quickTemplateText')?.value || '' : '';
    const choices = type === 'choices' ? readChoices($('quickChoiceRowsContainer')) : [];
    const initText = type === 'choices' ? choices[0]?.text || '' : tpl;

    if (!($('quickSaveToMaster')?.checked ?? true)) {
      const id = `temp_${state.tempSeq++}`;
      state.tempEvents.push({ id, title, content_type: type, template_text: tpl, choices });
      state.sel[id] = { checked: true, choiceIndex: 0, text: initText, overwrite: false };
      renderCreateEvents();
      closeQuick();
      showToast(`「${title}」を今回限りで追加しました`);
      $('eventSelectList')?.querySelector(`[data-event-key="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const btn = $('submitQuickAddBtn');
    if (btn) btn.disabled = true;
    try {
      const created = await api('/api/events', 'POST', { alliance_id: state.allianceId, title, content_type: type, template_text: tpl, choices });
      const key = String(created.id);
      state.sel[key] = { checked: true, choiceIndex: 0, text: initText, overwrite: false };
      await fetchEvents();
      closeQuick();
      showToast(`「${title}」をマスタに登録＆選択しました`);
      $('eventSelectList')?.querySelector(`[data-event-key="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) { alert(err.message); }
    finally { if (btn) btn.disabled = false; }
  });

  $('generateBtn')?.addEventListener('click', async () => {
    const text = buildNoticeText();
    state.lastText = text;
    if ($('previewTextarea')) $('previewTextarea').value = text;
    updateCharCount();

    const copied = await copyText(text);

    const targets = state.events.filter((ev) => {
      const s = state.sel[String(ev.id)];
      if (!s?.overwrite) return false;
      if (ev.content_type === 'choices' && !ev.choices.length) return false;
      return s.text !== masterTextOf(ev, s.choiceIndex);
    });

    let saved = 0;
    if (targets.length) {
      const results = await Promise.allSettled(
        targets.map((ev) => overwriteMaster(ev, state.sel[String(ev.id)].choiceIndex, state.sel[String(ev.id)].text))
      );
      saved = results.filter((r) => r.status === 'fulfilled').length;
      if (saved) renderCreateEvents();
    }

    const banner = $('autoCopyStatus');
    if (banner) {
      banner.className = `status-banner ${copied ? 'success' : 'warn'}`;
      banner.textContent = copied
        ? saved > 0
          ? `✅ 通知テキストを自動コピーし、${saved}件のイベントマスタを上書き保存しました！`
          : '✅ 通知テキストを自動でクリップボードにコピーしました！このままゲーム内に貼り付けできます。'
        : '⚠️ 自動コピーがブラウザに制限されました。下の「テキストをコピー」ボタンを押してください。';
    }
    if (copied) showToast(saved > 0 ? `コピー＆${saved}件のマスタを上書きしました` : 'クリップボードにコピーしました');
    switchView('preview');
  });

  $('previewTextarea')?.addEventListener('input', updateCharCount);
  $('copyAgainBtn')?.addEventListener('click', async () => {
    if (!$('previewTextarea')) return;
    if (await copyText($('previewTextarea').value)) {
      if ($('autoCopyStatus')) {
        $('autoCopyStatus').className = 'status-banner success';
        $('autoCopyStatus').textContent = '✅ 最新のテキストをクリップボードにコピーしました！';
      }
      showToast('コピーしました！');
    } else alert('コピーに失敗しました。手動で選択してコピーしてください。');
  });
  $('resetPreviewBtn')?.addEventListener('click', () => {
    if ($('previewTextarea')) $('previewTextarea').value = state.lastText;
    updateCharCount();
    showToast('微調整前の状態に戻しました');
  });
  $('backToCreateBtn')?.addEventListener('click', () => switchView('create'));

  document.querySelectorAll('input[name="contentType"]').forEach((r) =>
    r.addEventListener('change', () => toggleTypeUI('contentType', 'templateInputArea', 'choicesInputArea', 'choiceRowsContainer'))
  );
  $('addChoiceRowBtn')?.addEventListener('click', () => addChoiceRow($('choiceRowsContainer')));
  $('resetFormBtn')?.addEventListener('click', resetAdminForm);

  $('eventForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('editEventId')?.value || '';
    const type = document.querySelector('input[name="contentType"]:checked')?.value || 'template';
    const choices = type === 'choices' ? readChoices($('choiceRowsContainer')) : [];
    const payload = {
      alliance_id: state.allianceId,
      title: $('masterTitle')?.value.trim() || '',
      content_type: type,
      template_text: type === 'template' ? $('masterTemplateText')?.value || '' : '',
      choices,
      sort_order: $('masterSortOrder')?.value === '' ? undefined : Number($('masterSortOrder')?.value)
    };
    try {
      await api(id ? `/api/events/${id}` : '/api/events', id ? 'PUT' : 'POST', payload);
      if (id) {
        const k = String(id);
        state.sel[k] = {
          checked: state.sel[k]?.checked ?? false,
          choiceIndex: 0,
          text: type === 'choices' ? choices[0]?.text || '' : payload.template_text,
          overwrite: false
        };
      }
      resetAdminForm();
      await fetchEvents();
      showToast(id ? 'イベントを更新しました' : 'イベントを追加しました');
    } catch (err) { alert(err.message); }
  });

  // 大項目 ↑↓ ボタン
  $('sortableSections')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.section-move-btn');
    if (!btn || btn.disabled) return;
    const key = btn.closest('.section-card')?.dataset.sectionKey;
    const idx = state.sectionOrder.indexOf(key);
    const to = idx + Number(btn.dataset.dir);
    if (idx < 0 || to < 0 || to >= state.sectionOrder.length) return;
    const next = [...state.sectionOrder];
    [next[idx], next[to]] = [next[to], next[idx]];
    saveSectionOrder(next);
  });

  // ===== PWA =====
  const setupPWA = () => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
    }
    const btn = $('installAppBtn');
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!btn || standalone) return;

    let promptEv = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      promptEv = e;
      btn.classList.remove('hidden');
    });
    window.addEventListener('appinstalled', () => {
      promptEv = null;
      btn.classList.add('hidden');
      showToast('アプリをインストールしました！');
    });
    if (isIOS) btn.classList.remove('hidden');

    btn.addEventListener('click', async () => {
      if (promptEv) {
        promptEv.prompt();
        const { outcome } = await promptEv.userChoice;
        if (outcome === 'accepted') btn.classList.add('hidden');
        promptEv = null;
      } else if (isIOS) {
        alert('【iPhone / iPadでのアプリ化手順】\n1. Safariの共有ボタン（□↑）をタップ\n2.「ホーム画面に追加」を選択\n3. 右上の「追加」をタップ');
      }
    });
  };

  // ===== 初期化 =====
  const init = async () => {
    if ($('noticeDate')) {
      $('noticeDate').value = todayISO();
      if ($('datePreview')) $('datePreview').textContent = fmtDate($('noticeDate').value);
    }

    bindDragSort($('sortableSections'), {
      handleSel: '.section-drag-handle',
      itemSel: ':scope > .section-card',
      dragClass: 'section-dragging',
      phClass: 'section-drag-placeholder',
      fixedPhHeight: 76,
      getId: (el) => el.dataset.sectionKey,
      onDone: saveSectionOrder
    });

    const eventDragOpt = (itemSel) => ({
      handleSel: '.drag-handle',
      itemSel,
      dragClass: 'dragging',
      phClass: 'drag-placeholder',
      isTarget: (el) => el.dataset.draggable === 'true',
      getId: (el) => Number(el.dataset.eventId),
      onDone: saveEventOrder
    });
    bindDragSort($('eventSelectList'), eventDragOpt('.event-row'));
    bindDragSort($('adminEventList'), eventDragOpt('.admin-item'));
    setupPWA();

    const params = new URLSearchParams(location.search);
    const shareParam = (params.get('share') || '').trim();
    if (shareParam) {
      state.isShare = true;
      state.shareToken = shareParam;
    }

    try {
      await fetchAlliances();
      if (state.isShare) {
        if (!state.alliances[0]) return showShareError('無効な共有URLです。管理者に最新のURLを確認してください。');
        await switchAlliance(state.alliances[0].id, true);
        return;
      }
      const urlId = params.get('alliance');
      let savedId = null;
      try { savedId = localStorage.getItem(LAST_KEY); } catch {}
      const target =
        state.alliances.find((a) => a.id === urlId)?.id ||
        state.alliances.find((a) => a.id === savedId)?.id ||
        state.alliances[0]?.id ||
        'default';
      await switchAlliance(target, true);
    } catch (err) {
      if (state.isShare) showShareError(err.message);
      else {
        const html = `<p class="loading-text">DB読み込みエラー: ${err.message}</p>`;
        if ($('eventSelectList')) $('eventSelectList').innerHTML = html;
        if ($('adminEventList')) $('adminEventList').innerHTML = html;
      }
    }
  };

  init();
})();
