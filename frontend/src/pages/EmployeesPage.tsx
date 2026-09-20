import ResourceCrud from "../components/ResourceCrud";

export default function EmployeesPage() {
  return (
    <ResourceCrud
      title="Employees"
      endpoint={"/api/v1/employees"}
      fields={[
        { name: "employee_number", label: "Employee no.", required: true },
        { name: "first_name", label: "First name", required: true },
        { name: "last_name", label: "Last name", required: true },
        { name: "phone", label: "Phone", type: "tel" },
        { name: "email", label: "Email", type: "email" },
        { name: "job_title", label: "Job title" },
        { name: "hourly_rate", label: "Hourly rate", type: "number" },
      ]}
      columns={[
        { key: "employee_number", label: "No." },
        { key: "full_name", label: "Name", render: (r) => r.full_name || `${r.first_name} ${r.last_name}` },
        { key: "job_title", label: "Title" },
        { key: "phone", label: "Phone" },
      ]}
      newDefaults={{ is_active: true, can_operate: true }}
      transformIn={(f) => ({ ...f, hourly_rate: f.hourly_rate === "" || f.hourly_rate == null ? null : Number(f.hourly_rate) })}
    />
  );
}
