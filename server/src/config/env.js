import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from potential runtime locations if present
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
dotenv.config();

function cleanEnvVal(val) {
  if (!val) return '';
  return String(val).trim().replace(/^["']|["']$/g, '');
}

const resolvedSupabaseUrl = cleanEnvVal(
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ''
);

const resolvedSupabaseKey = cleanEnvVal(
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  ''
);

export const config = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET || 'devbox-jwt-master-secret-key-super-secure-2026',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'devbox-jwt-refresh-secret-key-super-secure-2026',
  aesMasterKey: process.env.AES_MASTER_KEY || '',
  cliMasterKey: process.env.DEVBOX_CLI_MASTER_KEY || '',
  cronSecret: process.env.CRON_SECRET || '',
  masterPassword: process.env.MASTER_PASSWORD || 'admin123',
  masterTotpSecret: process.env.MASTER_TOTP_SECRET || 'JBSWY3DPEHPK3PXP',
  whatsappServerUrl: process.env.WHATSAPP_SERVER_URL || '',
  whatsappServerSecret: process.env.WHATSAPP_SERVER_SECRET || '',
  whatsappRecipient: process.env.WHATSAPP_RECIPIENT || '',
  alertEmailRecipient: process.env.ALERT_EMAIL_RECIPIENT || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  supabaseUrl: resolvedSupabaseUrl,
  supabaseServiceRoleKey: resolvedSupabaseKey,
};
