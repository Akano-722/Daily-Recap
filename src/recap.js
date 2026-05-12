function cleanText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.trim();
}

function compactLine(value, max = 42) {
  const text = cleanText(value).replace(/\s+/g, ' ');
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter(Boolean).slice(0, 6);
}

function buildBullets(items) {
  if (!items.length) return '无明确遗留项。';
  return items.map((item) => `- ${item}`).join('\n');
}

export function composeDailyRecap(input) {
  const date = cleanText(input.date, '今天');
  const currentTime = cleanText(input.current_time, '当前时间未知');
  const timezone = cleanText(input.timezone, 'local');
  const dayContext = cleanText(input.day_context, '今天没有提供可总结内容。');
  const emotionalWeather = cleanText(input.emotional_weather, '没有特别标注。');
  const tomorrowFocus = normalizeList(input.tomorrow_focus);
  const unresolvedItems = normalizeList(input.unresolved_items);
  const highlights = normalizeList(input.highlights);
  const mode = cleanText(input.mode, 'night_diary');
  const userState = cleanText(input.user_state, '用户在线，准备晚间收束。');
  const includeSleepNote = input.include_sleep_note !== false;

  const shortCore = compactLine(
    input.push_body ||
      (highlights[0]
        ? `今日收尾：${highlights[0]}`
        : `今日收尾：${compactLine(dayContext, 28)}`),
    52
  );

  const pushTitle = compactLine(input.push_title || '秋，今天收尾了', 18);
  const pushSubtitle = compactLine(input.push_subtitle || `${date} · Daily Recap`, 28);
  const pushBody = shortCore || '今日回顾已整理，完整版本在窗口里。';

  const sleepNote = includeSleepNote
    ? cleanText(input.sleep_note, '该收工睡觉了。屏幕不会因为你多看十分钟就长出良心。')
    : '';

  const fullRecap = [
    `# Daily Recap · ${date}`,
    '',
    `当前时间：${currentTime}（${timezone}）`,
    `触发模式：${mode}`,
    `用户状态：${userState}`,
    '',
    '## 今天的主线',
    dayContext,
    '',
    '## 今天值得留下的点',
    highlights.length ? buildBullets(highlights) : '没有单独提供 highlights，按「今天的主线」归档。',
    '',
    '## 还悬着的事',
    buildBullets(unresolvedItems),
    '',
    '## 明天可以接着做',
    tomorrowFocus.length ? buildBullets(tomorrowFocus.slice(0, 3)) : '明天先从最明显的未完成事项继续。',
    '',
    '## 情绪天气',
    emotionalWeather,
    ...(sleepNote ? ['', '## 睡前提醒', sleepNote] : [])
  ].join('\n');

  return {
    push: {
      title: pushTitle,
      subtitle: pushSubtitle,
      body: pushBody,
      level: input.push_level || 'timeSensitive',
      group: input.push_group || 'qiu-daily-recap'
    },
    full_recap: fullRecap,
    sleep_note: sleepNote,
    suggested_next_actions: [
      '把 push 字段交给 Bark MCP 的 send_bark_push。',
      '把 full_recap 直接输出在当前对话窗口。',
      '如果你正在写日记，可以把 full_recap 或其压缩版交给 Ombre Brain 的 grow。'
    ]
  };
}
