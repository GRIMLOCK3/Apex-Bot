// ══════════════════════════════════════════════
//   APEX Webhook Server
//   Free hosting on Render.com
//   Receives TradingView alerts → sends to Telegram
// ══════════════════════════════════════════════

const https = require('https');
const http  = require('http');

// ── CONFIG (set these as Environment Variables on Render) ──
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || 'YOUR_BOT_TOKEN';
const TELEGRAM_CHAT  = process.env.TELEGRAM_CHAT  || 'YOUR_CHAT_ID';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'apex2024'; // security key
const PORT           = process.env.PORT || 3000;

// ── SEND TELEGRAM ──────────────────────────────
function sendTelegram(message) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      chat_id:    TELEGRAM_CHAT,
      text:       message,
      parse_mode: 'HTML'
    });
    const options = {
      hostname: 'api.telegram.org',
      path:     `/bot${TELEGRAM_TOKEN}/sendMessage`,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(res.statusCode === 200));
    });
    req.on('error', () => resolve(false));
    req.write(body);
    req.end();
  });
}

// ── FORMAT SIGNAL MESSAGE ──────────────────────
function formatMessage(sig) {
  const isCall = sig.signal === 'CALL';
  const dir    = isCall ? '⬆️' : '⬇️';
  const now    = new Date().toLocaleTimeString('en-GB', {
    hour:'2-digit', minute:'2-digit', second:'2-digit', timeZone:'UTC'
  });

  // Clean pair name
  const pair = (sig.pair || 'UNKNOWN')
    .replace('OANDA:','').replace('FX:','')
    .replace('_','/').replace(':','');

  return (
    `🚨 <b>APEX SIGNAL</b> 🚨\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `💱 Pair: <b>${pair}</b>\n` +
    `${dir} Direction: <b>${sig.signal}</b>\n` +
    `${sig.strength || '✅ VALID'} — <b>${sig.score || '?'}/6 confirmations</b>\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `⏰ <b>Entry Time: ${now} UTC</b>\n` +
    `💰 Entry Price: <b>${parseFloat(sig.price||0).toFixed(5)}</b>\n` +
    `⏱ Timeframe: <b>${sig.tf || '5'} min</b>\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `🕯 Pattern: ${sig.pattern || 'N/A'}\n` +
    `📊 RSI: ${sig.rsi || 'N/A'}\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `⚠️ Risk max 2% of balance per trade!\n` +
    `🤖 Powered by APEX Signal Bot`
  );
}

// ── HTTP SERVER ────────────────────────────────
const server = http.createServer(async (req, res) => {
  // Health check
  if(req.method === 'GET' && req.url === '/'){
    res.writeHead(200, {'Content-Type':'text/plain'});
    res.end('APEX Signal Bot is running ✅');
    return;
  }

  // Webhook endpoint
  if(req.method === 'POST' && req.url.startsWith('/webhook')){
    // Check secret key in URL: /webhook?secret=apex2024
    const urlParts = req.url.split('?');
    const params   = new URLSearchParams(urlParts[1] || '');
    if(params.get('secret') !== WEBHOOK_SECRET){
      res.writeHead(401);
      res.end('Unauthorized');
      console.log('❌ Unauthorized webhook attempt');
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const signal = JSON.parse(body);
        console.log('📡 Signal received:', signal);

        const msg = formatMessage(signal);
        const ok  = await sendTelegram(msg);

        if(ok){
          console.log(`✅ Telegram sent: ${signal.signal} ${signal.pair}`);
          res.writeHead(200);
          res.end('OK');
        } else {
          console.log('❌ Telegram failed');
          res.writeHead(500);
          res.end('Telegram failed');
        }
      } catch(e) {
        console.log('❌ Parse error:', e.message, '| Body:', body);
        res.writeHead(400);
        res.end('Bad request');
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`🚀 APEX Webhook Server running on port ${PORT}`);
  console.log(`📡 Webhook URL: https://YOUR-APP.onrender.com/webhook?secret=${WEBHOOK_SECRET}`);
  sendTelegram('🚀 <b>APEX Webhook Server Started!</b>\n\nBot is online and ready to receive TradingView signals.');
});
