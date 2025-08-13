
export default function SeedDatabaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <main className="w-full max-w-2xl">{children}</main>
    </div>
  );
}
