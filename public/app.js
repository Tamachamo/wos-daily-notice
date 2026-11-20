(() => {
  const state = {
    events: [],
    // 作成画面の入力状態保持（画面遷移・マスタ再読込時も極力維持）
    selections: {}, // { [eventId]: { checked: boolean, choiceIndex: number, text: string } }
    lastGeneratedText: ''
  };

  // DOM要素
  const views = {
    create: document.getElementById('view-create'),
    preview: document.getElementById('view-preview'),
    admin: document.getElementById('view-admin')
  };
  const tabBtns = document.querySelectorAll('.tab-btn');
  const noticeDateInput = document.getElementById('noticeDate');
  const datePreview = document.getElementById('datePreview');
  const todayScheduleInput = document.getElementById('todaySchedule');
  const eventSelectList = document.getElementById('eventSelectList');
  const freeTextInput = document.getElementById('freeText');
  const generateBtn = document.getElementById('generateBtn');
  const uncheckAllBtn = document.getElementById('uncheckAllBtn');
  const saveFreeTextDefaultBtn = document.getElementById('saveFreeTextDefaultBtn');

  const previewTextarea = document.getElementById('previewTextarea');
  const charCount = document.getElementById('charCount');
  const autoCopyStatus = document.getElementById('autoCopyStatus');
  const copyAgainBtn = document.getElementById('copyAgainBtn');
  const resetPreviewBtn = document.getElementById('resetPreviewBtn');
  const backToCreateBtn = document.getElementById('backToCreateBtn');

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

  // ===== API 通信 =====
  async function fetchEvents() {
    const res = await fetch('/api/events');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'イベント一覧の取得に失敗しました');
    }
    state.events = await res.json();

    // 各イベントの選択状態を初期化（既存の入力内容は維持）
    state.events.forEach((ev) => {
      if (!state.selections[ev.id]) {
        const initialText =
          ev.content_type === 'choices'
            ? ev.choices[0]?.text || ''
            : ev.template_text || '';
        state.selections[ev.id] = {
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
      const res = await fetch('/api/settings');
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.default_free_text === 'string') {
        freeTextInput.value = data.default_free_text;
      }
    } catch {
      // 読み込み失敗時は空欄のまま利用可能
    }
  }

  // ===== 通知作成画面の描画 =====
  function renderEventSelection() {
    eventSelectList.innerHTML = '';
    if (state.events.length === 0) {
      eventSelectList.innerHTML =
        '<p class="loading-text">登録されたイベントがありません。「イベント管理」から追加してください。</p>';
      return;
    }

    state.events.forEach((ev) => {
      const sel = state.selections[ev.id];
      const row = document.createElement('div');
      row.className = 'event-row' + (sel.checked ? ' checked' : '');

      // 左側（スマホでは上側）：チェックボックス＋イベント名
      const checkCol = document.createElement('label');
      checkCol.className = 'event-check-col';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = sel.checked;

      const titleSpan = document.createElement('span');
      titleSpan.className = 'event-title-text';
      titleSpan.textContent = ev.title;

      checkCol.appendChild(checkbox);
      checkCol.appendChild(titleSpan);

      // 右側（スマホでは下側）：選択肢（ある場合）＋編集可能な定型文欄
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
      row.appendChild(checkCol);
      row.appendChild(editorCol);
      eventSelectList.appendChild(row);
    });
  }

  // ===== 通知テキスト組み立て =====
  function buildNoticeText() {
    const blocks = [];

    // 1. 日付 + 今日の予定
    const dateStr = formatJapaneseDate(noticeDateInput.value);
    const scheduleLines = todayScheduleInput.value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => (line.startsWith('・') ? line : `・${line}`));

    let topBlock = dateStr;
    if (scheduleLines.length > 0) {
      topBlock += `\n●今日の予定\n${scheduleLines.join('\n')}`;
    }
    if (topBlock) {
      blocks.push(topBlock);
    }

    // 2. 今日イベント
    const eventItems = [];
    state.events.forEach((ev) => {
      const sel = state.selections[ev.id];
      if (!sel || !sel.checked) return;

      const content = (sel.text || '').trim();
      if (content) {
        const formattedContent = content.startsWith('→') ? content : `→${content}`;
        eventItems.push(`・${ev.title}\n${formattedContent}`);
      } else {
        eventItems.push(`・${ev.title}`);
      }
    });

    if (eventItems.length > 0) {
      blocks.push(`●今日イベント\n${eventItems.join('\n\n')}`);
    }

    // 3. 自由記述欄（行頭の全角スペース等を維持するため改行のみトリム）
    const freeText = freeTextInput.value.replace(/^\s*\n+|\n+\s*$/g, '');
    if (freeText.trim()) {
      blocks.push(freeText);
    }

    return blocks.join('\n\n');
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
      addChoiceRow('', '');
    }
  }

  function addChoiceRow(label = '', text = '') {
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
    removeBtn.addEventListener('click', () => {
      row.remove();
    });

    row.appendChild(labelInput);
    row.appendChild(textInput);
    row.appendChild(removeBtn);
    choiceRowsContainer.appendChild(row);
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
        ev.choices.forEach((c) => addChoiceRow(c.label, c.text));
      } else {
        addChoiceRow('', '');
      }
    }

    resetFormBtn.classList.remove('hidden');
    updateContentTypeUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderAdminList() {
    adminEventList.innerHTML = '';
    if (state.events.length === 0) {
      adminEventList.innerHTML = '<p class="loading-text">まだイベントが登録されていません。</p>';
      return;
    }

    state.events.forEach((ev) => {
      const item = document.createElement('div');
      item.className = 'admin-item';

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
        desc.textContent = ev.template_text ? `→${ev.template_text}` : '（タイトルのみ出力）';
      }

      info.appendChild(titleRow);
      info.appendChild(desc);

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
          delete state.selections[ev.id];
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
      item.appendChild(info);
      item.appendChild(actions);
      adminEventList.appendChild(item);
    });
  }

  // ===== イベントリスナー =====
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
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

  saveFreeTextDefaultBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_free_text: freeTextInput.value })
      });
      if (!res.ok) throw new Error('保存に失敗しました');
      showToast('自由記述欄の初期値をDBに保存しました');
    } catch (err) {
      alert(err.message);
    }
  });

  // 通知作成 → クリック操作内で自動コピー → 確認画面へ遷移
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

  addChoiceRowBtn.addEventListener('click', () => addChoiceRow('', ''));
  resetFormBtn.addEventListener('click', resetAdminForm);

  eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = editEventIdInput.value;
    const contentType = document.querySelector('input[name="contentType"]:checked')?.value || 'template';
    const choices = Array.from(choiceRowsContainer.querySelectorAll('.choice-row')).map((row) => ({
      label: row.querySelector('.choice-label-input').value.trim(),
      text: row.querySelector('.choice-text-input').value
    }));

    const payload = {
      title: masterTitleInput.value.trim(),
      content_type: contentType,
      template_text: contentType === 'template' ? masterTemplateTextInput.value : '',
      choices: contentType === 'choices' ? choices : [],
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

      // 編集時は作成画面の定型文も最新マスタへ同期
      if (id) {
        const wasChecked = state.selections[id]?.checked ?? false;
        const nextText =
          payload.content_type === 'choices'
            ? payload.choices[0]?.text || ''
            : payload.template_text || '';
        state.selections[id] = { checked: wasChecked, choiceIndex: 0, text: nextText };
      }

      resetAdminForm();
      await fetchEvents();
      showToast(id ? 'イベントを更新しました' : 'イベントを追加しました');
    } catch (err) {
      alert(err.message);
    }
  });

  // ===== 初期化 =====
  async function init() {
    noticeDateInput.value = getTodayLocalISO();
    datePreview.textContent = formatJapaneseDate(noticeDateInput.value);

    try {
      await Promise.all([fetchEvents(), fetchSettings()]);
    } catch (err) {
      eventSelectList.innerHTML = `<p class="loading-text">エラー: ${err.message}</p>`;
      adminEventList.innerHTML = `<p class="loading-text">エラー: ${err.message}</p>`;
    }
  }

  init();
})();
