import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-ignore
import fs from 'fs'
// @ts-ignore
import path from 'path'
// @ts-ignore
import { exec } from 'child_process'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-fundamental-analysis',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const reqUrl = (req as any).url;
          const parsedUrl = reqUrl ? reqUrl.split('?')[0] : '';
          if (reqUrl && reqUrl.startsWith('/fundamental-analysis/')) {
            const fileName = reqUrl.replace(/^\/fundamental-analysis\//, '').split('?')[0];
            // @ts-ignore
            let filePath = path.resolve((process as any).cwd(), '../data/outputs', fileName);
            if (!fs.existsSync(filePath)) {
              // Fallback to ticker-specific technical analysis subfolder
              filePath = path.resolve((process as any).cwd(), '../data/outputs/tickers/technical', fileName);
            }
            if (fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/json');
              res.end(fs.readFileSync(filePath));
              return;
            } else {
              res.statusCode = 404;
              res.end(`${fileName} not found`);
              return;
            }
          }
          if (reqUrl && (reqUrl.startsWith('/tickers/technical/') || reqUrl.startsWith('/technical-data/'))) {
            const fileName = reqUrl.replace(/^\/(tickers\/technical|technical-data)\//, '').split('?')[0];
            if (fileName.endsWith('.json')) {
              // @ts-ignore
              const filePath = path.resolve((process as any).cwd(), '../data/outputs/tickers/technical', fileName);
              if (fs.existsSync(filePath)) {
                res.setHeader('Content-Type', 'application/json');
                res.end(fs.readFileSync(filePath));
                return;
              }
            }
          }
          if (reqUrl && reqUrl.startsWith('/data/inputs/')) {
            const fileName = reqUrl.replace(/^\/data\/inputs\//, '').split('?')[0];
            // @ts-ignore
            const filePath = path.resolve((process as any).cwd(), '../data/inputs', fileName);
            if (fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/json');
              res.end(fs.readFileSync(filePath));
              return;
            }
          }
          if (reqUrl) {
            const parsedUrl = reqUrl.split('?')[0];
            if (parsedUrl === '/default_scan.csv') {
              // @ts-ignore
              const filePath = path.resolve((process as any).cwd(), '../data/outputs/latest_scan.csv');
              if (fs.existsSync(filePath)) {
                res.setHeader('Content-Type', 'text/csv');
                res.end(fs.readFileSync(filePath));
                return;
              }
            }
          }
          if (parsedUrl === '/theme_tracker.json' || parsedUrl === '/etfs_tracker.json' || parsedUrl === '/market_regime.json' || parsedUrl === '/strategy_lab.json') {
            // @ts-ignore
            const fileName = parsedUrl.substring(1);
            const filePath = path.resolve((process as any).cwd(), '../data/outputs', fileName);


            if (fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
              res.end(fs.readFileSync(filePath));
              return;
            } else {
              res.statusCode = 404;
              res.end(`${fileName} not found`);
              return;
            }
          }
          if (reqUrl === '/api/config') {
            // @ts-ignore
            const configPath = path.resolve(process.cwd(), '../config.yaml');
            if (fs.existsSync(configPath)) {
              const content = fs.readFileSync(configPath, 'utf8');
              const matchStocks = content.match(/rs_stocks_url:\s*["']?([^"'\n]+)/);
              const matchIndustries = content.match(/rs_industries_url:\s*["']?([^"'\n]+)/);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                rs_stocks_url: matchStocks ? matchStocks[1].trim() : 'https://raw.githubusercontent.com/Fred6725/rs-log/main/output/rs_stocks.csv',
                rs_industries_url: matchIndustries ? matchIndustries[1].trim() : 'https://raw.githubusercontent.com/Fred6725/rs-log/main/output/rs_industries.csv'
              }));
              return;
            }
          }
          if (reqUrl === '/api/run-backtest') {
            exec('uv run python src/main.py --no-ui', { cwd: path.resolve((process as any).cwd(), '..') }, (error: any, _stdout: any, stderr: any) => {
              if (error) {
                res.statusCode = 500;
                res.end(JSON.stringify({ status: 'error', message: stderr || error.message }));
                return;
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: 'success' }));
            });
            return;
          }

          next();
        });
      }
    }
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000,
      },
      '/yf-api': {
        target: 'https://query2.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yf-api/, ''),
      }
    }
  }
})
