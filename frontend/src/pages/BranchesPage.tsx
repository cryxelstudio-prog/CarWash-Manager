import ResourceCrud from "../components/ResourceCrud";

export default function BranchesPage() {
  return (
    <ResourceCrud
      title="Branches"
      endpoint={"/api/v1/branches"}
      fields={[
        { name: "code", label: "Code", required: true },
        { name: "name", label: "Name", required: true },
        { name: "phone", label: "Phone", type: "tel" },
        { name: "email", label: "Email", type: "email" },
        { name: "city", label: "City" },
        { name: "address", label: "Address", type: "textarea" },
      ]}
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "city", label: "City" },
        { key: "phone", label: "Phone" },
      ]}
      newDefaults={{ is_active: true, timezone: "Africa/Johannesburg" }}
    />
  );
}
