export default function DashboardLoading() {
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

      {/* Main grid layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column - summary cards */}
        <div className="space-y-6">
          <div className="h-32 bg-muted rounded-lg" />
          <div className="h-32 bg-muted rounded-lg" />
          <div className="h-64 bg-muted rounded-lg" />
        </div>

        {/* Right column - recent transactions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="space-y-3">
            <div className="h-20 bg-muted rounded-lg" />
            <div className="h-20 bg-muted rounded-lg" />
            <div className="h-20 bg-muted rounded-lg" />
            <div className="h-20 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
