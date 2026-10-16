import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { config } from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (const arg of args) {
    if (arg.startsWith('--secret=')) {
      parsed.secret = arg.split('=')[1].trim();
    } else if (arg.startsWith('--account=')) {
      parsed.account = arg.split('=')[1].trim();
    } else if (arg.startsWith('--issuer=')) {
      parsed.issuer = arg.split('=')[1].trim();
    } else if (arg.startsWith('--out=')) {
      parsed.outFile = arg.split('=')[1].trim();
    } else if (arg === '--live' || arg === '-w' || arg === '--watch') {
      parsed.live = true;
    } else if (arg === '--no-png') {
      parsed.noPng = true;
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    }
  }
  return parsed;
}

const cliArgs = parseArgs();

if (cliArgs.help) {
  console.log(`
DevBox TOTP Authenticator QR Generator
=======================================
Usage:
  node server/scripts/generate-totp-qr.js [options]

Options:
  --secret=<BASE32_KEY>   Custom base32 secret (defaults to MASTER_TOTP_SECRET from .env)
  --account=<NAME>        Account label (default: master@devbox.local)
  --issuer=<NAME>         Issuer title (default: DevBox)
  --out=<PATH>            Custom PNG output file path (default: ./totp-qr.png)
  --live, -w              Run live monitor ticking with current OTP every second
  --no-png                Skip saving PNG and HTML files to disk
  --help, -h              Show this help message
`);
  process.exit(0);
}

const secret = (cliArgs.secret || config.masterTotpSecret || 'JBSWY3DPEHPK3PXP').trim();
const account = cliArgs.account || 'master@devbox.local';
const issuer = cliArgs.issuer || 'DevBox';
const outPngPath = cliArgs.outFile
  ? path.resolve(process.cwd(), cliArgs.outFile)
  : path.resolve(__dirname, '../../totp-qr.png');
const outHtmlPath = path.resolve(__dirname, '../../totp-qr.html');

// Standard, universally compatible otpauth URI (works in Google Authenticator, Microsoft Authenticator, Authy, etc.)
const otpAuthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;

