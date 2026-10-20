import Link from "next/link";

export function SectionNav({
  label,
  items,
  selected,
}: {
  label: string;
  items: { label: string; href: string; key: string }[];
  selected: string;
}) {
  return (
    <nav className="section-nav" aria-label={label}>
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={selected === item.key ? "page" : undefined}
          className={selected === item.key ? "active" : ""}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
