'use strict';
// A deterministic, fictional launch simulation. All inputs are game evidence.
module.exports=function market(g){
 const votes={A:0,B:0,C:0};for(const[id,t]of Object.entries(g.review.votes||{}))if(t in votes)votes[t]+=g.review.weights?.[id]===2?2:1;
 const total=Object.values(votes).reduce((a,b)=>a+b,0),popular=Object.keys(votes).sort((a,b)=>votes[b]-votes[a])[0];
 const survey=Object.values(g.poster.survey||{}).map(s=>s.price).filter(n=>Number.isFinite(n)&&n>=0).sort((a,b)=>a-b);
 const median=survey.length?(survey[Math.floor((survey.length-1)/2)]+survey[Math.floor(survey.length/2)])/2:30000;
 const recommended=Math.max(100,Math.round(median*.9/100)*100),unitCost=Math.max(40,Math.round(recommended*.42)),fixedCost=Math.round(recommended*100),capital=Math.round(recommended*60);
 const team=g.review.winner||g.review.bossPick||popular,price=g.poster.officialPrice??recommended;
 const support=total?votes[team]/total:1/3,leader=total?votes[popular]/total:1/3;
 // Going against a clear preference shrinks demand; overpricing loses buyers.
 const productFit=leader?Math.max(.025,Math.pow(support/leader,2)):1;
 const fairPrice=Math.max(100,median),priceFit=price<=recommended?1:Math.exp(-4*Math.max(0,price/fairPrice-.9));
 const blocks=Object.keys(g.builds[team]||{}).length,readiness=Math.min(1,blocks/80);
 const units=Math.floor(1000*productFit*priceFit*readiness),revenue=units*price,cost=units*unitCost+fixedCost,profit=revenue-cost,cash=capital+profit;
 const bankrupt=cash<=0,status=bankrupt?'bankrupt':profit>=0?'profit':'loss';
 const reasons=[total?`民意：${team} 得 ${votes[team]} / ${total} 分；最高支持為 ${popular}。`:'尚無民意樣本，以三組平均支持估計。',survey.length?`${survey.length} 份市調，願付中位數 $${Math.round(median).toLocaleString()}；AI 建議 $${recommended.toLocaleString()}。`:'尚無市調，以預設願付 $30,000 試算，可信度較低。',productFit<.65?'拍板方案偏離民意，預估買氣下降。':'上市方案符合民意方向。',price>recommended*1.25?'售價高於市調接受範圍，訂單流失。':price<unitCost?'售價低於單位成本，賣一座賠一座。':'售價與成本形成可持續的毛利。',readiness<1?'馬桶尚未完成，完成度降低上市銷量。':'馬桶完成度達到量產門檻。'];
 return{model:'fictional-market-v1',status,bankrupt,popular,votes,support:Math.round(support*100),surveyCount:survey.length,median:Math.round(median),recommended,price,unitCost,fixedCost,capital,units,revenue,cost,profit,cash,readiness:Math.round(readiness*100),reasons};
};
