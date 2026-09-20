import { useEffect, useState } from "react";
import ResourceCrud from "../components/ResourceCrud";
import { api } from "../lib/api";

export default function WashBaysPage() {
  const [branches, setBranches] = useState<any[]>([]);
  useEffect(() => {
    api<any>("/api/v1/branches").then((d) => setBranches(d.items || [])).catch(() => undefined);
  }, []);
  return (
    <ResourceCrud
      title="Wash Bays"
      endpoint={"/api/v1/wash-bays"}
      fields={[
        { name: "branch_id", label: "Branch", type: "select", required: true, options: branches.map((b) => ({ value: b.id, label: b.name })) },
        { name: "name", label: "Name", required: true },
        { name: "bay_number", label: "Bay number", type: "number" },
        { name: "bay_type", label: "Type" },
      ]}
      columns={[
        { key: "name", label: "Name" },
        { key: "bay_number", label: "No." },
        { key: "bay_type", label: "Type" },
        { key: "branch_id", label: "Branch" },
      ]}
      newDefaults={{ bay_number: 1, bay_type: "STANDARD", is_active: true }}
      transformIn={(f) => ({ ...f, branch_id: Number(f.branch_id), bay_number: Number(f.bay_number || 1) })}
    />
  );
}
