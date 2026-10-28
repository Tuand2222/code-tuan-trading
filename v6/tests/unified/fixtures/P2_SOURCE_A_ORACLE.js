function capitalNAV(){
 const dep=getCashflow(), init=Number(state.initialCapital);
 const events=[...state.trades.filter(t=>Number.isFinite(Number(t.netPnl))).map(t=>({date:String(t.closeTime||t.date),amt:Number(t.netPnl),kind:'TRADE'})),...dep.map(d=>({date:d.date+'T00:00',amt:d.amt,kind:'FLOW'}))].sort((a,b)=>a.date.localeCompare(b.date)||(a.kind==='FLOW'?-1:1));
 let eq=init,units=init>0?init/100:0,nav=init>0?100:NaN,peak=nav,maxdd=0,cum=0,invalid=!(init>0);
 for(const v of events){
  if(v.kind==='FLOW'){
   const newEq=eq+v.amt;
   if(!(units>0&&nav>0&&newEq>0)){invalid=true;eq=newEq;continue;}
   units+=v.amt/nav;eq=newEq;
   if(!(units>0)){invalid=true;continue;}
   nav=eq/units;
  } else {eq+=v.amt;cum+=v.amt;if(!(units>0&&eq>0)){invalid=true;nav=NaN;}else nav=eq/units;}
  if(Number.isFinite(nav)&&nav>0){peak=Math.max(peak,nav);maxdd=Math.max(maxdd,1-nav/peak);}
 }
 const dd=Number.isFinite(nav)&&Number.isFinite(peak)&&peak>0?Math.max(0,1-nav/peak):1;
 return{equity:eq,nav,peak,dd,maxdd,pnl:cum,flows:dep.reduce((x,v)=>x+v.amt,0),warning:invalid||!(eq>0&&units>0)};
}
function rckBernoulli(p,b,alpha=.05,beta=.2,n=100){p=range(p,.001,.999);b=Math.max(.01,b);const eta=n>=100?0:Math.min(.25,1/Math.sqrt(Math.max(1,n))),pr=p*(1-eta),lam=Math.log(beta)/Math.log(alpha);const kelly=Math.max(0,p-(1-p)/b),robust=Math.max(0,pr-(1-pr)/b);
 if(robust<=0)return{f:0,kelly,robust,lambda:lam,eta,pr};const phi=f=>pr*Math.pow(1+b*f,-lam)+(1-pr)*Math.pow(1-f,-lam)-1;let lo=0,hi=Math.min(.95,robust);for(let i=0;i<65;i++){const mid=(lo+hi)/2;if(phi(mid)<=0)lo=mid;else hi=mid;}return{f:Math.min(lo,robust),kelly,robust,lambda:lam,eta,pr};}
function rckEmpirical(returns,alpha=.05,beta=.2){
 const a=returns.filter(Number.isFinite),n=a.length,lambda=Math.log(beta)/Math.log(alpha);
 if(n<2||!(lambda>0))return{f:0,kelly:0,lambda,feasible:false};
 const mu=a.reduce((sum,x)=>sum+x,0)/n,neg=a.filter(x=>x<0);
 if(mu<=0||!neg.length)return{f:0,kelly:0,lambda,feasible:false};
 const maxf=Math.min(.999,Math.min(...neg.map(x=>-1/x))*(1-1e-8));
 const derivative=f=>a.reduce((sum,x)=>sum+x/(1+f*x),0)/n;
 const phi=f=>a.reduce((sum,x)=>sum+Math.pow(1+f*x,-lambda),0)/n-1;
 let lo=0,hi=maxf;
 if(derivative(hi)<0){for(let i=0;i<65;i++){const mid=(lo+hi)/2;if(derivative(mid)>0)lo=mid;else hi=mid;}}
 const kelly=derivative(maxf)>=0?maxf:(lo+hi)/2;
 let cap=maxf;
 if(phi(maxf)>0){let left=1e-10,right=maxf;for(let i=0;i<70;i++){const mid=(left+right)/2;if(phi(mid)<=0)left=mid;else right=mid;}cap=left;}
 return{f:Math.max(0,Math.min(kelly,cap)),kelly,lambda,feasible:true};
}
function analyticRoR(p,b,stopPct,riskPct){p=range(p,0,1);b=Math.max(.01,b);const edge=p*b-(1-p),u=stopPct/riskPct;if(edge<=0)return 1;if(p>=1)return 0;if(p<=0)return 1;const fn=x=>p*Math.pow(x,b+1)-x+1-p;let lo=0,hi=1-1e-10;if(fn(hi)>0)return 1;for(let i=0;i<70;i++){let m=(lo+hi)/2;if(fn(m)>0)lo=m;else hi=m;}return Math.pow((lo+hi)/2,Math.max(0,u));}
function simulate(pool,o,seed){
            const rnd=mulberry(seed),n=pool.length,H=o.horizon,R=o.runs,k=o.riskPct/100;
            const steps=Array.from({length:H+1},()=>new Float64Array(R).fill(1)),dds=new Float64Array(R);
            for(let r=0;r<R;r++){let eq=1,pk=1,dd=0;for(let i=1;i<=H;i++){eq*=Math.max(0,1+k*pool[Math.floor(rnd()*n)]);if(eq>pk)pk=eq;if(1-eq/pk>dd)dd=1-eq/pk;steps[i][r]=eq;}dds[r]=dd;}
            const q=(a,p)=>{const b=Array.from(a).sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor(p*b.length))];};
            const fin=steps[H],bands=[.05,.25,.5,.75,.95].map(p=>steps.map(st=>(q(st,p)-1)*100));
            return {bands,med:q(fin,.5)-1,p5:q(fin,.05)-1,p95:q(fin,.95)-1,win:Array.from(fin).filter(v=>v>1).length/R,ddMed:q(dds,.5),ddProb:Array.from(dds).filter(v=>v>=o.ddLimit).length/R};
        }
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function range(x,low,hi){return Math.max(low,Math.min(hi,x));}