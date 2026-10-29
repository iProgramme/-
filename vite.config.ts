import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/balance/itusheng': {
            target: 'https://www.itusheng.xyz',
            changeOrigin: true,
            secure: false,
            rewrite: (path) => path.replace(/^\/api\/balance\/itusheng/, '/api/usage/token/')
          },
          '/api/balance': {
            target: 'https://api.vectorengine.cn',
            changeOrigin: true,
            secure: false,
            rewrite: (path) => path.replace(/^\/api\/balance/, '/api/usage/token/')
          }
        }
      },
      plugins: [
        react(),
        {
          name: 'balance-proxy-plugin',
          configureServer(server) {
            server.middlewares.use('/api/balance', async (req, res, next) => {
              if (req.method === 'OPTIONS') {
                res.writeHead(200, {
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Methods': 'GET,OPTIONS',
                  'Access-Control-Allow-Headers': '*'
                });
                res.end();
                return;
              }
              if (req.method !== 'GET') {
                return next();
              }
              try {
                const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
                const provider = url.searchParams.get('provider') || 'default';
                const customBaseUrl = url.searchParams.get('baseUrl');
                const targetBaseUrl = (customBaseUrl || (provider === 'itusheng' ? 'https://www.itusheng.xyz' : 'https://api.vectorengine.cn')).replace(/\/+$/, '');
                
                const authHeader = req.headers.authorization || '';
                const token = authHeader.replace(/^Bearer\s+/i, '') || url.searchParams.get('apiKey') || '';

                if (!token) {
                  res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                  res.end(JSON.stringify({ success: false, message: 'API key is required' }));
                  return;
                }

                console.log(`[Vite Proxy] Querying balance from ${targetBaseUrl}/api/usage/token/ for provider=${provider}`);

                const response = await fetch(`${targetBaseUrl}/api/usage/token/`, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${token}`
                  }
                });

                const data = await response.text();
                res.writeHead(response.status, {
                  'Content-Type': 'application/json; charset=utf-8',
                  'Access-Control-Allow-Origin': '*'
                });
                res.end(data);
              } catch (e: any) {
                console.error('[Vite Proxy] Balance query error:', e);
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ success: false, message: e.message || 'Proxy Error' }));
              }
            });
          }
        }
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
