// 首页：鸿蒙端 StudyRoom 布局（数据用云端 rooms_self / room_members_self / comments_self）
// - 我的自习室：我创建的房间（role=owner）→ 渐变卡
// - 好友的自习室：我加入的房间（role=member）→ 列表卡
// - 自习动态：由房间列表推导
// - 留言板：选择我的某个房间，读写该房间交流
// 主题（共学/晨读/冲刺/静心）云端无字段，仅存本地 localStorage，作展示用。
(function () {
  'use strict';

  var api = window.QingfanApi;
  var auth = window.QingfanAuth;

  var THEMES = { '共学': '📚', '晨读': '🌅', '冲刺': '🔥', '静心': '🌙' };
  var THEME_KEY = 'qingfan:roomTheme:';

  var el = {
    userBtn: document.getElementById('userBtn'),
    joinRoom: document.getElementById('joinRoom'),
    createRoom: document.getElementById('createRoom'),
    mineWrap: document.getElementById('mineWrap'),
    feed: document.getElementById('feed'),
    boardRoom: document.getElementById('boardRoom'),
    boardInput: document.getElementById('boardInput'),
    boardSend: document.getElementById('boardSend'),
    boardList: document.getElementById('boardList'),
    otherTitle: document.getElementById('otherTitle'),
    otherRooms: document.getElementById('otherRooms'),
    empty: document.getElementById('empty'),
    loading: document.getElementById('loading'),
    createModal: document.getElementById('createModal'),
    newName: document.getElementById('newName'),
    themeRow: document.getElementById('themeRow'),
    doCreate: document.getElementById('doCreate'),
    confirmModal: document.getElementById('confirmModal'),
    cfmTitle: document.getElementById('cfmTitle'),
    cfmText: document.getElementById('cfmText'),
    cfmOk: document.getElementById('cfmOk'),
  };

  var state = {
    rooms: [],
    membersByRoom: {},
    newTheme: '共学',
    confirm: null,
    boardRoomId: '',
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getTheme(roomId) {
    try { return localStorage.getItem(THEME_KEY + roomId) || '共学'; } catch (e) { return '共学'; }
  }
  function setTheme(roomId, theme) {
    try { localStorage.setItem(THEME_KEY + roomId, theme); } catch (e) { /* ignore */ }
  }
  function themeEmoji(theme) { return THEMES[theme] || '📚'; }

  // ---- 渲染：我的自习室（渐变卡） ----
  function renderMine(rooms) {
    el.mineWrap.innerHTML = rooms.map(function (r) {
      var members = state.membersByRoom[r.id] || [];
      var avatars = members.slice(0, 5).map(function (m) {
        var me = m.user_id === auth.getUserId();
        return '<span class="mine-card__avatar' + (me ? ' is-me' : '') + '">' + (me ? '我' : '友') + '</span>';
      }).join('');
      return (
        '<div class="mine-card" data-id="' + escapeHtml(r.id) + '">' +
        '<div class="mine-card__top">' +
        '<div class="mine-card__name">👥 ' + escapeHtml(r.name) + '</div>' +
        '<span class="mine-card__badge">' + (r.member_count || 1) + ' 人专注中</span>' +
        '<span class="mine-card__x" data-act="delete" title="解散房间">✕</span>' +
        '</div>' +
        '<div class="mine-card__sub">一起专注，互相监督</div>' +
        (avatars ? '<div class="mine-card__members">' + avatars + '</div>' : '') +
        '<div class="mine-card__foot">' +
        '<span class="mine-card__meta">🏠 创建于 ' + escapeHtml(api.formatTime(r.created_at)) + '</span>' +
        '<button class="mine-card__go" data-act="enter" type="button">进入房间</button>' +
        '</div>' +
        '</div>'
      );
    }).join('');
  }

  // ---- 渲染：好友的自习室 ----
  function renderOther(rooms) {
    el.otherTitle.hidden = rooms.length === 0;
    el.otherRooms.innerHTML = rooms.map(function (r) {
      var theme = getTheme(r.id);
      return (
        '<div class="room-card2" data-id="' + escapeHtml(r.id) + '">' +
        '<div class="room-card2__emoji">' + themeEmoji(theme) + '</div>' +
        '<div class="room-card2__body">' +
        '<div class="room-card2__name">' + escapeHtml(r.name) +
        (r.need_password ? '<span class="tag locked">有密码</span>' : '') + '</div>' +
        '<div class="room-card2__meta">' + escapeHtml(theme) + ' · ' + (r.member_count || 1) + ' 人</div>' +
        '</div>' +
        '<button class="room-card2__go" data-act="enter" type="button">进入</button>' +
        '<span class="room-card2__x" data-act="leave" title="退出房间">✕</span>' +
        '</div>'
      );
    }).join('');
  }

  // ---- 渲染：自习动态 ----
  function renderFeed(rooms) {
    var feeds = rooms.map(function (r) {
      return {
        icon: r.role === 'owner' ? '🌱' : '🌳',
        text: (r.role === 'owner' ? '你创建了「' : '你加入了「') + r.name + '」',
        time: api.formatTime(r.created_at),
        ts: Number(r.created_at) || 0,
      };
    }).sort(function (a, b) { return b.ts - a.ts; }).slice(0, 6);

    el.feed.innerHTML = feeds.map(function (f) {
      return (
        '<div class="feed__row">' +
        '<span class="feed__icon">' + f.icon + '</span>' +
        '<span class="feed__text">' + escapeHtml(f.text) + '</span>' +
        '<span class="feed__time">' + escapeHtml(f.time) + '</span>' +
        '</div>'
      );
    }).join('') || '<div class="tip">暂无动态</div>';
  }

  // ---- 留言板 ----
  function renderBoardRooms(rooms) {
    el.boardRoom.innerHTML = rooms.map(function (r) {
      return '<option value="' + escapeHtml(r.id) + '">' + escapeHtml(r.name) + '</option>';
    }).join('');
    if (!state.boardRoomId || !rooms.some(function (r) { return r.id === state.boardRoomId; })) {
      state.boardRoomId = rooms.length ? rooms[0].id : '';
    }
    if (state.boardRoomId) el.boardRoom.value = state.boardRoomId;
  }

  function loadBoard() {
    if (!state.boardRoomId) { el.boardList.innerHTML = ''; return; }
    el.boardList.innerHTML = '<div class="tip">加载中...</div>';
    api.call('comment.list', { roomId: state.boardRoomId, page: 1, pageSize: 20 })
      .then(function (data) {
        var list = (data.list || []).slice().sort(function (a, b) {
          return Number(b.created_at) - Number(a.created_at);
        }).slice(0, 8);
        if (!list.length) {
          el.boardList.innerHTML = '<div class="tip">还没有留言，来说点什么吧～</div>';
          return;
        }
        el.boardList.innerHTML = list.map(function (m) {
          var nick = (m.nickname || '匿名');
          return (
            '<div class="board-msg">' +
            '<span class="board-msg__avatar">' + escapeHtml(nick.slice(0, 1)) + '</span>' +
            '<div class="board-msg__body">' +
            '<div class="board-msg__head"><span class="board-msg__nick">' + escapeHtml(nick) + '</span>' +
            '<span class="board-msg__time">' + escapeHtml(api.formatTime(m.created_at)) + '</span></div>' +
            '<div class="board-msg__text">' + escapeHtml(m.content) + '</div>' +
            '</div>' +
            '</div>'
          );
        }).join('');
      })
      .catch(function (err) {
        el.boardList.innerHTML = '<div class="tip">' + escapeHtml(err.message || '加载失败') + '</div>';
      });
  }

  function sendBoard() {
    if (!state.boardRoomId) { api.toast('先创建一个自习室'); return; }
    var content = (el.boardInput.value || '').trim();
    if (!content) { api.toast('请输入留言内容'); el.boardInput.focus(); return; }
    var nickname = auth.getNickname() || '匿名';
    el.boardSend.disabled = true;
    api.call('comment.add', { roomId: state.boardRoomId, content: content, nickname: nickname, platform: 'web' })
      .then(function () {
        el.boardInput.value = '';
        el.boardSend.disabled = false;
        api.toast('已发送');
        loadBoard();
      })
      .catch(function (err) {
        el.boardSend.disabled = false;
        api.toast(err.message || '发送失败');
      });
  }

  // ---- 主加载 ----
  function render() {
    var mine = state.rooms.filter(function (r) { return r.role === 'owner'; });
    var other = state.rooms.filter(function (r) { return r.role !== 'owner'; });

    el.loading.hidden = true;
    el.empty.hidden = state.rooms.length > 0;

    renderMine(mine);
    renderFeed(state.rooms);
    renderOther(other);
    renderBoardRooms(state.rooms);

    if (state.rooms.length) loadBoard();
    else el.boardList.innerHTML = '';
  }

  function load() {
    el.loading.hidden = false;
    api.call('room.listMine')
      .then(function (data) {
        var rooms = (data && data.list) || [];
        state.rooms = rooms;
        state.membersByRoom = {};
        render();

        // 并发补拉每个房间的成员，用于「我的自习室」头像
        rooms.forEach(function (r) {
          api.call('room.get', { roomId: r.id })
            .then(function (room) {
              state.membersByRoom[r.id] = room.members || [];
              var mine = state.rooms.filter(function (x) { return x.role === 'owner'; });
              renderMine(mine);
            })
            .catch(function () { /* 忽略单个房间失败 */ });
        });
      })
      .catch(function (err) {
        el.loading.hidden = true;
        el.empty.hidden = true;
        api.toast(err.message || '加载失败');
      });
  }

  // ---- 创建 ----
  function openCreate() {
    el.newName.value = '';
    state.newTheme = '共学';
    Array.prototype.forEach.call(el.themeRow.children, function (chip) {
      chip.classList.toggle('is-on', chip.dataset.theme === '共学');
    });
    el.createModal.hidden = false;
    setTimeout(function () { el.newName.focus(); }, 50);
  }
  function closeCreate() { el.createModal.hidden = true; }

  function doCreate() {
    var name = (el.newName.value || '').trim();
    if (!name) { api.toast('请输入自习室名称'); el.newName.focus(); return; }
    el.doCreate.disabled = true;
    api.call('room.create', { name: name, password: '' })
      .then(function (room) {
        setTheme(room.id, state.newTheme);
        el.doCreate.disabled = false;
        closeCreate();
        api.toast('自习室「' + name + '」已创建');
        state.boardRoomId = room.id;
        load();
      })
      .catch(function (err) {
        el.doCreate.disabled = false;
        api.toast(err.message || '创建失败');
      });
  }

  // ---- 确认弹窗 ----
  function openConfirm(opts) {
    state.confirm = opts.onOk;
    el.cfmTitle.textContent = opts.title;
    el.cfmText.textContent = opts.text;
    el.cfmOk.textContent = opts.okText || '确定';
    el.cfmOk.classList.toggle('modal__btn--danger', opts.danger !== false);
    el.confirmModal.hidden = false;
  }
  function closeConfirm() { el.confirmModal.hidden = true; state.confirm = null; }

  function askDelete(room) {
    openConfirm({
      title: '解散自习室？',
      text: '「' + room.name + '」将从列表中移除，房间交流也不再可见。',
      okText: '解散',
      onOk: function () {
        api.call('room.delete', { roomId: room.id })
          .then(function () { api.toast('已解散'); load(); })
          .catch(function (err) { api.toast(err.message || '解散失败'); });
      },
    });
  }

  function askLeave(room) {
    openConfirm({
      title: '退出自习室？',
      text: '退出后将无法查看「' + room.name + '」的交流。',
      okText: '退出',
      onOk: function () {
        api.call('room.leave', { roomId: room.id })
          .then(function () { api.toast('已退出'); load(); })
          .catch(function (err) { api.toast(err.message || '退出失败'); });
      },
    });
  }

  function enterRoom(id) { location.href = 'room.html?id=' + encodeURIComponent(id); }

  // ---- 事件 ----
  function renderUser() {
    var u = auth.getUser();
    if (u) {
      el.userBtn.textContent = u.nickname || u.username || '我的';
      el.userBtn.classList.remove('pill--leaf');
      el.userBtn.classList.add('pill--ghost');
    } else {
      el.userBtn.textContent = '登录';
      el.userBtn.classList.remove('pill--ghost');
      el.userBtn.classList.add('pill--leaf');
    }
  }

  el.userBtn.addEventListener('click', function () {
    location.href = 'login.html';
  });
  el.createRoom.addEventListener('click', openCreate);
  el.joinRoom.addEventListener('click', function () { location.href = 'join.html'; });
  el.doCreate.addEventListener('click', doCreate);
  el.boardSend.addEventListener('click', sendBoard);
  el.boardRoom.addEventListener('change', function () {
    state.boardRoomId = el.boardRoom.value;
    loadBoard();
  });
  el.boardInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendBoard();
  });
  el.themeRow.addEventListener('click', function (e) {
    var chip = e.target.closest('.theme-chip');
    if (!chip) return;
    state.newTheme = chip.dataset.theme;
    Array.prototype.forEach.call(el.themeRow.children, function (c) {
      c.classList.toggle('is-on', c === chip);
    });
  });

  el.mineWrap.addEventListener('click', function (e) {
    var card = e.target.closest('.mine-card');
    if (!card) return;
    var room = state.rooms.find(function (r) { return r.id === card.dataset.id; });
    if (!room) return;
    var act = e.target.closest('[data-act]');
    if (act && act.dataset.act === 'delete') { askDelete(room); return; }
    enterRoom(room.id);
  });

  el.otherRooms.addEventListener('click', function (e) {
    var card = e.target.closest('.room-card2');
    if (!card) return;
    var room = state.rooms.find(function (r) { return r.id === card.dataset.id; });
    if (!room) return;
    var act = e.target.closest('[data-act]');
    if (act && act.dataset.act === 'leave') { askLeave(room); return; }
    enterRoom(room.id);
  });

  document.querySelectorAll('[data-close]').forEach(function (n) {
    n.addEventListener('click', function () { closeCreate(); closeConfirm(); });
  });
  el.cfmOk.addEventListener('click', function () {
    var fn = state.confirm;
    closeConfirm();
    if (fn) fn();
  });

  renderUser();
  load();
})();
