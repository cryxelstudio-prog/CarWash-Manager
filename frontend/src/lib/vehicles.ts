/** Vehicle / booking display helpers — ticket + description first; plates optional. */

export function vehicleDescription(v?: {
  colour?: string | null;
  make?: string | null;
  model?: string | null;
  size?: string | null;
  description?: string | null;
  vehicle_description?: string | null;
  vehicle_colour?: string | null;
  vehicle_make_model?: string | null;
} | null): string {
  if (!v) return "Vehicle";
  if (v.vehicle_description) return v.vehicle_description;
  if (v.description) return v.description;
  const colour = (v.colour || v.vehicle_colour || "").trim();
  const makeModel =
    (v.vehicle_make_model || `${v.make || ""} ${v.model || ""}`).trim();
  if (colour && makeModel) return `${colour} ${makeModel}`;
  if (makeModel) return makeModel;
  if (colour) return colour;
  if (v.size) return String(v.size).replace(/_/g, " ");
  return "Vehicle";
}

export function bookingPrimaryLabel(b: {
  ticket_number?: string | null;
  booking_number?: string | null;
}): string {
  return b.ticket_number || b.booking_number || "—";
}

export function isShowRegistration(branding: Record<string, string | null | undefined> | null | undefined): boolean {
  const show = (branding?.["vehicles.show_registration"] || "").toLowerCase();
  if (show === "true" || show === "1" || show === "yes") return true;
  const hide = (branding?.["vehicles.hide_registration"] || "true").toLowerCase();
  return !(hide === "true" || hide === "1" || hide === "yes");
}
