#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function reconcileReviews(files){
  const documents=new Map(),inputs=[],errors=[];
  for(const file of files){const bytes=await fs.readFile(file),data=JSON.parse(bytes);inputs.push({path:path.resolve(file),sha256:hash(bytes),listingCounts:data.listingCounts||null,limitations:data.limitations||['Coverage is limited to records in this review; no inaccessible-document review is implied.']});
    for(const r of Array.isArray(data)?data:data.records||[]){const s=r.source||{},id=s.sha256;
      if(!id||!s.path){errors.push(`${r.id}: missing original identity`);continue;}
      let current;try{current=hash(await fs.readFile(s.path));}catch{errors.push(`${r.id}: missing source file`);}
      if(current&&current!==id)errors.push(`${r.id}: source bytes changed`);
      const doc=documents.get(id)||{sha256:id,path:s.path,format:s.format||path.extname(s.path).slice(1),pageCount:s.pages,aliases:[],reviews:[]};
      if(!doc.aliases.includes(r.id))doc.aliases.push(r.id);
      doc.reviews.push({review:path.resolve(file),disposition:r.disposition,numbering:r.pageNumbering||'Recorded source page numbers; inspect review before reuse',method:r.reviewMethod||'Saved executive-summary review; not exhaustive visual QA',ranges:r.genuineFrontSummaryPageRanges||[],assessment:r.assessment});documents.set(id,doc);
    }
  }
  return {schema:'professional-slides.source-corpus/v1',accepted:!errors.length,inputs,uniqueDocuments:documents.size,documents:[...documents.values()],errors,scope:'Verified accessible original bytes and saved review dispositions; no full-page visual acceptance claim.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const report=await reconcileReviews(process.argv.slice(2));console.log(JSON.stringify(report,null,2));if(!report.accepted)process.exitCode=1;}
