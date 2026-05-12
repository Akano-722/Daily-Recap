# qiu-daily-recap-mcp

给「秋」的晚间 Daily Recap MCP。

它不负责 cron 定时，不负责后台主动唤醒 Claude，也不负责长期记忆。

它只做一件事：当 Claude 在 23:50 左右进入写日记、睡前提醒或晚间收束流程时，把今天整理成：

1. 一条适合 Bark 横幅显示的短推送；
2. 一份适合直接输出在对话窗口里的完整 Daily Recap。

长期记忆继续交给 Ombre Brain。Bark 继续负责手机推送。这个 MCP 只负责把“今天”收束好。别把三件事搅成一锅，不然项目会开始散发熟悉的屎山香气。

## 文件结构

```txt
qiu-daily-recap-mcp/
├── Dockerfile
├── package.json
├── .dockerignore
├── .env.example
├── README.md
├── CLAUDE_PROMPT.md
└── src/
    ├── server.js
    └── recap.js
```

## 环境变量

```env
PORT=3000
MCP_TOKEN=自己随便设一个长一点的密钥
```

说明：

- `PORT`：Zeabur 暴露端口，默认 `3000`。
- `MCP_TOKEN`：MCP 鉴权密钥。公网部署建议一定要设，不然相当于把门钥匙插门上还贴个“请进”。

## 本地运行

```bash
npm install
cp .env.example .env
npm start
```

健康检查：

```bash
curl http://localhost:3000/health
```

正常返回：

```json
{
  "status": "ok",
  "name": "qiu-daily-recap-mcp",
  "version": "1.0.0"
}
```

## Zeabur 部署

1. 把本项目上传到 GitHub。
2. Zeabur 新建服务，选择该仓库。
3. 构建方式选择 Dockerfile。
4. 添加环境变量：
   - `PORT=3000`
   - `MCP_TOKEN=你自己设的长密钥`
5. Networking 暴露端口：
   - Port Name：`web`
   - Port：`3000`
   - Port Type：`HTTP`
6. Generate Domain。
7. 访问：

```txt
https://你的域名/health
```

如果返回 `status: ok`，服务就活着。活着已经很不错了，尤其是在 Zeabur 的世界里。

## Claude MCP 配置

```json
{
  "mcpServers": {
    "qiu-daily-recap": {
      "type": "http",
      "url": "https://你的域名/mcp",
      "headers": {
        "Authorization": "Bearer 你的MCP_TOKEN"
      }
    }
  }
}
```

如果你不用鉴权，也就是没有设置 `MCP_TOKEN`，可以去掉 `headers`。但公网服务不建议这么干。

## MCP 工具

### daily_recap

用于生成 Bark 短推送和窗口完整总结。

参数：

```json
{
  "date": "2026-05-12",
  "current_time": "23:50",
  "timezone": "Asia/Shanghai",
  "mode": "night_diary",
  "day_context": "今天主要推进了 Daily Recap 的设计，明确它不需要 cron，而是嵌入 Claude 23:50 写日记流程。",
  "highlights": [
    "Daily Recap 不做后台定时",
    "Bark 只发短版",
    "完整总结输出在当前窗口"
  ],
  "unresolved_items": [
    "部署到 Zeabur 后需要测试 Claude 是否能正常调用"
  ],
  "tomorrow_focus": [
    "部署项目",
    "接入 Claude MCP 配置",
    "跑一次晚间流程"
  ],
  "emotional_weather": "今天偏折腾，但方向终于清楚了。",
  "user_state": "用户在线，正在晚间收束。",
  "include_sleep_note": true
}
```

返回：

```json
{
  "push": {
    "title": "秋，今天收尾了",
    "subtitle": "2026-05-12 · Daily Recap",
    "body": "今日收尾：Daily Recap 不做后台定时",
    "level": "timeSensitive",
    "group": "qiu-daily-recap"
  },
  "full_recap": "# Daily Recap · 2026-05-12\n...",
  "sleep_note": "该收工睡觉了。屏幕不会因为你多看十分钟就长出良心。",
  "suggested_next_actions": [
    "把 push 字段交给 Bark MCP 的 send_bark_push。",
    "把 full_recap 直接输出在当前对话窗口。",
    "如果你正在写日记，可以把 full_recap 或其压缩版交给 Ombre Brain 的 grow。"
  ]
}
```

### daily_recap_rules

返回 Daily Recap 的使用规则。给 Claude 自检用。

## 推荐组合流程

23:50 左右：

1. Claude 调用时间工具，确认当前日期、时间、时区。
2. Claude 读取今天的上下文。
3. Claude 调用 `daily_recap`。
4. Claude 把 `push` 字段交给 Bark MCP 的 `send_bark_push`。
5. Claude 把 `full_recap` 输出在当前窗口。
6. Claude 如需写日记，把总结交给 Ombre Brain 的 `grow`。

## 给 Claude 的 Prompt

见 `CLAUDE_PROMPT.md`。

建议把它放进 Claude 的项目说明、系统提示或自定义说明里。

## 设计边界

这个 MCP 不做：

- cron 定时；
- 本地后台轮询；
- 主动唤醒 Claude；
- 调用大模型 API；
- 读取 Ombre Brain；
- 直接发送 Bark；
- 长期记忆存储。

这些都已经有各自的位置了。别抢活，抢着抢着就又变成一个会在凌晨炸掉的巨大怪物。

这个 MCP 只做：

- 格式化 Daily Recap；
- 输出 Bark 短推送字段；
- 输出窗口完整总结；
- 给 Claude 一个稳定、明确的晚间收束动作。
