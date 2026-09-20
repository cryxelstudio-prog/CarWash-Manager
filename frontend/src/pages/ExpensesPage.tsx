import ResourceCrud from "../components/ResourceCrud";
import { formatMoney } from "../lib/api";

export default function ExpensesPage() {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ResourceCrud
      title="Expenses"
      endpoint={"/api/v1/expenses"}
      fields={[
        { name: "category", label: "Category" },
        { name: "description", label: "Description", required: true },
        { name: "amount", label: "Amount", type: "number", required: true },
        { name: "expense_date", label: "Date", type: "date", required: true },
        { name: "payment_method", label: "Method", type: "select", options: ["CASH","CARD","EFT","OTHER"].map((m)=>({value:m,label:m})) },
        { name: "notes", label: "Notes", type: "textarea" },
      ]}
      columns={[
        { key: "expense_number", label: "No." },
        { key: "expense_date", label: "Date" },
        { key: "category", label: "Category" },
        { key: "description", label: "Description" },
        { key: "amount", label: "Amount", render: (r) => formatMoney(r.amount) },
      ]}
      newDefaults={{ category: "GENERAL", payment_method: "CASH", expense_date: today, amount: 0 }}
      transformIn={(f) => ({ ...f, amount: Number(f.amount) })}
    />
  );
}
