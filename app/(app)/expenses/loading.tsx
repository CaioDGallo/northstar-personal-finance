export default function ExpensesLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-muted rounded" />
        <div className="h-10 w-24 bg-muted rounded" />
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="h-10 flex-1 bg-muted rounded" />
        <div className="h-10 w-32 bg-muted rounded" />
        <div className="h-10 w-32 bg-muted rounded" />
      </div>

      {/* Transaction list */}
      <div className="space-y-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="space-y-2">
            {i === 0 || i === 3 ? (
              <div className="h-6 w-32 bg-muted rounded mt-2" />
            ) : null}
            <div className="h-24 bg-muted rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
