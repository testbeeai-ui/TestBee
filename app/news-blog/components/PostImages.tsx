export function PostImages({
  heroImageUrl,
  inlineImageUrl,
  heroImageCaption,
  inlineImageCaption,
}: {
  heroImageUrl: string;
  inlineImageUrl: string;
  heroImageCaption: string;
  inlineImageCaption: string;
}) {
  if (!heroImageUrl.trim() && !inlineImageUrl.trim()) return null;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {heroImageUrl.trim() ? (
        <figure className="overflow-hidden rounded-lg border border-slate-700/60 bg-[#101a2a]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImageUrl}
            alt={heroImageCaption || "Hero image"}
            className="h-44 w-full object-cover"
          />
          {heroImageCaption.trim() ? (
            <figcaption className="px-3 py-2 text-xs text-slate-400">{heroImageCaption}</figcaption>
          ) : null}
        </figure>
      ) : null}
      {inlineImageUrl.trim() ? (
        <figure className="overflow-hidden rounded-lg border border-slate-700/60 bg-[#101a2a]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={inlineImageUrl}
            alt={inlineImageCaption || "Inline image"}
            className="h-44 w-full object-cover"
          />
          {inlineImageCaption.trim() ? (
            <figcaption className="px-3 py-2 text-xs text-slate-400">
              {inlineImageCaption}
            </figcaption>
          ) : null}
        </figure>
      ) : null}
    </div>
  );
}
