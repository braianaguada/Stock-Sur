import { describe,expect,it } from 'vitest';
import { normalizeSaleUnit,validateSaleQuantity } from './stock-quantity';
describe('sale quantities', () => {
 it.each(['un','UN',' unidades ','unidad','und'])('rejects fractions for %s', unit => {expect(() => validateSaleQuantity(1.5,unit)).toThrow('sin decimales');});
 it.each(['kg','g','lt','ml','m','cm','metros','litros'])('accepts fractional measurements for %s', unit => {expect(() => validateSaleQuantity(1.25,unit)).not.toThrow();});
 it('accepts whole returns and negative adjustments', () => {expect(() => validateSaleQuantity(-2,'un')).not.toThrow();});
 it.each([NaN,Infinity,-Infinity])('rejects nonfinite %s', value => {expect(() => validateSaleQuantity(value,'kg')).toThrow();});
 it('normalizes imported units without discarding legacy custom units', () => {expect(normalizeSaleUnit(' MTS ')).toBe('m');expect(normalizeSaleUnit('JGO')).toBe('jgo');expect(normalizeSaleUnit('L')).toBe('lt');});
});
