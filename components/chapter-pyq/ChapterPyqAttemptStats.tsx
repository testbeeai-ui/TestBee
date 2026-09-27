import { cn } from "@/lib/utils";
import type { PyqAttemptTally } from "@/lib/chapter-pyq/pyqAttemptStore";

const CELLS = [
  {
    key: "attempted",
    label: "Attempted",
    valueClass: "text-[#93C5FD]",
    cellClass: "bg-[#1E3A8A]/25",
  },
  {
    key: "right",
    label: "Right",
    valueClass: "text-[#6EE7B7]",
    cellClass: "bg-[#065F46]/30",
  },
  {
    key: "wrong",
    label: "Wrong",
    valueClass: "text-[#FDA4AF]",
    cellClass: "bg-[#9F1239]/25",
  },
] as const;

/** One even strip: number over a single-line label, same height in every card. */
export default function ChapterPyqAttemptStats({ tally }: { tally: PyqAttemptTally }) {
  return (
    <div
      className="mt-2.5 grid grid-cols-3 overflow-hidden rounded-lg border border-[#243049]"
      aria-label="Question results"
    >
      {CELLS.map((cell, index) => (
        <div
          key={cell.key}
          className={cn(
            "flex min-w-0 flex-col items-center justify-center px-1 py-1.5",
            cell.cellClass,
            index > 0 && "border-l border-[#243049]"
          )}
        >
          <span className={cn("text-sm font-bold leading-none tabular-nums", cell.valueClass)}>
            {tally[cell.key]}
          </span>
          <span
            className={cn(
              "mt-1 max-w-full truncate text-[10px] font-medium leading-none tracking-tight",
              cell.valueClass
            )}
          >
            {cell.label}
          </span>
        </div>
      ))}
    </div>
  );
}
