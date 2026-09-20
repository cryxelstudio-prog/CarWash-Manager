import { useEffect, useState } from "react";
import ResourceCrud from "../components/ResourceCrud";
import { api } from "../lib/api";

export default function VehiclesPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  useEffect(() => {
    api<any>("/api/v1/customers").then((d) => setCustomers(d.items || [])).catch(() => undefined);
  }, []);
  const sizes = ["SMALL","SEDAN","HATCHBACK","SUV","BAKKIE","VAN","MINIBUS","COMMERCIAL","CUSTOM"];
  return (
    <ResourceCrud
      title="Vehicles"
      endpoint={"/api/v1/vehicles"}
      fields={[
        { name: "customer_id", label: "Customer", type: "select", required: true, options: customers.map((c) => ({ value: c.id, label: c.full_name || `${c.first_name} ${c.last_name}` })) },
        { name: "registration", label: "Registration", required: true },
        { name: "make", label: "Make" },
        { name: "model", label: "Model" },
        { name: "colour", label: "Colour" },
        { name: "year", label: "Year", type: "number" },
        { name: "size", label: "Size", type: "select", options: sizes.map((s) => ({ value: s, label: s })) },
      ]}
      columns={[
        { key: "registration", label: "Reg" },
        { key: "make", label: "Make" },
        { key: "model", label: "Model" },
        { key: "size", label: "Size" },
        { key: "customer_id", label: "Customer" },
      ]}
      newDefaults={{ size: "SEDAN", is_active: true }}
      transformIn={(f) => ({ ...f, customer_id: Number(f.customer_id), year: f.year ? Number(f.year) : null })}
    />
  );
}
