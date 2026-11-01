import templates from './assets/phone-templates/templates.json' with {type:'json'};

// Versioned files are immutable. Retain old entries when adding a new revision.
export const phoneTemplates=Object.freeze(templates.map(t=>Object.freeze({...t})));
export function phoneTemplate(model,id){
 const template=phoneTemplates.findLast(t=>t.model===model&&(id===undefined||t.id===id));
 if(id!==undefined&&!template)throw Error('This phone template is unavailable.');
 return template||null;
}
