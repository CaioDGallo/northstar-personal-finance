export default function BudgetsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header with month picker */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-muted rounded" />
        <div className="flex items-center gap-3">
          <div className="size-10 bg-muted rounded" />
          <div className="h-6 w-48 bg-muted rounded" />
          <div className="size-10 bg-muted rounded" />
        </div>
      </div>

      {/* Budget summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-24 bg-muted rounded-lg" />
        <div className="h-24 bg-muted rounded-lg" />
        <div className="h-24 bg-muted rounded-lg" />
      </div>

      {/* Budget breakdown list */}
      <div className="space-y-3">
        <div className="h-6 w-40 bg-muted rounded" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-20 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}
