export default function FaturasLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header with month picker */}
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 items-center justify-between">
        <div className="h-8 w-32 bg-muted rounded" />
        <div className="flex items-center gap-3">
          <div className="size-10 bg-muted rounded" />
          <div className="h-6 w-48 bg-muted rounded" />
          <div className="size-10 bg-muted rounded" />
        </div>
      </div>

      {/* Fatura cards */}
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}
