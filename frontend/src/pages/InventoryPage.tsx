import ResourceCrud from "../components/ResourceCrud";
import { formatMoney } from "../lib/api";

export default function InventoryPage() {
  return (
    <ResourceCrud
      title="Inventory"
      endpoint={"/api/v1/inventory"}
      fields={[
        { name: "sku", label: "SKU", required: true },
        { name: "name", label: "Name", required: true },
        { name: "category", label: "Category" },
        { name: "unit", label: "Unit" },
        { name: "quantity_on_hand", label: "Qty on hand", type: "number" },
        { name: "reorder_level", label: "Reorder level", type: "number" },
        { name: "unit_cost", label: "Unit cost", type: "number" },
      ]}
      columns={[
        { key: "sku", label: "SKU" },
        { key: "name", label: "Name" },
        { key: "quantity_on_hand", label: "Qty" },
        { key: "reorder_level", label: "Reorder" },
        { key: "unit_cost", label: "Cost", render: (r) => formatMoney(r.unit_cost) },
        { key: "is_low_stock", label: "Low?", render: (r) => r.is_low_stock ? "YES" : "" },
      ]}
      newDefaults={{ category: "CONSUMABLE", unit: "unit", quantity_on_hand: 0, reorder_level: 0, unit_cost: 0, is_active: true }}
      transformIn={(f) => ({
        ...f,
        quantity_on_hand: Number(f.quantity_on_hand || 0),
        reorder_level: Number(f.reorder_level || 0),
        unit_cost: Number(f.unit_cost || 0),
      })}
    />
  );
}
