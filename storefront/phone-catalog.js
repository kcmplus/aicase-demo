// Preserve catalog order: existing QR codes refer to the original model indexes.
export function phoneBrand(model='') {
 if(/^iPhone\b/i.test(model))return 'Apple';
 return model.trim().split(/\s+/)[0]||'';
}
export function phoneBrands(models) {return [...new Set(models.map(phoneBrand).filter(Boolean))];}
const normalize=value=>value.toLowerCase().replace(/[\s._-]+/g,'');
export function findPhoneModels(models,brand,query='') {
 const terms=query.trim().split(/\s+/).map(normalize).filter(Boolean);
 return models.filter(model=>phoneBrand(model)===brand&&terms.every(term=>normalize(brand+' '+model).includes(term)));
}
