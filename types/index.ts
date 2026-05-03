export type CaseStage =
  | "DOCUMENTS_PENDING"
  | "DOCUMENT_SUBMITTED"
  | "PAYMENT_MADE"
  | "SUBMITTED_TO_IMMIGRATION"
  | "AWAITING_COLLECTION"
  | "PASSPORT_COLLECTED";
export type RiskState = "COMPLIANT" | "EXPIRING_SOON" | "EXPIRED" | "UNKNOWN";

export interface Student {
  id: string;
  student_id: string;
  full_name: string;
  email: string;
  nationality: string;
  phone?: string;
  created_at: string;
}

export interface ComplianceCase {
  id: string;
  student_id: string;
  current_stage: CaseStage;
  permit_expiry_date: string | null;
  passport_expiry_date: string | null;
  efns_reference_number?: string;
  updated_at: string;
}

export interface DocumentRequest {
  id: string;
  case_id: string;
  title: string;
  status: "PENDING" | "FULFILLED";
  created_at: string;
}
