import {aiExamples,aiStyles} from './runtime-catalog.js';
import {groupAIExamples} from './ai-example-groups.js';
export {aiExamples};
const emptyExample={id:'',name:'Example',subject:'No examples available',original:'',origin:'',results:{}};
export const exampleFor=id=>aiExamples.find(e=>e.id===id)||aiExamples[0]||emptyExample;
export const exampleResult=(exampleId='portrait',styleId)=>aiExamples.find(e=>e.id===exampleId)?.results[styleId];

// An effect still selects its exact saved case, even when several share a photo.
export const aiGroups=()=>groupAIExamples(aiExamples).map(group=>({...group,looks:group.examples.flatMap(example=>aiStyles.filter(style=>example.results[style.id]).map(style=>({example,style,image:example.results[style.id]})))})).filter(group=>group.looks.length);
