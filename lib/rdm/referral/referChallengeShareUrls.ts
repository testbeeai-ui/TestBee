/**
 * WhatsApp “click to chat” URL.
 *
 * Prefer `api.whatsapp.com/send` over `wa.me/?text=…`: the wa.me short redirect
 * has been reported to corrupt UTF-8 (emoji show as) on desktop / WhatsApp Web.
 * @see https://stackoverflow.com/questions/66954605
 */
export function buildWhatsAppShareUrl(text: string): string {
  const encoded = encodeURIComponent(text);
  return `https://api.whatsapp.com/send?text=${encoded}`;
}
