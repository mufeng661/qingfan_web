// 青番 Web · 统一后端配置
//
// 三端（微信小程序 / 鸿蒙 / Web）统一使用小程序环境与云函数 studyRoomFunctions，
// 数据全部落在该环境的 rooms_self / room_members_self / comments_self，天然共享。
//
// Web 无法使用 wx.cloud，因此通过 CloudBase HTTP 网关调用同一个云函数：
//   POST https://<envId>.api.tcloudbasegateway.com/v1/functions/studyRoomFunctions
//
// 两种接入方式，任选其一即可跑通：
//
// 方式 A（推荐）：用「客户端 Publishable Key」
//   控制台 → 云开发平台 / ApiKey 管理 → 复制客户端 Publishable Key，填到下面 accessKey。
//   Publishable Key 可暴露在浏览器，代表匿名权限，调用云函数时会以函数自身的服务端权限访问数据库。
//
// 方式 B：用「HTTP 访问服务」把云函数挂到一个免鉴权路由
//   控制台 → 环境管理 → HTTP 访问服务 → 新建路由（资源类型=云函数，资源对象=studyRoomFunctions，
//   身份认证=关闭），把生成的完整地址填到下面 fnUrl。
//
// accessKey 与 fnUrl 都留空时会走网关 /v1/functions 且不带鉴权，必然 401。
window.QINGFAN = {
  envId: 'cloud1-d5g8q89yd66340db4',
  fnName: 'studyRoomFunctions',
  gatewayBase: 'https://cloud1-d5g8q89yd66340db4.api.tcloudbasegateway.com',
  // 方式 A：客户端 Publishable Key（可暴露浏览器）
  accessKey: '',
  // 方式 B：云函数的 HTTP 访问地址，例如 https://xxx.tcloudbaseapp.com/studyRoom
  fnUrl: 'cloud1-d5g8q89yd66340db4-1493220082.ap-shanghai.app.tcloudbase.com/studyRoom',
};
