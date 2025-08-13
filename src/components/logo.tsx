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
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6 text-primary"
      >
        <path d="M6 18l6-6-6-6" />
        <path d="M12 18l6-6-6-6" />
        <path d="M15.5 15.5a2.12 2.12 0 0 0 3 0" />
        <path d="M15.5 8.5a2.12 2.12 0 0 1 3 0" />
        <path d="M4 14.5h7" />
        <path d="M4 9.5h7" />
      </svg>
      <span className="text-lg font-semibold text-primary">Score Vision</span>
    </div>
  );
}
