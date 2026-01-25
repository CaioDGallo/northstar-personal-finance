export default function CategoriesLoading() {
  return (
    <div className="animate-pulse">
      {/* Title */}
      <div className="h-8 w-40 bg-muted rounded mb-6" />

      {/* Tabs */}
      <div className="h-10 w-full bg-muted rounded-lg mb-6" />

      {/* Add button */}
      <div className="flex justify-end mb-3">
        <div className="h-9 w-48 bg-muted rounded" />
      </div>

      {/* Category cards */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-16 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}
