import type { ParsedRow } from "@/lib/importParser";

export type ImportStep = "upload" | "map" | "preview" | "done";

export interface ImportMappingState {
  supplier_code: string;
  description: string;
  price: string;
}

export interface ImportPreviewRow {
  supplier_code: string;
  raw_description: string;
  price: number;
}

export type { ParsedRow };
