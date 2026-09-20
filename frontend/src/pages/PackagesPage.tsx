import ResourceCrud from "../components/ResourceCrud";
import { formatMoney } from "../lib/api";

export default function PackagesPage() {
  return (
    <ResourceCrud
      title="Packages"
      endpoint={"/api/v1/packages"}
      fields={[
        { name: "code", label: "Code", required: true },
        { name: "name", label: "Name", required: true },
        { name: "price", label: "Price", type: "number", required: true },
        { name: "duration_minutes", label: "Duration (min)", type: "number" },
        { name: "description", label: "Description", type: "textarea" },
      ]}
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "price", label: "Price", render: (r) => formatMoney(r.price) },
        { key: "duration_minutes", label: "Mins" },
      ]}
      newDefaults={{ duration_minutes: 60, price: 0, is_active: true, service_ids: [] }}
      transformIn={(f) => ({ ...f, price: Number(f.price), duration_minutes: Number(f.duration_minutes || 60), service_ids: f.service_ids || [] })}
    />
  );
}
