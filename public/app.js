(() => {
  const LAST_ALLIANCE_KEY = 'wos_last_alliance_id';
  const DEFAULT_SECTION_ORDER = ['free_top', 'schedule', 'events', 'free_bottom'];

  const state = {
    isShareMode: false,
    shareToken: '',
    alliances: [],
    currentAllianceId: 'default',
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    events: [],
    tempEvents: [],
    tempIdCounter: 1,
    selections: {},
    lastGeneratedText: ''
  };

  // DOM要素
  const views = {
    create: document.getElementById('view-create'),
    preview: document.getElementById('view-preview'),
    admin: document.getElementById('view-admin')
  };
  const tabBtns = document.querySelectorAll('.tab-btn[data-view]');
  const shareErrorCard = document.getElementById('shareErrorCard');
  const shareErrorMessage = document.getElementById('shareErrorMessage');

  // 同盟（箱）関連
  const allianceSelect = document.getElementById('allianceSelect');
  const lockedAllianceName = document.getElementById('lockedAllianceName');
  const allianceBarActions = document.getElementById('allianceBarActions');
  const copyShareUrlBtn = document.getElementById('copyShareUrlBtn');
  const openAllianceModalBtn = document.getElementById('openAllianceModalBtn');
  const allianceModal = document.getElementById('allianceModal');
  const closeAllianceModalBtn = document.getElementById('closeAllianceModalBtn');
  const createAllianceForm = document.getElementById('createAllianceForm');
  const newAllianceNameInput = document.getElementById('newAllianceName');
  const newAllianceSlugInput = document.getElementById('newAllianceSlug');
  const copyFromAllianceSelect = document.getElementById('copyFromAllianceSelect');
  const createAllianceSubmitBtn = document.getElementById('createAllianceSubmitBtn');
  const allianceManageList = document.getElementById('allianceManageList');
  const adminCurrentAllianceName = document.getElementById('adminCurrentAllianceName');

  // 通知作成画面
  const noticeDateInput = document.getElementById('noticeDate');
  const datePreview = document.getElementById('datePreview');
  const sortableSections = document.getElementById('sortableSections');
  const topFreeTextInput = document.getElementById('topFreeText');
  const saveTopFreeTextDefaultBtn = document.getElementById('saveTopFreeTextDefaultBtn');
  const todayScheduleInput = document.getElementById('todaySchedule');
  const eventSelectList = document.getElementById('eventSelectList');
  const freeTextInput = document.getElementById('freeText');
  const generateBtn = document.getElementById('generateBtn');
  const uncheckAllBtn = document.getElementById('uncheckAllBtn');
  const saveFreeTextDefaultBtn = document.getElementById('saveFreeTextDefaultBtn');

  // クイック追加モーダル
  const openQuickAddBtn = document.getElementById('openQuickAddBtn');
  const openQuickAddBottomBtn = document.getElementById('openQuickAddBottomBtn');
  const quickAddModal = document.getElementById('quickAddModal');
  const closeQuickAddBtn = document.getElementById('closeQuickAddBtn');
  const cancelQuickAddBtn = document.getElementById('cancelQuickAddBtn');
  const quickAddForm = document.getElementById('quickAddForm');
  const quickTitleInput = document.getElementById('quickTitle');
  const quickContentTypeRadios = document.querySelectorAll('input[name="quickContentType"]');
  const quickTemplateArea = document.getElementById('quickTemplateArea');
  const quickTemplateTextInput = document.getElementById('quickTemplateText');
  const quickChoicesArea = document.getElementById('quickChoicesArea');
  const quickChoiceRowsContainer = document.getElementById('quickChoiceRowsContainer');
  const quickAddChoiceRowBtn = document.getElementById('quickAddChoiceRowBtn');
  const quickSaveToMasterCheckbox = document.getElementById('quickSaveToMaster');
  const submitQuickAddBtn = document.getElementById('submitQuickAddBtn');

  // プレビュー画面
  const previewTextarea = document.getElementById('previewTextarea');
  const charCount = document.getElementById('charCount');
  const autoCopyStatus = document.getElementById('autoCopyStatus');
  const copyAgainBtn = document.getElementById('copyAgainBtn');
  const resetPreviewBtn = document.getElementById('resetPreviewBtn');
  const backToCreateBtn = document.getElementById('backToCreateBtn');

  // 管理画面
  const eventForm = document.getElementById('eventForm');
  const formTitle = document.getElementById('formTitle');
  const editEventIdInput = document.getElementById('editEventId');
  const masterTitleInput = document.getElementById('masterTitle');
  const masterSortOrderInput = document.getElementById('masterSortOrder');
  const contentTypeRadios = document.querySelectorAll('input[name="contentType"]');
  const templateInputArea = document.getElementById('templateInputArea');
  const masterTemplateTextInput = document.getElementById('masterTemplateText');
  const choicesInputArea = document.getElementById('choicesInputArea');
  const choiceRowsContainer = document.getElementById('choiceRowsContainer');
  const addChoiceRowBtn = document.getElementById('addChoiceRowBtn');
  const resetFormBtn = document.getElementById('resetFormBtn');
  const adminEventList = document.getElementById('adminEventList');
  const toastEl = document.getElementById('toast');

  // ===== ユーティリティ =====
  let toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2500);
  }

  function getTodayLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatJapaneseDate(isoDate) {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-').map(Number);
    if (!y || !m || !d) return '';
    const date = new Date(y, m - 1, d);
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    return `${m}月${d}日(${weekdays[date.getDay()]})`;
  }

  function normalizeSectionOrder(raw) {
    const list = Array.isArray(raw) ? raw : [];
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

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // フォールバックへ
    }
    try {
      const tmp = document.createElement('textarea');
      tmp.value = text;
      tmp.style.position = 'fixed';
      tmp.style.opacity = '0';
      document.body.appendChild(tmp);
      tmp.focus();
      tmp.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(tmp);
      return ok;
    } catch {
      return false;
    }
  }

  function switchView(viewName) {
    Object.entries(views).forEach(([name, el]) => {
      el.classList.toggle('active', name === viewName);
    });
    tabBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function getExternalShareUrl(alliance) {
    if (!alliance?.share_token) return '';
    return `${window.location.origin}/?share=${encodeURIComponent(alliance.share_token)}`;
  }

  function getCurrentAlliance() {
    return state.alliances.find((a) => a.id === state.currentAllianceId) || state.alliances[0] || null;
  }

  function syncUrlWithAlliance(allianceId) {
    if (state.isShareMode) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('share');
      url.searchParams.set('alliance', allianceId);
      window.history.replaceState({}, '', url.toString());
    } catch {
      // 無視
    }
    try {
      localStorage.setItem(LAST_ALLIANCE_KEY, allianceId);
    } catch {
      // 無視
    }
  }

  function applyShareModeUI(allianceName) {
    allianceSelect.classList.add('hidden');
    allianceBarActions.classList.add('hidden');
    lockedAllianceName.classList.remove('hidden');
    lockedAllianceName.textContent = allianceName;
    document.title = `${allianceName}｜ホワサバ 同盟通知メーカー`;
  }

  function showShareAccessError(message) {
    Object.values(views).forEach((el) => el.classList.remove('active'));
    tabBtns.forEach((btn) => btn.classList.add('hidden'));
    allianceSelect.classList.add('hidden');
    allianceBarActions.classList.add('hidden');
    lockedAllianceName.classList.add('hidden');
    shareErrorMessage.textContent = message;
    shareErrorCard.classList.remove('hidden');
  }

  function createDragHandle() {
    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.title = 'ドラッグして並び替え';
    handle.setAttribute('aria-label', 'ドラッグして並び替え');
    handle.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
      '<circle cx="5.5" cy="3" r="1.4"/><circle cx="10.5" cy="3" r="1.4"/>' +
      '<circle cx="5.5" cy="8" r="1.4"/><circle cx="10.5" cy="8" r="1.4"/>' +
      '<circle cx="5.5" cy="13" r="1.4"/><circle cx="10.5" cy="13" r="1.4"/>' +
      '</svg>';
    return handle;
  }

  function addChoiceRowTo(container, label = '', text = '') {
    const row = document.createElement('div');
    row.className = 'choice-row';

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.className = 'input choice-label-input';
    labelInput.placeholder = '選択肢名（例：1日目）';
    labelInput.value = label;

    const textInput = document.createElement('textarea');
    textInput.className = 'textarea choice-text-input';
    textInput.rows = 2;
    textInput.placeholder = 'この選択肢の定型文';
    textInput.value = text;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-danger btn-sm';
    removeBtn.textContent = '削除';
    removeBtn.addEventListener('click', () => row.remove());

    row.appendChild(labelInput);
    row.appendChild(textInput);
    row.appendChild(removeBtn);
    container.appendChild(row);
  }

  function collectChoicesFrom(container) {
    return Array.from(container.querySelectorAll('.choice-row'))
      .map((row) => ({
        label: row.querySelector('.choice-label-input').value.trim(),
        text: row.querySelector('.choice-text-input').value
      }))
      .filter((c) => c.label || c.text);
  }

  // ===== 大項目（4セクション）の並び替え =====
  function applySectionOrder(order) {
    state.sectionOrder = normalizeSectionOrder(order);
    const cardMap = new Map();
    sortableSections.querySelectorAll(':scope > .section-card').forEach((card) => {
      cardMap.set(card.dataset.sectionKey, card);
    });

    state.sectionOrder.forEach((key, idx) => {
      const card = cardMap.get(key);
      if (!card) return;
      sortableSections.appendChild(card);

      const numEl = card.querySelector('.section-num');
      if (numEl) numEl.textContent = `${idx + 2}.`;

      const upBtn = card.querySelector('.section-move-btn[data-dir="-1"]');
      const downBtn = card.querySelector('.section-move-btn[data-dir="1"]');
      if (upBtn) upBtn.disabled = idx === 0;
      if (downBtn) downBtn.disabled = idx === state.sectionOrder.length - 1;
    });
  }

  async function saveSectionOrder(newOrder) {
    const previousOrder = [...state.sectionOrder];
    const normalized = normalizeSectionOrder(newOrder);
    applySectionOrder(normalized);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alliance_id: state.currentAllianceId,
          section_order: normalized
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '項目の並び順保存に失敗しました');
      }
      showToast('項目の並び順を保存しました');
    } catch (err) {
      alert(err.message);
      applySectionOrder(previousOrder);
    }
  }

  function setupSectionDragSort() {
    let dragCard = null;
    let placeholder = null;
    let activeHandle = null;
    let activePointerId = null;
    let offsetY = 0;
    let initialOrder = [];

    function getOrder() {
      return Array.from(sortableSections.querySelectorAll(':scope > .section-card')).map(
        (el) => el.dataset.sectionKey
      );
    }

    function onPointerMove(e) {
      if (!dragCard || e.pointerId !== activePointerId) return;
      e.preventDefault();

      dragCard.style.top = `${e.clientY - offsetY}px`;

      const edge = 80;
      if (e.clientY < edge) {
        window.scrollBy(0, -12);
      } else if (e.clientY > window.innerHeight - edge) {
        window.scrollBy(0, 12);
      }

      const siblings = Array.from(
        sortableSections.querySelectorAll(':scope > .section-card')
      ).filter((el) => el !== dragCard);

      let inserted = false;
      for (const sibling of siblings) {
        const box = sibling.getBoundingClientRect();
        const midY = box.top + box.height / 2;
        if (e.clientY < midY) {
          sortableSections.insertBefore(placeholder, sibling);
          inserted = true;
          break;
        }
      }

      if (!inserted) {
        sortableSections.appendChild(placeholder);
      }
    }

    function finishDrag(e) {
      if (!dragCard || e.pointerId !== activePointerId) return;

      if (activeHandle) {
        activeHandle.removeEventListener('pointermove', onPointerMove);
        activeHandle.removeEventListener('pointerup', finishDrag);
        activeHandle.removeEventListener('pointercancel', finishDrag);
        try {
          activeHandle.releasePointerCapture(activePointerId);
        } catch {
          // 無視
        }
      }

      dragCard.classList.remove('section-dragging');
      dragCard.style.position = '';
      dragCard.style.top = '';
      dragCard.style.left = '';
      dragCard.style.width = '';
      dragCard.style.zIndex = '';
      dragCard.style.pointerEvents = '';

      if (placeholder && placeholder.parentNode) {
        placeholder.replaceWith(dragCard);
      }

      document.body.classList.remove('is-dragging');

      const newOrder = getOrder();
      const changed =
        newOrder.length === initialOrder.length &&
        newOrder.some((key, idx) => key !== initialOrder[idx]);

      dragCard = null;
      placeholder = null;
      activeHandle = null;
      activePointerId = null;

      if (changed) {
        saveSectionOrder(newOrder);
      }
    }

    sortableSections.addEventListener('pointerdown', (e) => {
      const handle = e.target.closest('.section-drag-handle');
      if (!handle || !sortableSections.contains(handle)) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      const card = handle.closest('.section-card');
      if (!card || card.parentElement !== sortableSections) return;

      e.preventDefault();

      dragCard = card;
      activeHandle = handle;
      activePointerId = e.pointerId;
      initialOrder = getOrder();

      const rect = dragCard.getBoundingClientRect();
      offsetY = Math.min(e.clientY - rect.top, 36);

      placeholder = document.createElement('div');
      placeholder.className = 'section-drag-placeholder';
      placeholder.style.height = '76px';

      dragCard.parentNode.insertBefore(placeholder, dragCard);

      dragCard.classList.add('section-dragging');
      dragCard.style.position = 'fixed';
      dragCard.style.top = `${e.clientY - offsetY}px`;
      dragCard.style.left = `${rect.left}px`;
      dragCard.style.width = `${rect.width}px`;
      dragCard.style.zIndex = '90';
      dragCard.style.pointerEvents = 'none';

      document.body.classList.add('is-dragging');

      try {
        handle.setPointerCapture(e.pointerId);
      } catch {
        // 無視
      }

      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', finishDrag);
      handle.addEventListener('pointercancel', finishDrag);
    });

    // ↑↓ボタンによる並び替え
    sortableSections.addEventListener('click', (e) => {
      const btn = e.target.closest('.section-move-btn');
      if (!btn || btn.disabled) return;
      const card = btn.closest('.section-card');
      if (!card) return;

      const key = card.dataset.sectionKey;
      const dir = Number(btn.dataset.dir);
      const idx = state.sectionOrder.indexOf(key);
      const targetIdx = idx + dir;
      if (idx === -1 || targetIdx < 0 || targetIdx >= state.sectionOrder.length) return;

      const nextOrder = [...state.sectionOrder];
      [nextOrder[idx], nextOrder[targetIdx]] = [nextOrder[targetIdx], nextOrder[idx]];
      saveSectionOrder(nextOrder);
    });
  }

  // ===== イベント行のドラッグ並び替え =====
  function setupDragSort(container, itemSelector, onReorder) {
    let dragItem = null;
    let placeholder = null;
    let activeHandle = null;
    let activePointerId = null;
    let offsetY = 0;
    let initialOrder = [];

    function getOrder() {
      return Array.from(container.querySelectorAll(itemSelector))
        .filter((el) => el.dataset.draggable === 'true')
        .map((el) => Number(el.dataset.eventId));
    }

    function onPointerMove(e) {
      if (!dragItem || e.pointerId !== activePointerId) return;
      e.preventDefault();

      dragItem.style.top = `${e.clientY - offsetY}px`;

      const edge = 72;
      if (e.clientY < edge) {
        window.scrollBy(0, -10);
      } else if (e.clientY > window.innerHeight - edge) {
        window.scrollBy(0, 10);
      }

      const siblings = Array.from(container.querySelectorAll(itemSelector)).filter(
        (el) => el !== dragItem && el.dataset.draggable === 'true'
      );

      let inserted = false;
      for (const sibling of siblings) {
        const box = sibling.getBoundingClientRect();
        const midY = box.top + box.height / 2;
        if (e.clientY < midY) {
          container.insertBefore(placeholder, sibling);
          inserted = true;
          break;
        }
      }

      if (!inserted) {
        const lastDraggable = siblings[siblings.length - 1];
        if (lastDraggable && lastDraggable.nextSibling) {
          container.insertBefore(placeholder, lastDraggable.nextSibling);
        } else {
          container.appendChild(placeholder);
        }
      }
    }

    function finishDrag(e) {
      if (!dragItem || e.pointerId !== activePointerId) return;

      if (activeHandle) {
        activeHandle.removeEventListener('pointermove', onPointerMove);
        activeHandle.removeEventListener('pointerup', finishDrag);
        activeHandle.removeEventListener('pointercancel', finishDrag);
        try {
          activeHandle.releasePointerCapture(activePointerId);
        } catch {
          // 無視
        }
      }

      dragItem.classList.remove('dragging');
      dragItem.style.position = '';
      dragItem.style.top = '';
      dragItem.style.left = '';
      dragItem.style.width = '';
      dragItem.style.zIndex = '';
      dragItem.style.pointerEvents = '';

      if (placeholder && placeholder.parentNode) {
        placeholder.replaceWith(dragItem);
      }

      document.body.classList.remove('is-dragging');

      const newOrder = getOrder();
      const changed =
        newOrder.length === initialOrder.length &&
        newOrder.some((id, idx) => id !== initialOrder[idx]);

      dragItem = null;
      placeholder = null;
      activeHandle = null;
      activePointerId = null;

      if (changed) {
        onReorder(newOrder);
      }
    }

    container.addEventListener('pointerdown', (e) => {
      const handle = e.target.closest('.drag-handle');
      if (!handle || !container.contains(handle)) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      const item = handle.closest(itemSelector);
      if (!item || item.dataset.draggable !== 'true') return;

      e.preventDefault();

      dragItem = item;
      activeHandle = handle;
      activePointerId = e.pointerId;
      initialOrder = getOrder();

      const rect = dragItem.getBoundingClientRect();
      offsetY = e.clientY - rect.top;

      placeholder = document.createElement('div');
      placeholder.className = 'drag-placeholder';
      placeholder.style.height = `${rect.height}px`;

      dragItem.parentNode.insertBefore(placeholder, dragItem);

      dragItem.classList.add('dragging');
      dragItem.style.position = 'fixed';
      dragItem.style.top = `${rect.top}px`;
      dragItem.style.left = `${rect.left}px`;
      dragItem.style.width = `${rect.width}px`;
      dragItem.style.zIndex = '90';
      dragItem.style.pointerEvents = 'none';

      document.body.classList.add('is-dragging');

      try {
        handle.setPointerCapture(e.pointerId);
      } catch {
        // 無視
      }

      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', finishDrag);
      handle.addEventListener('pointercancel', finishDrag);
    });
  }

  async function saveEventOrder(orderedIds) {
    const eventMap = new Map(state.events.map((ev) => [ev.id, ev]));
    state.events = orderedIds
      .map((id, idx) => {
        const ev = eventMap.get(id);
        return ev ? { ...ev, sort_order: idx + 1 } : null;
      })
      .filter(Boolean);

    renderEventSelection();
    renderAdminList();

    try {
      const res = await fetch('/api/events/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '並び順の保存に失敗しました');
      }
      showToast('イベントの並び順を保存しました');
    } catch (err) {
      alert(err.message);
      await fetchEvents();
    }
  }

  // ===== 同盟（箱）管理 =====
  async function fetchAlliances() {
    const endpoint = state.isShareMode
      ? `/api/alliances?share_token=${encodeURIComponent(state.shareToken)}`
      : '/api/alliances';
    const res = await fetch(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || '同盟情報の取得に失敗しました');
    }
    state.alliances = await res.json();
    renderAllianceUI();
  }

  function renderAllianceUI() {
    const current = getCurrentAlliance();
    if (adminCurrentAllianceName) {
      adminCurrentAllianceName.textContent = current ? current.name : '';
    }

    if (state.isShareMode) {
      if (current) applyShareModeUI(current.name);
      return;
    }

    allianceSelect.innerHTML = '';
    state.alliances.forEach((al) => {
      const opt = document.createElement('option');
      opt.value = al.id;
      opt.textContent = al.name;
      if (al.id === state.currentAllianceId) opt.selected = true;
      allianceSelect.appendChild(opt);
    });

    copyFromAllianceSelect.innerHTML = '';
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '空の状態から作成';
    copyFromAllianceSelect.appendChild(emptyOpt);

    state.alliances.forEach((al) => {
      const opt = document.createElement('option');
      opt.value = al.id;
      opt.textContent = `「${al.name}」のイベントをコピー`;
      if (al.id === state.currentAllianceId) opt.selected = true;
      copyFromAllianceSelect.appendChild(opt);
    });

    allianceManageList.innerHTML = '';
    state.alliances.forEach((al) => {
      const isCurrent = al.id === state.currentAllianceId;
      const item = document.createElement('div');
      item.className = 'alliance-manage-item' + (isCurrent ? ' current' : '');

      const meta = document.createElement('div');
      meta.className = 'alliance-manage-meta';

      const nameRow = document.createElement('div');
      nameRow.className = 'alliance-manage-name';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = al.name;
      nameRow.appendChild(nameSpan);

      if (isCurrent) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = '選択中';
        nameRow.appendChild(badge);
      }

      const idText = document.createElement('div');
      idText.className = 'alliance-manage-id';
      idText.textContent = al.share_token
        ? `共有URL: ?share=${al.share_token}`
        : `ID: ${al.id}`;

      meta.appendChild(nameRow);
      meta.appendChild(idText);

      const actions = document.createElement('div');
      actions.className = 'alliance-manage-actions';

      if (!isCurrent) {
        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'btn btn-primary btn-sm';
        openBtn.textContent = '開く';
        openBtn.addEventListener('click', async () => {
          closeAllianceModal();
          await switchAlliance(al.id);
        });
        actions.appendChild(openBtn);
      }

      const shareUrlBtn = document.createElement('button');
      shareUrlBtn.type = 'button';
      shareUrlBtn.className = 'btn btn-secondary btn-sm';
      shareUrlBtn.textContent = '🔒 共有URLコピー';
      shareUrlBtn.addEventListener('click', async () => {
        const url = getExternalShareUrl(al);
        if (!url) {
          alert('共有トークンがありません。URL再発行を実行してください。');
          return;
        }
        const ok = await copyToClipboard(url);
        if (ok) showToast(`「${al.name}」の外部共有URLをコピーしました`);
      });

      const regenBtn = document.createElement('button');
      regenBtn.type = 'button';
      regenBtn.className = 'btn btn-ghost btn-sm';
      regenBtn.textContent = 'URL再発行';
      regenBtn.title = '古い共有URLを無効化し、新しいURLを発行します';
      regenBtn.addEventListener('click', async () => {
        if (
          !confirm(
            `「${al.name}」の外部共有URLを再発行しますか？\nこれまで配布した古い共有URLは使えなくなります。`
          )
        ) {
          return;
        }
        try {
          const res = await fetch(`/api/alliances/${encodeURIComponent(al.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ regenerate_token: true })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || '再発行に失敗しました');
          }
          const updated = await res.json();
          await fetchAlliances();
          const newUrl = `${window.location.origin}/?share=${encodeURIComponent(updated.share_token)}`;
          await copyToClipboard(newUrl);
          showToast('新しい共有URLを発行＆コピーしました');
        } catch (err) {
          alert(err.message);
        }
      });

      const renameBtn = document.createElement('button');
      renameBtn.type = 'button';
      renameBtn.className = 'btn btn-ghost btn-sm';
      renameBtn.textContent = '名前変更';
      renameBtn.addEventListener('click', async () => {
        const nextName = prompt('新しい同盟名を入力してください', al.name);
        if (!nextName || !nextName.trim() || nextName.trim() === al.name) return;
        try {
          const res = await fetch(`/api/alliances/${encodeURIComponent(al.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nextName.trim() })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || '名前変更に失敗しました');
          }
          await fetchAlliances();
          showToast('同盟名を変更しました');
        } catch (err) {
          alert(err.message);
        }
      });

      actions.appendChild(shareUrlBtn);
      actions.appendChild(regenBtn);
      actions.appendChild(renameBtn);

      if (state.alliances.length > 1) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn btn-danger btn-sm';
        delBtn.textContent = '削除';
        delBtn.addEventListener('click', async () => {
          if (
            !confirm(
              `「${al.name}」の箱を削除しますか？\nこの同盟に登録されているイベントや自由記述欄もすべて消えます。`
            )
          ) {
            return;
          }
          try {
            const res = await fetch(`/api/alliances/${encodeURIComponent(al.id)}`, {
              method: 'DELETE'
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error || '削除に失敗しました');
            }
            await fetchAlliances();
            if (state.currentAllianceId === al.id && state.alliances[0]) {
              await switchAlliance(state.alliances[0].id);
            }
            showToast(`「${al.name}」を削除しました`);
          } catch (err) {
            alert(err.message);
          }
        });
        actions.appendChild(delBtn);
      }

      item.appendChild(meta);
      item.appendChild(actions);
      allianceManageList.appendChild(item);
    });
  }

  async function switchAlliance(allianceId, { silent = false } = {}) {
    state.currentAllianceId = allianceId;
    state.selections = {};
    state.tempEvents = [];
    syncUrlWithAlliance(allianceId);
    resetAdminForm();
    renderAllianceUI();

    eventSelectList.innerHTML = '<p class="loading-text">読み込み中...</p>';
    adminEventList.innerHTML = '<p class="loading-text">読み込み中...</p>';

    await Promise.all([fetchEvents(), fetchSettings()]);

    if (!silent) {
      const current = getCurrentAlliance();
      if (current) showToast(`「${current.name}」に切り替えました`);
    }
  }

  function openAllianceModal() {
    if (state.isShareMode) return;
    newAllianceNameInput.value = '';
    newAllianceSlugInput.value = '';
    renderAllianceUI();
    allianceModal.classList.remove('hidden');
    setTimeout(() => newAllianceNameInput.focus(), 50);
  }

  function closeAllianceModal() {
    allianceModal.classList.add('hidden');
  }

  // ===== イベント・設定 API 通信 =====
  async function fetchEvents() {
    const res = await fetch(
      `/api/events?alliance_id=${encodeURIComponent(state.currentAllianceId)}`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'イベント一覧の取得に失敗しました');
    }
    state.events = await res.json();

    state.events.forEach((ev) => {
      const key = String(ev.id);
      if (!state.selections[key]) {
        const initialText =
          ev.content_type === 'choices'
            ? ev.choices[0]?.text || ''
            : ev.template_text || '';
        state.selections[key] = {
          checked: false,
          choiceIndex: 0,
          text: initialText
        };
      }
    });

    renderEventSelection();
    renderAdminList();
  }

  async function fetchSettings() {
    try {
      const res = await fetch(
        `/api/settings?alliance_id=${encodeURIComponent(state.currentAllianceId)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      topFreeTextInput.value =
        typeof data.default_top_free_text === 'string' ? data.default_top_free_text : '';
      freeTextInput.value =
        typeof data.default_free_text === 'string' ? data.default_free_text : '';
      applySectionOrder(data.section_order || DEFAULT_SECTION_ORDER);
    } catch {
      topFreeTextInput.value = '';
      freeTextInput.value = '';
      applySectionOrder(DEFAULT_SECTION_ORDER);
    }
  }

  // ===== 通知作成画面の描画 =====
  function createEventRow(ev, isTemp = false) {
    const key = String(ev.id);
    const sel = state.selections[key];
    const row = document.createElement('div');
    row.className = 'event-row' + (sel.checked ? ' checked' : '');
    row.dataset.eventKey = key;
    if (!isTemp) {
      row.dataset.eventId = String(ev.id);
      row.dataset.draggable = 'true';
    }

    const checkWrap = document.createElement('div');
    checkWrap.className = 'event-check-wrap';

    if (!isTemp) {
      checkWrap.appendChild(createDragHandle());
    }

    const checkCol = document.createElement('label');
    checkCol.className = 'event-check-col';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = sel.checked;

    const titleWrap = document.createElement('div');
    titleWrap.className = 'event-title-wrap';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'event-title-text';
    titleSpan.textContent = ev.title;
    titleWrap.appendChild(titleSpan);

    if (isTemp) {
      const tempBadge = document.createElement('span');
      tempBadge.className = 'badge-temp';
      tempBadge.textContent = '今回限り';
      titleWrap.appendChild(tempBadge);
    }

    checkCol.appendChild(checkbox);
    checkCol.appendChild(titleWrap);
    checkWrap.appendChild(checkCol);

    if (isTemp) {
      const removeTempBtn = document.createElement('button');
      removeTempBtn.type = 'button';
      removeTempBtn.className = 'btn btn-ghost btn-sm';
      removeTempBtn.textContent = '✕';
      removeTempBtn.title = 'この今回限りイベントを削除';
      removeTempBtn.addEventListener('click', () => {
        state.tempEvents = state.tempEvents.filter((t) => t.id !== ev.id);
        delete state.selections[key];
        renderEventSelection();
      });
      checkWrap.appendChild(removeTempBtn);
    }

    const editorCol = document.createElement('div');
    editorCol.className = 'event-editor-col';

    const textarea = document.createElement('textarea');
    textarea.className = 'textarea';
    textarea.rows = 2;
    textarea.placeholder = '通知内容（空欄の場合はタイトルのみ出力）';
    textarea.value = sel.text;

    if (ev.content_type === 'choices' && ev.choices.length > 0) {
      const select = document.createElement('select');
      select.className = 'select';
      ev.choices.forEach((choice, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx);
        opt.textContent = choice.label || `選択肢${idx + 1}`;
        if (idx === sel.choiceIndex) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener('change', () => {
        const idx = Number(select.value);
        sel.choiceIndex = idx;
        sel.text = ev.choices[idx]?.text || '';
        textarea.value = sel.text;
        if (!sel.checked) {
          sel.checked = true;
          checkbox.checked = true;
          row.classList.add('checked');
        }
      });

      editorCol.appendChild(select);
    }

    textarea.addEventListener('input', () => {
      sel.text = textarea.value;
      if (textarea.value.trim() && !sel.checked) {
        sel.checked = true;
        checkbox.checked = true;
        row.classList.add('checked');
      }
    });

    checkbox.addEventListener('change', () => {
      sel.checked = checkbox.checked;
      row.classList.toggle('checked', sel.checked);
    });

    editorCol.appendChild(textarea);
    row.appendChild(checkWrap);
    row.appendChild(editorCol);
    return row;
  }

  function renderEventSelection() {
    eventSelectList.innerHTML = '';
    const allEmpty = state.events.length === 0 && state.tempEvents.length === 0;
    if (allEmpty) {
      eventSelectList.innerHTML =
        '<p class="loading-text">この同盟にはまだイベントがありません。「＋ イベント追加」から作成してください。</p>';
      return;
    }

    state.events.forEach((ev) => {
      eventSelectList.appendChild(createEventRow(ev, false));
    });

    state.tempEvents.forEach((ev) => {
      eventSelectList.appendChild(createEventRow(ev, true));
    });
  }

  // ===== クイック追加モーダル =====
  function updateQuickContentTypeUI() {
    const selected = document.querySelector('input[name="quickContentType"]:checked')?.value || 'template';
    quickTemplateArea.classList.toggle('hidden', selected !== 'template');
    quickChoicesArea.classList.toggle('hidden', selected !== 'choices');

    if (selected === 'choices' && quickChoiceRowsContainer.children.length === 0) {
      addChoiceRowTo(quickChoiceRowsContainer, '', '');
    }
  }

  function openQuickAddModal() {
    quickTitleInput.value = '';
    document.querySelector('input[name="quickContentType"][value="template"]').checked = true;
    quickTemplateTextInput.value = '';
    quickChoiceRowsContainer.innerHTML = '';
    quickSaveToMasterCheckbox.checked = true;
    updateQuickContentTypeUI();
    quickAddModal.classList.remove('hidden');
    setTimeout(() => quickTitleInput.focus(), 50);
  }

  function closeQuickAddModal() {
    quickAddModal.classList.add('hidden');
  }

  // ===== 通知テキスト組み立て（大項目の並び順をそのまま反映） =====
  function buildSectionBlock(key) {
    if (key === 'free_top') {
      const text = topFreeTextInput.value.replace(/^\s*\n+|\n+\s*$/g, '');
      return text.trim() ? text : '';
    }

    if (key === 'schedule') {
      const scheduleLines = todayScheduleInput.value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      return scheduleLines.length > 0 ? `●今日の予定\n${scheduleLines.join('\n')}` : '';
    }

    if (key === 'events') {
      const eventItems = [];
      const combinedEvents = [...state.events, ...state.tempEvents];
      combinedEvents.forEach((ev) => {
        const sel = state.selections[String(ev.id)];
        if (!sel || !sel.checked) return;

        const content = (sel.text || '').trim();
        if (content) {
          eventItems.push(`・${ev.title}\n${content}`);
        } else {
          eventItems.push(`・${ev.title}`);
        }
      });
      return eventItems.length > 0 ? `●イベント\n${eventItems.join('\n\n')}` : '';
    }

    if (key === 'free_bottom') {
      const text = freeTextInput.value.replace(/^\s*\n+|\n+\s*$/g, '');
      return text.trim() ? text : '';
    }

    return '';
  }

  function buildNoticeText() {
    const dateStr = formatJapaneseDate(noticeDateInput.value);
    const sectionBlocks = state.sectionOrder
      .map((key) => buildSectionBlock(key))
      .filter((block) => block.length > 0);

    if (!dateStr) {
      return sectionBlocks.join('\n\n');
    }
    if (sectionBlocks.length === 0) {
      return dateStr;
    }

    const [firstBlock, ...restBlocks] = sectionBlocks;
    return [`${dateStr}\n${firstBlock}`, ...restBlocks].join('\n\n');
  }

  function updateCharCount() {
    charCount.textContent = `${previewTextarea.value.length}文字`;
  }

  // ===== 管理画面（マスタ編集） =====
  function updateContentTypeUI() {
    const selected = document.querySelector('input[name="contentType"]:checked')?.value || 'template';
    templateInputArea.classList.toggle('hidden', selected !== 'template');
    choicesInputArea.classList.toggle('hidden', selected !== 'choices');

    if (selected === 'choices' && choiceRowsContainer.children.length === 0) {
      addChoiceRowTo(choiceRowsContainer, '', '');
    }
  }

  function resetAdminForm() {
    editEventIdInput.value = '';
    formTitle.textContent = 'イベント新規登録';
    masterTitleInput.value = '';
    masterSortOrderInput.value = '';
    document.querySelector('input[name="contentType"][value="template"]').checked = true;
    masterTemplateTextInput.value = '';
    choiceRowsContainer.innerHTML = '';
    resetFormBtn.classList.add('hidden');
    updateContentTypeUI();
  }

  function startEditEvent(ev) {
    editEventIdInput.value = String(ev.id);
    formTitle.textContent = `イベント編集：${ev.title}`;
    masterTitleInput.value = ev.title;
    masterSortOrderInput.value = String(ev.sort_order ?? '');

    const radio = document.querySelector(`input[name="contentType"][value="${ev.content_type}"]`);
    if (radio) radio.checked = true;

    masterTemplateTextInput.value = ev.template_text || '';
    choiceRowsContainer.innerHTML = '';
    if (ev.content_type === 'choices') {
      if (ev.choices.length > 0) {
        ev.choices.forEach((c) => addChoiceRowTo(choiceRowsContainer, c.label, c.text));
      } else {
        addChoiceRowTo(choiceRowsContainer, '', '');
      }
    }

    resetFormBtn.classList.remove('hidden');
    updateContentTypeUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderAdminList() {
    adminEventList.innerHTML = '';
    if (state.events.length === 0) {
      adminEventList.innerHTML = '<p class="loading-text">この同盟にはまだイベントが登録されていません。</p>';
      return;
    }

    state.events.forEach((ev) => {
      const item = document.createElement('div');
      item.className = 'admin-item';
      item.dataset.eventId = String(ev.id);
      item.dataset.draggable = 'true';

      const leftWrap = document.createElement('div');
      leftWrap.className = 'admin-item-left';
      leftWrap.appendChild(createDragHandle());

      const info = document.createElement('div');
      info.className = 'admin-item-info';

      const titleRow = document.createElement('div');
      titleRow.className = 'admin-item-title';

      const titleText = document.createElement('span');
      titleText.textContent = `[順:${ev.sort_order}] ${ev.title}`;

      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent =
        ev.content_type === 'choices' ? `選択肢 (${ev.choices.length}件)` : '定型文';

      titleRow.appendChild(titleText);
      titleRow.appendChild(badge);

      const desc = document.createElement('div');
      desc.className = 'admin-item-desc';
      if (ev.content_type === 'choices') {
        desc.textContent = ev.choices
          .map((c) => `・${c.label}: ${c.text || '（空欄）'}`)
          .join('\n');
      } else {
        desc.textContent = ev.template_text || '（タイトルのみ出力）';
      }

      info.appendChild(titleRow);
      info.appendChild(desc);
      leftWrap.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'admin-item-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-secondary btn-sm';
      editBtn.textContent = '編集';
      editBtn.addEventListener('click', () => startEditEvent(ev));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-danger btn-sm';
      delBtn.textContent = '削除';
      delBtn.addEventListener('click', async () => {
        if (!confirm(`「${ev.title}」を削除しますか？`)) return;
        try {
          const res = await fetch(`/api/events/${ev.id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('削除に失敗しました');
          delete state.selections[String(ev.id)];
          if (editEventIdInput.value === String(ev.id)) {
            resetAdminForm();
          }
          await fetchEvents();
          showToast('イベントを削除しました');
        } catch (err) {
          alert(err.message);
        }
      });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      item.appendChild(leftWrap);
      item.appendChild(actions);
      adminEventList.appendChild(item);
    });
  }

  // ===== イベントリスナー =====
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  allianceSelect.addEventListener('change', async () => {
    await switchAlliance(allianceSelect.value);
  });

  copyShareUrlBtn.addEventListener('click', async () => {
    const current = getCurrentAlliance();
    if (!current) return;
    const url = getExternalShareUrl(current);
    if (!url) {
      alert('共有トークンが未設定です。「箱を管理」からURL再発行を行ってください。');
      return;
    }
    const ok = await copyToClipboard(url);
    if (ok) {
      showToast(`「${current.name}」の外部共有URLをコピーしました`);
    }
  });

  openAllianceModalBtn.addEventListener('click', openAllianceModal);
  closeAllianceModalBtn.addEventListener('click', closeAllianceModal);
  allianceModal.addEventListener('click', (e) => {
    if (e.target === allianceModal) closeAllianceModal();
  });

  createAllianceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = newAllianceNameInput.value.trim();
    if (!name) return;

    createAllianceSubmitBtn.disabled = true;
    try {
      const res = await fetch('/api/alliances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          id: newAllianceSlugInput.value.trim(),
          copy_from_id: copyFromAllianceSelect.value
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '同盟の作成に失敗しました');
      }
      const created = await res.json();
      await fetchAlliances();
      closeAllianceModal();
      await switchAlliance(created.id, { silent: true });
      showToast(
        created.copied_events_count > 0
          ? `「${created.name}」を作成しました（イベント${created.copied_events_count}件コピー）`
          : `「${created.name}」を作成しました`
      );
    } catch (err) {
      alert(err.message);
    } finally {
      createAllianceSubmitBtn.disabled = false;
    }
  });

  noticeDateInput.addEventListener('change', () => {
    datePreview.textContent = formatJapaneseDate(noticeDateInput.value);
  });

  uncheckAllBtn.addEventListener('click', () => {
    Object.values(state.selections).forEach((sel) => {
      sel.checked = false;
    });
    renderEventSelection();
  });

  saveTopFreeTextDefaultBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alliance_id: state.currentAllianceId,
          default_top_free_text: topFreeTextInput.value
        })
      });
      if (!res.ok) throw new Error('保存に失敗しました');
      const current = getCurrentAlliance();
      showToast(`「${current?.name || '現在'}」の自由記述欄（上）を保存しました`);
    } catch (err) {
      alert(err.message);
    }
  });

  saveFreeTextDefaultBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alliance_id: state.currentAllianceId,
          default_free_text: freeTextInput.value
        })
      });
      if (!res.ok) throw new Error('保存に失敗しました');
      const current = getCurrentAlliance();
      showToast(`「${current?.name || '現在'}」の自由記述欄（下）を保存しました`);
    } catch (err) {
      alert(err.message);
    }
  });

  // クイック追加モーダル
  openQuickAddBtn.addEventListener('click', openQuickAddModal);
  openQuickAddBottomBtn.addEventListener('click', openQuickAddModal);
  closeQuickAddBtn.addEventListener('click', closeQuickAddModal);
  cancelQuickAddBtn.addEventListener('click', closeQuickAddModal);

  quickAddModal.addEventListener('click', (e) => {
    if (e.target === quickAddModal) closeQuickAddModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!quickAddModal.classList.contains('hidden')) closeQuickAddModal();
      if (!allianceModal.classList.contains('hidden')) closeAllianceModal();
    }
  });

  quickContentTypeRadios.forEach((radio) => {
    radio.addEventListener('change', updateQuickContentTypeUI);
  });

  quickAddChoiceRowBtn.addEventListener('click', () => {
    addChoiceRowTo(quickChoiceRowsContainer, '', '');
  });

  quickAddForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = quickTitleInput.value.trim();
    if (!title) return;

    const contentType = document.querySelector('input[name="quickContentType"]:checked')?.value || 'template';
    const templateText = contentType === 'template' ? quickTemplateTextInput.value : '';
    const choices = contentType === 'choices' ? collectChoicesFrom(quickChoiceRowsContainer) : [];
    const saveToMaster = quickSaveToMasterCheckbox.checked;
    const initialText = contentType === 'choices' ? choices[0]?.text || '' : templateText;

    if (!saveToMaster) {
      const tempId = `temp_${state.tempIdCounter++}`;
      state.tempEvents.push({
        id: tempId,
        title,
        content_type: contentType,
        template_text: templateText,
        choices
      });
      state.selections[tempId] = {
        checked: true,
        choiceIndex: 0,
        text: initialText
      };
      renderEventSelection();
      closeQuickAddModal();
      showToast(`「${title}」を今回限りで追加しました`);
      eventSelectList.querySelector(`[data-event-key="${tempId}"]`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      return;
    }

    submitQuickAddBtn.disabled = true;
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alliance_id: state.currentAllianceId,
          title,
          content_type: contentType,
          template_text: templateText,
          choices
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'マスタへの保存に失敗しました');
      }
      const created = await res.json();
      const newKey = String(created.id);
      state.selections[newKey] = {
        checked: true,
        choiceIndex: 0,
        text: initialText
      };

      await fetchEvents();
      closeQuickAddModal();
      showToast(`「${title}」をマスタに登録＆選択しました`);
      eventSelectList.querySelector(`[data-event-key="${newKey}"]`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    } catch (err) {
      alert(err.message);
    } finally {
      submitQuickAddBtn.disabled = false;
    }
  });

  // 通知作成 → 自動コピー → 確認画面へ遷移
  generateBtn.addEventListener('click', async () => {
    const text = buildNoticeText();
    state.lastGeneratedText = text;
    previewTextarea.value = text;
    updateCharCount();

    const copied = await copyToClipboard(text);
    if (copied) {
      autoCopyStatus.className = 'status-banner success';
      autoCopyStatus.textContent = '✅ 通知テキストを自動でクリップボードにコピーしました！このままゲーム内に貼り付けできます。';
      showToast('クリップボードにコピーしました');
    } else {
      autoCopyStatus.className = 'status-banner warn';
      autoCopyStatus.textContent = '⚠️ 自動コピーがブラウザに制限されました。下の「テキストをコピー」ボタンを押してください。';
    }

    switchView('preview');
  });

  previewTextarea.addEventListener('input', updateCharCount);

  copyAgainBtn.addEventListener('click', async () => {
    const ok = await copyToClipboard(previewTextarea.value);
    if (ok) {
      autoCopyStatus.className = 'status-banner success';
      autoCopyStatus.textContent = '✅ 最新のテキストをクリップボードにコピーしました！';
      showToast('コピーしました！');
    } else {
      alert('コピーに失敗しました。テキストを手動で選択してコピーしてください。');
    }
  });

  resetPreviewBtn.addEventListener('click', () => {
    previewTextarea.value = state.lastGeneratedText;
    updateCharCount();
    showToast('微調整前の状態に戻しました');
  });

  backToCreateBtn.addEventListener('click', () => {
    switchView('create');
  });

  contentTypeRadios.forEach((radio) => {
    radio.addEventListener('change', updateContentTypeUI);
  });

  addChoiceRowBtn.addEventListener('click', () => {
    addChoiceRowTo(choiceRowsContainer, '', '');
  });
  resetFormBtn.addEventListener('click', resetAdminForm);

  eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = editEventIdInput.value;
    const contentType = document.querySelector('input[name="contentType"]:checked')?.value || 'template';
    const choices = contentType === 'choices' ? collectChoicesFrom(choiceRowsContainer) : [];

    const payload = {
      alliance_id: state.currentAllianceId,
      title: masterTitleInput.value.trim(),
      content_type: contentType,
      template_text: contentType === 'template' ? masterTemplateTextInput.value : '',
      choices,
      sort_order: masterSortOrderInput.value === '' ? undefined : Number(masterSortOrderInput.value)
    };

    try {
      const url = id ? `/api/events/${id}` : '/api/events';
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '保存に失敗しました');
      }

      if (id) {
        const key = String(id);
        const wasChecked = state.selections[key]?.checked ?? false;
        const nextText =
          payload.content_type === 'choices'
            ? payload.choices[0]?.text || ''
            : payload.template_text || '';
        state.selections[key] = { checked: wasChecked, choiceIndex: 0, text: nextText };
      }

      resetAdminForm();
      await fetchEvents();
      showToast(id ? 'イベントを更新しました' : 'イベントを追加しました');
    } catch (err) {
      alert(err.message);
    }
  });

  // ===== PWA =====
  const installAppBtn = document.getElementById('installAppBtn');
  let deferredInstallPrompt = null;

  function isStandaloneMode() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }

  function isIOSDevice() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function setupPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      });
    }

    if (!installAppBtn || isStandaloneMode()) return;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      installAppBtn.classList.remove('hidden');
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      installAppBtn.classList.add('hidden');
      showToast('アプリをインストールしました！');
    });

    if (isIOSDevice()) {
      installAppBtn.classList.remove('hidden');
    }

    installAppBtn.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          installAppBtn.classList.add('hidden');
        }
        deferredInstallPrompt = null;
      } else if (isIOSDevice()) {
        alert(
          '【iPhone / iPadでのアプリ化手順】\n' +
          '1. Safari下部（または上部）の共有ボタン（□↑）をタップ\n' +
          '2.「ホーム画面に追加」を選択\n' +
          '3. 右上の「追加」をタップ'
        );
      }
    });
  }

  // ===== 初期化 =====
  async function init() {
    noticeDateInput.value = getTodayLocalISO();
    datePreview.textContent = formatJapaneseDate(noticeDateInput.value);

    setupSectionDragSort();
    setupDragSort(eventSelectList, '.event-row', saveEventOrder);
    setupDragSort(adminEventList, '.admin-item', saveEventOrder);
    setupPWA();

    const params = new URLSearchParams(window.location.search);
    const shareParam = (params.get('share') || '').trim();

    if (shareParam) {
      state.isShareMode = true;
      state.shareToken = shareParam;
    }

    try {
      await fetchAlliances();

      if (state.isShareMode) {
        const target = state.alliances[0];
        if (!target) {
          showShareAccessError('無効な共有URLです。管理者に最新のURLを確認してください。');
          return;
        }
        await switchAlliance(target.id, { silent: true });
        return;
      }

      const urlParam = params.get('alliance');
      let savedId = null;
      try {
        savedId = localStorage.getItem(LAST_ALLIANCE_KEY);
      } catch {
        // 無視
      }

      const targetId =
        state.alliances.find((a) => a.id === urlParam)?.id ||
        state.alliances.find((a) => a.id === savedId)?.id ||
        state.alliances[0]?.id ||
        'default';

      await switchAlliance(targetId, { silent: true });
    } catch (err) {
      if (state.isShareMode) {
        showShareAccessError(err.message);
      } else {
        eventSelectList.innerHTML = `<p class="loading-text">エラー: ${err.message}</p>`;
        adminEventList.innerHTML = `<p class="loading-text">エラー: ${err.message}</p>`;
      }
    }
  }

  init();
})();