async function main() {
  console.log('\n================================================================');
  console.log('            DEV BOX - 2FA TOTP SETUP & QR GENERATOR             ');
  console.log('================================================================\n');

  console.log(`Issuer  : ${issuer}`);
  console.log(`Account : ${account}`);
  console.log(`Secret  : ${secret}`);
  console.log(`URI     : ${otpAuthUrl}\n`);

  console.log('--- SCAN QR CODE (NORMAL TERMINAL CONTRAST) ---\n');
  try {
    const normalQr = await QRCode.toString(otpAuthUrl, {
      type: 'terminal',
      small: true
    });
    console.log(normalQr);
  } catch (err) {
    console.error('Failed to render terminal QR:', err.message);
  }

  // Generate PNG and standalone HTML helper
  let dataUrl = '';
  try {
    dataUrl = await QRCode.toDataURL(otpAuthUrl, { width: 320, margin: 2 });
  } catch (err) {
    console.error('Failed to generate QR data URL:', err.message);
  }

  if (!cliArgs.noPng) {
    try {
      await QRCode.toFile(outPngPath, otpAuthUrl, {
        type: 'png',
        width: 320,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });
      console.log(`✓ Image saved: ${outPngPath}`);
    } catch (err) {
      console.error('Failed to save PNG:', err.message);
    }

    try {
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DevBox 2FA Authenticator Setup</title>
  <style>
    body {
      background: #0d1117;
      color: #c9d1d9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .card {
      background: #161b22;
      border: 3px solid #30363d;
      border-radius: 12px;
      padding: 32px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 16px 32px rgba(0,0,0,0.4);
    }
    h1 { color: #58a6ff; font-size: 1.4rem; margin-top: 0; margin-bottom: 8px; }
    p { font-size: 0.9rem; color: #8b949e; line-height: 1.4; margin-bottom: 20px; }
    .qr-container {
      background: #ffffff;
      padding: 16px;
      border-radius: 8px;
      display: inline-block;
      margin-bottom: 20px;
      border: 2px solid #58a6ff;
    }
    .qr-container img { display: block; width: 260px; height: 260px; }
    .key-box {
      background: #0d1117;
      border: 1px dashed #30363d;
      padding: 12px;
      border-radius: 6px;
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: 2px;
      color: #7ee787;
      margin-bottom: 20px;
      word-break: break-all;
      user-select: all;
    }
    .otp-display {
      background: #1f242c;
      border: 2px solid #238636;
      border-radius: 8px;
      padding: 16px;
      margin-top: 10px;
    }
    .otp-code {
      font-size: 2rem;
      font-weight: 900;
      letter-spacing: 6px;
      color: #56d364;
    }
    .timer-bar {
      margin-top: 10px;
      font-size: 0.85rem;
      color: #8b949e;
    }
    .instructions {
      text-align: left;
      font-size: 0.8rem;
      color: #8b949e;
      margin-top: 24px;
      border-top: 1px solid #30363d;
      padding-top: 16px;
    }
    .instructions ol { padding-left: 20px; margin: 0; }
    .instructions li { margin-bottom: 6px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>DevBox Authenticator Setup</h1>
    <p>Scan the QR code below using Google Authenticator, Microsoft Authenticator, or 1Password.</p>
    <div class="qr-container">
      <img src="${dataUrl}" alt="DevBox TOTP QR Code" />
    </div>

    <div style="font-size: 0.8rem; font-weight: bold; color: #8b949e; margin-bottom: 6px; text-transform: uppercase;">
      Manual Setup Key
    </div>
    <div class="key-box" title="Click to select">${secret}</div>

    <div class="otp-display">
      <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: bold; color: #8b949e; margin-bottom: 4px;">
        Live Code (For Verification)
      </div>
      <div id="live-otp" class="otp-code">------</div>
      <div id="countdown" class="timer-bar">Refreshing in --s</div>
    </div>

    <div class="instructions">
      <ol>
        <li>Open <strong>Google Authenticator</strong> or <strong>Microsoft Authenticator</strong> on your phone.</li>
        <li>Tap <strong>+</strong> and select <strong>Scan a QR code</strong> (or <strong>Enter a setup key</strong> and paste key <code>${secret}</code>).</li>
        <li>The 6-digit code shown in your app should match the live code above!</li>
      </ol>
    </div>
  </div>

  <script type="module">
    import { authenticator } from 'https://cdn.jsdelivr.net/npm/otplib@12.0.1/+esm';
    const secret = "${secret}";

    function updateCode() {
      try {
        const code = authenticator.generate(secret);
        const epoch = Math.floor(Date.now() / 1000);
        const remaining = 30 - (epoch % 30);
        document.getElementById('live-otp').textContent = code;
        document.getElementById('countdown').textContent = 'Changes in ' + remaining + 's';
      } catch (e) {
        document.getElementById('live-otp').textContent = "ERROR";
      }
    }
    updateCode();
    setInterval(updateCode, 1000);
  </script>
</body>
</html>`;
      fs.writeFileSync(outHtmlPath, htmlContent, 'utf-8');
      console.log(`✓ Web preview saved: ${outHtmlPath}`);
    } catch (err) {
      console.error('Failed to save HTML preview:', err.message);
    }
  }

  const formattedSecret = secret.match(/.{1,4}/g)?.join(' ') || secret;
  console.log(`\n================================================================`);
  console.log(`MANUAL SETUP KEY (If phone camera cannot scan terminal):`);
  console.log(`Key (Base32) :  ${secret}  (${formattedSecret})`);
  console.log(`Account Name :  ${account}`);
  console.log(`Type of key  :  Time based (TOTP)`);
  console.log(`================================================================\n`);

  function printCurrentOtp() {
    const currentOtp = authenticator.generate(secret);
    const epoch = Math.floor(Date.now() / 1000);
    const remainingSeconds = 30 - (epoch % 30);
    process.stdout.write(`\rCurrent 6-Digit OTP: [ \x1b[32m\x1b[1m${currentOtp}\x1b[0m ] | Valid for next: \x1b[33m${remainingSeconds}s\x1b[0m `);
  }

  if (cliArgs.live) {
    console.log('Running live TOTP monitor (Press Ctrl+C to exit)...');
    printCurrentOtp();
    setInterval(printCurrentOtp, 1000);
  } else {
    printCurrentOtp();
    console.log('\n\n--- INSTRUCTIONS ---');
    console.log('1. In Google Authenticator, tap [+] then "Scan a QR code".');
    console.log('   - If scanning from terminal fails due to font scaling or dark background:');
    console.log(`   - Open file://${outHtmlPath} in your browser and scan the crisp image.`);
    console.log('   - OR tap [+] -> "Enter a setup key" and enter: ' + secret);
    console.log('2. Once added, the 6-digit code in your app will match the OTP above.\n');
  }
}

main().catch((err) => {
  console.error('Error generating TOTP QR:', err);
  process.exit(1);
});
