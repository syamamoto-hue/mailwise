let DATA = null;
let selectedPresetId = null;
let saveTimer = null;

async function init() {
  DATA = await loadData();
  if (DATA.presets[0]) selectedPresetId = DATA.presets[0].id;
  render();
}

function getPreset() {
  return DATA.presets.find(p => p.id === selectedPresetId) || null;
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await saveData(DATA);
    showToast('保存しました');
  }, 400);
}

async function saveNow() {
  clearTimeout(saveTimer);
  await saveData(DATA);
  showToast('保存しました');
}

function render() {
  renderPresetList();
  renderEditor();
}

/* ---------- 左: プリセット一覧 ---------- */
function renderPresetList() {
  const ul = document.getElementById('preset-list');
  ul.innerHTML = '';

  if (!DATA.presets.length) {
    const li = document.createElement('li');
    li.className = 'preset-empty';
    li.textContent = 'まだありません';
    ul.appendChild(li);
    return;
  }

  DATA.presets.forEach(preset => {
    const li = document.createElement('li');
    li.className = 'preset-item' + (preset.id === selectedPresetId ? ' active' : '');

    const name = document.createElement('span');
    name.className = 'preset-item-name';
    name.textContent = preset.name || '(無名)';
    li.appendChild(name);

    const mini = document.createElement('span');
    mini.className = 'mini';
    mini.textContent = (preset.clients ? preset.clients.length : 0);
    li.appendChild(mini);

    li.addEventListener('click', () => {
      selectedPresetId = preset.id;
      render();
    });
    ul.appendChild(li);
  });
}

/* ---------- 右: 選択中プリセットの編集 ---------- */
function renderEditor() {
  const wrap = document.getElementById('editor');
  const preset = getPreset();

  if (!preset) {
    wrap.innerHTML = '<p class="empty">左の「＋ 追加」からプリセットを作ってください。</p>';
    return;
  }

  wrap.innerHTML = '';

  // プリセット名 + 削除
  const head = document.createElement('div');
  head.className = 'editor-head';

  const nameIn = document.createElement('input');
  nameIn.className = 'preset-name';
  nameIn.value = preset.name;
  nameIn.placeholder = 'プリセット名（例：BRAIN定期報告）';
  nameIn.addEventListener('input', () => {
    preset.name = nameIn.value;
    renderPresetList();
    scheduleSave();
  });
  head.appendChild(nameIn);

  const delPreset = document.createElement('button');
  delPreset.className = 'danger';
  delPreset.type = 'button';
  delPreset.textContent = 'プリセット削除';
  delPreset.addEventListener('click', () => {
    if (confirm(`プリセット「${preset.name || '無名'}」を削除しますか？`)) {
      DATA.presets = DATA.presets.filter(p => p.id !== preset.id);
      selectedPresetId = DATA.presets[0] ? DATA.presets[0].id : null;
      saveNow();
      render();
    }
  });
  head.appendChild(delPreset);
  wrap.appendChild(head);

  // クライアント一覧
  const clients = preset.clients || (preset.clients = []);
  if (!clients.length) {
    const hint = document.createElement('p');
    hint.className = 'empty';
    hint.textContent = 'クライアントがありません。下のボタンから追加してください。';
    wrap.appendChild(hint);
  }
  clients.forEach(client => wrap.appendChild(renderClientCard(preset, client)));

  const addClient = document.createElement('button');
  addClient.className = 'add';
  addClient.type = 'button';
  addClient.textContent = '＋ クライアント追加';
  addClient.addEventListener('click', () => {
    clients.push({ id: uid('c'), name: '', color: 'blue', urls: [] });
    saveNow();
    renderEditor();
    renderPresetList();
  });
  wrap.appendChild(addClient);
}

function renderClientCard(preset, client) {
  const card = document.createElement('div');
  card.className = 'client-card';

  const row = document.createElement('div');
  row.className = 'client-row';

  const dot = document.createElement('span');
  dot.className = 'dot dot-' + (client.color || 'blue');
  row.appendChild(dot);

  const nameIn = document.createElement('input');
  nameIn.className = 'client-name';
  nameIn.value = client.name;
  nameIn.placeholder = 'クライアント名（例：歯科A）';
  nameIn.addEventListener('input', () => {
    client.name = nameIn.value;
    scheduleSave();
  });
  row.appendChild(nameIn);

  const colorSel = document.createElement('select');
  colorSel.className = 'color-select';
  TAB_COLORS.forEach(col => {
    const opt = document.createElement('option');
    opt.value = col;
    opt.textContent = COLOR_LABELS[col];
    if (col === (client.color || 'blue')) opt.selected = true;
    colorSel.appendChild(opt);
  });
  colorSel.addEventListener('change', () => {
    client.color = colorSel.value;
    dot.className = 'dot dot-' + client.color;
    scheduleSave();
  });
  row.appendChild(colorSel);

  const delClient = document.createElement('button');
  delClient.className = 'danger small';
  delClient.type = 'button';
  delClient.textContent = '削除';
  delClient.addEventListener('click', () => {
    if (confirm(`クライアント「${client.name || '無名'}」を削除しますか？`)) {
      preset.clients = preset.clients.filter(c => c.id !== client.id);
      saveNow();
      renderEditor();
      renderPresetList();
    }
  });
  row.appendChild(delClient);
  card.appendChild(row);

  const ta = document.createElement('textarea');
  ta.className = 'urls';
  ta.rows = 5;
  ta.placeholder = 'URLを1行に1つずつ貼り付けてください\nhttps://example.com/report\nhttps://example.com/dashboard';
  ta.value = (client.urls || []).join('\n');

  const count = document.createElement('div');
  count.className = 'url-count';

  function updateCount() {
    const n = (client.urls || []).filter(u => u && u.trim()).length;
    count.textContent = n + ' 個のタブが開きます';
  }

  ta.addEventListener('input', () => {
    client.urls = ta.value.split('\n').map(s => s.trim()).filter(Boolean);
    updateCount();
    scheduleSave();
  });
  updateCount();

  card.appendChild(ta);
  card.appendChild(count);
  return card;
}

/* ---------- ヘッダーのボタン ---------- */
document.getElementById('add-preset').addEventListener('click', () => {
  const preset = { id: uid('p'), name: '', clients: [] };
  DATA.presets.push(preset);
  selectedPresetId = preset.id;
  saveNow();
  render();
});

document.getElementById('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tab-launcher-presets.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('import').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const obj = JSON.parse(await file.text());
    if (!obj || !Array.isArray(obj.presets)) throw new Error('ファイルの形式が違います');
    DATA = obj;
    selectedPresetId = DATA.presets[0] ? DATA.presets[0].id : null;
    await saveData(DATA);
    render();
    showToast('読み込みました');
  } catch (err) {
    alert('読み込めませんでした: ' + err.message);
  }
  e.target.value = '';
});

/* ---------- トースト ---------- */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 1500);
}

init();
