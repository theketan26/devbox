import { useState, useEffect, useRef } from 'react';

/**
 * Custom React hook for auto-clearing sensitive secrets from OS clipboard after 45 seconds
 * @param {number} [timeoutSeconds=45]
 */
export function useSensitiveClipboard(timeoutSeconds = 45) {
  const [copiedKey, setCopiedKey] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef(null);

  const clearClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText('');
      }
    } catch (err) {
      console.warn('Could not clear OS clipboard:', err);
    }
    setCopiedKey(null);
    setSecondsLeft(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const copySecret = async (secretValue, keyIdentifier) => {
    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      await navigator.clipboard.writeText(secretValue);
      setCopiedKey(keyIdentifier);
      setSecondsLeft(timeoutSeconds);

      timerRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearClipboard();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    copiedKey,
    secondsLeft,
    isCopied: (key) => copiedKey === key && secondsLeft > 0,
    copySecret,
    clearNow: clearClipboard
  };
}
