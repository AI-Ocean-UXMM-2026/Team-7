export function SalesChart() {
  return (
    <div className="sample-chart" role="img" aria-label="Sample weekly recorded sales: Monday 280,000, Tuesday 350,000, Wednesday 310,000, Thursday 520,000, Friday 460,000, Saturday 610,000, Sunday 486,500 MMK.">
      <svg viewBox="0 0 620 250" aria-hidden="true">
        <defs><linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#37c9d9" stopOpacity=".32"/><stop offset="1" stopColor="#37c9d9" stopOpacity="0"/></linearGradient></defs>
        {[35, 85, 135, 185].map((y, i) => <g key={y}><line x1="52" y1={y} x2="598" y2={y} className="chart-gridline"/><text x="8" y={y + 4}>{[600, 400, 200, 0][i]}K</text></g>)}
        <path d="M58 115 C90 115 115 98 145 98 S205 108 232 108 S290 55 319 55 S380 70 406 70 S465 32 493 32 S550 63 584 63 L584 185 L58 185 Z" fill="url(#sales-fill)"/>
        <path d="M58 115 C90 115 115 98 145 98 S205 108 232 108 S290 55 319 55 S380 70 406 70 S465 32 493 32 S550 63 584 63" className="sales-line"/>
        {[[58,115],[145,98],[232,108],[319,55],[406,70],[493,32],[584,63]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="4" fill="white" stroke="#229dc1" strokeWidth="3"/>)}
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((day, i) => <text key={day} x={58+i*87.5} y="222" textAnchor="middle">{day}</text>)}
      </svg>
    </div>
  );
}

export function CashFlowChart() {
  return (
    <div className="sample-chart" role="img" aria-label="Illustrative January to June comparison of recorded sales, payments received, and estimated profit. Sample figures only; not live financial results.">
      <div className="chart-legend"><span><i className="legend-sales"/>Sales</span><span><i className="legend-received"/>Received</span><span><i className="legend-profit"/>Profit</span></div>
      <svg viewBox="0 0 620 250" aria-hidden="true">
        {[35, 85, 135, 185].map((y,i)=><g key={y}><line x1="44" y1={y} x2="610" y2={y} className="chart-gridline"/><text x="5" y={y+4}>{[3,2,1,0][i]}M</text></g>)}
        {[[55,38,12],[78,54,22],[105,76,35],[124,91,46],[143,108,57],[157,125,69]].map((heights,i)=><g key={i}>{heights.map((height,j)=><rect key={j} x={65+i*92+j*17} y={185-height} width="13" height={height} rx="4" fill={["#3478f6","#37c9d9","#f2ae40"][j]}/>)}<text x={85+i*92} y="222" textAnchor="middle">{["Jan","Feb","Mar","Apr","May","Jun"][i]}</text></g>)}
      </svg>
    </div>
  );
}

export function ExpenseChart() {
  return (
    <div className="expense-breakdown">
      <div className="expense-donut" role="img" aria-label="Sample expenses: product purchase 66%, delivery 14%, marketing 11%, other 9%."><div><strong>2.14M</strong><span>Total MMK</span></div></div>
      <ul>{[["Product purchase","66%","#3478f6"],["Delivery","14%","#37c9d9"],["Marketing","11%","#e96585"],["Other","9%","#f2ae40"]].map(([label,value,color])=><li key={label}><i style={{background:color}}/><span>{label}</span><strong>{value}</strong></li>)}</ul>
    </div>
  );
}
