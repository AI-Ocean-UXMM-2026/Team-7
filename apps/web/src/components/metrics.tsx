import { Card, Icon, type IconName } from "@ocean/ui";

export type Metric = {
  label: string;
  value: string;
  note: string;
  icon: IconName;
  currency?: boolean;
  pill?: string;
};

const METRIC_THEMES = ["metric-sales", "metric-payments", "metric-expenses", "metric-profit"];

export function Metrics({ items }: { items: Metric[] }) {
  return (
    <div className="metrics-grid">
      {items.map((item, index) => {
        const theme = METRIC_THEMES[index % METRIC_THEMES.length]!;
        return (
          <Card
            key={item.label}
            className={`metric ${theme}`}
          >
            <div className="metric-header-row">
              <span className="metric-icon">
                <Icon name={item.icon} />
              </span>
              {item.pill && (
                <span className="metric-pill">
                  {item.pill}
                </span>
              )}
            </div>
            <h2>{item.label}</h2>
            <p className="metric-value">
              {item.value}
              {item.currency !== false && <span> MMK</span>}
            </p>
            <p className="metric-note">{item.note}</p>
          </Card>
        );
      })}
    </div>
  );
}
