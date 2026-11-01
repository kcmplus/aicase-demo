import test from 'node:test';
import assert from 'node:assert/strict';
import {dragPlacement} from '../storefront/artwork-drag.js';
test('drag delta is independent of display size and moves at pointer speed',()=>{
 const a=dragPlacement({x:40,y:60,dx:20,dy:-40,width:200,height:400});
 const b=dragPlacement({x:40,y:60,dx:10,dy:-20,width:100,height:200});
 assert.deepEqual(a,{x:50,y:50});assert.deepEqual(a,b);
});
test('individual artwork drag compensates for a resized group',()=>{
 assert.deepEqual(dragPlacement({x:40,y:60,dx:20,dy:40,width:200,height:400,groupScale:.5}),{x:60,y:80});
});
test('pointer outside the case clamps the placement and invalid geometry is rejected',()=>{
 assert.deepEqual(dragPlacement({x:50,y:50,dx:-999,dy:999,width:200,height:400}),{x:0,y:100});
 assert.throws(()=>dragPlacement({x:50,y:50,dx:1,dy:1,width:0,height:400}));
});
const {scaleFromPointer,rotationFromPointer,rotateGroup}=await import('../storefront/artwork-drag.js');
test('corner resizing grows and shrinks around the center with limits',()=>{
 assert.equal(scaleFromPointer({scale:100,startDistance:50,distance:75}),150);
 assert.equal(scaleFromPointer({scale:100,startDistance:50,distance:25}),50);
 assert.equal(scaleFromPointer({scale:100,startDistance:50,distance:0}),25);
 assert.equal(scaleFromPointer({scale:100,startDistance:50,distance:500,min:50,max:180}),180);
 assert.throws(()=>scaleFromPointer({scale:100,startDistance:0,distance:50}));
});
test('rotation handle wraps correctly across the -180/180 boundary',()=>{
 assert.equal(rotationFromPointer({rotation:20,startAngle:Math.PI*170/180,angle:-Math.PI*170/180}),40);
 assert.equal(rotationFromPointer({rotation:0,startAngle:-Math.PI/2,angle:0}),90);
});
test('whole-design rotation respects the case aspect ratio and preserves individual scale',()=>{
 const layers=[{id:'one',x:60,y:50,rotation:30}],edits={one:{x:60,y:50,rotation:30,scale:80}};
 const rotated=rotateGroup(edits,layers,90,.5);
 assert.deepEqual(rotated.one,{x:50,y:55,rotation:120,scale:80});assert.equal(edits.one.x,60);
});
