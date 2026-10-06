/* 金馬桶專案 — 伺服器與網頁共用設定 */
(function (root) {
  const G = {};

  G.PHASES = [
    { id: 'lobby',   name: '報到',   long: '報到搶職位',     hint: '最快的三位成為董事，互選董事長' },
    { id: 'roles',   name: '董事選舉', long: '董事選舉發布',   hint: '前三位董事互選董事長' },
    { id: 'brief',   name: '開案',   long: '董事長開案',     hint: '老闆決定這座馬桶要賣給誰' },
    { id: 'build',   name: '共創',   long: '人類 × AI 三隊競賽', hint: '兩組研發與自主 AI 同場競技' },
    { id: 'review',  name: '評選',   long: '提案評選',       hint: '全員投票，老闆拍板' },
    { id: 'poster',  name: '推廣',   long: '上市推廣',       hint: '行銷處做海報，其他人做市調' },
    { id: 'gallery', name: '海報',   long: '海報評選',       hint: '全員投票，老闆選官方海報' },
    { id: 'launch',  name: '發表會', long: '上市發表會',     hint: '金馬桶正式上市' }
  ];
  // One layout drives architecture, seats, collision and server navigation.
  G.LAYOUT = 'arrival-villa-4';
  G.ROOMS = [
    {id:'A',name:'第一研發處',sub:'LAB A / 24 SEATS',x:-26,z:5,w:28,d:26,color:'#63b6ac',seats:24},
    {id:'B',name:'第二研發處',sub:'LAB B / 24 SEATS',x:26,z:5,w:28,d:26,color:'#739cc2',seats:24},
    {id:'M',name:'行銷處',sub:'STUDIO / 12 SEATS',x:-26,z:30,w:28,d:18,color:'#bca0af',seats:12},
    {id:'board',name:'董事長室',sub:'CHAIRPERSON / EXHIBITION',x:26,z:30,w:28,d:18,color:'#b69d70'},
    {id:'lounge',name:'茶水間',sub:'COFFEE & CONVERSATION',x:-30,z:-22,w:20,d:16,color:'#b7a17c'},
    {id:'arcade',name:'遊戲室',sub:'SIDE QUEST',x:-9,z:-22,w:20,d:16,color:'#a18abd'},
    {id:'wc',name:'廁所',sub:'RESET YOURSELF',x:9,z:-22,w:14,d:16,color:'#80aaa9'},
    {id:'atrium',name:'迎賓大廳',sub:'GOLDEN TOILET / ARRIVAL',x:0,z:28,w:21,d:34,color:'#92a8a2',open:true},
    {id:'courtyard',name:'中庭足球場',sub:'OVERTIME / FOOTBALL',x:0,z:1,w:21,d:18,color:'#71986c',outdoor:true},
    {id:'terrace',name:'戶外露台',sub:'TERRACE / SLOW DOWN',x:0,z:49,w:84,d:8,color:'#b3a284',outdoor:true},
    {id:'pool',name:'月光泳池',sub:'A × B / WATER VOLLEY',x:52,z:28,w:20,d:24,color:'#6cbbd0',outdoor:true},
    {id:'garden',name:'林蔭花園',sub:'BOTANICAL WALK',x:52,z:-15,w:20,d:46,color:'#789466',outdoor:true},
    {id:'smoking',name:'吸菸區',sub:'OUTDOOR / SMOKING',x:-52,z:19,w:16,d:18,color:'#9eaa94',outdoor:true},
    {id:'road',name:'園區馬路',sub:'FOREST AVENUE',x:0,z:65,w:124,d:12,color:'#899aa0',outdoor:true},
    {id:'forest',name:'城市森林',sub:'FOREST TRAIL',x:0,z:-48,w:122,d:16,color:'#729675',outdoor:true},
    {id:'core',name:'神秘機房',sub:'C / CHAIRPERSON ONLY',x:29,z:-22,w:24,d:16,color:'#89a688',private:true},
    {id:'grounds',name:'園區漫步',sub:'EXPLORE THE CAMPUS',x:0,z:7,w:126,d:130,color:'#879a79',outdoor:true,base:true}
  ];
  G.DESKS = [];
  for(const id of ['A','B','M']) {
    const r=G.ROOMS.find(r=>r.id===id);
    for(const dx of [-9.7,-6.1,-2.5,2.5,6.1,9.7]) for(const dz of id==='M'?[-5,1]:[-9,-4,1,6])
      G.DESKS.push({x:r.x+dx,z:r.z+dz,room:id,color:r.color});
  }
  G.WALLS=[]; G.SOLIDS=[];
  for(const r of G.ROOMS.filter(r=>!r.outdoor&&!r.open)) {
    for(const side of [-1,1]) {
      G.WALLS.push({x:r.x+side*r.w/2,z:r.z,w:.32,d:r.d});
      // Wide doors at both ends make every wing accessible from the galleries.
      for(const half of [-1,1])G.WALLS.push({x:r.x+half*(r.w/4+1),z:r.z+side*r.d/2,w:r.w/2-2,d:.32});
    }
  }
  for(const d of G.DESKS)G.SOLIDS.push({x:d.x,z:d.z,w:3.05,d:1.6});
  // Equipment islands and furnishings; the same footprints are rendered below.
  G.FIXTURES = [
    ...[-36,-30,-24].map(x=>({type:'coffee',x,z:-27,w:4,d:2})),
    ...[-36,-25].map(x=>({type:'sofa',x,z:-20,w:5,d:3})),
    ...[-16,-11,-6].map(x=>({type:'arcade',x,z:-27,w:2.3,d:2})),
    {type:'pinball',x:-11,z:-20,w:3,d:4},
    {type:'darts',x:-4,z:-20,w:2,d:2},
    ...[5,9,13].map(x=>({type:'toilet',x,z:-27,w:2.5,d:3})),
    {type:'boardTable',x:26,z:29,w:15,d:7},
    {type:'reception',x:0,z:25,w:8,d:2},

    ...[-33,-21,21,33].map(x=>({type:'patio',x,z:49,w:4,d:3})),
    {type:'smoking',x:-54,z:16,w:5,d:3},
    ...[-29,-21].flatMap(z=>[22,35].map(x=>({type:'rack',x,z,w:4,d:2.5}))),
    ...[-26,26].map(x=>({type:'printer',x:x+10.5,z:15,w:2,d:2}))
  ];
  G.SOLIDS.push(...G.FIXTURES.map(f=>({x:f.x,z:f.z,w:f.w,d:f.d})));
  for(const x of [47,58])for(const z of [-32,-18,-4])G.SOLIDS.push({x,z,w:4,d:4});
  for(const x of [-51,-38,-24,-10,5,21,37,53])for(const z of [-53,-40])G.SOLIDS.push({x,z,w:.9,d:.9});
  for(const x of [-31,-20,20,31])G.SOLIDS.push({x,z:56,w:4.7,d:2.4});
  for(const x of [-36,-25])G.SOLIDS.push({x,z:-18,w:2,d:2});
  for(const x of [-36,-16,16,36])G.SOLIDS.push({x,z:-6.8,w:3,d:1});
  for(const z of [-30,39])for(let x=-40;x<=40;x+=8)if(z!==39||x!==0)G.SOLIDS.push({x,z,w:.4,d:.4});
  for(const x of [-40,40])for(let z=-23;z<39;z+=8)G.SOLIDS.push({x,z,w:.4,d:.4});
  for(const z of [-11,19.5])for(const x of [-39,-13,13,39])G.SOLIDS.push({x,z,w:.3,d:.3});
  for(const x of [-10.5,10.5])for(const z of [-6,10,29,43])G.SOLIDS.push({x,z,w:.3,d:.3});
  G.PHASE_IDS = G.PHASES.map(p => p.id);

  G.SHOW_PLAN = [{"id":"lobby","seconds":45,"title":"報到集合","task":"請大家用手機加入，選分身、輸入姓名。最快的三位就是董事！","say":"請掃玩家網址，今天一起蓋一座會賺錢的馬桶。"},{"id":"roles","seconds":30,"title":"董事互選","task":"請三位董事投給另一位董事；兩票當選，平票重投。","say":"三位董事不能投自己，現在決定今晚誰負責拍板。"},{"id":"brief","seconds":45,"title":"董事長開案","task":"請董事長選擇馬桶客群；向兩個研發處說明需求。","say":"同一道題，人類兩組對抗 AI。先看清楚要服務誰。"},{"id":"build","seconds":210,"title":"一起蓋馬桶","task":"請研發同仁按「導航到我的電腦」，抵達機台後一起建造。","say":"先底座、再座圈、最後水箱。主管少改一點，作品會快一點。"},{"id":"review","seconds":60,"title":"提案評選","task":"先展示三組作品，再請所有人投票；董事長最後拍板。","say":"親自去董事長室，看模型後投票得 2 分；遠端投票 1 分。"},{"id":"poster","seconds":120,"title":"海報與市調","task":"行銷設計海報；其他同仁填願付價格；董事長參考 AI 定價。","say":"讓這座馬桶賣得出去：名字、標語、售價，一個都不能少。"},{"id":"gallery","seconds":45,"title":"海報投票","task":"請全員選海報，不能投自己；董事長選官方版本與售價。","say":"看上方空拍機布幕，投給你最想買單的那張海報。"},{"id":"launch","seconds":45,"title":"上市揭曉","task":"公布馬桶、官方海報與獲利／虧損，邀請大家用表情慶祝。","say":"看看今晚是成功上市，還是把公司沖走了！謝謝大家一起共創。"}];
  G.DEFAULT_SETTINGS = { briefSec: 45, buildSec: 240, posterSec: 240 };

  // 積木空間（x 寬、y 高、z 深）
  G.GRID = { x: 14, y: 16, z: 14 };

  // kind: std 一般 / metal 金屬 / glass 玻璃 / rgb 電競燈
  G.COLORS = [
    { name: '陶瓷白', hex: '#f3f2ec', kind: 'std' },
    { name: '象牙米', hex: '#e6d6b8', kind: 'std' },
    { name: '石墨黑', hex: '#2c3034', kind: 'std' },
    { name: '水泥灰', hex: '#98a2a5', kind: 'std' },
    { name: '土豪金', hex: '#d9a437', kind: 'metal' },
    { name: '鏡面銀', hex: '#cfd6db', kind: 'metal' },
    { name: '青綠',   hex: '#2f8f8b', kind: 'std' },
    { name: '天空藍', hex: '#3d7fc4', kind: 'std' },
    { name: '櫻花粉', hex: '#f0a7b9', kind: 'std' },
    { name: '正紅',   hex: '#d6453b', kind: 'std' },
    { name: '原木',   hex: '#a8784c', kind: 'std' },
    { name: '玻璃',   hex: '#b8e2ff', kind: 'glass' },
    { name: '電競 RGB', hex: '#ff3df0', kind: 'rgb' }
  ];

  G.TEAMS = {
    A: { id: 'A', name: '第一研發處', plan: '方案 A', color: '#297c7b', soft: '#dcefeb' },
    B: { id: 'B', name: '第二研發處', plan: '方案 B', color: '#3977bc', soft: '#dde8f5' },
    C: { id:'C',name:'自主 AI',plan:'方案 C',color:'#d2ef96',soft:'#293727' },
    M: { id: 'M', name: '行銷處',   plan: '行銷',   color: '#9566ac', soft: '#eee3f3' }
  };

  // 職級：budget = 同時可擁有的積木數
  G.RANKS = {
    board: {name:'董事',level:6,budget:0,color:'#e7ce87',perks:['董事互選董事長；不能投自己','巡視公司、參與評選與市調']},
    boss:    { name: '董事長', level: 7, budget: 0,  color: '#c88d2e',
               perks: ['不用蓋，負責拍板', '可以「巡視」任一隊，讓全隊螢幕跳出老闆', '可以貼金色「老闆的關心」', '決定開案方向、上市方案、官方海報'] },
    lead:    { name: '處長',   level: 5, budget: 6,  color: '#7a4f9a',
               perks: ['只有 6 塊積木（主管不用親自動手）', '可以拆任何隊員的積木', '可以貼意見貼紙', '每 45 秒可對全隊發一次「方向調整」'] },
    manager: { name: '部長',   level: 4, budget: 15, color: '#3977bc',
               perks: ['15 塊積木', '可以拆任何隊員的積木', '可以貼意見貼紙指點江山'] },
    chief: {name:'課長',level:3,budget:25,color:'#4b9c85',perks:['25 塊積木，帶著大家動手蓋','可貼意見貼紙；只能拆自己的積木']},
    staff:   { name: '基層',   level: 2, budget: 40, color: '#297c7b',
               perks: ['40 塊積木，主力就是你', '只能拆自己的積木', '主管的貼紙…看看就好'] },
    intern:  { name: '實習生', level: 1, budget: 30, color: '#6b7e82',
               perks: ['遲到的人來當實習生', '30 塊積木', '只能拆自己的積木'] }
  };

  G.TITLES = {
    lead: { A: '第一研發處 處長', B: '第二研發處 處長', M: '行銷處 處長' },
    manager: {
      A: ['ID 部長', '機構部長', '散熱部長', '電子部長', '聲學部長', '韌體部長'],
      B: ['ID 部長', '機構部長', '散熱部長', '電子部長', '聲學部長', '韌體部長'],
      M: ['品牌部長', '產品行銷處長', '通路部長']
    },
    chief:{A:['設計課長','工程課長'],B:['設計課長','工程課長'],M:['文案課長','創意課長']},
    staff: {
      A: ['ID 設計師', 'CMF 設計師', '機構工程師', '電子工程師', '散熱工程師', '聲學工程師', '韌體工程師', '品質驗證工程師', '製造工程師', '採購專員'],
      B: ['ID 設計師', 'CMF 設計師', '機構工程師', '電子工程師', '散熱工程師', '聲學工程師', '韌體工程師', '品質驗證工程師', '製造工程師', '採購專員'],
      M: ['行銷企劃', '社群小編', '美術設計', '文案企劃', '活動企劃']
    }
  };

  G.BRIEFS = [
    { icon: '🎮', name: '電競玩家', tag: '蹲著也要贏', text: '久坐不麻、要有 RGB、最好還能放手把。' },
    { icon: '👵', name: '銀髮族',   tag: '起身不費力', text: '扶手、防滑、按鈕要大，阿嬤一看就會用。' },
    { icon: '💰', name: '豪宅土豪', tag: '越金越好',   text: '要氣派、要閃，客人來一定要拍照。' },
    { icon: '🐱', name: '貓主子',   tag: '人貓共用',   text: '主子也要能用，最好順便當貓跳台。' },
    { icon: '🚀', name: '太空人',   tag: '無重力也能用', text: '要固定得住、要有科技感，NASA 會想買。' },
    { icon: '🏢', name: '小資套房族', tag: '0.5 坪放得下', text: '要小、要省水、要能塞進超小浴室。' }
  ];

  G.STICKERS = ['再大一點', '換個顏色', '要有質感', '可以更大膽嗎？', '參考一下競品', '這裡加 RGB', '成本太高了', '客戶不會喜歡', '這邊要有呼吸感', '能更有科技感嗎', '我覺得不錯', '明天就要看到'];
  G.BOSS_STICKERS = ['我不懂，但我要更好', '這個好！', '下禮拜要上市', '預算砍一半', '要有國際感', '我太太覺得不行', '可以再金一點', '跟對手比呢？'];
  G.BANNERS = ['方向全改！要更有未來感！', '我昨天看到一個好東西…', '這個顏色不對', '客戶說要更貴氣', '整體要再收斂一點', '放大格局，想像一下十年後'];
  G.REACTIONS = ['👍', '😍', '🤔', '🔥', '😂', '💩'];

  G.LIMITS = { name: 12, sticker: 16, banner: 20, quote: 30, posterName: 16, posterSlogan: 30, posterBytes: 900000 };

  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.GAME = G;
})(typeof self !== 'undefined' ? self : this);
