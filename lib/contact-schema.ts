export type ContactCategory =
  | "Intern"
  | "Kunde"
  | "Leverandør"
  | "Transport"
  | "Samarbejdspartner"
  | "Andet";

export type ContactRecord = {
  address: string | null;
  category: ContactCategory;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  id: string;
  notes: string | null;
  phone: string | null;
  role: string | null;
};

export const contactCategories: ContactCategory[] = [
  "Intern",
  "Kunde",
  "Leverandør",
  "Transport",
  "Samarbejdspartner",
  "Andet",
];
