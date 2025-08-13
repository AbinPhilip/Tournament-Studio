export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6 text-primary"
      >
        <path d="m6 18 4-4" />
        <path d="m10 18 4-4" />
        <path d="m14 18 4-4" />
        <path d="m18 18 4-4" />
        <path d="m18 6-4-4" />
        <path d="m14 6-4-4" />
        <path d="m10 6-4-4" />
        <path d="m6 6-4-4" />
        <path d="M12 10a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2Z" />
      </svg>
      <span className="text-lg font-semibold text-primary">Battledore</span>
    </div>
  );
}
