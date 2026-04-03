'use client';

interface StatCard {
  label: string;
  value: string | number;
  sub: string;
  borderColor: string;
}

interface PrepMockStatCardsProps {
  nextClassName: string;
  nextClassTime: string;
  mockPending: number;
  revisionItems: number;
  accuracy: number;
}

export default function PrepMockStatCards({
  nextClassName,
  nextClassTime,
  mockPending,
  revisionItems,
  accuracy,
}: PrepMockStatCardsProps) {
  const cards: StatCard[] = [
    {
      label: 'Next class',
      value: nextClassName || '—',
      sub: nextClassTime || 'No upcoming',
      borderColor: 'border-l-green-500',
    },
    {
      label: 'Mock pending',
      value: mockPending,
      sub: 'tests due',
      borderColor: 'border-l-amber-500',
    },
    {
      label: 'Revision items',
      value: revisionItems,
      sub: 'Instacues queued',
      borderColor: 'border-l-orange-500',
    },
    {
      label: 'Accuracy',
      value: `${accuracy}%`,
      sub: 'last 7 days',
      borderColor: 'border-l-blue-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`edu-card rounded-xl border border-border/50 border-l-4 ${card.borderColor} p-4`}
        >
          <div className="text-xs text-muted-foreground font-medium mb-1">{card.label}</div>
          <div className="text-2xl font-extrabold text-foreground leading-tight">{card.value}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{card.sub}</div>
        </div>
      ))}
    </div>
  );
}
