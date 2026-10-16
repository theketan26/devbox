/**
 * Utility functions for validating and sanitizing parameters
 */

/**
 * Checks if a value is a valid standard UUID format.
 * Rejects 'undefined', 'null', 'all', empty strings, and non-UUID values.
 * @param {any} val
 * @returns {boolean}
 */
export function isValidUuid(val) {
    if (!val || typeof val !== 'string') return false;
    const trimmed = val.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null' || trimmed === 'all') {
        return false;
    }
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
}

/**
 * Returns a sanitized UUID string if valid, otherwise null.
 * @param {any} val
 * @returns {string|null}
 */
export function cleanUuid(val) {
    return isValidUuid(val) ? val.trim() : null;
}
