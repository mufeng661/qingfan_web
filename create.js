// 创建房间
(function () {
  'use strict';

  var api = window.QingfanApi;
  var el = {
    back: document.getElementById('back'),
    name: document.getElementById('name'),
    pwdSwitch: document.getElementById('pwdSwitch'),
    password: document.getElementById('password'),
    submit: document.getElementById('submit'),
  };
  var usePassword = false;
  var submitting = false;

  el.back.addEventListener('click', function () { history.back(); });

  el.pwdSwitch.addEventListener('click', function () {
    usePassword = !usePassword;
    el.pwdSwitch.classList.toggle('is-on', usePassword);
    el.pwdSwitch.setAttribute('aria-pressed', usePassword ? 'true' : 'false');
    el.password.hidden = !usePassword;
    if (usePassword) el.password.focus();
  });

  el.submit.addEventListener('click', function () {
    if (submitting) return;
    var name = (el.name.value || '').trim();
    if (!name) { api.toast('请输入房间名称'); el.name.focus(); return; }
    if (usePassword && !el.password.value) { api.toast('请输入房间密码或关闭密码'); el.password.focus(); return; }

    submitting = true;
    el.submit.disabled = true;
    el.submit.textContent = '创建中...';
    api.call('room.create', { name: name, password: usePassword ? el.password.value : '' })
      .then(function (room) {
        api.toast('创建成功');
        location.replace('room.html?id=' + encodeURIComponent(room.id));
      })
      .catch(function (err) {
        submitting = false;
        el.submit.disabled = false;
        el.submit.textContent = '创建房间';
        api.toast(err.message || '创建失败');
      });
  });
})();
