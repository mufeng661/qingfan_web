// 青番 Web · 云函数调用客户端
//
// 与小程序 utils/api.js 的 call(action, data) 完全同构：
//   wx.cloud.callFunction({ name, data: { action, ...data } })
// Web 改为 HTTP POST 到同一云函数，返回 { success, data, error }。

(function () {
  'use strict';

  function endpoint() {
    if (window.QINGFAN.fnUrl) {
      // 容错：漏写协议时自动补 https://，避免被当成相对路径打到本地
      var url = String(window.QINGFAN.fnUrl).trim();
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      return url;
    }
    return window.QINGFAN.gatewayBase + '/v1/functions/' + window.QINGFAN.fnName;
  }

  function headers() {
    var h = {
      'Content-Type': 'application/json; charset=utf-8',
      'x-user-id': window.QingfanAuth.getUserId(),
      'x-user-platform': 'web',
    };
    var token = window.QingfanAuth.getToken();
    if (token) h['x-user-token'] = token;
    if (window.QINGFAN.accessKey) {
      h.Authorization = 'Bearer ' + window.QINGFAN.accessKey;
    }
    return h;
  }

  async function call(action, data) {
    // userId 同时通过「请求体」和「请求头」下发：
    //  - 网关 /v1/functions 调用时，云函数收到的是事件体（读 event.userId）
    //  - HTTP 访问服务路由调用时，云函数收到的是 HTTP 事件（读 x-user-id 头）
    // 已登录时再带 token，后端优先用 token 解析出手机号作为身份。
    var payload = Object.assign(
      { action: action, userId: window.QingfanAuth.getUserId(), platform: 'web' },
      data || {}
    );
    var token = window.QingfanAuth.getToken();
    if (token) payload.token = token;
    var res;
    try {
      res = await fetch(endpoint(), {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload),
      });
    } catch (e) {
      throw new Error('网络异常，请检查连接后重试');
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error('后端未授权：请在 config.js 配置 Publishable Key（accessKey），或把云函数挂到免鉴权的 HTTP 访问路由（fnUrl）');
    }

    var raw;
    try {
      raw = await res.json();
    } catch (e) {
      throw new Error('服务返回异常（HTTP ' + res.status + '）');
    }

    // 兼容网关可能的包裹形态：{success,data} / {result:{success,data}}
    var result = raw && raw.success !== undefined ? raw : (raw && raw.result) || raw;

    if (!result || !result.success) {
      throw new Error((result && result.error && result.error.message) || '请求失败');
    }
    return result.data;
  }

  function formatTime(value) {
    if (value === undefined || value === null || value === '') return '';
    var ms = Number(value);
    var date = new Date(Number.isFinite(ms) ? ms : value);
    if (isNaN(date.getTime())) return String(value);
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
      ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  function toast(message, kind) {
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' toast--' + kind : '');
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('is-show'); });
    setTimeout(function () {
      el.classList.remove('is-show');
      setTimeout(function () { el.remove(); }, 220);
    }, 1800);
  }

  function qs(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : '';
  }

  window.QingfanApi = {
    call: call,
    formatTime: formatTime,
    toast: toast,
    qs: qs,
  };
})();
