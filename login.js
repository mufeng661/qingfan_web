// 登录 / 注册（对齐鸿蒙端 Login.ets）
// - 登录：手机号 + 密码 → auth.login
// - 注册：用户名 + 手机号 + 密码 + 确认密码 + 验证码（演示码 1234）→ auth.register
// 成功后保存 token 与用户信息，跳回首页（app.html）。
(function () {
  'use strict';

  var api = window.QingfanApi;
  var auth = window.QingfanAuth;

  var el = {
    back: document.getElementById('back'),
    loggedPanel: document.getElementById('loggedPanel'),
    loggedName: document.getElementById('loggedName'),
    logoutBtn: document.getElementById('logoutBtn'),
    authPanel: document.getElementById('authPanel'),
    tabs: document.querySelectorAll('.tab'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    loginPhone: document.getElementById('loginPhone'),
    loginPwd: document.getElementById('loginPwd'),
    doLogin: document.getElementById('doLogin'),
    regName: document.getElementById('regName'),
    regPhone: document.getElementById('regPhone'),
    regPwd: document.getElementById('regPwd'),
    regPwd2: document.getElementById('regPwd2'),
    regCode: document.getElementById('regCode'),
    sendCode: document.getElementById('sendCode'),
    doRegister: document.getElementById('doRegister'),
  };

  var countdown = 0;
  var timer = null;

  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function isPhone(v) { return /^1[3-9]\d{9}$/.test(digits(v)); }

  function renderLogged() {
    var logged = auth.isLoggedIn();
    el.loggedPanel.hidden = !logged;
    el.authPanel.hidden = logged;
    if (logged) {
      var u = auth.getUser();
      el.loggedName.textContent = (u && (u.nickname || u.username)) || u.phone || '已登录';
    }
  }

  function setMode(mode) {
    Array.prototype.forEach.call(el.tabs, function (t) {
      t.classList.toggle('is-on', t.dataset.mode === mode);
    });
    el.loginForm.hidden = mode !== 'login';
    el.registerForm.hidden = mode !== 'register';
  }

  function startCountdown() {
    if (!isPhone(el.regPhone.value)) { api.toast('请输入正确的手机号'); el.regPhone.focus(); return; }
    countdown = 60;
    el.sendCode.disabled = true;
    el.sendCode.textContent = countdown + 's';
    timer = setInterval(function () {
      countdown -= 1;
      if (countdown <= 0) {
        clearInterval(timer);
        timer = null;
        el.sendCode.disabled = false;
        el.sendCode.textContent = '获取验证码';
      } else {
        el.sendCode.textContent = countdown + 's';
      }
    }, 1000);
    api.toast('验证码已发送（演示码 1234）');
  }

  function afterAuth(data) {
    auth.setSession(data.token, data.user);
    api.toast('登录成功');
    setTimeout(function () { location.href = 'app.html'; }, 400);
  }

  function doLogin() {
    if (!isPhone(el.loginPhone.value)) { api.toast('请输入正确的手机号'); el.loginPhone.focus(); return; }
    if ((el.loginPwd.value || '').length < 6) { api.toast('密码至少 6 位'); el.loginPwd.focus(); return; }
    el.doLogin.disabled = true;
    el.doLogin.textContent = '登录中…';
    api.call('auth.login', { phone: digits(el.loginPhone.value), password: el.loginPwd.value })
      .then(afterAuth)
      .catch(function (err) {
        el.doLogin.disabled = false;
        el.doLogin.textContent = '登录';
        api.toast(err.message || '登录失败');
      });
  }

  function doRegister() {
    var name = (el.regName.value || '').trim();
    if (name.length < 2) { api.toast('请输入用户名（至少 2 个字符）'); el.regName.focus(); return; }
    if (!isPhone(el.regPhone.value)) { api.toast('请输入正确的手机号'); el.regPhone.focus(); return; }
    if ((el.regPwd.value || '').length < 6) { api.toast('密码至少 6 位'); el.regPwd.focus(); return; }
    if (el.regPwd.value !== el.regPwd2.value) { api.toast('两次输入的密码不一致'); el.regPwd2.focus(); return; }
    if ((el.regCode.value || '').trim() !== '1234') { api.toast('验证码错误，演示码为 1234'); el.regCode.focus(); return; }

    el.doRegister.disabled = true;
    el.doRegister.textContent = '注册中…';
    api.call('auth.register', { username: name, phone: digits(el.regPhone.value), password: el.regPwd.value })
      .then(function (data) {
        auth.setSession(data.token, data.user);
        api.toast('注册成功');
        setTimeout(function () { location.href = 'app.html'; }, 500);
      })
      .catch(function (err) {
        el.doRegister.disabled = false;
        el.doRegister.textContent = '注册';
        api.toast(err.message || '注册失败');
      });
  }

  function doLogout() {
    if (!window.confirm('退出登录？')) return;
    auth.clearSession();
    renderLogged();
    api.toast('已退出登录');
  }

  el.back.addEventListener('click', function () { location.href = 'app.html'; });
  el.tabs.forEach(function (t) {
    t.addEventListener('click', function () { setMode(t.dataset.mode); });
  });
  el.doLogin.addEventListener('click', doLogin);
  el.doRegister.addEventListener('click', doRegister);
  el.sendCode.addEventListener('click', function () { if (!timer) startCountdown(); });
  el.logoutBtn.addEventListener('click', doLogout);
  [el.loginPhone, el.loginPwd].forEach(function (n) {
    n.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
  });
  [el.regName, el.regPhone, el.regPwd, el.regPwd2, el.regCode].forEach(function (n) {
    n.addEventListener('keydown', function (e) { if (e.key === 'Enter') doRegister(); });
  });

  el.loginPhone.value = '13800008888';
  renderLogged();
})();
