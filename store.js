// 青番 Web · 本地数据层（对齐 AppState/Store）
// - 全局项：引导标记、主题
// - 账号隔离项：资料 / 待办 / 专注记录 / 每日统计 / 挑战 / 徽章 / 房间专注
//   key = qingfan:<base>:<userKey>；userKey 登录=手机号，游客=guest-<设备id>
(function () {
  'use strict';

  var NS = 'qingfan:';

  var THEMES = {
    green: { name: '青番绿', desc: '清新自然' },
    dark: { name: '深夜墨', desc: '沉浸专注' },
    dawn: { name: '晨光暖', desc: '温暖明亮' },
    ocean: { name: '静谧蓝', desc: '冷静理性' },
  };
  var THEME_KEYS = ['green', 'dark', 'dawn', 'ocean'];

  var BACKGROUNDS = [
    { key: 'sky', name: '天空', from: '#3E7BB5', to: '#86BCE4' },
    { key: 'mist', name: '晨雾', from: '#A9C79E', to: '#DCEBD2' },
    { key: 'dusk', name: '夕阳', from: '#E8A98D', to: '#C9604F' },
  ];
  var WHITE_NOISES = [
    { key: 'forest', name: '森林', icon: '🍃' },
    { key: 'rain', name: '雨声', icon: '🌧' },
    { key: 'wave', name: '海浪', icon: '🌊' },
    { key: 'mute', name: '静音', icon: '🔇' },
  ];
  var DURATIONS = [25, 15, 5, 1];
  var INTERRUPT_REASONS = ['临时有事', '手机打断', '失去状态', '饿了/累了', '其它'];
  var DIFFICULTY = { easy: '轻松', medium: '适中', hard: '困难' };
  var BADGE_CATALOG = [
    { id: 'b1', name: '连续 7 天', desc: '连续签到 7 天', icon: '🔥' },
    { id: 'b2', name: '森林新芽', desc: '种下第 1 棵树', icon: '🌱' },
    { id: 'b3', name: '专注达人', desc: '累计专注 100 小时', icon: '⭐' },
    { id: 'b4', name: '月度冠军', desc: '当月排行第 1', icon: '🏆' },
  ];

  function userKey() {
    var a = window.QingfanAuth;
    if (a && a.isLoggedIn()) return a.getUserId();
    if (a) return 'guest-' + a.getUserId();
    return 'guest';
  }

  function raw(k, def) {
    try { var s = localStorage.getItem(k); return s == null ? def : JSON.parse(s); }
    catch (e) { return def; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ }
  }

  var Store = {
    userKey: userKey,
    get: function (k, def) { return raw(NS + k, def); },
    set: function (k, v) { write(NS + k, v); },
    acct: function (k, def) { return raw(NS + k + ':' + userKey(), def); },
    setAcct: function (k, v) { write(NS + k + ':' + userKey(), v); },
  };

  // ---- 主题 ----
  function getTheme() {
    var t = Store.get('theme', 'green');
    return THEME_KEYS.indexOf(t) >= 0 ? t : 'green';
  }
  function setTheme(t) { Store.set('theme', t); applyTheme(t); }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t || getTheme());
  }

  // ---- 日期 ----
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dateStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function today() { return dateStr(new Date()); }

  // ---- 资料 ----
  function defaultProfile() {
    var a = window.QingfanAuth;
    var u = a && a.getUser();
    var nick = (u && (u.nickname || u.username)) || '专注的你';
    return {
      nickname: nick, avatarSeed: nick.slice(0, 1), bio: '把专注，种成一片森林',
      level: 1, exp: 0, streak: 0, lastSignDate: '', signDates: [], notifyEnabled: true, bonusTrees: 0,
    };
  }
  function getProfile() {
    var p = Store.acct('profile', null);
    if (!p) { p = defaultProfile(); Store.setAcct('profile', p); }
    return p;
  }
  function saveProfile(p) { Store.setAcct('profile', p); }
  function nextLevelExp(level) { return level * 300; }
  function addExp(n) {
    var p = getProfile();
    p.exp += n;
    while (p.exp >= nextLevelExp(p.level)) { p.exp -= nextLevelExp(p.level); p.level += 1; }
    saveProfile(p);
    return p;
  }

  // ---- 待办 ----
  function getTasks() { return Store.acct('tasks', []); }
  function saveTasks(t) { Store.setAcct('tasks', t); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // 新账号首次进入的「引导待办」：解释待办的作用，以及添加 / 删除 / 开始方法
  // （只种一次；用户删光后不再重复）
  function seedTasksIfNeeded() {
    if (Store.acct('seeded', false)) return;
    Store.setAcct('seeded', true);
    var now = Date.now();
    var texts = [
      '待办是什么：把任务拆成一个个番茄，逐个专注完成',
      '怎么添加：点「今日待办」右上角「＋ 添加」新增，可自定义时长',
      '怎么删除：点待办卡片右侧的「×」即可删除',
      '怎么开始：点待办右侧的「开始」，进入番茄计时并种下一棵树',
    ];
    var seed = texts.map(function (title, i) {
      return { id: 'guide_' + (i + 1), title: title, durationMin: 25, status: 'todo', difficulty: 'easy', order: i, createdAt: now + i };
    });
    saveTasks(seed);
  }

  // ---- 记录 / 统计 ----
  function getRecords() { return Store.acct('records', []); }
  function addRecord(r) {
    var list = getRecords();
    list.push(r);
    Store.setAcct('records', list);
    // 每日统计
    var stats = Store.acct('stats', {});
    var d = dateStr(new Date(r.endAt || Date.now()));
    var s = stats[d] || { date: d, focusMinutes: 0, pomodoroCount: 0, doneTaskCount: 0, interruptCounts: {} };
    s.focusMinutes += Math.round((r.durationSec || 0) / 60);
    if (r.finished) s.pomodoroCount += 1;
    if (!r.finished && r.interruptReason) {
      s.interruptCounts[r.interruptReason] = (s.interruptCounts[r.interruptReason] || 0) + 1;
    }
    stats[d] = s;
    Store.setAcct('stats', stats);
  }
  function getStats() { return Store.acct('stats', {}); }
  function bumpDoneTask() {
    var stats = Store.acct('stats', {});
    var d = today();
    var s = stats[d] || { date: d, focusMinutes: 0, pomodoroCount: 0, doneTaskCount: 0, interruptCounts: {} };
    s.doneTaskCount += 1;
    stats[d] = s;
    Store.setAcct('stats', stats);
  }

  // ---- 挑战 ----
  function getGoal() { return Store.acct('goal', 4); }
  function setGoal(n) { Store.setAcct('goal', Math.max(1, Math.min(20, n))); }

  // ---- 成长 ----
  function todayFocusMinutes() {
    var s = getStats()[today()];
    return s ? s.focusMinutes : 0;
  }
  function totalPomodoro() {
    var stats = getStats();
    return Object.keys(stats).reduce(function (a, k) { return a + (stats[k].pomodoroCount || 0); }, 0);
  }
  function totalFocusMinutes() {
    var stats = getStats();
    return Object.keys(stats).reduce(function (a, k) { return a + (stats[k].focusMinutes || 0); }, 0);
  }
  function trees() {
    var p = getProfile();
    return Math.floor(totalPomodoro() / 10) + (p.bonusTrees || 0);
  }
  // 连续 = 连续满足「当日已签到 且 当日专注≥10 分钟」
  function computeStreak() {
    var p = getProfile();
    var stats = getStats();
    var set = {};
    (p.signDates || []).forEach(function (d) { set[d] = true; });
    var streak = 0;
    var d = new Date();
    for (var i = 0; i < 400; i++) {
      var ds = dateStr(d);
      var s = stats[ds];
      var ok = set[ds] && s && s.focusMinutes >= 10;
      if (ok) streak += 1;
      else if (i > 0) break;
      else if (i === 0) { /* 今天还没达标，继续看昨天 */ }
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }
  function isSignedToday() {
    var p = getProfile();
    return (p.signDates || []).indexOf(today()) >= 0;
  }
  function signInToday() {
    var p = getProfile();
    if ((p.signDates || []).indexOf(today()) >= 0) return { already: true };
    p.signDates = (p.signDates || []).concat([today()]);
    p.lastSignDate = today();
    var streak = computeStreak();
    var gain = streak >= 7 ? 15 : 10;
    saveProfile(p);
    addExp(gain);
    return { already: false, gain: gain };
  }

  window.QFStore = Store;
  window.QFData = {
    THEMES: THEMES, THEME_KEYS: THEME_KEYS, BACKGROUNDS: BACKGROUNDS, WHITE_NOISES: WHITE_NOISES,
    DURATIONS: DURATIONS, INTERRUPT_REASONS: INTERRUPT_REASONS, DIFFICULTY: DIFFICULTY, BADGE_CATALOG: BADGE_CATALOG,
    getTheme: getTheme, setTheme: setTheme, applyTheme: applyTheme,
    today: today, dateStr: dateStr,
    getProfile: getProfile, saveProfile: saveProfile, nextLevelExp: nextLevelExp, addExp: addExp,
    getTasks: getTasks, saveTasks: saveTasks, uid: uid, seedTasksIfNeeded: seedTasksIfNeeded,
    getRecords: getRecords, addRecord: addRecord, getStats: getStats, bumpDoneTask: bumpDoneTask,
    getGoal: getGoal, setGoal: setGoal,
    todayFocusMinutes: todayFocusMinutes, totalPomodoro: totalPomodoro, totalFocusMinutes: totalFocusMinutes,
    trees: trees, computeStreak: computeStreak, isSignedToday: isSignedToday, signInToday: signInToday,
  };
})();
