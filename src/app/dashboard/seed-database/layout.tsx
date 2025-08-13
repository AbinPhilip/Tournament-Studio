
export default function SeedDatabaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This layout is intentionally minimal to avoid triggering authentication checks
  // from the main dashboard layout.
  return <>{children}</>;
}
