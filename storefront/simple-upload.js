export async function importPhoto(file,{maxEdge=1200,quality=.82}={}) {
 if(!file || !['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPG, PNG or WebP image.');
 if(file.size>10*1024*1024)throw Error('Choose an image smaller than 10 MB.');
 let bitmap;
 try {
  bitmap=await createImageBitmap(file);
  if(bitmap.width<1||bitmap.height<1)throw Error('Invalid image dimensions');
  const scale=Math.min(1,maxEdge/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fef4e8';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',quality);
 } catch {throw Error('This image could not be opened. Try another JPG, PNG or WebP.');}
 finally {bitmap?.close();}
}
