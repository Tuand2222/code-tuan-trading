
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function mean(a){let s=0;for(let i=0;i<a.length;i++)s+=a[i];return s/(a.length||1)}
function esW(a,al){const s=[...a].sort((x,y)=>x-y),m=1-al,w=1/s.length;let rem=m,t=0;for(const x of s){const k=Math.min(w,rem);t+=k*x;rem-=k;if(rem<1e-12)break}return t/m}
function varW(a,al){const s=[...a].sort((x,y)=>x-y),m=1-al;let c=0;for(const x of s){c+=1/s.length;if(c>=m-1e-12)return x}return s[s.length-1]}
function cum(R,n,h,seed){const rnd=seed!=null?mulberry(seed):Math.random,o=new Float64Array(n);for(let i=0;i<n;i++){let s=0;for(let k=0;k<h;k++)s+=R[(rnd()*R.length)|0];o[i]=s}return o.sort()}
function tailMult(a,m,mode){const arr=[...a];if(m<=1)return{arr,k:0,L:a.filter(x=>x<0).length};
if(mode==='all'||mode==='all_trades'){const ix=arr.map((x,i)=>[x,i]).sort((p,q)=>p[0]-q[0]),k=Math.max(1,Math.ceil(.025*arr.length));ix.slice(0,k).forEach(z=>{if(arr[z[1]]<0)arr[z[1]]*=m;else arr[z[1]]-=Math.abs(arr[z[1]])*(m-1)});return{arr,k,L:arr.length}}
const ix=arr.map((x,i)=>[x,i]).filter(z=>z[0]<0).sort((p,q)=>p[0]-q[0]);if(!ix.length)return{arr,k:0,L:0};const k=Math.max(1,Math.ceil(.025*ix.length));ix.slice(0,k).forEach(z=>{arr[z[1]]*=m});return{arr,k,L:ix.length}}

function omegaCalc(p){
  const {R1,R2,lo,hi,L,mu1,mu2}=p;
  const om=(arr,l)=>{if(!arr||!arr.length)return 1;let g=0,d=0;for(let i=0;i<arr.length;i++){const x=arr[i];if(x>l)g+=x-l;else if(x<l)d+=l-x}return d>0?Math.min(g/d,20):20};
  const pts1=[],pts2=[];
  for(let i=0;i<100;i++){
    const x=lo+(hi-lo)*i/99;
    pts1.push({x,y:om(R1,x)});
    if(R2&&R2.length)pts2.push({x,y:om(R2,x)});
  }
  const s1=[...R1].sort((a,b)=>a-b);
  const qGrid=[10,20,30,40,50,60,70,80,90].map(q=>{
    const idx=Math.min(s1.length-1,Math.max(0,Math.floor((q/100)*s1.length)));
    const qVal=s1[idx];
    return {q,rVal:qVal,om1:om(R1,qVal),om2:R2&&R2.length?om(R2,qVal):null};
  });
  return {pts1,pts2,omL1:om(R1,L),omL2:R2&&R2.length?om(R2,L):null,omMu1:om(R1,mu1),omMu2:R2&&R2.length?om(R2,mu2):null,qGrid};
}

function esCalc(p){
  const {R,w,slip,lh,tailMode}=p;
  const c=cum(R,5000,10,202605),k=Math.floor(c.length*.025),k1=Math.floor(c.length*.01),v975=c[k],v99=c[k1];
  let sumK=0;for(let i=0;i<k;i++)sumK+=c[i];const es=sumK/Math.max(1,k);
  const rS=tailMult(R,slip,tailMode),cw=cum(rS.arr,5000,w,202606),kw=Math.floor(cw.length*.025);
  let sumKw=0;for(let i=0;i<kw;i++)sumKw+=cw[i];const esS=(sumKw/Math.max(1,kw))*Math.sqrt(lh/10);
  const wn=Math.min(w,R.length);let worst=Infinity,nwin=0;
  for(let i=0;i+wn<=rS.arr.length;i++){let t=0;for(let j=i;j<i+wn;j++)t+=rS.arr[j];nwin++;if(t<worst)worst=t}
  let a=0,b=0,n=0;const breachPts=[];
  for(let t=5;t<R.length;t++){
    const pr=R.slice(0,t);
    const v975t=varW(pr,.975),v99t=varW(pr,.99);
    if(t>=10){n++;if(R[t]<v975t)a++;if(R[t]<v99t)b++;}
    breachPts.push({idx:t+1,r:R[t],v975:v975t,v99:v99t,b975:R[t]<v975t,b99:R[t]<v99t});
  }
  const lo=Math.floor(c[0]),hi=Math.ceil(c[c.length-1]),bins=Array(Math.max(1,hi-lo)).fill(0);
  for(let i=0;i<c.length;i++)bins[Math.min(bins.length-1,Math.floor(c[i])-lo)]++;
  return {v975,v99,es,esSingle:esW(R,.975),varSingle:varW(R,.975),esS,worst,nwin,wn,a,b,n,lo,hi,bins,rSk:rS.k,rSL:rS.L,breachPts};
}

