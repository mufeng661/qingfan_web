// 青番 Web · 单页应用（对齐鸿蒙端功能与原型）
// 路由：#/today #/focus #/complete #/timeline #/data #/me #/ai #/studyroom #/onboarding
(function () {
  'use strict';

  var D = window.QFData;
  var api = window.QingfanApi;
  var auth = window.QingfanAuth;

  var $view = document.getElementById('view');
  var $modal = document.getElementById('modalRoot');

  // ---------- 工具 ----------
  function h(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(msg) { api.toast(msg); }
  function esc(v) { return h(v); }
  function fmtClock(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }
  function fmtTime(ts) {
    var d = new Date(ts), p = function (n) { return n < 10 ? '0' + n : n; };
    return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function isLogged() { return auth.isLoggedIn(); }
  function requireLogin() {
    if (isLogged()) return true;
    toast('登录后可用，请先登录');
    setTimeout(function () { location.href = 'login.html'; }, 800);
    return false;
  }

  // ---------- 弹窗 ----------
  function openModal(html) {
    $modal.innerHTML = '<div class="modal"><div class="modal__mask" data-close></div>' +
      '<div class="modal__panel">' + html + '</div></div>';
    $modal.querySelector('[data-close]').addEventListener('click', closeModal);
    return $modal.querySelector('.modal__panel');
  }
  function closeModal() { $modal.innerHTML = ''; }
  window.__qfCloseModal = closeModal;

  // ---------- 专注会话 ----------
  var session = null; // { taskId, taskTitle, roomId, roomName, minutes, bg, noise, started, elapsed, remain, timer }

  // ================= 引导 =================
  var SLIDES = [
    { emoji: '🤖', title: 'AI 更懂你', desc: '根据你的专注节奏与打断原因，AI 给出可执行的建议，还能一键排待办。' },
    { emoji: '🍅', title: '待办 + 专注', desc: '把待办拆成番茄，一键开始专注；圆环倒计时、专注背景、白噪音帮你进入状态。' },
    { emoji: '🌿', title: '自习室共学', desc: '创建或加入自习室，和好友一起专注、互相监督，房间留言互相打气。' },
    { emoji: '🌳', title: '看得见的成长', desc: '每 10 个番茄种下 1 棵树，连续打卡、徽章与森林记录你的坚持。' },
  ];
  var obIndex = 0;
  function screenOnboarding() {
    $view.innerHTML = '<div class="onboard">' +
      '<div class="onboard__slide" id="obSlide"></div>' +
      '<div class="onboard__dots" id="obDots"></div>' +
      '<div class="onboard__foot"><button class="btn btn--primary" style="width:100%" id="obNext"></button>' +
      '<div class="center" style="margin-top:10px"><button class="btn btn--ghost btn--sm" id="obSkip">跳过</button></div></div></div>';
    function paint() {
      var s = SLIDES[obIndex];
      document.getElementById('obSlide').innerHTML =
        '<div class="onboard__emoji">' + s.emoji + '</div>' +
        '<div class="onboard__title">' + h(s.title) + '</div>' +
        '<div class="onboard__desc">' + h(s.desc) + '</div>';
      document.getElementById('obDots').innerHTML = SLIDES.map(function (_, i) {
        return '<i class="' + (i === obIndex ? 'on' : '') + '" data-i="' + i + '"></i>';
      }).join('');
      document.getElementById('obNext').textContent = obIndex === SLIDES.length - 1 ? '开始使用' : '下一步';
    }
    paint();
    document.getElementById('obDots').addEventListener('click', function (e) {
      var i = e.target.dataset.i; if (i == null) return; obIndex = Number(i); paint();
    });
    document.getElementById('obSkip').addEventListener('click', finish);
    document.getElementById('obNext').addEventListener('click', function () {
      if (obIndex < SLIDES.length - 1) { obIndex += 1; paint(); } else finish();
    });
    function finish() { D.getTheme(); QFStore.set('onboarded', true); go('today'); }
  }

  // ================= 今日 =================
  function screenToday() {
    D.seedTasksIfNeeded();
    var p = D.getProfile();
    var tasks = D.getTasks().slice().sort(function (a, b) { return a.order - b.order; });
    var goal = D.getGoal();
    var done = D.getStats()[D.today()];
    var pomo = done ? done.pomodoroCount : 0;
    var min = D.todayFocusMinutes();
    var streak = D.computeStreak();
    var name = (auth.getNickname() || p.nickname || '专注的你');
    var d = new Date();
    var wk = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];

    $view.innerHTML =
      '<div class="between">' +
      '<div><div class="greet__date">' + d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 周' + wk + '</div>' +
      '<div class="greet__hi">' + h(greeting()) + '，' + h(name) + '</div></div>' +
      '<button class="btn btn--primary btn--sm" id="signBtn">' + (D.isSignedToday() ? '已签到' : '签到') + '</button>' +
      '</div>' +

      '<div class="card" style="margin-top:16px"><div class="overview">' +
      cell(min, '今日专注(分)') + cell(pomo, '番茄') + cell(streak, '连续天数') +
      '</div></div>' +

      '<div class="card"><div class="between"><div><b>今日挑战</b> <span class="muted3">目标 ' + goal + ' 个番茄</span></div>' +
      '<div class="row"><button class="btn btn--ghost btn--sm" id="goalMinus">−</button><button class="btn btn--ghost btn--sm" id="goalPlus">＋</button></div></div>' +
      '<div class="progress" style="margin-top:12px"><div class="progress__bar" style="width:' + Math.min(100, Math.round(pomo / goal * 100)) + '%"></div></div>' +
      '<div class="muted3" style="font-size:12px;margin-top:6px">已完成 ' + pomo + ' / ' + goal + '</div></div>' +

      '<div class="card aicard"><div class="row" style="justify-content:space-between">' +
      '<div><b>AI 建议</b><div style="font-size:12.5px;opacity:.9;margin-top:4px">' + aiTip(pomo, min, streak) + '</div></div>' +
      '<button class="btn btn--sm" id="aiBtn">去对话</button></div></div>' +

      '<div class="section-title between">今日待办<button class="btn btn--sm" id="addTask">＋ 添加</button></div>' +
      '<div id="taskList"></div>';

    renderTasks(tasks);

    document.getElementById('signBtn').addEventListener('click', function () {
      if (!requireLogin()) return;
      var r = D.signInToday();
      if (r.already) { toast('今天已经签过到了'); return; }
      toast('签到成功 +' + r.gain + ' 经验');
      go('today');
    });
    document.getElementById('goalMinus').addEventListener('click', function () { D.setGoal(D.getGoal() - 1); go('today'); });
    document.getElementById('goalPlus').addEventListener('click', function () { D.setGoal(D.getGoal() + 1); go('today'); });
    document.getElementById('aiBtn').addEventListener('click', function () { go('ai'); });
    document.getElementById('addTask').addEventListener('click', addTaskModal);
  }

  function cell(num, label) {
    return '<div class="overview__cell"><div class="overview__num">' + num + '</div><div class="overview__lbl">' + label + '</div></div>';
  }
  function greeting() {
    var hh = new Date().getHours();
    if (hh < 6) return '夜深了';
    if (hh < 11) return '早上好';
    if (hh < 14) return '中午好';
    if (hh < 18) return '下午好';
    return '晚上好';
  }
  function aiTip(pomo, min, streak) {
    if (pomo === 0 && min === 0) return '今天还没开始，先来一个 25 分钟番茄吧。';
    if (streak >= 7) return '连续 ' + streak + ' 天啦，保持节奏，别断更。';
    if (pomo >= 4) return '今天状态不错，注意中途拉伸休息一下。';
    return '已专注 ' + min + ' 分钟，再加一个番茄就达标了。';
  }

  function renderTasks(tasks) {
    var box = document.getElementById('taskList');
    if (!tasks.length) { box.innerHTML = '<div class="empty-hint">还没有待办，点右上角「添加」开始</div>'; return; }
    box.innerHTML = tasks.map(function (t, i) {
      return '<div class="task ' + (t.status === 'done' ? 'is-done' : '') + '" data-id="' + t.id + '">' +
        '<div class="task__check" data-act="toggle">' + (t.status === 'done' ? '✓' : '') + '</div>' +
        '<div class="grow"><div class="task__title">' + h(t.title) + '</div>' +
        '<div class="task__meta">' + t.durationMin + ' 分钟 · ' + D.DIFFICULTY[t.difficulty] + '</div></div>' +
        '<button class="btn btn--ghost btn--sm" data-act="up">↑</button>' +
        '<button class="btn btn--ghost btn--sm" data-act="down">↓</button>' +
        (t.status === 'todo' ? '<button class="btn btn--primary btn--sm" data-act="start">开始</button>' : '') +
        '<button class="btn btn--ghost btn--sm" data-act="del">×</button>' +
        '</div>';
    }).join('');
  }

  function addTaskModal() {
    var panel = openModal(
      '<div class="modal__title">添加待办</div>' +
      '<input class="input" id="tTitle" placeholder="要做的事" style="margin-top:12px">' +
      '<div class="row" style="margin-top:12px;flex-wrap:wrap" id="durRow">' +
      D.DURATIONS.map(function (m) { return '<button class="pill ' + (m === 25 ? 'is-on' : '') + '" data-m="' + m + '">' + m + ' 分</button>'; }).join('') +
      '<input class="input" id="tCustom" placeholder="自定义" style="width:110px" inputmode="numeric">' +
      '</div>' +
      '<div class="row" style="margin-top:10px" id="diffRow">' +
      Object.keys(D.DIFFICULTY).map(function (k, i) { return '<button class="pill ' + (i === 1 ? 'is-on' : '') + '" data-d="' + k + '">' + D.DIFFICULTY[k] + '</button>'; }).join('') +
      '</div>' +
      '<div class="modal__actions"><button class="btn" data-close>取消</button><button class="btn btn--primary" id="tSave">添加</button></div>'
    );
    panel.querySelector('.modal__mask');
    var dur = 25, diff = 'medium';
    panel.querySelectorAll('#durRow .pill').forEach(function (b) {
      b.addEventListener('click', function () {
        dur = Number(b.dataset.m); panel.querySelectorAll('#durRow .pill').forEach(function (x) { x.classList.remove('is-on'); }); b.classList.add('is-on');
      });
    });
    panel.querySelectorAll('#diffRow .pill').forEach(function (b) {
      b.addEventListener('click', function () {
        diff = b.dataset.d; panel.querySelectorAll('#diffRow .pill').forEach(function (x) { x.classList.remove('is-on'); }); b.classList.add('is-on');
      });
    });
    panel.querySelector('#tSave').addEventListener('click', function () {
      var title = panel.querySelector('#tTitle').value.trim();
      var custom = Number(panel.querySelector('#tCustom').value);
      if (!title) { toast('请输入待办内容'); return; }
      var m = custom > 0 ? Math.max(1, Math.min(600, custom)) : dur;
      var list = D.getTasks();
      list.push({ id: D.uid(), title: title, durationMin: m, status: 'todo', difficulty: diff, order: list.length, createdAt: Date.now() });
      D.saveTasks(list);
      closeModal(); toast('已添加'); go('today');
    });
    panel.querySelector('[data-close]').addEventListener('click', closeModal);
  }

  function bindTaskList() {
    var box = document.getElementById('taskList');
    if (!box) return;
    box.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]'); if (!btn) return;
      var el = e.target.closest('.task'); var id = el.dataset.id;
      var list = D.getTasks();
      var t = list.find(function (x) { return x.id === id; }); if (!t) return;
      var act = btn.dataset.act;
      if (act === 'toggle') {
        t.status = t.status === 'done' ? 'todo' : 'done';
        if (t.status === 'done') D.bumpDoneTask();
        D.saveTasks(list); go('today');
      } else if (act === 'del') {
        D.saveTasks(list.filter(function (x) { return x.id !== id; })); go('today');
      } else if (act === 'up' || act === 'down') {
        var i = list.findIndex(function (x) { return x.id === id; });
        var j = act === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= list.length) return;
        var tmp = list[i].order; list[i].order = list[j].order; list[j].order = tmp;
        list.sort(function (a, b) { return a.order - b.order; });
        list.forEach(function (x, k) { x.order = k; });
        D.saveTasks(list); go('today');
      } else if (act === 'start') {
        startFocus({ taskId: t.id, taskTitle: t.title, minutes: t.durationMin });
      }
    });
  }

  // ================= 专注 =================
  function startFocus(opts) {
    session = Object.assign({
      taskId: '', taskTitle: '', roomId: '', roomName: '',
      minutes: 25, bg: 'sky', noise: 'forest', started: false, elapsed: 0, remain: 25 * 60, timer: null,
    }, opts || {});
    session.remain = session.minutes * 60;
    go('focus');
  }

  function screenFocus() {
    if (!session) { go('today'); return; }
    var s = session;
    var bg = D.BACKGROUNDS.find(function (b) { return b.key === s.bg; }) || D.BACKGROUNDS[0];
    $view.innerHTML =
      '<div class="between"><button class="btn btn--ghost btn--sm" id="fBack">‹ 返回</button>' +
      '<div class="muted">' + h(s.taskTitle || s.roomName || '自由专注') + '</div><div style="width:64px"></div></div>' +
      '<div class="focus-stage" id="stage" style="margin-top:14px;background:linear-gradient(160deg,' + bg.from + ',' + bg.to + ')">' +
      '<div class="focus-ring">' +
      '<svg width="210" height="210"><circle cx="105" cy="105" r="94" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="11"></circle>' +
      '<circle id="ring" cx="105" cy="105" r="94" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-dasharray="590" stroke-dashoffset="0"></circle></svg>' +
      '<div class="focus-ring__time"><b id="ftime">' + fmtClock(s.remain) + '</b><span id="fstate">' + (s.started ? '专注中' : '准备开始') + '</span></div>' +
      '</div>' +
      (s.taskId
        ? ''
        : '<div class="row" style="justify-content:center;margin-top:16px" id="durRow2">' +
          D.DURATIONS.map(function (m) { return '<button class="pill ' + (m === s.minutes ? 'is-on' : '') + '" data-m="' + m + '">' + m + ' 分</button>'; }).join('') +
          '</div>') +
      '<div class="row" style="justify-content:center;margin-top:16px;gap:12px">' +
      '<button class="btn btn--primary" id="fStart" style="min-width:130px">' + (s.started ? '暂停' : '开始专注') + '</button>' +
      '<button class="btn btn--ghost" id="fExit">提前退出</button></div>' +
      '</div>' +

      '<div class="section-title">专注背景</div><div class="row" id="bgRow">' +
      D.BACKGROUNDS.map(function (b) { return '<button class="pill ' + (b.key === s.bg ? 'is-on' : '') + '" data-bg="' + b.key + '">' + b.name + '</button>'; }).join('') + '</div>' +

      '<div class="section-title">白噪音</div><div class="row" id="noiseRow">' +
      D.WHITE_NOISES.map(function (n) { return '<button class="pill ' + (n.key === s.noise ? 'is-on' : '') + '" data-noise="' + n.key + '">' + n.icon + ' ' + n.name + '</button>'; }).join('') + '</div>';

    document.getElementById('fBack').addEventListener('click', function () { if (s.started) { s.started = false; stopTimer(); } session = null; go('today'); });
    document.getElementById('fStart').addEventListener('click', toggleTimer);
    document.getElementById('fExit').addEventListener('click', earlyExit);
    document.querySelectorAll('#durRow2 .pill').forEach(function (b) {
      b.addEventListener('click', function () {
        if (s.started) { toast('专注进行中，无法改时长'); return; }
        s.minutes = Number(b.dataset.m); s.remain = s.minutes * 60;
        document.querySelectorAll('#durRow2 .pill').forEach(function (x) { x.classList.remove('is-on'); }); b.classList.add('is-on');
        paintTimer();
      });
    });
    document.getElementById('bgRow').addEventListener('click', function (e) {
      var b = e.target.closest('[data-bg]'); if (!b) return; s.bg = b.dataset.bg; go('focus');
    });
    document.getElementById('noiseRow').addEventListener('click', function (e) {
      var b = e.target.closest('[data-noise]'); if (!b) return; s.noise = b.dataset.noise; go('focus');
    });
    paintTimer();
  }
  function paintTimer() {
    var s = session; if (!s) return;
    var total = s.minutes * 60;
    var ratio = total ? s.remain / total : 0;
    var ring = document.getElementById('ring');
    if (ring) ring.setAttribute('stroke-dashoffset', String(Math.round(590 * (1 - ratio))));
    var ft = document.getElementById('ftime'); if (ft) ft.textContent = fmtClock(s.remain);
    var fs = document.getElementById('fstate'); if (fs) fs.textContent = s.started ? '专注中' : '准备开始';
  }
  function toggleTimer() {
    var s = session; if (!s) return;
    if (s.started) { s.started = false; stopTimer(); }
    else { s.started = true; tick(); s.timer = setInterval(tick, 1000); }
    paintTimer();
    document.getElementById('fStart').textContent = s.started ? '暂停' : '开始专注';
  }
  function stopTimer() { if (session && session.timer) { clearInterval(session.timer); session.timer = null; } }
  function tick() {
    var s = session; if (!s) return;
    s.remain -= 1;
    if (s.remain <= 0) { s.remain = 0; stopTimer(); s.started = false; finishFocus(true); return; }
    paintTimer();
  }
  function finishFocus(finished) {
    var s = session; if (!s) return;
    var durationSec = finished ? s.minutes * 60 : (s.minutes * 60 - s.remain);
    var rec = {
      id: D.uid(), taskId: s.taskId, taskTitle: s.taskTitle || s.roomName || '专注',
      startAt: Date.now() - durationSec * 1000, endAt: Date.now(), durationSec: durationSec,
      finished: finished, interruptReason: finished ? '' : (s.interruptReason || ''), backgroundKey: s.bg, whiteNoise: s.noise, roomId: s.roomId,
    };
    D.addRecord(rec);
    if (finished) {
      D.addExp(20);
      var list = D.getTasks();
      var t = list.find(function (x) { return x.id === s.taskId; });
      if (t) { t.status = 'done'; D.saveTasks(list); D.bumpDoneTask(); }
      if (s.roomId) { api.call('focus.record', { roomId: s.roomId, minutes: s.minutes }).catch(function () {}); }
    }
    session = null;
    if (finished) { completeInfo = { min: s.minutes, total: D.totalPomodoro() }; }
    go(finished ? 'complete' : 'today');
  }
  var completeInfo = null;
  function earlyExit() {
    var s = session; if (!s) return;
    if (!s.started) { session = null; go('today'); return; }
    var panel = openModal('<div class="modal__title">提前退出</div><div class="muted" style="font-size:13px;margin-top:8px">本次不计番茄，选择中断原因：</div>' +
      '<div class="row" style="flex-wrap:wrap;margin-top:12px" id="reasons">' +
      D.INTERRUPT_REASONS.map(function (r) { return '<button class="pill" data-r="' + h(r) + '">' + h(r) + '</button>'; }).join('') +
      '</div><div class="modal__actions"><button class="btn" data-close>继续专注</button></div>');
    panel.querySelector('[data-close]').addEventListener('click', closeModal);
    panel.querySelector('#reasons').addEventListener('click', function (e) {
      var b = e.target.closest('[data-r]'); if (!b) return;
      s.interruptReason = b.dataset.r;
      stopTimer(); closeModal(); finishFocus(false);
    });
  }

  // ================= 完成 =================
  function screenComplete() {
    var info = completeInfo || { min: 25, total: D.totalPomodoro() };
    completeInfo = null;
    $view.innerHTML = '<div class="center" style="padding:60px 20px">' +
      '<div style="font-size:72px">🎉</div>' +
      '<h2 style="font-family:Georgia,serif;margin:14px 0 6px">专注完成！</h2>' +
      '<div class="muted">本次专注 ' + info.min + ' 分钟，累计番茄 ' + info.total + ' 个</div>' +
      '<button class="btn btn--primary" style="margin-top:26px;min-width:160px" id="cBack">回到今日</button></div>';
    document.getElementById('cBack').addEventListener('click', function () { go('today'); });
  }

  // ================= 时间轴 =================
  var tlRange = 'day';
  function screenTimeline() {
    if (!requireLogin()) return;
    var recs = D.getRecords().slice().sort(function (a, b) { return b.endAt - a.endAt; });
    var now = new Date();
    function inRange(r) {
      var d = new Date(r.endAt);
      if (tlRange === 'day') return D.dateStr(d) === D.today();
      if (tlRange === 'week') return (now - d) < 7 * 864e5;
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    var list = recs.filter(inRange);
    $view.innerHTML = '<h2 class="display" style="margin:0 0 4px">时间轴</h2><div class="muted3" style="font-size:12px;margin-bottom:12px">完成记录</div>' +
      '<div class="row" id="tlTabs">' + tabPill('day', '日') + tabPill('week', '周') + tabPill('month', '月') + '</div>' +
      '<div class="card" style="margin-top:14px">' +
      (list.length ? list.map(function (r) {
        return '<div class="timeline__item"><div class="ic-round">' + (r.finished ? '🍅' : '⏸') + '</div>' +
          '<div class="grow"><div style="font-size:14px;font-weight:600">' + h(r.taskTitle) + '</div>' +
          '<div class="muted3" style="font-size:11.5px">' + fmtTime(r.endAt) + ' · ' + Math.round(r.durationSec / 60) + ' 分钟' +
          (r.finished ? '' : ' · 中断：' + h(r.interruptReason || '未记录')) + '</div></div></div>';
      }).join('') : '<div class="empty-hint">这个时间段还没有完成记录</div>') +
      '</div>';
    document.getElementById('tlTabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-t]'); if (!b) return; tlRange = b.dataset.t; go('timeline');
    });
  }
  function tabPill(k, label) { return '<button class="pill ' + (tlRange === k ? 'is-on' : '') + '" data-t="' + k + '">' + label + '</button>'; }

  // ================= 数据 =================
  function screenData() {
    if (!requireLogin()) return;
    var stats = D.getStats();
    var totalMin = D.totalFocusMinutes(), totalPomo = D.totalPomodoro();
    var todayS = stats[D.today()] || { focusMinutes: 0, pomodoroCount: 0, doneTaskCount: 0 };
    var days = Object.keys(stats);
    var avg = days.length ? Math.round(totalMin / days.length) : 0;
    // 任务占比（按记录时长聚合）
    var byTask = {};
    D.getRecords().forEach(function (r) { byTask[r.taskTitle] = (byTask[r.taskTitle] || 0) + Math.round(r.durationSec / 60); });
    var taskArr = Object.keys(byTask).map(function (k) { return { name: k, min: byTask[k] }; }).sort(function (a, b) { return b.min - a.min; }).slice(0, 6);
    var sum = taskArr.reduce(function (a, b) { return a + b.min; }, 0) || 1;
    var colors = ['#6E9B57', '#E07A5F', '#D9A441', '#7FA1B0', '#B08BC0', '#C09B6E'];
    var stops = []; var acc = 0;
    taskArr.forEach(function (t, i) { var p = t.min / sum * 100; stops.push(colors[i % colors.length] + ' ' + acc + '% ' + (acc + p) + '%'); acc += p; });
    var pieBg = taskArr.length ? 'conic-gradient(' + stops.join(',') + ')' : 'var(--surface2)';
    // 本月打断原因
    var interrupts = {};
    days.forEach(function (d) {
      var s = stats[d]; if (!s || !s.interruptCounts) return;
      Object.keys(s.interruptCounts).forEach(function (k) { interrupts[k] = (interrupts[k] || 0) + s.interruptCounts[k]; });
    });
    var interArr = Object.keys(interrupts).map(function (k) { return { k: k, v: interrupts[k] }; });
    var interMax = interArr.reduce(function (a, b) { return Math.max(a, b.v); }, 1);
    // 月度柱状
    var monthDays = [];
    var now = new Date(), y = now.getFullYear(), m = now.getMonth();
    var dim = new Date(y, m + 1, 0).getDate();
    for (var i = 1; i <= dim; i++) { var ds = y + '-' + (m + 1 < 10 ? '0' : '') + (m + 1) + '-' + (i < 10 ? '0' : '') + i; monthDays.push(stats[ds] ? stats[ds].focusMinutes : 0); }
    var monthMax = Math.max.apply(null, monthDays.concat([1]));

    $view.innerHTML = '<h2 class="display" style="margin:0 0 12px">数据</h2>' +
      '<div class="card"><div class="overview">' + cell(totalMin, '累计专注(分)') + cell(totalPomo, '累计番茄') + cell(avg, '日均(分)') + '</div></div>' +
      '<div class="card"><div class="between"><b>当日专注</b><span class="muted3" style="font-size:12px">' + D.today() + '</span></div>' +
      '<div class="overview" style="margin-top:8px">' + cell(todayS.focusMinutes, '分钟') + cell(todayS.pomodoroCount, '番茄') + cell(todayS.doneTaskCount, '完成任务') + '</div></div>' +
      '<div class="section-title">专注时长分布</div>' +
      '<div class="card"><div class="row" style="gap:18px"><div style="width:120px;height:120px;border-radius:50%;background:' + pieBg + '"></div>' +
      '<div class="grow">' + (taskArr.length ? taskArr.map(function (t, i) {
        return '<div class="row" style="justify-content:space-between;font-size:12.5px;margin-bottom:4px"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + colors[i % colors.length] + ';margin-right:6px"></i>' + h(t.name) + '</span><span class="muted3">' + t.min + ' 分</span></div>';
      }).join('') : '<div class="empty-hint" style="padding:10px">暂无数据</div>') + '</div></div></div>' +

      '<div class="section-title">本月专注</div><div class="card"><div class="row" style="align-items:flex-end;gap:2px;height:110px;overflow-x:auto">' +
      monthDays.map(function (v) { var hh = Math.round(v / monthMax * 96); return '<div title="' + v + ' 分" style="flex:none;width:6px;height:' + Math.max(2, hh) + 'px;background:var(--leaf);border-radius:3px 3px 0 0"></div>'; }).join('') +
      '</div><div class="muted3" style="font-size:11.5px;margin-top:6px">' + y + ' 年 ' + (m + 1) + ' 月（每天 1 根）</div></div>' +

      '<div class="section-title">打断原因分布</div><div class="card">' +
      (interArr.length ? interArr.map(function (x) {
        return '<div style="margin-bottom:8px"><div class="between" style="font-size:12.5px"><span>' + h(x.k) + '</span><span class="muted3">' + x.v + ' 次</span></div>' +
          '<div class="progress" style="margin-top:4px"><div class="progress__bar" style="width:' + Math.round(x.v / interMax * 100) + '%"></div></div></div>';
      }).join('') : '<div class="empty-hint">暂无打断记录</div>') + '</div>' +

      '<div class="section-title">AI 洞察</div><div class="card aicard" id="insightCard"><div style="font-size:13px;line-height:1.6" id="insightText">正在生成…</div></div>';

    loadInsight();
  }
  function loadInsight() {
    var el = document.getElementById('insightText'); if (!el) return;
    var ctx = {
      focusMinutesToday: D.todayFocusMinutes(), pomodoroToday: D.totalPomodoro(), streak: D.computeStreak(),
      tasks: D.getTasks().filter(function (t) { return t.status === 'todo'; }).slice(0, 5).map(function (t) { return t.title; }),
    };
    api.call('ai.insight', { context: ctx, platform: 'web' })
      .then(function (data) { if (el) el.textContent = (data && data.reply) || '继续保持专注节奏。'; })
      .catch(function () { if (el) el.textContent = aiTip(ctx.pomodoroToday, ctx.focusMinutesToday, ctx.streak); });
  }

  // ================= AI =================
  var aiMsgs = [];
  function screenAi() {
    if (!requireLogin()) return;
    aiMsgs = QFStore.acct('aiChat', []).slice(-200);
    $view.innerHTML = '<div class="between"><h2 class="display" style="margin:0">AI 助手</h2><button class="btn btn--ghost btn--sm" id="aiClear">清空</button></div>' +
      '<div class="card" id="aiList" style="margin-top:12px;min-height:300px"></div>' +
      '<div class="row" style="margin-top:12px"><input class="input" id="aiInput" placeholder="问问 AI，例如：帮我排一下今天的计划"><button class="btn btn--primary" id="aiSend">发送</button></div>' +
      '<div class="row" style="margin-top:10px;flex-wrap:wrap">' +
      ['帮我制定今日计划', '我最近总被打断怎么办', '如何提升专注时长'].map(function (q) { return '<button class="pill" data-q="' + h(q) + '">' + h(q) + '</button>'; }).join('') + '</div>';
    paintAi();
    function saveAi() { QFStore.setAcct('aiChat', aiMsgs.slice(-200)); }
    function paintAi() {
      var list = document.getElementById('aiList');
      list.innerHTML = aiMsgs.length ? aiMsgs.map(function (m) {
        return '<div class="msg" style="margin-bottom:12px"><div class="msg__avatar">' + (m.role === 'user' ? '我' : '🤖') + '</div>' +
          '<div class="msg__text" style="' + (m.role === 'user' ? '' : 'color:var(--leaf-deep)') + '">' + h(m.content) + '</div></div>';
      }).join('') : '<div class="empty-hint">和 AI 聊聊你的专注计划吧</div>';
      list.scrollTop = list.scrollHeight;
    }
    function send(text) {
      text = (text || '').trim(); if (!text) return;
      aiMsgs.push({ role: 'user', content: text }); saveAi(); paintAi();
      document.getElementById('aiInput').value = '';
      var ctx = { nickname: auth.getNickname(), todayFocusMinutes: D.todayFocusMinutes(), streak: D.computeStreak() };
      // 用户想“创建/添加任务、制定计划”等时都需要模型返回待办 JSON
      var wantPlan = /计划|规划|安排|清单|制定|创建|新增|添加|建个|加个|帮我做|提醒|日程|排个|排一下|待办|任务/.test(text);
      api.call('ai.chat', { messages: aiMsgs.slice(-8), context: ctx, wantPlan: wantPlan, platform: 'web' })
        .then(function (data) {
          aiMsgs.push({ role: 'assistant', content: (data && data.reply) || '……' }); saveAi(); paintAi();
          var todos = (data && data.todos) || [];
          if (todos.length) {
            var list = D.getTasks();
            todos.forEach(function (t) { list.push({ id: D.uid(), title: t.title, durationMin: t.durationMin || 25, status: 'todo', difficulty: t.difficulty || 'medium', order: list.length, createdAt: Date.now() }); });
            D.saveTasks(list); toast('已添加 ' + todos.length + ' 个待办，可在「今日」查看');
          } else if (wantPlan) {
            toast('AI 未返回可添加的待办，换个说法再试试');
          }
        })
        .catch(function (err) {
          aiMsgs.push({ role: 'assistant', content: localReply(text) }); saveAi(); paintAi(); toast(err.message || 'AI 暂不可用，已用本地建议');
        });
    }
    document.getElementById('aiSend').addEventListener('click', function () { send(document.getElementById('aiInput').value); });
    document.getElementById('aiInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') send(e.target.value); });
    document.getElementById('aiClear').addEventListener('click', function () {
      if (!confirm('清空对话记录？')) return;
      aiMsgs = []; QFStore.setAcct('aiChat', []); paintAi();
    });
    document.querySelectorAll('[data-q]').forEach(function (b) { b.addEventListener('click', function () { send(b.dataset.q); }); });
  }
  function localReply(text) {
    if (/计划|安排|清单/.test(text)) return '可以先把今天要做的事列成 3~5 个 25 分钟番茄，按「先难后易」排序，完成一个就休息 5 分钟。';
    if (/打断/.test(text)) return '把手机调静音并放到视线外，专注前先写下「回来要做的事」，避免大脑惦记。';
    return '建议保持 25 分钟专注 + 5 分钟休息的节奏，连续 4 个番茄后休息 15~20 分钟。';
  }

  // ================= 我的 =================
  function screenMe() {
    var p = D.getProfile();
    var guest = !isLogged();
    var name = (guest ? '游客' : (auth.getNickname() || p.nickname));
    var need = D.nextLevelExp(p.level);
    var trees = D.trees();
    var streak = D.computeStreak();
    var forest = Math.max(12, trees);

    $view.innerHTML = '<h2 class="display" style="margin:0 0 12px">我的</h2>' +
      '<div class="card"><div class="row">' +
      '<div class="ic-round" style="width:54px;height:54px;font-size:20px">' + h((p.avatarSeed || name).slice(0, 1)) + '</div>' +
      '<div class="grow"><div style="font-size:16px;font-weight:700">' + h(name) + '</div>' +
      '<div class="muted3" style="font-size:12px">' + (guest ? '登录后可同步与解锁全部功能' : h(auth.getUser().phone)) + '</div></div>' +
      (guest ? '<button class="btn btn--primary btn--sm" id="goLogin">登录 / 注册</button>' : '<button class="btn btn--ghost btn--sm" id="logout">退出</button>') +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="between" style="font-size:12.5px"><span>Lv.' + p.level + ' · ' + (guest ? 0 : p.exp) + '/' + need + ' 经验</span><span class="muted3">连续 ' + streak + ' 天</span></div>' +
      '<div class="progress" style="margin-top:6px"><div class="progress__bar" style="width:' + Math.min(100, Math.round(p.exp / need * 100)) + '%"></div></div></div>' +

      '<div class="section-title">我的森林（' + trees + ' 棵）</div><div class="card"><div class="forest">' +
      Array.from({ length: forest }).map(function (_, i) { return '<span class="' + (i < trees ? 'on' : '') + '">' + (i < trees ? '🌳' : '🌱') + '</span>'; }).join('') +
      '</div><div class="muted3" style="font-size:11.5px;margin-top:8px">每 10 个番茄种下 1 棵树</div></div>' +

      '<div class="section-title">徽章</div><div class="badges">' +
      D.BADGE_CATALOG.map(function (b, i) {
        var on = (b.id === 'b1' && streak >= 7) || (b.id === 'b2' && trees >= 1) || (b.id === 'b3' && D.totalFocusMinutes() >= 6000);
        return '<div class="badge ' + (on ? '' : 'off') + '"><div class="badge__icon">' + b.icon + '</div><div style="font-size:12px;font-weight:600;margin-top:4px">' + b.name + '</div><div class="muted3" style="font-size:10.5px">' + b.desc + '</div></div>';
      }).join('') + '</div>' +

      '<div class="section-title">外观主题</div><div class="row" id="themeRow" style="flex-wrap:wrap">' +
      D.THEME_KEYS.map(function (k) { return '<button class="pill ' + (D.getTheme() === k ? 'is-on' : '') + '" data-th="' + k + '">' + D.THEMES[k].name + '</button>'; }).join('') + '</div>' +

      '<div class="section-title">更多</div><div class="card">' +
      row('🔄', '重看新手引导', 'replay') +
      row('🔔', '通知提醒', 'notify') +
      '</div>';

    var gl = document.getElementById('goLogin'); if (gl) gl.addEventListener('click', function () { location.href = 'login.html'; });
    var lo = document.getElementById('logout'); if (lo) lo.addEventListener('click', function () {
      if (!confirm('退出登录？')) return;
      auth.clearSession(); toast('已退出'); go('me');
    });
    document.getElementById('themeRow').addEventListener('click', function (e) {
      var b = e.target.closest('[data-th]'); if (!b) return; D.setTheme(b.dataset.th); go('me');
    });
    document.querySelectorAll('.card [data-more]').forEach(function (n) {
      n.addEventListener('click', function () {
        if (n.dataset.more === 'replay') { obIndex = 0; go('onboarding'); }
        else if (n.dataset.more === 'notify') {
          var on = !p.notifyEnabled; p.notifyEnabled = on; D.saveProfile(p); toast(on ? '已开启提醒' : '已关闭提醒'); go('me');
        }
      });
    });
  }
  function row(icon, label, more) {
    return '<div class="between" data-more="' + more + '" style="padding:10px 0;cursor:pointer"><span>' + icon + ' ' + label + '</span><span class="muted3">›</span></div>';
  }

  // ================= 自习室（单房间详情，对齐鸿蒙端）=================
  var sr = { room: null, members: [], comments: [], replyTo: null, dissolveTimer: null };

  function screenStudyroom() {
    if (!requireLogin()) return;
    $view.innerHTML = '<div class="between" style="margin-bottom:12px">' +
        '<div><h2 class="display" style="margin:0">自习室</h2>' +
        '<div class="muted3" style="font-size:12px;margin-top:2px">和好友一起，专注不孤单</div></div>' +
        '<div class="row" id="srActions"></div></div>' +
      '<div id="srBody"><div class="empty-hint">加载中…</div></div>';
    loadStudyroom();
  }

  function loadStudyroom() {
    api.call('room.listMine').then(function (data) {
      var list = (data && data.list) || [];
      if (!list.length) { sr.room = null; sr.members = []; renderEntry(); return; }
      api.call('room.get', { roomId: list[0].id }).then(function (room) {
        sr.room = room;
        sr.members = room.members || [];
        renderRoomHome();
      }).catch(function (err) {
        document.getElementById('srBody').innerHTML = '<div class="empty-hint">' + h(err.message) + '</div>';
      });
    }).catch(function (err) {
      document.getElementById('srBody').innerHTML = '<div class="empty-hint">' + h(err.message) + '</div>';
    });
  }

  function renderEntry() {
    var actions = document.getElementById('srActions');
    actions.innerHTML = '<button class="btn btn--ghost btn--sm" id="srJoin">🔑 加入</button>' +
      '<button class="btn btn--primary btn--sm" id="srCreate">＋ 创建</button>';
    actions.querySelector('#srJoin').addEventListener('click', srJoinModal);
    actions.querySelector('#srCreate').addEventListener('click', srCreateModal);
    document.getElementById('srBody').innerHTML =
      '<div class="card" id="eJoin" style="text-align:center;padding:30px 0;cursor:pointer">' +
        '<div style="font-size:30px">🔑</div>' +
        '<div class="display" style="font-size:17px;margin-top:14px">加入自习室</div>' +
        '<div class="muted3" style="font-size:12px;margin-top:6px">输入好友分享的房间号 / 加入码</div></div>' +
      '<div class="card" id="eCreate" style="text-align:center;padding:30px 0;cursor:pointer;margin-top:14px">' +
        '<div style="font-size:30px">🏠</div>' +
        '<div class="display" style="font-size:17px;margin-top:14px">创建自习室</div>' +
        '<div class="muted3" style="font-size:12px;margin-top:6px">新建一个自习室，邀请好友加入</div></div>';
    document.getElementById('eJoin').addEventListener('click', srJoinModal);
    document.getElementById('eCreate').addEventListener('click', srCreateModal);
  }

  function memberName(m) {
    var uid = auth.getUserId();
    if (m.user_id === uid) return auth.getNickname() || '我';
    return m.nickname || ('用户 …' + String(m.user_id || '').slice(-6));
  }

  function renderRoomHome() {
    var r = sr.room;
    var uid = auth.getUserId();
    var actions = document.getElementById('srActions');
    actions.innerHTML = '';
    var order = sr.members.slice().sort(function (a, b) { return (b.focus_minutes || 0) - (a.focus_minutes || 0); });
    sr.members = order;
    var focusing = order.filter(function (m) { return m.focusing === 1; }).length;
    var myRank = 0;
    order.forEach(function (m, i) { if (m.user_id === uid) myRank = i + 1; });
    var joinCode = r.join_code || r.id;

    document.getElementById('srBody').innerHTML =
      '<div class="card">' +
        '<div class="between" style="align-items:flex-start">' +
          '<div style="flex:1;min-width:0">' +
            '<div class="display" style="font-size:20px;font-weight:700">' + h(r.name) + '</div>' +
            '<div class="row" id="jcRow" style="align-items:center;gap:6px;margin-top:4px;cursor:pointer">' +
              '<span class="muted3" style="font-size:11px">加入码</span>' +
              '<b style="font-size:13.5px">' + h(joinCode) + '</b>' +
              '<span style="color:var(--leaf);font-size:12px">📋</span></div>' +
            '<span class="tag" style="margin-top:8px;display:inline-block">' + (r.member_count || order.length || 1) + ' 人</span>' +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0">' +
            '<div style="font-size:24px;font-weight:800;color:var(--tomato)">' + focusing + '</div>' +
            '<div class="muted3" style="font-size:10.5px">正在专注中</div>' +
            '<div style="font-size:20px;font-weight:800;color:var(--tomato);margin-top:8px">' + (myRank || 1) + '</div>' +
            '<div class="muted3" style="font-size:10.5px">当前排名</div>' +
          '</div>' +
        '</div>' +
        '<div class="row" style="margin-top:14px">' +
          '<button class="btn btn--primary btn--sm" id="srBoard">📖 留言</button>' +
          '<button class="btn btn--ghost btn--sm" id="srShare">↗ 分享</button>' +
        '</div>' +
        (r.daily_min > 0 ? '<div class="muted3" style="font-size:11px;margin-top:10px">每日最低专注 ' + r.daily_min + ' 分钟 · 未达标当日会被移出</div>' : '') +
      '</div>' +
      '<div class="section-title display">成员排行</div>' +
      '<div id="srMembers"></div>' +
      '<button class="btn btn--ghost" id="srDanger" style="width:100%;margin-top:18px;color:var(--tomato)">' + (r.role === 'owner' ? '解散自习室' : '退出自习室') + '</button>';

    var membersBox = document.getElementById('srMembers');
    if (!order.length) {
      membersBox.innerHTML = '<div class="empty-hint">暂无成员</div>';
    } else {
      membersBox.innerHTML = order.map(function (m, i) {
        var rankColor = i === 0 ? '#D9A441' : i === 1 ? '#84917D' : i === 2 ? '#E07A5F' : 'var(--line)';
        var canKick = r.role === 'owner' && m.user_id !== uid && m.role !== 'owner';
        return '<div class="card" data-member="' + h(m.user_id) + '" ' + (canKick ? 'data-kick="1" ' : '') + 'style="margin-bottom:10px;display:flex;align-items:center' + (canKick ? ';cursor:pointer' : '') + '">' +
          '<div style="width:24px;height:24px;border-radius:12px;background:' + rankColor + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">' + (i + 1) + '</div>' +
          '<div style="flex:1;min-width:0;margin-left:10px">' +
            '<div class="row" style="align-items:center;gap:6px"><b style="font-size:14px">' + h(memberName(m)) + '</b>' +
              (m.role === 'owner' ? ' <span class="tag" style="color:#D9A441;background:#F4E8CE">房主</span>' : '') + '</div>' +
            '<div class="muted3" style="font-size:11.5px;margin-top:3px">今日已专注 ' + (m.today_minutes || 0) + ' 分钟</div>' +
            '<div class="row" style="gap:6px;margin-top:6px">' +
              '<span class="tag" style="color:#E07A5F;background:#F6E1D6">连续专注 ' + (m.streak_days || 0) + ' 天</span>' +
              '<span class="tag" style="color:#D9A441;background:#F4E8CE">共专注 ' + (m.total_days || 0) + ' 天</span></div>' +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0"><div style="font-size:20px;font-weight:800;color:var(--ink)">' + (m.focus_minutes || 0) + '</div>' +
          '<div class="muted3" style="font-size:10px">分钟</div></div>' +
        '</div>';
      }).join('');
      membersBox.querySelectorAll('[data-kick]').forEach(function (n) {
        n.addEventListener('click', function () { askKick(n.dataset.member); });
      });
    }

    document.getElementById('jcRow').addEventListener('click', function () { copy(joinCode, '加入码已复制'); });
    document.getElementById('srBoard').addEventListener('click', openBoard);
    document.getElementById('srShare').addEventListener('click', function () {
      var text = '青番自习室邀请：' + (auth.getNickname() || '好友') + ' 邀请你进入「' + r.name + '」自习室，房间号 ' + r.id + '，一起专注吧！';
      copy(text, '分享文案已复制');
    });
    document.getElementById('srDanger').addEventListener('click', function () {
      if (r.role === 'owner') askDelete(); else askLeave();
    });
  }

  function srCreateModal() {
    var panel = openModal('<div class="modal__title">创建自习室</div>' +
      '<div class="muted3" style="font-size:11.5px;margin-bottom:10px">起个名字，喊上好友一起学</div>' +
      '<input class="input" id="rName" placeholder="房间名称">' +
      '<div class="row" style="align-items:center;justify-content:space-between;margin-top:12px"><span>设置密码</span><input type="checkbox" id="rUsePwd"></div>' +
      '<input class="input" id="rPwd" placeholder="房间密码" style="margin-top:10px;display:none">' +
      '<div class="row" style="align-items:center;justify-content:space-between;margin-top:12px"><span>每日最低专注</span><span><input class="input" id="rDaily" value="30" style="width:70px;text-align:right"> 分钟</span></div>' +
      '<div class="muted3" style="font-size:10.5px;margin-top:6px">未达标当日会被移出；填 0 表示不设限</div>' +
      '<div class="modal__actions"><button class="btn" data-close>取消</button><button class="btn btn--primary" id="rDo">创建</button></div>');
    panel.querySelector('[data-close]').addEventListener('click', closeModal);
    panel.querySelector('#rUsePwd').addEventListener('change', function (e) {
      panel.querySelector('#rPwd').style.display = e.target.checked ? '' : 'none';
    });
    panel.querySelector('#rDo').addEventListener('click', function () {
      var name = panel.querySelector('#rName').value.trim();
      if (!name) { toast('请输入名称'); return; }
      var daily = parseInt(panel.querySelector('#rDaily').value, 10);
      if (!isFinite(daily) || daily < 0) daily = 30;
      var usePwd = panel.querySelector('#rUsePwd').checked;
      api.call('room.create', { name: name, password: usePwd ? panel.querySelector('#rPwd').value : '', dailyMin: daily, nickname: auth.getNickname() || '', platform: 'web' })
        .then(function (room) { closeModal(); copy(room.id, '已创建，房间号 ' + room.id); loadStudyroom(); })
        .catch(function (err) { toast(err.message || '创建失败'); });
    });
  }

  function srJoinModal() {
    var panel = openModal('<div class="modal__title">加入自习室</div>' +
      '<div class="muted3" style="font-size:11.5px;margin-bottom:10px">输入好友分享的房间号 / 加入码</div>' +
      '<input class="input" id="rId" placeholder="房间号 / 加入码">' +
      '<input class="input" id="rPwd2" placeholder="房间密码（无则留空）" style="margin-top:10px">' +
      '<div class="modal__actions"><button class="btn" data-close>取消</button><button class="btn btn--primary" id="rJoin2">加入</button></div>');
    panel.querySelector('[data-close]').addEventListener('click', closeModal);
    panel.querySelector('#rJoin2').addEventListener('click', function () {
      var id = panel.querySelector('#rId').value.trim();
      if (!id) { toast('请输入房间号'); return; }
      api.call('room.join', { roomId: id, password: panel.querySelector('#rPwd2').value, nickname: auth.getNickname() || '', platform: 'web' })
        .then(function () { closeModal(); toast('已加入'); loadStudyroom(); })
        .catch(function (err) { toast(err.message || '加入失败'); });
    });
  }

  function openBoard() {
    sr.replyTo = null;
    loadBoardComments();
  }
  function loadBoardComments() {
    api.call('comment.list', { roomId: sr.room.id, page: 1, pageSize: 50 }).then(function (data) {
      sr.comments = (data.list || []).slice().sort(function (a, b) { return Number(a.created_at) - Number(b.created_at); });
      renderBoard();
    }).catch(function (err) { toast(err.message || '加载失败'); });
  }
  function renderBoard() {
    var panel = document.getElementById('boardModalPanel');
    if (!panel) {
      panel = openModal('<div class="modal__title">留言</div>' +
        '<div class="muted3" style="font-size:11px;margin-bottom:10px">' + h(sr.room.name) + '</div>' +
        '<div id="boardReply"></div>' +
        '<div class="row" style="gap:8px"><input class="input" id="bInput" placeholder="写一句留言…" style="flex:1"><button class="btn btn--primary" id="bSend">发送</button></div>' +
        '<div id="boardList" style="margin-top:14px;max-height:300px;overflow:auto"></div>');
      panel.id = 'boardModalPanel';
      panel.querySelector('#bSend').addEventListener('click', sendBoardComment);
      panel.querySelector('#bInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') sendBoardComment(); });
    }
    var replyBox = panel.querySelector('#boardReply');
    if (sr.replyTo) {
      replyBox.innerHTML = '<div class="row" style="align-items:center;justify-content:space-between;padding:6px 10px;background:#DCE8CF;border-radius:8px;margin-bottom:8px">' +
        '<span style="font-size:11.5px;color:#4C7A3E">回复 @' + h(sr.replyTo.nickname) + '</span>' +
        '<span style="font-size:11.5px;cursor:pointer" id="bCancelReply">取消</span></div>';
      replyBox.querySelector('#bCancelReply').addEventListener('click', function () { sr.replyTo = null; renderBoard(); });
    } else {
      replyBox.innerHTML = '';
    }
    panel.querySelector('#boardList').innerHTML = sr.comments.length ? sr.comments.map(function (m, i) {
      return '<div style="display:flex;gap:8px;padding:8px 0;padding-left:' + ((m.depth || 0) * 16) + 'px">' +
        '<div class="msg__avatar">' + h((m.nickname || '匿').slice(0, 1)) + '</div>' +
        '<div style="flex:1;min-width:0"><div class="between"><b style="font-size:12.5px">' + h(m.nickname || '匿名') + '</b><span class="msg__meta">' + fmtTime(m.created_at) + '</span></div>' +
        '<div style="font-size:13px;line-height:1.5;margin-top:3px">' + (m.reply_to_name ? '<span style="color:#4C7A3E">回复 @' + h(m.reply_to_name) + '：</span>' : '') + h(m.content) + '</div>' +
        '<div style="font-size:10.5px;color:#4C7A3E;margin-top:4px;cursor:pointer" data-reply="' + i + '">回复</div></div></div>';
    }).join('') : '<div class="empty-hint">还没有留言，来说点什么吧</div>';
    panel.querySelectorAll('[data-reply]').forEach(function (n) {
      n.addEventListener('click', function () {
        var m = sr.comments[Number(n.dataset.reply)];
        if (m) { sr.replyTo = { id: m.id, nickname: m.nickname || '匿名' }; renderBoard(); }
      });
    });
  }
  function sendBoardComment() {
    var panel = document.getElementById('boardModalPanel');
    var input = panel.querySelector('#bInput');
    var v = input.value.trim();
    if (!v) { toast('请输入内容'); return; }
    var payload = { roomId: sr.room.id, content: v, nickname: auth.getNickname() || '匿名', platform: 'web' };
    if (sr.replyTo) payload.parentId = sr.replyTo.id;
    api.call('comment.add', payload).then(function () {
      input.value = '';
      sr.replyTo = null;
      toast('已发送');
      loadBoardComments();
    }).catch(function (err) { toast(err.message || '发送失败'); });
  }

  function askKick(userId) {
    var m = sr.members.find(function (x) { return x.user_id === userId; });
    if (!m) return;
    var panel = openModal('<div class="modal__title" style="text-align:center">移出成员</div>' +
      '<div class="muted3" style="text-align:center;margin-top:8px">确定将「' + h(memberName(m)) + '」移出自习室吗？</div>' +
      '<div class="modal__actions"><button class="btn" data-close>取消</button><button class="btn btn--danger" id="kickOk">移出</button></div>');
    panel.querySelector('[data-close]').addEventListener('click', closeModal);
    panel.querySelector('#kickOk').addEventListener('click', function () {
      api.call('room.kick', { roomId: sr.room.id, targetUserId: userId }).then(function () {
        closeModal(); toast('已移出该成员'); loadStudyroom();
      }).catch(function (err) { toast(err.message || '移出失败'); });
    });
  }

  function askDelete() {
    var panel = openModal('<div class="modal__title" style="text-align:center">解散自习室？</div>' +
      '<div class="muted3" style="text-align:center;margin-top:8px">「' + h(sr.room.name) + '」及其留言将不可见，成员会被移出。</div>' +
      '<div class="modal__actions"><button class="btn" data-close>取消</button><button class="btn btn--danger" id="delOk" disabled>解散（10s）</button></div>');
    panel.querySelector('[data-close]').addEventListener('click', closeModal);
    var ok = panel.querySelector('#delOk');
    var left = 10;
    ok.addEventListener('click', function () { if (left <= 0) doDelete(); });
    if (sr.dissolveTimer) clearInterval(sr.dissolveTimer);
    sr.dissolveTimer = setInterval(function () {
      left -= 1;
      if (left <= 0) {
        clearInterval(sr.dissolveTimer);
        sr.dissolveTimer = null;
        ok.disabled = false;
        ok.textContent = '解散';
      } else {
        ok.textContent = '解散（' + left + 's）';
      }
    }, 1000);
  }
  function doDelete() {
    if (sr.dissolveTimer) { clearInterval(sr.dissolveTimer); sr.dissolveTimer = null; }
    api.call('room.delete', { roomId: sr.room.id }).then(function () { closeModal(); toast('已解散自习室'); loadStudyroom(); }).catch(function (e) { toast(e.message); });
  }
  function askLeave() {
    var panel = openModal('<div class="modal__title" style="text-align:center">退出自习室？</div>' +
      '<div class="muted3" style="text-align:center;margin-top:8px">「' + h(sr.room.name) + '」退出后可在「加入」中重新进入。</div>' +
      '<div class="modal__actions"><button class="btn" data-close>取消</button><button class="btn btn--danger" id="leaveOk">退出</button></div>');
    panel.querySelector('[data-close]').addEventListener('click', closeModal);
    panel.querySelector('#leaveOk').addEventListener('click', function () {
      api.call('room.leave', { roomId: sr.room.id }).then(function () { closeModal(); toast('已退出'); loadStudyroom(); }).catch(function (e) { toast(e.message); });
    });
  }
  function copy(text, msg) {
    var done = function () { toast(msg); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done).catch(done);
    else done();
  }

  // ================= 路由 =================
  var ROUTES = {
    onboarding: screenOnboarding,
    today: function () { screenToday(); bindTaskList(); },
    focus: screenFocus,
    complete: screenComplete,
    timeline: screenTimeline,
    data: screenData,
    ai: screenAi,
    me: screenMe,
    studyroom: screenStudyroom,
  };
  var NAV = ['today', 'studyroom', 'timeline', 'data', 'me'];
  var NAV_LABEL = { today: '今日', studyroom: '自习室', timeline: '时间轴', data: '数据', me: '我的' };

  function current() {
    var hash = (location.hash || '').replace(/^#\/?/, '');
    return hash.split('?')[0] || 'today';
  }
  function go(route, param) { location.hash = '#/' + route; }

  function renderShellNav() {
    var cur = current();
    document.querySelectorAll('.sidenav__item, .tabbar__item').forEach(function (n) {
      n.classList.toggle('is-on', n.dataset.route === cur);
    });
  }
  function refreshUserChip() {
    var b = document.getElementById('userChip');
    if (!b) return;
    if (isLogged()) { b.textContent = auth.getNickname() || '我的'; }
    else { b.textContent = '登录'; }
  }

  function renderRoute() {
    var name = current();
    var fn = ROUTES[name] || ROUTES.today;
    renderShellNav();
    refreshUserChip();
    fn();
  }

  function route() {
    D.applyTheme();
    // 首次进入且未看过引导
    if (!QFStore.get('onboarded', false) && current() !== 'onboarding') {
      location.hash = '#/onboarding'; return;
    }
    renderRoute();
    // 拉取云端数据（跨端同步）后重渲染
    if (D.cloudPull) {
      D.cloudPull().then(function (pulled) { if (pulled) renderRoute(); });
    }
  }

  // shell 导航绑定
  document.querySelectorAll('[data-route]').forEach(function (n) {
    n.addEventListener('click', function () { go(n.dataset.route === 'studyroom' && !isLogged() ? 'studyroom' : n.dataset.route); });
  });
  var themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var ks = D.THEME_KEYS; var i = ks.indexOf(D.getTheme()); D.setTheme(ks[(i + 1) % ks.length]); go('me');
  });
  var userChip = document.getElementById('userChip');
  if (userChip) userChip.addEventListener('click', function () { location.href = 'login.html'; });

  window.addEventListener('hashchange', route);
  route();
})();
