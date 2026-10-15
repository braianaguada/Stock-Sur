import { describe, expect, it } from 'vitest';
import { createItemForm, productDetailsPayload } from './form';

describe('product details', () => {
  it('keeps optional details empty for legacy products', () => {
    const form = createItemForm();
    expect(productDetailsPayload(form)).toEqual({supplier_id:null,description:null,technical_notes:null,structured_attributes:{},weight:null,weight_unit:'kg',length:null,width:null,height:null,dimension_unit:'cm'});
    expect(form.unit).toBe('un');
  });
  it('separates sale units, physical dimensions and structured characteristics', () => {
    const form = {...createItemForm(),unit:'un',weight:'1,25',length:'30',description:'  Completa  ',technical_notes:'  Refrigerante  ',structured_attributes:'Diametro: 1/2\nMaterial: Cobre',supplier_id:'provider'};
    expect(productDetailsPayload(form)).toMatchObject({supplier_id:'provider',weight:1.25,length:30,description:'Completa',technical_notes:'Refrigerante',structured_attributes:{Diametro:'1/2',Material:'Cobre'}});
    expect(form.unit).toBe('un');
  });
  it.each(['-1','Infinity','NaN','abc'])('rejects invalid physical measurements %s', value => {
    expect(() => productDetailsPayload({...createItemForm(),weight:value})).toThrow('mayor o igual a cero');
    expect(() => productDetailsPayload({...createItemForm(),width:value})).toThrow('mayor o igual a cero');
  });
  it.each(['Sin valor','Color:','Color: rojo\ncolor: azul'])('rejects ambiguous characteristics %s', structured_attributes => {
    expect(() => productDetailsPayload({...createItemForm(),structured_attributes})).toThrow();
  });
});
