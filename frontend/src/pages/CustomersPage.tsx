import ResourceCrud from "../components/ResourceCrud";

export default function CustomersPage() {
  return (
    <ResourceCrud
      title="Customers"
      subtitle="Customer directory"
      endpoint={"/api/v1/customers"}
      fields={[
        { name: "first_name", label: "First name", required: true },
        { name: "last_name", label: "Last name", required: true },
        { name: "phone", label: "Phone", required: true, type: "tel" },
        { name: "email", label: "Email", type: "email" },
        { name: "company_name", label: "Company" },
        { name: "city", label: "City" },
        { name: "notes", label: "Notes", type: "textarea" },
      ]}
      columns={[
        { key: "customer_number", label: "No." },
        { key: "full_name", label: "Name", render: (r: any) => r.full_name || (r.first_name + " " + r.last_name) },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "city", label: "City" },
      ]}
      newDefaults={{ is_active: true }}
    />
  );
}
