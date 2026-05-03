import { RiskState } from "@/types";

export function getRiskState(expiryDate: string | null): RiskState {
  if (!expiryDate) return "UNKNOWN";

  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "EXPIRED";
  if (diffDays <= 30) return "EXPIRING_SOON";
  return "COMPLIANT";
}

export function getStatusStyles(state: RiskState) {
  switch (state) {
    case "EXPIRED":
      return "bg-red-50 text-red-700 border-red-200 ring-red-600/10";
    case "EXPIRING_SOON":
      return "bg-amber-50 text-amber-700 border-amber-200 ring-amber-600/10";
    case "COMPLIANT":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-600/10";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200 ring-slate-600/10";
  }
}
