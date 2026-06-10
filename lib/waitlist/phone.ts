/** Strip to digits; drop leading 91 or 0 when user pasted +91 / 0-prefixed numbers. */
export function sanitizeMobileInput(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

export type NormalizeIndianMobileResult =
  | { ok: true; phone: string }
  | { ok: false; error: string };

/** Normalize to 10-digit Indian mobile (no +91, no spaces). */
export function normalizeIndianMobile(raw: string): NormalizeIndianMobileResult {
  const phone = sanitizeMobileInput(raw);
  if (!phone) {
    return {
      ok: false,
      error: "Enter your 10-digit mobile number (no +91, no spaces).",
    };
  }
  if (phone.length !== 10) {
    return {
      ok: false,
      error: `Mobile must be exactly 10 digits — you entered ${phone.length}. No +91 or spaces.`,
    };
  }
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return {
      ok: false,
      error: "Enter a valid Indian mobile number (10 digits, starting with 6–9). No +91 or spaces.",
    };
  }
  return { ok: true, phone };
}
