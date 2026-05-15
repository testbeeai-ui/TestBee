export function RevisionPlaybookStrip() {
  const blocks = [
    {
      key: "180",
      big: "180d",
      l1: "Intensive phase",
      l2: "Chapter-wise mocks",
      border: "border-emerald-500/45",
      bg: "bg-emerald-500/[0.06]",
      text: "text-emerald-300",
    },
    {
      key: "60",
      big: "60d",
      l1: "Revision sprint",
      l2: "Weak areas + mocks",
      border: "border-amber-500/45",
      bg: "bg-amber-500/[0.07]",
      text: "text-amber-300",
    },
    {
      key: "3",
      big: "3d",
      l1: "Final countdown",
      l2: "Instacues · rest",
      border: "border-rose-500/50",
      bg: "bg-rose-600/[0.08]",
      text: "text-rose-300",
    },
  ];
  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-3">
      {blocks.map((b) => (
        <div
          key={b.key}
          className={`rounded-lg border px-2.5 py-3 text-center ${b.border} ${b.bg}`}
        >
          <p className={`text-xl font-bold tabular-nums sm:text-2xl ${b.text}`}>{b.big}</p>
          <p className={`mt-1 text-[11px] font-medium leading-tight ${b.text}`}>{b.l1}</p>
          <p className={`mt-0.5 text-[10px] leading-snug opacity-95 ${b.text}`}>{b.l2}</p>
        </div>
      ))}
    </div>
  );
}
