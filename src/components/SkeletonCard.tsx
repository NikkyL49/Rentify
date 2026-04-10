"use client";

/** Animated skeleton placeholder that matches ItemCard dimensions. */
export function SkeletonCard() {
  return (
    <div className="itemCard skeletonCard" aria-hidden="true">
      <div className="skeletonImg" />
      <div className="itemCardBody">
        <div className="skeletonLine skeletonPrice" />
        <div className="skeletonLine skeletonName" />
        <div className="skeletonLine skeletonMeta" />
      </div>
    </div>
  );
}

/** Renders N skeleton cards in the standard card grid. */
export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="cardsGrid">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
