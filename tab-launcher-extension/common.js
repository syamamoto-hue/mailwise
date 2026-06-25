// 共通: データの読み書きと定数

// タブグループで使える色（Chrome の仕様に合わせています）
const TAB_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
const COLOR_LABELS = {
  grey: 'グレー', blue: 'ブルー', red: 'レッド', yellow: 'イエロー',
  green: 'グリーン', pink: 'ピンク', purple: 'パープル', cyan: 'シアン', orange: 'オレンジ'
};

// 初回起動時に表示されるサンプルデータ（自由に編集・削除できます）
const DEFAULT_DATA = {
  presets: [
    {
      id: 'sample-brain',
      name: 'BRAIN定期報告',
      clients: [
        {
          id: 'sample-dental-a',
          name: '歯科A（サンプル）',
          color: 'blue',
          urls: [
            'https://www.google.com/',
            'https://www.google.com/maps'
          ]
        },
        {
          id: 'sample-dental-b',
          name: '歯科B（サンプル）',
          color: 'green',
          urls: [
            'https://www.google.com/'
          ]
        }
      ]
    }
  ]
};

// 簡易ユニークID
function uid(prefix) {
  return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function loadData() {
  const res = await chrome.storage.local.get('data');
  if (res && res.data && Array.isArray(res.data.presets)) {
    return res.data;
  }
  return structuredClone(DEFAULT_DATA);
}

async function saveData(data) {
  await chrome.storage.local.set({ data });
}

// 「example.com」のように http が無くても開けるよう補完
function normalizeUrl(u) {
  const s = (u || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^chrome:\/\//i.test(s) || /^edge:\/\//i.test(s) || /^about:/i.test(s)) return s;
  return 'https://' + s;
}
