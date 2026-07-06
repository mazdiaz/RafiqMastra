import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { startLiteLLMProxy } from './litellm-proxy.mjs';

const proxyPort = Number(process.env.LITELLM_PROXY_PORT || 4120);
const server = await startLiteLLMProxy({ port: proxyPort });

const mastraEntrypoint = resolve('node_modules/mastra/dist/index.js');

const mastra = spawn(process.execPath, [mastraEntrypoint, 'dev'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    OPENAI_BASE_URL: `http://localhost:${proxyPort}/v1`,
  },
});

function shutdown(signal) {
  server.close();

  if (!mastra.killed) {
    mastra.kill(signal);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

mastra.on('error', (error) => {
  console.error('Gagal menjalankan Mastra:', error);

  server.close(() => {
    process.exit(1);
  });
});

mastra.on('exit', (code, signal) => {
  server.close(() => {
    if (signal && process.platform !== 'win32') {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });
});
