'use strict';
// A title belongs to the current first place, never merely to a participant.
module.exports=function honors(game,now=Date.now()){
 const players=Object.values(game.players).filter(p=>!p.kicked),ids=new Set(players.map(p=>p.id)),out={};
 function first(rows,compare,label){const winner=rows.filter(r=>ids.has(r.id)).sort(compare)[0];if(winner&&!out[winner.id])out[winner.id]=label;}
 first(Object.values(game.golf?.best||{}).filter(r=>r.distance>0),(a,b)=>b.distance-a.distance||a.at-b.at,'高爾夫第一名');
 first(Object.values(game.play?.flowers||{}),(a,b)=>b.height-a.height||a.at-b.at,'種花第一名');
 first(Object.values(game.recreation?.pressure?.best||{}),(a,b)=>a.remaining-b.remaining||a.at-b.at,'倒數按鈕第一名');
 for(const [type,label]of [['darts','飛鏢第一名'],['pinball','彈珠台第一名']])first(players.filter(p=>p.miniBest?.[type]>0).map(p=>({id:p.id,score:p.miniBest[type],joinIdx:p.joinIdx})),(a,b)=>b.score-a.score||a.joinIdx-b.joinIdx,label);
 const coffee=game.recreation?.coffee;
 if(coffee?.finished)first(players.filter(p=>coffee.winners?.includes(p.id)).map(p=>({id:p.id,joinIdx:p.joinIdx})),(a,b)=>a.joinIdx-b.joinIdx,'咖啡第一名');
 const scorer=game.recreation?.football?.scorer;
 if(scorer&&ids.has(scorer.id)&&!out[scorer.id])out[scorer.id]='黃金右腳';
 // Only the latest punished driver wears the special title, until cuffs expire.
 first(players.filter(p=>p.play?.cuffUntil>now).map(p=>({id:p.id,until:p.play.cuffUntil})),(a,b)=>b.until-a.until,'OMNI 逮到你');
 return out;
};
