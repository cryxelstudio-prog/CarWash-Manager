import ResourceCrud from "../components/ResourceCrud";

export default function SuppliersPage() {
  return (
    <ResourceCrud
      title="Suppliers"
      endpoint={"/api/v1/suppliers"}
      fields={[
        { name: "code", label: "Code", required: true },
        { name: "name", label: "Name", required: true },
        { name: "contact_name", label: "Contact" },
        { name: "phone", label: "Phone", type: "tel" },
        { name: "email", label: "Email", type: "email" },
        { name: "address", label: "Address", type: "textarea" },
      ]}
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "contact_name", label: "Contact" },
        { key: "phone", label: "Phone" },
      ]}
      newDefaults={{ is_active: true }}
    />
  );
}
