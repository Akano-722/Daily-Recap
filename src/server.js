import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { composeDailyRecap } from './recap.js';

const PORT = Number(process.env.PORT || 3000);
const MCP_TOKEN = process.env.MCP_TOKEN || '';
const transports = new Map();

function requireAuth(req, res, next) {
  if (!MCP_TOKEN) return next();

  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${MCP_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}

function createServer() {
  const server = new McpServer({
    name: 'qiu-daily-recap-mcp',
    version: '1.0.0'
  });

  server.tool(
    'daily_recap',
    '在 23:50 晚间日记或睡前提醒流程中，把今天压缩成 Bark 短推送和窗口完整总结。不负责定时，不负责主动唤醒 Claude。',
    {
      date: z.string().optional().describe('日期，例如 2026-05-12。Claude 应先调用时间工具再填入。'),
      current_time: z.string().optional().describe('当前时间，例如 23:50。Claude 应先调用时间工具再填入。'),
      timezone: z.string().optional().describe('时区，例如 Asia/Shanghai 或 America/Los_Angeles。'),
      mode: z.string().optional().describe('触发模式，默认 night_diary。'),
      day_context: z.string().min(1).describe('今天的主要内容。由 Claude 根据当天对话、记忆、activity trace 等材料整理。'),
      highlights: z.array(z.string()).optional().describe('今天值得留下的 1-6 个要点。'),
      unresolved_items: z.array(z.string()).optional().describe('今天尚未解决、明天可能继续的事项。'),
      tomorrow_focus: z.array(z.string()).optional().describe('明天建议继续推进的 1-3 件事。'),
      emotional_weather: z.string().optional().describe('一句话情绪天气，可留空。'),
      user_state: z.string().optional().describe('用户当前状态，例如还在线、准备睡觉、正在收尾。'),
      include_sleep_note: z.boolean().optional().describe('是否生成睡前提醒，默认 true。'),
      sleep_note: z.string().optional().describe('自定义睡前提醒。'),
      push_title: z.string().optional().describe('自定义 Bark 标题，建议很短。'),
      push_subtitle: z.string().optional().describe('自定义 Bark 副标题，建议很短。'),
      push_body: z.string().optional().describe('自定义 Bark 内容，必须短，避免横幅省略。'),
      push_level: z.string().optional().describe('Bark level，默认 timeSensitive。'),
      push_group: z.string().optional().describe('Bark group，默认 qiu-daily-recap。')
    },
    async (args) => {
      const result = composeDailyRecap(args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    }
  );

  server.tool(
    'daily_recap_rules',
    '返回 Daily Recap 的使用规则，供 Claude 在晚间日记流程中自检。',
    {},
    async () => ({
      content: [
        {
          type: 'text',
          text: [
            'Daily Recap 不是定时器，也不是后台任务。',
            '它只在 Claude 已经因日记流程或用户对话被唤醒时调用。',
            '调用前必须先调用时间工具确认当前日期、时间和时区。',
            '当时间接近 23:50，且正在写每日总结、日记、睡前提醒或晚间收束时，默认调用 daily_recap。',
            'Bark 只发短版，完整总结输出在当前对话窗口。',
            '如接入 Ombre Brain，可在输出后将 recap 或压缩版交给 grow 归档。'
          ].join('\n')
        }
      ]
    })
  );

  return server;
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', name: 'qiu-daily-recap-mcp', version: '1.0.0' });
});

app.post('/mcp', requireAuth, async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'];
    let transport = sessionId ? transports.get(sessionId) : undefined;

    if (!transport) {
      if (!isInitializeRequest(req.body)) {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
          id: null
        });
      }

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true
      });

      transport.onclose = () => {
        if (transport.sessionId) transports.delete(transport.sessionId);
      };

      const server = createServer();
      await server.connect(transport);
    }

    await transport.handleRequest(req, res, req.body);

    if (transport.sessionId) {
      transports.set(transport.sessionId, transport);
    }
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error?.message || String(error) });
    }
  }
});

app.get('/mcp', requireAuth, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  const transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport) {
    return res.status(400).send('Invalid or missing session ID');
  }

  await transport.handleRequest(req, res);
});

app.delete('/mcp', requireAuth, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  const transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport) {
    return res.status(400).send('Invalid or missing session ID');
  }

  await transport.handleRequest(req, res);
});

app.listen(PORT, () => {
  console.log(`qiu-daily-recap-mcp listening on :${PORT}`);
});
