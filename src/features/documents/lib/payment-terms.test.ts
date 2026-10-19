import { describe, expect, it } from 'vitest';
import { customerPaymentTerms } from './payment-terms';
describe('customerPaymentTerms', () => {
  it.each([[null, 'Contado'], [{ account_due_days: 0 }, 'Contado'], [{ account_due_days: 30 }, '30 d\u00edas'], [{ account_due_days: 45 }, '45 d\u00edas']] as const)('derives terms without losing legacy periods', (customer, expected) => {
    expect(customerPaymentTerms(customer)).toBe(expected);
  });
});
