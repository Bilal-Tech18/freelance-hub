export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Le body ne scrolle plus (overflow hidden global) : ce wrapper rend les
  // pages d'auth scrollables sur petits écrans.
  return <div className="flex h-full flex-col overflow-y-auto">{children}</div>;
}
