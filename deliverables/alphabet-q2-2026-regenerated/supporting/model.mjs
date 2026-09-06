// First-draft analytical schedules. USD billions, shares billions, except prices.
// Run: node story/model.mjs. No network, no file writes, no production dependency.
const reported = {
 q225:{revenue:96.428,search:54.190,youtube:9.796,network:7.354,subscriptions:11.203,cloud:13.624,bets:.373,hedge:-.112,servicesOI:33.063,cloudOI:2.826,betsOI:-1.246,corporateOI:-3.372,oi:31.271},
 q226:{revenue:119.796,search:63.271,youtube:11.055,network:7.303,subscriptions:12.911,cloud:24.768,bets:.382,hedge:.106,servicesOI:39.544,cloudOI:8.814,betsOI:-1.799,corporateOI:-5.789,oi:40.770},
 h126:{revenue:229.692,cloud:44.796,cloudOI:15.412,ni:174.771,cfo:84.859,capex:80.598,da:13.586,sbc:14.708,deferredTax:27.538,securitiesGains:-135.803,other:3.161,ar:-6.904,inventory:-7.739,taxes:8.304,otherAssets:-9.950,ap:2.090,accruals:.308,deferredRevenue:.789},
 cashQuarters:[{period:'Q3 2025',cfo:48.414,capex:23.953},{period:'Q4 2025',cfo:52.402,capex:27.851},{period:'Q1 2026',cfo:45.790,capex:35.674},{period:'Q2 2026',cfo:39.069,capex:44.924}],
 balance:{cash:55.911,marketableDebt:99.5,marketableEquity:87.063,longMarketableEquity:14.126,privateInvestments:131.461,debtFace:101.085,financeLeases:2.590,preferredLiquidation:19.25,legalAccrual:17.4,longTaxPayable:11.306,fundingCommitments:21.9,shares:12.230},
 price:{symbol:'GOOGL',class:'A',unadjustedClose:335.02,timestamp:'2026-09-01T16:00:00-04:00'}
};
const cases={
 Downside:{search:[8,5,4,3,3],cloud:[35,25,20,15,12],otherServices:[5,4,3,3,3],servicesMargin:[39,38,37,36,36],cloudMargin:[28,28,29,30,30],corporateGrowth:[20,15,12,10,8],capexRatio:[40,38,33,29,25],daRatio:[8,10,11,12,13],wcRatio:15,investmentRecovery:.5,backstopLoss:15},
 Reference:{search:[15,12,10,8,6],cloud:[55,40,30,25,20],otherServices:[10,9,8,7,6],servicesMargin:[42,42,42,43,43],cloudMargin:[34,35,36,36,36],corporateGrowth:[20,15,12,10,8],capexRatio:[40,35,29,24,20],daRatio:[8,10,11,12,13],wcRatio:10,investmentRecovery:.75,backstopLoss:5},
 Upside:{search:[18,17,15,12,10],cloud:[70,55,45,35,25],otherServices:[13,12,11,10,8],servicesMargin:[43,44,45,45,45],cloudMargin:[36,37,38,39,40],corporateGrowth:[20,15,12,10,8],capexRatio:[42,36,29,23,18],daRatio:[8,10,11,12,13],wcRatio:8,investmentRecovery:1,backstopLoss:0}
};
function calc(name,wacc=.10,g=.03,overrides={}){
 const c={...cases[name],...overrides};const q=reported.q226;const b=reported.balance;
 let search=q.search*4,cloud=q.cloud*4,other=(q.youtube+q.network+q.subscriptions)*4,bets=q.bets*4,corp=-q.corporateOI*4,betsLoss=-q.betsOI*4,priorRevenue=(q.revenue-q.hedge)*4;
 const rows=[];
 for(let i=0;i<5;i++){
  search*=1+c.search[i]/100;cloud*=1+c.cloud[i]/100;other*=1+c.otherServices[i]/100;corp*=1+c.corporateGrowth[i]/100;betsLoss*=1.05;
  const revenue=search+cloud+other+bets, servicesOI=(search+other)*c.servicesMargin[i]/100,cloudOI=cloud*c.cloudMargin[i]/100,oi=servicesOI+cloudOI-corp-betsLoss,nopat=oi*.8,da=revenue*c.daRatio[i]/100,capex=revenue*c.capexRatio[i]/100,wc=(revenue-priorRevenue)*c.wcRatio/100,fcff=nopat+da-capex-wc;
  rows.push({year:i+1,search,cloud,otherServices:other,revenue,servicesOI,cloudOI,corporateCosts:corp,betsLoss,oi,margin:oi/revenue,nopat,da,capex,wc,fcff,pv:fcff/(1+wacc)**(i+1)});priorRevenue=revenue;
 }
 const last=rows.at(-1);const terminalRevenue=last.revenue*(1+g),terminalNopat=last.nopat*(1+g),terminalDa=terminalRevenue*c.daRatio[4]/100,terminalCapex=terminalRevenue*c.capexRatio[4]/100,terminalWc=last.revenue*g*c.wcRatio/100,terminalFCFF=terminalNopat+terminalDa-terminalCapex-terminalWc;
 const terminal=terminalFCFF/(wacc-g)/(1+wacc)**5,explicitPV=rows.reduce((a,r)=>a+r.pv,0),ev=explicitPV+terminal;
 // Economic equity investments include all liquid and illiquid holdings once.
 // Gross haircut followed by conservative 25% haircut for taxes/realization friction.
 const investmentAssets=(b.marketableEquity+b.longMarketableEquity+b.privateInvestments)*c.investmentRecovery*.75;
 const equityBridge=b.cash+b.marketableDebt+investmentAssets-b.debtFace-b.financeLeases-b.preferredLiquidation-b.legalAccrual-b.longTaxPayable-b.fundingCommitments-c.backstopLoss;
 const equity=ev+equityBridge,price=equity/b.shares;
 return {name,wacc,g,rows,explicitPV,terminal,terminalShare:terminal/ev,terminalFCFF,terminalImpliedROIC:g*terminalNopat/(terminalCapex-terminalDa+terminalWc),ev,investmentAssets,equityBridge,equity,price,vsSnapshot:price/reported.price.unadjustedClose-1,capex5y:rows.reduce((a,r)=>a+r.capex,0)};
}
const growthBridge=Object.fromEntries(['search','youtube','network','subscriptions','cloud','bets','hedge'].map(k=>[k,{change:reported.q226[k]-reported.q225[k],contributionPp:(reported.q226[k]-reported.q225[k])/reported.q225.revenue*100}]));
const results=Object.keys(cases).map(n=>calc(n));
const sensitivity=[.08,.09,.10,.11,.12].map(wacc=>({wacc,values:[.02,.03,.04].map(g=>({g,price:calc('Reference',wacc,g).price}))}));
let low=.001,high=.25;for(let i=0;i<100;i++){let mid=(low+high)/2;if(calc('Reference',mid,.03).price>reported.price.unadjustedClose)low=mid;else high=mid;}
const h=reported.h126;const cashBridge=[h.ni,h.securitiesGains,h.deferredTax,h.da,h.sbc,h.other,h.ar+h.inventory+h.taxes+h.otherAssets+h.ap+h.accruals+h.deferredRevenue,-h.capex];
const schedules={reported,cases,growthBridge,results,sensitivity,referenceImpliedDiscountRate:(low+high)/2,cashBridge,cashBridgeSum:cashBridge.reduce((a,v)=>a+v,0),fcfH126:h.cfo-h.capex,fcfH125:63.897-39.643,fcfAfterSBC:h.cfo-h.capex-h.sbc,normalizedQ2EPS:9.11-6.26,normalizedAnnualizedPE:335.02/((9.11-6.26)*4),ttmFCFYield:53.273/(335.02*12.230),stressCapexFivePp:calc('Reference',.10,.03,{capexRatio:[45,40,34,29,25]}).price,stressSearchDownFivePp:calc('Reference',.10,.03,{search:[10,7,5,3,1]}).price,upsideAt8Percent:calc('Upside',.08,.03).price};
console.log(JSON.stringify(schedules,null,2));
