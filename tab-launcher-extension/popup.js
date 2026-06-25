let DATA = null;

const presetView = document.getElementById('preset-view');
const clientView = document.getElementById('client-view');

async function init() {
  DATA = await loadData();
  renderPresets();
}

function showPresetView() {
  clientView.hidden = true;
  presetView.hidden = false;
}

function renderPresets() {
  showPresetView();
  const list = document.getElementById('preset-list');
  list.innerHTML = '';

  if (!DATA.presets.length) {
    list.innerHTML = '<p class="empty">プリセットがありません。<br>「⚙️ 設定」から追加してください。</p>';
    return;
  }

  DATA.presets.forEach(preset => {
    const btn = document.createElement('button');
    btn.className = 'item';
    btn.type = 'button';

    const label = document.createElement('span');
    label.className = 'item-label';
    label.textContent = preset.name || '(無名のプリセット)';
    btn.appendChild(label);

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = (preset.clients ? preset.clients.length : 0) + '件';
    btn.appendChild(badge);

    btn.addEventListener('click', () => openPreset(preset));
    list.appendChild(btn);
  });
}

function openPreset(preset) {
  presetView.hidden = true;
  clientView.hidden = false;
  document.getElementById('preset-title').textContent = preset.name || '(無名のプリセット)';

  const list = document.getElementById('client-list');
  list.innerHTML = '';

  const clients = preset.clients || [];
  if (!clients.length) {
    list.innerHTML = '<p class="empty">クライアントがありません。<br>「⚙️ 設定」から追加してください。</p>';
    return;
  }

  clients.forEach(client => {
    const urlCount = (client.urls || []).filter(u => u && u.trim()).length;

    const btn = document.createElement('button');
    btn.className = 'item';
    btn.type = 'button';

    const dot = document.createElement('span');
    dot.className = 'dot dot-' + (client.color || 'blue');
    btn.appendChild(dot);

    const label = document.createElement('span');
    label.className = 'item-label';
    label.textContent = client.name || '(無名のクライアント)';
    btn.appendChild(label);

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = urlCount + 'タブ';
    btn.appendChild(badge);

    if (urlCount === 0) {
      btn.disabled = true;
      btn.title = 'URLが登録されていません';
    } else {
      btn.addEventListener('click', () => openClient(client));
    }
    list.appendChild(btn);
  });
}

async function openClient(client) {
  const urls = (client.urls || []).map(normalizeUrl).filter(Boolean);
  if (!urls.length) return;

  const tabIds = [];
  for (const url of urls) {
    try {
      const tab = await chrome.tabs.create({ url, active: false });
      tabIds.push(tab.id);
    } catch (e) {
      console.warn('タブを開けませんでした:', url, e);
    }
  }

  // 開いたタブを1つのタブグループにまとめる
  if (tabIds.length) {
    try {
      const groupId = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(groupId, {
        title: client.name || 'タブグループ',
        color: client.color || 'blue'
      });
    } catch (e) {
      console.warn('タブグループ化に失敗しました:', e);
    }
  }

  window.close();
}

document.getElementById('back').addEventListener('click', renderPresets);
document.getElementById('open-options').addEventListener('click', () => chrome.runtime.openOptionsPage());
document.getElementById('open-options-2').addEventListener('click', () => chrome.runtime.openOptionsPage());

init();
