import type { Item } from './types';

export function createItemForm(item?: Item) {
  return {
    sku: item?.sku ?? '', name: item?.name ?? '', supplier: item?.supplier ?? '', supplier_id: item?.supplier_id ?? '',
    brand: item?.brand ?? '', model: item?.model ?? '', attributes: item?.attributes ?? '',
    unit: item?.unit || 'un', category: item?.category ?? '', demand_profile: item?.demand_profile ?? 'LOW',
    demand_monthly_estimate: item?.demand_monthly_estimate?.toString() ?? '',
    description: item?.description ?? '', technical_notes: item?.technical_notes ?? '',
    structured_attributes: Object.entries(item?.structured_attributes ?? {}).map(([key,value]) => key + ': ' + value).join('\n'),
    weight: item?.weight?.toString() ?? '', weight_unit: item?.weight_unit ?? 'kg',
    length: item?.length?.toString() ?? '', width: item?.width?.toString() ?? '', height: item?.height?.toString() ?? '',
    dimension_unit: item?.dimension_unit ?? 'cm',
  };
}
export type ItemFormState = ReturnType<typeof createItemForm>;
export function productDetailsPayload(form: ItemFormState) {
  const nonNegative = (value: string, label: string) => {
    if (!value.trim()) return null;
    const number = Number(value.replace(',', '.'));
    if (!Number.isFinite(number) || number < 0) throw new Error(label + ' debe ser un numero mayor o igual a cero');
    return number;
  };
  const entries = form.structured_attributes.split('\n').filter(line => line.trim()).map(line => {
    const colon = line.indexOf(':');
    if (colon < 1 || !line.slice(colon + 1).trim()) throw new Error('Cada caracteristica debe tener nombre: valor');
    return [line.slice(0,colon).trim(), line.slice(colon+1).trim()] as const;
  });
  if (new Set(entries.map(([key]) => key.toLocaleLowerCase())).size !== entries.length) throw new Error('Hay caracteristicas con el mismo nombre');
  return {
    supplier_id: form.supplier_id || null,
    description: form.description.trim() || null, technical_notes: form.technical_notes.trim() || null,
    structured_attributes: Object.fromEntries(entries),
    weight: nonNegative(form.weight, 'El peso'), weight_unit: form.weight_unit,
    length: nonNegative(form.length, 'El largo'), width: nonNegative(form.width, 'El ancho'), height: nonNegative(form.height, 'El alto'),
    dimension_unit: form.dimension_unit,
  };
}
