import ResourceCrud from "../components/ResourceCrud";
import { formatMoney } from "../lib/api";

export default function ServicesPage() {
  return (
    <ResourceCrud
      title="Services"
      endpoint={"/api/v1/services"}
      fields={[
        { name: "code", label: "Code", required: true },
        { name: "name", label: "Name", required: true },
        { name: "category", label: "Category" },
        { name: "base_price", label: "Base price", type: "number", required: true },
        { name: "duration_minutes", label: "Duration (min)", type: "number" },
        { name: "description", label: "Description", type: "textarea" },
      ]}
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "category", label: "Category" },
        { key: "base_price", label: "Price", render: (r: any) => formatMoney(r.base_price) },
        { key: "duration_minutes", label: "Mins" },
      ]}
      newDefaults={{ category: "WASH", duration_minutes: 30, base_price: 0, is_active: true }}
      transformIn={(f) => ({ ...f, base_price: Number(f.base_price), duration_minutes: Number(f.duration_minutes || 30), tax_rate: 15 })}
    />
  );
}
