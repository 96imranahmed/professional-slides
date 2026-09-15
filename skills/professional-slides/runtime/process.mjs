import {spawn} from 'node:child_process';
/** Retry transport failures only; a rejected content review is never retried here. */
export async function runProcess(bin,args,{input,timeoutMs=180000,retries=0,stdio='pipe',onRetry}={}) {
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0||!Number.isInteger(retries)||retries<0||retries>2)throw new Error('Invalid process budget');
  for(let attempt=0;;attempt++)try {
    return await new Promise((resolve,reject)=>{
      const child=spawn(bin,args,{stdio:['pipe',stdio==='inherit'?'inherit':'ignore','pipe'],detached:process.platform!=='win32'});let detail='',timedOut=false,killTimer;
      child.stderr.on('data',d=>{detail=(detail+d).slice(-6000);});
      const stop=signal=>{try{if(process.platform!=='win32'&&child.pid)process.kill(-child.pid,signal);else child.kill(signal);}catch(e){if(e.code!=='ESRCH')throw e;}};
      const timer=setTimeout(()=>{timedOut=true;stop('SIGTERM');killTimer=setTimeout(()=>stop('SIGKILL'),1000);},timeoutMs);
      const clear=()=>{clearTimeout(timer);clearTimeout(killTimer);};
      child.on('error',e=>{clear();reject(e);});
      child.on('close',code=>{clear();if(code===0&&!timedOut)resolve();else {const e=new Error(timedOut?`Process timed out: ${detail}`:`${bin} exited ${code}: ${detail}`);e.transient=timedOut||/429|rate limit|503|ECONNRESET|temporarily unavailable/i.test(detail);reject(e);}});
      child.stdin.on('error',e=>{if(e.code!=='EPIPE')child.kill('SIGTERM');});child.stdin.end(input);
    });
  }catch(e){if(!e.transient||attempt>=retries)throw e;onRetry?.(attempt+1);}
}
