import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from multiple potential runtime paths (local dev, server dir, Docker root)
const envPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(process.cwd(), 'server/.env'),
  path.resolve(process.cwd(), '.env')
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}
dotenv.config(); // fallback to default process.env

// Default Supabase project credentials for DevBox
const DEFAULT_SUPABASE_URL = 'https://tocdtmbnghwamhodkbel.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_6QPVr0zdlPNYvzXTErhZ8g_0MxBuMAM';

function cleanEnvVal(val) {
  if (!val) return '';
  return String(val).trim().replace(/^["']|["']$/g, '');
}

const resolvedSupabaseUrl = cleanEnvVal(
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  DEFAULT_SUPABASE_URL
);

const resolvedSupabaseKey = cleanEnvVal(
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_KEY
);

export const config = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET || 'devbox-zhUnynJsRgeOByuMQd4q5t1nhpUb7D33',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'devbox-rgEve9HXq6yBwmQMbGJP4sFYmrwsGXSo',
  aesMasterKey: process.env.AES_MASTER_KEY || 'vMyvvXhLsy9inBx9U72X3M7uZdyE73fmCdtwgtfYw7ab0kU9AaiUeWN1q2tZXupo',
  cliMasterKey: process.env.DEVBOX_CLI_MASTER_KEY || 'devbox-Cnq05kd9pXYHWPHW0gmO0erMfnK3LNz9',
  cronSecret: process.env.CRON_SECRET || 'devbox-i4DUz3WIuAk0fxP2vctTmZWysr5uTQjQ',
  masterPassword: process.env.MASTER_PASSWORD || 'K@s112326',
  masterTotpSecret: process.env.MASTER_TOTP_SECRET || 'JBSWY3DPEHPK3PXP', // Base32 test secret
  whatsappServerUrl: process.env.WHATSAPP_SERVER_URL || 'http://137.23.42.57:3000',
  whatsappServerSecret: process.env.WHATSAPP_SERVER_SECRET || '48b570db89384a4f5d95132f9539a426',
  whatsappRecipient: process.env.WHATSAPP_RECIPIENT || '916264255516@c.us',
  alertEmailRecipient: process.env.ALERT_EMAIL_RECIPIENT || 'ketangsolanki129@gmail.com',
  resendApiKey: process.env.RESEND_API_KEY || '',
  supabaseUrl: resolvedSupabaseUrl,
  supabaseServiceRoleKey: resolvedSupabaseKey,
};
