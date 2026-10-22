"use client";

import { useState } from "react";
import { Icon } from "@ocean/ui";
import { sampleOrders } from "@/lib/sample-data";

export function OrdersTable({ searchable = false, initialQuery = "" }: { searchable?: boolean; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState("All statuses");
  const rows = sampleOrders.filter(order =>
    `${order.id} ${order.customer} ${order.product}`.toLowerCase().includes(query.toLowerCase()) &&
    (status === "All statuses" || order.status === status));
  return (
    <>
      {searchable && <div className="table-toolbar">
        <label className="search-field"><Icon name="search"/><span className="sr-only">Search orders</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by order ID or customer…"/></label>
        <label><span className="sr-only">Order status</span><select value={status} onChange={e=>setStatus(e.target.value)}>{["All statuses","New","Processing","Shipped"].map(s=><option key={s}>{s}</option>)}</select></label>
      </div>}
      <div className="table-scroll" role="region" aria-label="Order records" tabIndex={0}>
        <table className="data-table"><caption className="sr-only">Orders ledger.</caption>
          <thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Date</th><th scope="col" className="amount-cell">Amount</th><th scope="col">Payment</th><th scope="col">Order status</th></tr></thead>
          <tbody>{rows.map(order=><tr key={order.id}><td><strong className="order-id">#{order.id}</strong></td><td><div className="customer-cell"><span className="customer-avatar" aria-hidden="true">{order.initials}</span><span><strong>{order.customer}</strong><small>{order.product}</small></span></div></td><td className="muted">{order.date}</td><td className="amount-cell"><strong>{order.amount}</strong><small> MMK</small></td><td><span className={`status-badge ${order.payment === "Received" ? "status-success" : order.payment === "Needs review" ? "status-warning" : "status-neutral"}`}>{order.payment}</span></td><td><span className={`status-badge ${order.status === "Shipped" ? "status-success" : order.status === "New" ? "status-info" : "status-warning"}`}>{order.status}</span></td></tr>)}</tbody>
        </table>
      </div>
      {!rows.length && <div className="table-empty" role="status"><Icon name="search" size={30}/><h3>No matching orders</h3><p>Try a customer name or a different status.</p><button className="text-button" onClick={()=>{setQuery("");setStatus("All statuses");}}>Clear filters</button></div>}
      {searchable && <p className="table-summary" role="status">Showing {rows.length} of {sampleOrders.length} orders</p>}
    </>
  );
}
