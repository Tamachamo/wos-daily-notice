CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'template',
  template_text TEXT NOT NULL DEFAULT '',
  choices_json TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO events (title, content_type, template_text, choices_json, sort_order) VALUES
('氷原の支配者', 'choices', '', '[{"label":"1日目（都市開発）","text":"建造、研究、訓練、火晶"},{"label":"2日目（英雄開発）","text":"英雄欠片、ラッキーホイール、採集"},{"label":"最終日（総力）","text":"エナ石、専用装備、ミスリル、火晶、加速"}]', 1),
('夢幻追憶ฅ^•ω•^ฅﾆｬｰ', 'template', '', '[]', 2),
('かき氷:(´ºωº｀):', 'template', '', '[]', 3),
('全軍参戦', 'template', 'タイルキル禁止！セカチャのテントぶつかり稽古か砦要塞戦、明日の国内王城戦で稼ぎましょう！', '[]', 4);

INSERT OR IGNORE INTO app_settings (key, value) VALUES
('default_free_text', '【今週の予定】
土曜日 国内王城(HOT同盟移籍予定)
    大乱闘フェスティバル');
