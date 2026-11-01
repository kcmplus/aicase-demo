import {phoneTemplates,phoneTemplate} from './phone-templates.js';
import {validatePersonalPass} from './simple-personalize.js';
// A code identifies a versioned preset or locally saved custom design, not payment.
export const designs = [
  {id:'bloom', name:'In Full Bloom', category:'A little joy, every day.', color:'#e7efea'},
  {id:'type', name:'Make It Yours', category:'Say it your way.', color:'#f2e8e8'},
  {id:'abstract', name:'Off Script', category:'A different kind of everyday.', color:'#eae6f1'},
  {id:'sunset', name:'Slow Moments', category:'Take the scenic route.', color:'#f3e9dc'},
  {id:'minimal-heart', name:'Simply Yours', category:'Less, with a little love.', color:'#eeeae5'},
  {id:'citrus', name:'Sunday Club', category:'Keep the good days close.', color:'#e9ecdf'},
];
export const legacyPhoneModels = ['iPhone 16 Pro', 'iPhone 16', 'iPhone 15 Pro', 'iPhone 15', 'Samsung S24'];
// New selections show only the supplied templates. Keep historical identifiers
// separate so opening an existing design never substitutes another case shape.
export const selectablePhoneModels = [...new Set(phoneTemplates.map(t=>t.model))];
export const phoneModels = [...new Set([...legacyPhoneModels,...selectablePhoneModels])];
export const stations = [
  {id:'DEMO-01',name:'Demo station 01',online:true,models:phoneModels},
  {id:'DEMO-02',name:'Demo station 02 · limited stock',online:true,models:['iPhone 16 Pro','iPhone 16']},
  {id:'DEMO-03',name:'Demo station 03 · offline',online:false,models:phoneModels},
];
export function createPass(designId, model) {
  const d = designs.findIndex(item => item.id === designId);
  const m = legacyPhoneModels.indexOf(model);
  if (d < 0) throw Error('Choose a design from the collection.');
  if (m < 0) throw Error('Choose your phone model first.');
  const body = `1${d + 1}${m + 1}`;
  const check = (Number(body) * 7) % 10;
  return {version:1, designId, model, code:`POP-${body}${check}`};
}
export function createPersonalPass(selection) {
  if(!phoneModels.includes(selection.model))throw Error('Choose your phone model first.');
  if(selection.source!=='photo'&&!designs.some(d=>d.id===selection.designId))throw Error('Choose a design from the collection.');
  const code='POP-C-'+crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase();
  const template=phoneTemplate(selection.model,selection.phoneTemplateId);
  return validatePersonalPass({...selection,...(template?{phoneTemplateId:template.id}:{}),version:2,code});
}
export function readPass(input, personalPass) {
  const code = String(input || '').trim().toUpperCase();
  if(/^POP-C-[A-F0-9]{16}$/.test(code)) {
    if(!personalPass||personalPass.code!==code)throw Error('This custom pass is saved in its original browser. Open the station demo there.');
    if(!phoneModels.includes(personalPass.model)||!designs.some(d=>d.id===personalPass.designId))throw Error('The phone model or design in this pass is unavailable.');
    return validatePersonalPass(personalPass);
  }
  const match = /^POP-1([1-6])([1-5])([0-9])$/.exec(code);
  if (!match) throw Error('That code isn’t recognized. Use the POP- code on your design pass.');
  const pass = createPass(designs[Number(match[1])-1].id, legacyPhoneModels[Number(match[2])-1]);
  if (pass.code !== code) throw Error('Check the last digit of your design code and try again.');
  return pass;
}
export function stationAvailability(stationId, pass) {
  const station = stations.find(item => item.id === stationId);
  if (!station) return {ok:false,message:'Choose a valid demo station.'};
  if (!station.online) return {ok:false,message:'This station is offline. Try another station.'};
  if (!station.models.includes(pass.model)) return {ok:false,message:'This phone case is out of stock here. Try demo station 01.'};
  return {ok:true,message:'Your phone case is available at this demo station.'};
}
export function startPrint(pass, stationId) {
  const validated = readPass(pass?.code, pass);
  const status = stationAvailability(stationId, validated);
  if (!status.ok) throw Error(status.message);
  return {pass:validated, stationId, status:'printing'};
}
export function advancePrint(job) {
  if (!job || !['printing','ready'].includes(job.status)) throw Error('There is no active print to continue.');
  return {...job, status:job.status === 'printing' ? 'ready' : 'collected'};
}
