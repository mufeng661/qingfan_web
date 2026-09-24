// 青番 Web · 用户身份 / 登录态
//
// 登录后：userId = 手机号（与鸿蒙/小程序同一套账号），所有请求带 token。
// 未登录：退化为设备 UUID 游客身份。
//
// 登录/注册页见 login.html + login.js；token 由云函数 auth.register / auth.login 签发。

(function () {
  'use strict';

  var ID_KEY = 'qingfan:userId';
  var TOKEN_KEY = 'qingfan:token';
  var USER_KEY = 'qingfan:user';
  var NICK_KEY = 'qingfan:nickname';

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function deviceId() {
    var id = '';
    try { id = localStorage.getItem(ID_KEY) || ''; } catch (e) { id = ''; }
    if (!id) {
      id = uuid();
      try { localStorage.setItem(ID_KEY, id); } catch (e) { /* ignore */ }
    }
    return id;
  }

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }

  function getUser() {
    try {
      var s = localStorage.getItem(USER_KEY);
      return s ? JSON.parse(s) : null;
    } catch (e) { return null; }
  }

  function isLoggedIn() {
    return !!getToken() && !!getUser();
  }

  function setSession(token, user) {
    try {
      localStorage.setItem(TOKEN_KEY, token || '');
      localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
      if (user && (user.nickname || user.username)) {
        localStorage.setItem(NICK_KEY, user.nickname || user.username);
      }
    } catch (e) { /* ignore */ }
  }

  function clearSession() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) { /* ignore */ }
  }

  // 登录后为手机号（后端用 token 解析），未登录为设备 UUID
  function getUserId() {
    var u = getUser();
    if (u && u.phone) return u.phone;
    return deviceId();
  }

  function getNickname() {
    var u = getUser();
    if (u && (u.nickname || u.username)) return u.nickname || u.username;
    try { return localStorage.getItem(NICK_KEY) || ''; } catch (e) { return ''; }
  }

  function setNickname(name) {
    try { localStorage.setItem(NICK_KEY, String(name || '').slice(0, 20)); } catch (e) { /* ignore */ }
  }

  window.QingfanAuth = {
    getUserId: getUserId,
    getNickname: getNickname,
    setNickname: setNickname,
    getToken: getToken,
    getUser: getUser,
    isLoggedIn: isLoggedIn,
    setSession: setSession,
    clearSession: clearSession,
  };
})();
