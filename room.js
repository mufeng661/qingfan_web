// 房间详情：成员 + 交流（回复 / 点赞 / 删除 / 分页）
(function () {
  'use strict';

  var api = window.QingfanApi;
  var auth = window.QingfanAuth;

  var ROLE_CLASS = { '管理员': 'role-admin', '用户': 'role-user', '游客': 'role-visitor' };

  var el = {
    back: document.getElementById('back'),
    navTitle: document.getElementById('navTitle'),
    roomCard: document.getElementById('roomCard'),
    roomName: document.getElementById('roomName'),
    roomLocked: document.getElementById('roomLocked'),
    memberCount: document.getElementById('memberCount'),
    toggleMembers: document.getElementById('toggleMembers'),
    members: document.getElementById('members'),
    invite: document.getElementById('invite'),
    copyId: document.getElementById('copyId'),
    deleteRoom: document.getElementById('deleteRoom'),
    leaveRoom: document.getElementById('leaveRoom'),
    list: document.getElementById('list'),
    tip: document.getElementById('tip'),
    replyBar: document.getElementById('replyBar'),
    replyName: document.getElementById('replyName'),
    cancelReply: document.getElementById('cancelReply'),
    nickname: document.getElementById('nickname'),
    content: document.getElementById('content'),
    submit: document.getElementById('submit'),
  };

  var roomId = api.qs('id');
  var state = {
    room: null,
    members: [],
    list: [],
    page: 1,
    pageSize: 20,
    hasMore: false,
    loading: false,
    submitting: false,
    replyTo: null,
    isOwner: false,
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---- 房间信息 ----
  function loadRoom() {
    return api.call('room.get', { roomId: roomId }).then(function (room) {
      state.room = room;
      state.isOwner = room.role === 'owner';
      state.members = (room.members || []).map(function (m) {
        return Object.assign({}, m, {
          roleText: m.role === 'owner' ? '房主' : '成员',
          shortId: String(m.user_id || '').slice(-6),
        });
      });

      el.navTitle.textContent = room.name || '自习室';
      document.title = room.name || '自习室';
      el.roomName.textContent = room.name;
      el.roomLocked.hidden = !room.need_password;
      el.memberCount.textContent = room.member_count || 0;
      el.roomCard.hidden = false;
      el.deleteRoom.hidden = !state.isOwner;
      el.leaveRoom.hidden = state.isOwner;
      renderMembers();
    }).catch(function (err) {
      api.toast(err.message || '房间加载失败');
    });
  }

  function renderMembers() {
    el.members.innerHTML = state.members.map(function (m) {
      return (
        '<div class="member">' +
        '<span class="member-role ' + (m.role === 'owner' ? 'owner' : '') + '">' + escapeHtml(m.roleText) + '</span>' +
        '<span class="member-id">用户 …' + escapeHtml(m.shortId) + '</span>' +
        '</div>'
      );
    }).join('');
  }

  // ---- 交流列表 ----
  function buildTree(rows) {
    var map = {};
    rows.forEach(function (row) {
      map[String(row.id)] = Object.assign({}, row, { children: [], depth: 0 });
    });
    var roots = [];
    rows.forEach(function (row) {
      var node = map[String(row.id)];
      if (row.parent_id !== null && row.parent_id !== undefined && map[String(row.parent_id)]) {
        map[String(row.parent_id)].children.push(node);
      } else if (row.parent_id === null || row.parent_id === undefined) {
        roots.push(node);
      }
    });
    roots.sort(function (a, b) { return Number(b.created_at) - Number(a.created_at); });
    Object.keys(map).forEach(function (key) {
      map[key].children.sort(function (a, b) { return Number(a.created_at) - Number(b.created_at); });
    });
    var flat = [];
    (function walk(nodes, depth) {
      nodes.forEach(function (node) {
        node.depth = depth;
        flat.push(node);
        walk(node.children, depth + 1);
      });
    })(roots, 0);
    return flat;
  }

  function renderList() {
    el.list.innerHTML = state.list.map(function (item, index) {
      var avatar = item.avatar
        ? '<img class="avatar-img" src="' + escapeHtml(item.avatar) + '" alt="" />'
        : '<span class="avatar-text">' + escapeHtml(item.nickname || '匿') + '</span>';
      var roleClass = ROLE_CLASS[item.role] || 'role-visitor';
      var replyPrefix = item.reply_to_name
        ? '<span class="reply-to">回复 @' + escapeHtml(item.reply_to_name) + '：</span>'
        : '';
      return (
        '<div class="item" style="margin-left:' + (item.depth * 20) + 'px">' +
        '<div class="avatar">' + avatar + '</div>' +
        '<div class="body">' +
        '<div class="head">' +
        '<span class="nickname">' + escapeHtml(item.nickname) + '</span>' +
        '<span class="role ' + roleClass + '">' + escapeHtml(item.role) + '</span>' +
        '</div>' +
        '<div class="text">' + replyPrefix + escapeHtml(item.content) + '</div>' +
        '<div class="meta">' +
        '<span class="time">' + escapeHtml(api.formatTime(item.created_at)) + '</span>' +
        '<span class="actions">' +
        '<span class="action" data-act="reply" data-index="' + index + '">回复</span>' +
        '<span class="action ' + (item.liked ? 'liked' : '') + '" data-act="like" data-index="' + index + '">' +
        (item.liked ? '已赞' : '赞') + ' ' + (item.likes || 0) + '</span>' +
        (item.can_delete ? '<span class="action delete" data-act="delete" data-index="' + index + '">删除</span>' : '') +
        '</span>' +
        '</div>' +
        '</div>' +
        '</div>'
      );
    }).join('');

    if (state.loading) {
      el.tip.textContent = '加载中...';
      el.tip.hidden = false;
    } else if (!state.list.length) {
      el.tip.textContent = '还没有交流，发一条打个招呼吧～';
      el.tip.hidden = false;
    } else if (!state.hasMore) {
      el.tip.textContent = '没有更多了';
      el.tip.hidden = false;
    } else {
      el.tip.textContent = '上拉加载更多';
      el.tip.hidden = false;
    }
  }

  function loadComments(reset) {
    if (state.loading || !roomId) return Promise.resolve();
    var page = reset ? 1 : state.page + 1;
    state.loading = true;
    renderList();
    return api.call('comment.list', { roomId: roomId, page: page, pageSize: state.pageSize })
      .then(function (data) {
        var rows = (data.list || []).map(function (item) {
          return Object.assign({}, item, { timeText: api.formatTime(item.created_at) });
        });
        var tree = buildTree(rows);
        state.list = reset ? tree : state.list.concat(tree);
        state.page = page;
        state.hasMore = Boolean(data.hasMore);
        state.loading = false;
        renderList();
      })
      .catch(function (err) {
        state.loading = false;
        renderList();
        api.toast(err.message || '加载失败');
      });
  }

  // ---- 操作 ----
  function submit() {
    if (state.submitting) return;
    var content = (el.content.value || '').trim();
    if (!content) { api.toast('请输入内容'); el.content.focus(); return; }
    var nickname = (el.nickname.value || '').trim() || '匿名';
    auth.setNickname(nickname);

    var payload = { roomId: roomId, content: content, nickname: nickname, platform: 'web' };
    if (state.replyTo) payload.parentId = state.replyTo.id;

    state.submitting = true;
    el.submit.disabled = true;
    el.submit.textContent = '发送中';
    api.call('comment.add', payload)
      .then(function () {
        el.content.value = '';
        cancelReply();
        state.submitting = false;
        el.submit.disabled = false;
        el.submit.textContent = '发送';
        api.toast('已发送');
        return loadComments(true);
      })
      .catch(function (err) {
        state.submitting = false;
        el.submit.disabled = false;
        el.submit.textContent = '发送';
        api.toast(err.message || '发送失败');
      });
  }

  function onReply(index) {
    var item = state.list[index];
    if (!item) return;
    state.replyTo = { id: item.id, nickname: item.nickname };
    el.replyBar.hidden = false;
    el.replyName.textContent = item.nickname;
    el.content.placeholder = '回复 ' + item.nickname;
    el.content.focus();
  }

  function cancelReply() {
    state.replyTo = null;
    el.replyBar.hidden = true;
    el.content.placeholder = '和大家说点什么...';
  }

  function onLike(index) {
    var item = state.list[index];
    if (!item) return;
    var action = item.liked ? 'unlike' : 'like';
    api.call('comment.like', { roomId: roomId, id: item.id, action: action })
      .then(function (data) {
        item.likes = data.likes;
        item.liked = data.liked;
        renderList();
      })
      .catch(function (err) { api.toast(err.message || '操作失败'); });
  }

  function onDelete(index) {
    var item = state.list[index];
    if (!item) return;
    if (!window.confirm('确定要删除这条留言吗？')) return;
    api.call('comment.delete', { roomId: roomId, id: item.id })
      .then(function () { api.toast('已删除'); return loadComments(true); })
      .catch(function (err) { api.toast(err.message || '删除失败'); });
  }

  function leaveRoom() {
    if (!window.confirm('退出后将无法查看房间内交流，确定退出吗？')) return;
    api.call('room.leave', { roomId: roomId })
      .then(function () { api.toast('已退出'); setTimeout(function () { location.href = 'index.html'; }, 500); })
      .catch(function (err) { api.toast(err.message || '退出失败'); });
  }

  function deleteRoom() {
    if (!window.confirm('解散后房间和所有交流记录将不可见，确定解散吗？')) return;
    api.call('room.delete', { roomId: roomId })
      .then(function () { api.toast('已解散'); setTimeout(function () { location.href = 'index.html'; }, 500); })
      .catch(function (err) { api.toast(err.message || '解散失败'); });
  }

  function copyText(text, okMsg) {
    var done = function () { api.toast(okMsg); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { api.toast('复制失败'); }
    ta.remove();
  }

  // ---- 事件绑定 ----
  el.back.addEventListener('click', function () { location.href = 'index.html'; });
  el.toggleMembers.addEventListener('click', function () {
    el.members.hidden = !el.members.hidden;
    el.toggleMembers.textContent = el.members.hidden ? '查看成员' : '收起成员';
  });
  el.copyId.addEventListener('click', function () { copyText(roomId, '房间号已复制'); });
  el.invite.addEventListener('click', function () {
    var base = location.origin + location.pathname.replace(/room\.html$/, 'join.html');
    copyText(base + '?roomId=' + encodeURIComponent(roomId), '邀请链接已复制');
  });
  el.leaveRoom.addEventListener('click', leaveRoom);
  el.deleteRoom.addEventListener('click', deleteRoom);
  el.cancelReply.addEventListener('click', cancelReply);
  el.submit.addEventListener('click', submit);
  el.content.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
  });
  el.list.addEventListener('click', function (e) {
    var target = e.target.closest('.action');
    if (!target) return;
    var index = Number(target.dataset.index);
    if (target.dataset.act === 'reply') onReply(index);
    else if (target.dataset.act === 'like') onLike(index);
    else if (target.dataset.act === 'delete') onDelete(index);
  });

  // 触底加载更多
  window.addEventListener('scroll', function () {
    if (!state.hasMore || state.loading) return;
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 120) {
      loadComments(false);
    }
  });

  // ---- 初始化 ----
  if (!roomId) {
    api.toast('缺少房间号');
  } else {
    el.nickname.value = auth.getNickname();
    loadRoom();
    loadComments(true);
  }
})();
