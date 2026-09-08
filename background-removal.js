(function(){
  "use strict";

  const LIBRARY_URL="https://esm.sh/@imgly/background-removal@1.7.0?bundle&deps=onnxruntime-web@1.21.0";
  let libraryPromise=null;

  function getLibrary(){
    if(!libraryPromise)libraryPromise=import(LIBRARY_URL);
    return libraryPromise;
  }

  async function decodeBlob(blob){
    if("createImageBitmap" in window)return createImageBitmap(blob);
    const url=URL.createObjectURL(blob);
    try{
      return await new Promise((resolve,reject)=>{
        const image=new Image();
        image.onload=()=>resolve(image);
        image.onerror=reject;
        image.src=url;
      });
    }finally{
      URL.revokeObjectURL(url);
    }
  }

  function morphology(source,width,height,radius,expand){
    if(radius<=0)return source;
    const horizontal=new Uint8ClampedArray(source.length);
    const result=new Uint8ClampedArray(source.length);
    const initial=expand?0:255;
    for(let y=0;y<height;y+=1){
      const row=y*width;
      for(let x=0;x<width;x+=1){
        let value=initial;
        const start=Math.max(0,x-radius),end=Math.min(width-1,x+radius);
        for(let sample=start;sample<=end;sample+=1)value=expand?Math.max(value,source[row+sample]):Math.min(value,source[row+sample]);
        horizontal[row+x]=value;
      }
    }
    for(let y=0;y<height;y+=1){
      for(let x=0;x<width;x+=1){
        let value=initial;
        const start=Math.max(0,y-radius),end=Math.min(height-1,y+radius);
        for(let sample=start;sample<=end;sample+=1)value=expand?Math.max(value,horizontal[sample*width+x]):Math.min(value,horizontal[sample*width+x]);
        result[y*width+x]=value;
      }
    }
    return result;
  }

  function applyMask(image,mask,options){
    const width=image.naturalWidth,height=image.naturalHeight;
    const radius=Math.abs(Math.round(options.edgeOffset||0));
    const shifted=morphology(mask,width,height,radius,(options.edgeOffset||0)>0);
    const threshold=Math.max(0,Math.min(100,options.threshold??50))/100*255;
    const feather=Math.max(0,Math.min(40,options.feather??10))/40*96;
    const lower=threshold-feather,upper=threshold+feather;
    const output=document.createElement("canvas");
    output.width=width;
    output.height=height;
    const context=output.getContext("2d",{willReadFrequently:true});
    context.drawImage(image,0,0,width,height);
    const pixels=context.getImageData(0,0,width,height);
    for(let index=0;index<shifted.length;index+=1){
      const alpha=shifted[index];
      let normalized;
      if(feather===0)normalized=alpha>=threshold?1:0;
      else{
        normalized=Math.max(0,Math.min(1,(alpha-lower)/(upper-lower)));
        normalized=normalized*normalized*(3-2*normalized);
      }
      const pixelIndex=index*4+3;
      pixels.data[pixelIndex]=Math.round(pixels.data[pixelIndex]*normalized);
    }
    context.putImageData(pixels,0,0);
    return output;
  }

  async function createMask(file,image,options,onProgress){
    const library=await getLibrary();
    const device=options.device==="auto"?(navigator.gpu?"gpu":"cpu"):options.device;
    const maskBlob=await library.segmentForeground(file,{
      model:options.model,
      device,
      output:{format:"image/png",quality:1},
      progress:(key,current,total)=>onProgress?.({stage:key,current,total})
    });
    const decoded=await decodeBlob(maskBlob);
    const canvas=document.createElement("canvas");
    canvas.width=image.naturalWidth;
    canvas.height=image.naturalHeight;
    const context=canvas.getContext("2d",{willReadFrequently:true});
    context.drawImage(decoded,0,0,canvas.width,canvas.height);
    if(typeof decoded.close==="function")decoded.close();
    const rgba=context.getImageData(0,0,canvas.width,canvas.height).data;
    const alpha=new Uint8ClampedArray(canvas.width*canvas.height);
    for(let index=0;index<alpha.length;index+=1)alpha[index]=rgba[index*4+3];
    return{key:`${options.model}|${device}`,alpha};
  }

  async function process(file,image,cache,options,onProgress){
    const device=options.device==="auto"?(navigator.gpu?"gpu":"cpu"):options.device;
    const maskKey=`${options.model}|${device}`;
    let maskCache=cache?.mask;
    if(!maskCache||maskCache.key!==maskKey){
      onProgress?.({stage:"model:start",current:0,total:1});
      maskCache=await createMask(file,image,options,onProgress);
    }
    const resultKey=`${maskKey}|${options.threshold}|${options.feather}|${options.edgeOffset}`;
    if(cache?.resultKey===resultKey&&cache.canvas)return cache;
    onProgress?.({stage:"refine",current:0,total:1});
    const canvas=applyMask(image,maskCache.alpha,options);
    onProgress?.({stage:"refine",current:1,total:1});
    return{mask:maskCache,resultKey,canvas};
  }

  async function encode(canvas,format="image/png",quality=.9){
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,format,format==="image/png"?undefined:quality));
    if(!blob)throw new Error("去背圖片輸出失敗");
    return blob;
  }

  window.J5XBackgroundRemoval=Object.freeze({process,encode});
})();
