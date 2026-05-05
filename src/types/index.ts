export type ModuleId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface Transaction {
  date: string;
  description: string;
  category: string;
  categoryClass: string;
  amount: number;
}

export interface PLRow {
  label: string;
  value: string;
  type: 'pos' | 'neg' | 'neutral' | 'bold' | 'sub';
  isTotal?: boolean;
  isSub?: boolean;
  isBold?: boolean;
}

export interface Product {
  oem: string;
  name: string;
  category: string;
  categoryColor: string;
  stockAlmaty: number;
  stockAstana: number;
  cost: number;
  status: 'ok' | 'low' | 'zero';
}

export interface Movement {
  date: string;
  type: 'in' | 'out' | 'transfer';
  product: string;
  oem: string;
  from: string;
  to: string;
  qty: number;
  document: string;
}
