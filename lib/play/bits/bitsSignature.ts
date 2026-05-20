/**
 * Fingerprint for a generated topic-quiz MCQ list. Must stay in sync with
 * `public.bits_signature_v1(bits_questions jsonb)` in Supabase migrations.
 */
export type BitsSignatureQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
};

export function getBitsSignature(items: BitsSignatureQuestion[]): string {
  const raw = items
    .map((q, idx) => `${idx + 1}|${q.question}|${q.correctAnswer}|${q.options.join("||")}`)
    .join("###");
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return `v1-${items.length}-${Math.abs(hash)}`;
}
