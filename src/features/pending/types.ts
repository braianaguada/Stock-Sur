export type PendingLine = {
  id: string;
  raw_description: string;
  supplier_code: string | null;
  price: number;
  price_list_versions?: {
    price_lists?: {
      name?: string | null;
      suppliers?: {
        name?: string | null;
      } | null;
    } | null;
  } | null;
};

export type PendingItemOption = {
  id: string;
  name: string;
  sku: string | null;
};
