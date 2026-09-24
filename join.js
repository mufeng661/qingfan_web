// 加入房间
(function () {
  'use strict';

  var api = window.QingfanApi;
  var el = {
    back: document.getElementById('back'),
    roomId: document.getElementById('roomId'),
    password: document.getElementById('password'),
    submit: document.getElementById('submit'),
  };
  var submitting = false;

  // 支持邀请链接 ?roomId=xxx 预填
  var preset = api.qs('roomId');
  if (preset) el.roomId.value = preset;

  el.back.addEventListener('click', function () { history.back(); });

  el.submit.addEventListener('click', function () {
    if (submitting) return;
    var roomId = (el.roomId.value || '').trim();
    if (!roomId) { api.toast('请输入房间号'); el.roomId.focus(); return; }

    submitting = true;
    el.submit.disabled = true;
    el.submit.textContent = '加入中...';
    api.call('room.join', { roomId: roomId, password: el.password.value })
      .then(function (room) {
        api.toast('加入成功');
        location.replace('room.html?id=' + encodeURIComponent(room.id));
      })
      .catch(function (err) {
        submitting = false;
        el.submit.disabled = false;
        el.submit.textContent = '加入房间';
        api.toast(err.message || '加入失败');
      });
  });
})();
