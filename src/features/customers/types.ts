export interface Customer {
  id: string;
  company_id: string;
  name: string;
  cuit: string | null;
  email: string | null;
  phone: string | null;
  is_occasional: boolean;
}
