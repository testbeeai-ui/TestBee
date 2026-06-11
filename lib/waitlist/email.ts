/** Validate email address format strictly, rejecting malformed domains like 12ironman@.com and fake TLDs */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;
  
  // Enforce standard trusted TLD list to prevent users entering "funny emails" like yahoo.ddd or abc.abc
  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9]+([.-]?[a-zA-Z0-9]+)*\.(com|org|net|edu|gov|in|co|io|me|app|dev|ai|us|uk|ca|au|de|fr|jp|cn|br|ru|tv|cc|xyz|info|biz|ac)(?:\.[a-zA-Z]{2,})?$/i;
  
  return EMAIL_REGEX.test(trimmed);
}
