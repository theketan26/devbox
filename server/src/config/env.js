import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET || 'devbox-jwt-master-secret-key-super-secure-2026',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'devbox-jwt-refresh-secret-key-super-secure-2026',
  aesMasterKey: process.env.AES_MASTER_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  cliMasterKey: process.env.DEVBOX_CLI_MASTER_KEY || 'devbox-cli-master-key-xyz987',
  cronSecret: process.env.CRON_SECRET || 'devbox-cron-internal-secret-token',
  masterPassword: process.env.MASTER_PASSWORD || 'admin123',
  masterTotpSecret: process.env.MASTER_TOTP_SECRET || 'JBSWY3DPEHPK3PXP', // Base32 test secret
  whatsappServerUrl: process.env.WHATSAPP_SERVER_URL || 'http://localhost:3000',
  whatsappServerSecret: process.env.WHATSAPP_SERVER_SECRET || '48b570db89384a4f5d95132f9539a426',
  whatsappRecipient: process.env.WHATSAPP_RECIPIENT || '919876543210@c.us',
  alertEmailRecipient: process.env.ALERT_EMAIL_RECIPIENT || 'devops@example.com',
  resendApiKey: process.env.RESEND_API_KEY || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
};
