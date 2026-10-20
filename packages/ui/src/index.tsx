import type { ReactNode } from "react";

export type IconName =
  | "home"
  | "sales"
  | "finance"
  | "settings"
  | "menu"
  | "arrow"
  | "wallet"
  | "orders"
  | "search";

const paths: Record<IconName, string> = {
  home: "m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8",
  sales: "M5 3h14v18H5zM8 7h8M8 11h8M8 15h5",
  finance: "M4 20h17M7 16V9m5 7V4m5 12v-5",
  settings:
    "m9 3-1 3-3 1-2 4 2 2v4l4 2 3-1 3 1 4-2v-4l2-2-2-4-3-1-1-3zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  menu: "M4 6h16M4 12h16M4 18h16",
  arrow: "m4 16 6-6 4 4 6-9M14 5h6v6",
  wallet: "M3 6h18v14H3zM3 6V3h15v3M16 11h5v5h-5z",
  orders: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="muted">{description}</p>
    </div>
  );
}

export function Placeholder({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="placeholder">
      <span className="placeholder-icon">
        <Icon name="orders" size={26} />
      </span>
      <h2>{title}</h2>
      <p className="muted">{children}</p>
      <span className="badge">Not connected in this workspace</span>
    </Card>
  );
}
