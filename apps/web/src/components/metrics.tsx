import { Card, Icon, type IconName } from "@ocean/ui";

export type Metric = {
  label: string;
  value: string;
  note: string;
  icon: IconName;
  currency?: boolean;
};

export function Metrics({ items }: { items: Metric[] }) {
  return (
    <div className="metrics-grid">
      {items.map((item, index) => (
        <Card
          key={item.label}
          className={`metric${index === 0 ? " metric-primary" : ""}`}
        >
          <span className={`metric-icon tone-${index}`}>
            <Icon name={item.icon} />
          </span>
          <h2>{item.label}</h2>
          <p className="metric-value">
            {item.value}
            {item.currency !== false && <span> MMK</span>}
          </p>
          <p className="metric-note">{item.note}</p>
        </Card>
      ))}
    </div>
  );
}
