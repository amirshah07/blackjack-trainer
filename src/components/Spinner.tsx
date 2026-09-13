/**
 * Full-screen loading state shown while a mode's client component hydrates.
 *
 * Not a client component: it renders during Suspense on the server, so it must
 * be static markup with a CSS-driven animation.
 */
export function LoadingScreen() {
  return (
    <main className="flex h-screen items-center justify-center" aria-busy="true">
      <span className="sr-only">Loading</span>
      <svg
        width="52"
        height="52"
        viewBox="0 0 50 50"
        className="spinner"
        role="img"
        aria-label="Loading"
      >
        {/* Faint full ring, so the arc reads as travelling around a track. */}
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="rgba(252, 211, 77, 0.18)"
          strokeWidth="4"
        />
        {/* The moving arc: a quarter of the circumference (2*pi*20 ≈ 126). */}
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="#fcd34d"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="32 94"
        />
      </svg>
    </main>
  );
}
