export interface StatementMetadata {
  bank: string;
  accountType: string;
  accountNumber: string;
  statementPeriod: {
    from: string;
    to: string;
  };
  currency: string;
}

export interface ParsedTransaction {
  date: string;
  narration: string;
  debit: number | null;
  credit: number | null;
  balance: number;
  reference: string;
  sequence: number;
}

export interface ParsedStatement {
  metadata: StatementMetadata;
  openingBalance: number;
  closingBalance: number;
  transactions: ParsedTransaction[];
}