function rckEmpCalc(p){
  const {R,W,payoff,al,be}=p;
  const N=R.length,lam=Math.log(be)/Math.log(al),eta=N<100?Math.min(.25,1/Math.sqrt(N)):0;
  // Binary W/R solver
  const kelBin=W-(1-W)/payoff,pw=W*(1-eta),pl=1-pw,kelBinRob=pw-pl/payoff;
  const solBin=(p0,q0)=>{const k=p0-q0/payoff;if(k<=0)return 0;const ph=b=>p0*Math.pow(1+b*payoff,-lam)+q0*Math.pow(1-b,-lam)-1;let lo=1e-6,hi=1-1e-6;for(let i=0;i<90;i++){const m=(lo+hi)/2;ph(m)<0?lo=m:hi=m}return Math.min(lo,k)};
  const bBin=solBin(W,1-W),bBinRob=solBin(pw,pl);
  // Full Empirical distribution solver using entire historical R array
  const minR=Math.min(...R,-0.01),maxB=Math.min(0.95,0.98/Math.abs(minR));
  const weights=(useEta)=>{
    if(!useEta||eta<=0)return R.map(()=>1/N);
    const wPos=1-eta;let sumP=0,cntN=0;
    R.forEach(r=>{if(r>0)sumP+=wPos/N;else cntN++});
    const rem=Math.max(0,1-sumP),wNeg=cntN>0?rem/cntN:1/N;
    return R.map(r=>r>0?wPos/N:wNeg);
  };
  const solveEmp=(useEta)=>{
    const ws=weights(useEta);
    // Find empirical Kelly peak via derivative of E[log(1 + b*R_i)]
    const dLog=b=>{let s=0;for(let i=0;i<N;i++){const denom=1+b*R[i];if(denom<=1e-6)return -1e9;s+=ws[i]*R[i]/denom}return s};
    if(dLog(1e-6)<=0)return {kel:0,bRck:0};
    let loK=1e-6,hiK=maxB;
    for(let i=0;i<80;i++){const m=(loK+hiK)/2;dLog(m)>0?loK=m:hiK=m}
    const kelEmp=loK;
    // Solve E[w_i * (1 + b*R_i)^(-lam)] - 1 <= 0
    const phi=b=>{let s=0;for(let i=0;i<N;i++){const v=1+b*R[i];if(v<=1e-6)return 1e9;s+=ws[i]*Math.pow(v,-lam)}return s-1};
    let loR=1e-6,hiR=kelEmp;
    for(let i=0;i<80;i++){const m=(loR+hiR)/2;phi(m)<0?loR=m:hiR=m}
    return {kel:kelEmp,bRck:Math.min(loR,kelEmp)};
  };
  const empOrig=solveEmp(false),empRob=solveEmp(true);
  return {lam,eta,N,kelBin,kelBinRob,bBin,bBinRob,kelEmp:empOrig.kel,kelEmpRob:empRob.kel,bEmp:empOrig.bRck,bEmpRob:empRob.bRck,minR};
}

function propMulti(p){
  const {R,n,f,size,fee,actFee,stages,ml,dl,tpd,maxT,fT,sp,payoutDays,comp}=p;
  const rnd=mulberry(202609);
  const runStage=(tr,tgPct,maxTrades)=>{
    let e=1,pk=1,ds=1,d=0;
    for(let t=1;t<=maxTrades;t++){
      if(d===0)ds=e;
      e+=(comp?e:1)*f*R[(rnd()*R.length)|0]; /* comp=true: rủi ro % theo số dư hiện tại (lãi kép); false: theo số dư gốc */
      d=(d+1)%tpd;
      if(e>pk)pk=e;
      const fl=tr?Math.min(1,pk-ml):1-ml;
      if(e<=fl||(dl>0&&e<ds-dl))return[0,t,e];
      if(tgPct>0&&e>=1+tgPct)return[1,t,e];
    }
    return[2,maxTrades,e];
  };
  const out={};
  const payCycleTrades=Math.max(5,Math.round((payoutDays||10)*tpd));
  for(const tr of [0,1]){
    let pass1=0,fail1=0,to1=0,tp=[],roi=[],fees=0,pay=0,actTotal=0;
    const stPass=stages.map(()=>0);
    for(let c=0;c<n;c++){
      let cost=0,ok=0;
      for(let a=0;a<10;a++){
        cost+=fee;
        let allPassed=true,tradesUsed=0;
        for(let si=0;si<stages.length;si++){
          const r=runStage(tr,stages[si],maxT);
          tradesUsed+=r[1];
          if(r[0]===1){if(a===0)stPass[si]++;}
          else{allPassed=false;if(a===0&&si===0){r[0]===0?fail1++:to1++;}break;}
        }
        if(allPassed){ok=1;cost+=actFee;if(a===0){pass1++;tp.push(tradesUsed);actTotal+=actFee}break;}
      }
      let py=0;
      if(ok){
        // Funded phase with 10-day payout cycles across fT trades
        const nCycles=Math.max(1,Math.floor(fT/payCycleTrades));
        let alive=true;
        for(let cy=0;cy<nCycles&&alive;cy++){
          const r=runStage(tr,0,payCycleTrades);
          if(r[0]===0){alive=false;break;}
          if(r[2]>1)py+=(r[2]-1)*size*sp;
        }
      }
      roi.push((py-cost)/Math.max(1,cost));
      fees+=cost;pay+=py;
    }
    roi.sort((a,b)=>a-b);tp.sort((a,b)=>a-b);
    const pPass=pass1/n;
    const totalCostOnce=fee+pPass*actFee;
    const expSinglePayout=pPass>0?(pay/n)/Math.max(1,Math.floor(fT/payCycleTrades))/pPass:0;
    const evUsd=pPass*expSinglePayout-(1-pPass)*fee-pPass*actFee;
    const evPct=(evUsd/Math.max(1,fee))*100;
    const pdfRoi=((pPass*(pay/Math.max(1,pass1))-totalCostOnce)/Math.max(1,totalCostOnce))*100;
    out[tr]={
      pass:pPass,fail:fail1/n,to:to1/n,
      stPass:stPass.map(x=>x/n),
      medT:tp.length?tp[tp.length>>1]:0,
      roiMed:roi[roi.length>>1],
      ev:fees/n,evPay:pay/n,
      evUsd,evPct,pdfRoi,
      cyc:pay>0?fees/pay:0
    };
  }
  return out;
}
