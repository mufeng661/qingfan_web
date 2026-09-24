# 青番 Web（qingfan_web）

青番 App 的 Web 端自习室。与**微信小程序**、**鸿蒙端**共用同一套 CloudBase 后端（云函数 `studyRoomFunctions`），房间、成员、留言、账号数据三端互通。

## 功能

- **自习室首页**：我的自习室（渐变卡）、自习动态、留言板、好友的自习室；创建房间弹窗（名称 + 主题）
- **创建 / 加入房间**：房间号加入、可选房间密码
- **房间详情**：成员列表、房间交流（回复 / 点赞 / 删除 / 分页加载）
- **登录 / 注册**：手机号 + 密码登录；用户名 + 手机号 + 密码 + 验证码注册；登录态本地保存

## 目录结构

```
.
├── index.html      自习室首页
├── create.html     创建房间
├── join.html       加入房间
├── room.html       房间详情（成员 + 交流）
├── login.html      登录 / 注册
├── home.js         首页逻辑
├── create.js       创建房间逻辑
├── join.js         加入房间逻辑
├── room.js         房间详情逻辑
├── login.js        登录 / 注册逻辑
├── config.js       后端配置（环境 / 云函数 / 访问地址）
├── auth.js         用户身份与登录态（token / user）
├── api.js          云函数调用客户端 call(action, data)
├── styles.css      样式（对齐鸿蒙端「青番绿」主题）
└── serve.js        本地静态服务器（无需依赖）
```

## 本地运行

```bash
node serve.js
# 打开 http://localhost:5173
```

> ⚠️ 不要用 `file://` 直接打开 `index.html`（浏览器会发 `Origin: null`，后端会拒绝）。必须用 HTTP 服务访问。

## 后端配置（config.js）

三端统一使用云函数 `studyRoomFunctions`（环境 `cloud1-d5g8q89yd66340db4`）。Web 无法使用 `wx.cloud`，通过 CloudBase HTTP 调用：

```js
window.QINGFAN = {
  envId: 'cloud1-d5g8q89yd66340db4',
  fnName: 'studyRoomFunctions',
  gatewayBase: 'https://cloud1-d5g8q89yd66340db4.api.tcloudbasegateway.com',
  accessKey: '',              // 方式 A：客户端 Publishable Key（走网关时需要）
  fnUrl: '',                  // 方式 B：云函数 HTTP 访问地址（免鉴权路由）
};
```

两种接入方式任选其一：

- **方式 A**：控制台获取客户端 Publishable Key 填入 `accessKey`，走网关 `/v1/functions/...`
- **方式 B**：在「HTTP 访问服务」把云函数挂到免鉴权路由，把完整地址填入 `fnUrl`

## 云函数接口（action）

| action | 说明 |
|---|---|
| `auth.register` | 注册（username / phone / password） |
| `auth.login` | 登录（phone / password），返回 token + user |
| `auth.profile` | 查询当前用户（需 token） |
| `room.create` / `room.join` / `room.listMine` / `room.get` / `room.leave` / `room.delete` | 房间相关 |
| `comment.list` / `comment.add` / `comment.delete` / `comment.like` | 房间交流相关 |

请求格式：`POST` JSON `{ action, userId, platform, token?, ...data }`，响应 `{ success, data }` 或 `{ success:false, error:{ code, message } }`。

## 数据表

| 表 | 用途 |
|---|---|
| `users_self` | 账号（手机号 / 用户名 / 密码哈希） |
| `rooms_self` | 房间（房主、密码哈希、软删除） |
| `room_members_self` | 房间成员关系（role: owner / member） |
| `comments_self` | 房间交流（`project_id` = 房间号） |

## 说明

- 登录后身份为手机号，未登录为设备 UUID 游客身份，两者数据相互独立。
- 房间「主题」云端暂无对应字段，仅本地 `localStorage` 保存，用于展示。
- 直连 `github.com:443` 可能受限，推送时可走本地代理：`git -c http.proxy=http://127.0.0.1:7897 push`。
