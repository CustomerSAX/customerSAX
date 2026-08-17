import { page, paging, type PagingArgs } from "../shared/paging.js";

type QuoteArgs = PagingArgs & {
  companyKey?: string;
  customerId?: string;
};

type QuoteRecord = {
  companyKey?: string;
  companyName?: string;
  createdAt?: string;
  customerEmail?: string;
  customerId?: string;
  id: string;
  key?: string;
  lastModifiedAt?: string;
  quoteNumber?: string;
  status?: string;
  totalPrice?: {
    centAmount: number;
    currencyCode: string;
    fractionDigits: number;
  };
};

const sampleQuotes: QuoteRecord[] = [
  {
    companyKey: "doomsday",
    companyName: "Doomsday",
    createdAt: "2026-07-22T10:15:00.000Z",
    customerEmail: "shivam.soni@royalcyber.com",
    id: "quote-doomsday-501",
    key: "quote-doomsday-501",
    lastModifiedAt: "2026-07-22T10:15:00.000Z",
    quoteNumber: "Q-501",
    status: "Open",
    totalPrice: {
      centAmount: 450000,
      currencyCode: "USD",
      fractionDigits: 2
    }
  }
];

export const resolvers = {
  quotes: (_parent: unknown, args: QuoteArgs) => {
    const { limit, offset } = paging(args);
    const filtered = sampleQuotes.filter((quote) => {
      if (args.companyKey && quote.companyKey !== args.companyKey) return false;
      if (args.customerId && quote.customerId !== args.customerId) return false;
      return true;
    });

    return page(filtered.slice(offset, offset + limit), filtered.length, offset);
  }
};
