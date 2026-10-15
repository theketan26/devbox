/**
 * Format configurations into various export formats
 */

export function exportDotEnv(configs, decryptedMap = {}) {
  const lines = [
    `# ==========================================`,
    `# Dev Box Environment Configuration`,
    `# Generated at: ${new Date().toISOString()}`,
    `# ==========================================`,
    ''
  ];

  configs.forEach(cfg => {
    const val = decryptedMap[cfg.id] !== undefined ? decryptedMap[cfg.id] : cfg.encrypted_value;
    // Quote if contains special characters or spaces
    const escaped = val.includes('\n') || val.includes(' ') || val.includes('"')
      ? JSON.stringify(val)
      : val;
    lines.push(`${cfg.key}=${escaped}`);
  });

  return lines.join('\n');
}

export function exportJSON(configs, decryptedMap = {}) {
  const result = {};
  configs.forEach(cfg => {
    result[cfg.key] = decryptedMap[cfg.id] !== undefined ? decryptedMap[cfg.id] : cfg.encrypted_value;
  });
  return JSON.stringify(result, null, 2);
}

export function exportDockerCompose(configs, decryptedMap = {}) {
  const lines = [
    `# Dev Box Docker Compose Environment Block`,
    `# Generated at: ${new Date().toISOString()}`,
    `services:`,
    `  app:`,
    `    environment:`
  ];

  configs.forEach(cfg => {
    const val = decryptedMap[cfg.id] !== undefined ? decryptedMap[cfg.id] : cfg.encrypted_value;
    lines.push(`      - ${cfg.key}=${val}`);
  });

  return lines.join('\n');
}

export function exportK8sSecret(configs, decryptedMap = {}, secretName = 'app-secrets') {
  const lines = [
    `apiVersion: v1`,
    `kind: Secret`,
    `metadata:`,
    `  name: ${secretName}`,
    `type: Opaque`,
    `data:`
  ];

  configs.forEach(cfg => {
    const val = decryptedMap[cfg.id] !== undefined ? decryptedMap[cfg.id] : cfg.encrypted_value;
    const base64Val = Buffer.from(val, 'utf8').toString('base64');
    lines.push(`  ${cfg.key}: ${base64Val}`);
  });

  return lines.join('\n');
}
