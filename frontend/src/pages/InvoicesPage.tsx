import { useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { api, formatMoney } from "../lib/api";

export default function InvoicesPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api<any>("/api/v1/invoices").then((d) => setItems(d.items || [])); }, []);
  return (
    <div>
      <PageHeader title="Invoices" subtitle="Issued invoices and PDF downloads" />
      <div className="card overflow-auto">
        <table className="table">
          <thead><tr><th>No.</th><th>Date</th><th>Customer</th><th>Total</th><th>Paid</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.invoice_number}</td>
                <td>{i.invoice_date}</td>
                <td>{i.customer_id}</td>
                <td>{formatMoney(i.total_amount)}</td>
                <td>{formatMoney(i.amount_paid)}</td>
                <td>{i.status}</td>
                <td className="text-right"><a className="btn-secondary !py-1" href={`/api/v1/invoices/${i.id}/pdf`} target="_blank" rel="noreferrer">PDF</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
