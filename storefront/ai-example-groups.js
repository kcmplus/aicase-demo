// Group the gallery by source photo while keeping every saved case/result intact.
// Both the public catalog and admin records use this grouping rule.
export function groupAIExamples(examples){
 const groups=new Map();
 const resultCount=example=>Object.keys(example.results||{}).length;
 for(const example of examples){
  const original=(example.original??example.original_path??'').replace(/^\.\//,'/');
  const key=original||example.code||example.id;
  if(!groups.has(key))groups.set(key,{key,original,example,examples:[]});
  const group=groups.get(key);
  group.examples.push(example);
  // Prefer the broad case title over a one-off style study of the same photo.
  if(resultCount(example)>resultCount(group.example))group.example=example;
 }
 return [...groups.values()];
}
