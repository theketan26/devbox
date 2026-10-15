/**
 * Cross-environment parity checker
 * Compares configuration keys across environments (development, staging, production)
 */

export function calculateParity(configs = []) {
  const targetEnvironments = ['development', 'staging', 'production'];
  const keyMap = new Map();

  configs.forEach(cfg => {
    if (!keyMap.has(cfg.key)) {
      keyMap.set(cfg.key, {});
    }
    keyMap.get(cfg.key)[cfg.environment] = {
      id: cfg.id,
      exists: true,
      isSecret: cfg.is_secret,
      updatedAt: cfg.updated_at
    };
  });

  const matrix = [];
  let inParityCount = 0;

  for (const [key, envData] of keyMap.entries()) {
    const environmentsStatus = {};
    const missingIn = [];

    targetEnvironments.forEach(env => {
      if (envData[env]) {
        environmentsStatus[env] = envData[env];
      } else {
        environmentsStatus[env] = { exists: false };
        missingIn.push(env);
      }
    });

    const hasParity = missingIn.length === 0;
    if (hasParity) {
      inParityCount++;
    }

    matrix.push({
      key,
      environments: environmentsStatus,
      hasParity,
      missingIn
    });
  }

  // Sort: non-parity items first, then alphabetical
  matrix.sort((a, b) => {
    if (a.hasParity !== b.hasParity) {
      return a.hasParity ? 1 : -1;
    }
    return a.key.localeCompare(b.key);
  });

  const totalKeys = matrix.length;
  const parityPercentage = totalKeys > 0 ? Math.round((inParityCount / totalKeys) * 100) : 100;

  return {
    environments: targetEnvironments,
    summary: {
      totalKeys,
      inParityCount,
      parityPercentage,
      missingCount: totalKeys - inParityCount
    },
    matrix
  };
}
