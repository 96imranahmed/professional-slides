import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export async function writeMontage(renders,output){
  if(!process.env.RUNTIME_NODE_MODULES)throw new Error('RUNTIME_NODE_MODULES is required');
  const packageDir=path.join(process.env.RUNTIME_NODE_MODULES,'sharp');
  const manifest=JSON.parse(await fs.readFile(path.join(packageDir,'package.json'),'utf8'));
  const {default:sharp}=await import(pathToFileURL(path.join(packageDir,manifest.main)).href);
  const width=640,height=360,columns=Math.min(3,renders.length),rows=Math.ceil(renders.length/columns);
  const images=await Promise.all(renders.map(async(r,i)=>({input:await sharp(await fs.readFile(r.path)).resize(width,height).png().toBuffer(),left:(i%columns)*width,top:Math.floor(i/columns)*height})));
  await sharp({create:{width:columns*width,height:rows*height,channels:4,background:'#ffffff'}}).composite(images).png().toFile(output);
  return output;
}
