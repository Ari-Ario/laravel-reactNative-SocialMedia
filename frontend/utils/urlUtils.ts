/**
 * Unified URL detection and extraction utility for the Social Media platform.
 * Supports standard protocols (http, https) and common www. prefixes.
 */

export const URL_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;

/**
 * Detects if a string contains any valid URLs.
 */
export const hasUrl = (text: string | null | undefined): boolean => {
  if (!text) return false;
  return URL_REGEX.test(text);
};

/**
 * Extracts the first valid URL from a string.
 * Automatically adds 'https://' prefix to URLs starting with 'www.'
 */
export const extractFirstUrl = (text: string | null | undefined): string | null => {
  if (!text) return null;
  
  // Reset regex state due to 'g' flag
  URL_REGEX.lastIndex = 0;
  
  const match = text.match(URL_REGEX);
  if (!match) return null;

  let url = match[0];
  if (url.toLowerCase().startsWith('www.')) {
    url = `https://${url}`;
  }
  
  return url;
};
