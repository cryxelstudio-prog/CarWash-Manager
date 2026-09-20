import { useEffect, useState } from "react";
import ResourceCrud from "../components/ResourceCrud";
import { api } from "../lib/api";
import { useBranding } from "../hooks/useBranding";
import { isShowRegistration, vehicleDescription } from "../lib/vehicles";

export default function VehiclesPage() {
  const { branding } = useBranding();
  const showReg = isShowRegistration(branding);
  const [customers, setCustomers] = useState<any[]>([]);
  useEffect(() => {
    api<any>("/api/v1/customers").then((d) => setCustomers(d.items || [])).catch(() => undefined);
  }, []);
  const sizes = ["SMALL","SEDAN","HATCHBACK","SUV","BAKKIE","VAN","MINIBUS","COMMERCIAL","CUSTOM"];
  const fields: any[] = [
    { name: "customer_id", label: "Customer", type: "select", required: true, options: customers.map((c) => ({ value: c.id, label: c.full_name || `${c.first_name} ${c.last_name}` })) },
    { name: "colour", label: "Colour", required: true, placeholder: "White" },
    { name: "make", label: "Make", required: true, placeholder: "VW" },
    { name: "model", label: "Model", required: true, placeholder: "Polo" },
    { name: "year", label: "Year", type: "number" },
    { name: "size", label: "Size", type: "select", options: sizes.map((s) => ({ value: s, label: s })) },
  ];
  if (showReg) {
    fields.splice(1, 0, { name: "registration", label: "Registration (optional)", required: false, placeholder: "CA 123-456" });
  } else {
    fields.push({ name: "registration", label: "Registration (advanced / optional)", required: false, placeholder: "Hidden in daily ops unless enabled in Settings" });
  }
  return (
    <ResourceCrud
      title="Vehicles"
      subtitle="Identified by colour + make + model (e.g. White Polo). Plates optional."
      endpoint={"/api/v1/vehicles"}
      fields={fields}
      columns={[
        { key: "description", label: "Vehicle", render: (row: any) => vehicleDescription(row) },
        ...(showReg ? [{ key: "registration", label: "Reg" }] : []),
        { key: "size", label: "Size" },
        { key: "customer_id", label: "Customer" },
      ]}
      newDefaults={{ size: "SEDAN", is_active: true, colour: "", make: "", model: "" }}
      transformIn={(f) => ({
        ...f,
        customer_id: Number(f.customer_id),
        year: f.year ? Number(f.year) : null,
        registration: f.registration ? String(f.registration).trim().toUpperCase() : null,
      })}
    />
  );
}
