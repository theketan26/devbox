import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { config } from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CLI arguments (e.g. --secret=..., --account=..., --issuer=..., --out=..., --no-png)
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
  --issuer=<NAME>         Issuer title (default: DevBox Infrastructure)
  --out=<PATH>            Custom PNG output file path (default: ./totp-qr.png)
  --no-png                Skip saving PNG file to disk
  --help, -h              Show this help message
`);
  process.exit(0);
}

const secret = (cliArgs.secret || config.masterTotpSecret || 'JBSWY3DPEHPK3PXP').trim();
const account = cliArgs.account || 'master@devbox.local';
const issuer = cliArgs.issuer || 'DevBox Infrastructure';
const outFilePath = cliArgs.outFile
  ? path.resolve(process.cwd(), cliArgs.outFile)
  : path.resolve(__dirname, '../../totp-qr.png');

async function main() {
  console.log('\n======================================================');
  console.log('       DEV BOX - 2FA TOTP AUTHENTICATOR SETUP         ');
  console.log('======================================================\n');

  // Generate standard TOTP otpauth URL
  const otpAuthUrl = authenticator.keyuri(account, issuer, secret);

  console.log(`Issuer  : ${issuer}`);
  console.log(`Account : ${account}`);
  console.log(`Secret  : ${secret}`);
  console.log(`URI     : ${otpAuthUrl}\n`);

  console.log('--- SCAN QR CODE WITH YOUR AUTHENTICATOR APP ---\n');

  try {
    // Generate ASCII/terminal QR code for immediate scanning directly from terminal
    const terminalQr = await QRCode.toString(otpAuthUrl, {
      type: 'terminal',
      small: true,
    });
    console.log(terminalQr);
  } catch (err) {
    console.error('Failed to render terminal QR code:', err.message);
  }

  // Save PNG image file if not disabled
  if (!cliArgs.noPng) {
    try {
      await QRCode.toFile(outFilePath, otpAuthUrl, {
        type: 'png',
        width: 320,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      console.log(`\n✓ QR Code PNG image saved to: ${outFilePath}`);
    } catch (err) {
      console.error('Failed to write QR image file:', err.message);
    }
  }

  // Generate manual entry grouping (e.g. 4-letter chunks)
  const formattedSecret = secret.match(/.{1,4}/g)?.join(' ') || secret;
  console.log(`\nManual Entry Key (Base32): ${formattedSecret}`);

  // Display current valid TOTP code and countdown to expiry
  const currentOtp = authenticator.generate(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const remainingSeconds = 30 - (epoch % 30);

  console.log('\n------------------------------------------------------');
  console.log(`Current Test OTP Code : [ ${currentOtp} ]`);
  console.log(`Valid for next        : ${remainingSeconds}s`);
  console.log('------------------------------------------------------\n');
  console.log('Tips:');
  console.log('1. Scan the terminal QR code using Google Authenticator, Authy, Microsoft Authenticator, or 1Password.');
  console.log('2. Or open the generated PNG file if your terminal font distorts the QR.');
  console.log('3. Compare the 6-digit code in your app with "Current Test OTP Code" above to confirm synchronization.\n');
}

main().catch((err) => {
  console.error('Error generating TOTP QR:', err);
  process.exit(1);
});
