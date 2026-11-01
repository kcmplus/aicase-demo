export function dragPlacement({x,y,dx,dy,width,height,groupScale=1}){
 if(![x,y,dx,dy,width,height,groupScale].every(Number.isFinite)||width<=0||height<=0||groupScale<=0)throw Error('Invalid artwork drag geometry.');
 const bound=v=>Math.round(Math.max(0,Math.min(100,v))*10)/10;
 return {x:bound(x+dx/width*100/groupScale),y:bound(y+dy/height*100/groupScale)};
}
export const wrapDegrees=value=>Math.round((((value+180)%360+360)%360-180)*10)/10;
export function scaleFromPointer({scale,startDistance,distance,min=25,max=200}){
 if(![scale,startDistance,distance,min,max].every(Number.isFinite)||startDistance<=0||distance<0)throw Error('Invalid resize geometry.');
 return Math.round(Math.max(min,Math.min(max,scale*distance/startDistance))*10)/10;
}
export function rotationFromPointer({rotation=0,startAngle,angle}){return wrapDegrees(rotation+(angle-startAngle)*180/Math.PI);}
export function rotateGroup(edits,layers,degrees,aspect){
 const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a),bound=v=>Math.round(Math.max(0,Math.min(100,v))*10)/10;
 return Object.fromEntries(layers.map(l=>{const e=edits[l.id]||{x:l.x,y:l.y,scale:100,rotation:l.rotation},x=(e.x-50)*aspect,y=e.y-50;return [l.id,{...e,x:bound(50+(x*c-y*s)/aspect),y:bound(50+x*s+y*c),rotation:wrapDegrees(e.rotation+degrees)}];}));
}
