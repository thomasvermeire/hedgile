/** Company values the browser needs too (the data access is in companies.server.ts). */
export const stockValuationMethodOptions = ['WAVG', 'Batch', 'FIFO', 'LIFO'] as const;
export type StockValuationMethod = (typeof stockValuationMethodOptions)[number];
