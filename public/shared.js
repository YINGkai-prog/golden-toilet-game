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
  G.ROOMS = [
    {id:'A',name:'研發一處',sub:'HUMAN / A',x:-12,z:2,w:14,d:9,color:'#62d9cc',door:[-12,8]},
    {id:'B',name:'研發二處',sub:'HUMAN / B',x:4,z:2,w:14,d:9,color:'#7da9ff',door:[4,8]},
    {id:'lounge',name:'茶水間',sub:'COFFEE BREAK',x:-13,z:-9,w:12,d:8,color:'#d2b68c',door:[-13,-4],route:[[-13,-3],[-20,-3],[-20,8]]},
    {id:'arcade',name:'遊戲室',sub:'SIDE QUEST',x:-1,z:-9,w:10,d:8,color:'#b793ed',door:[-1,-4],route:[[-1,-3],[12,-3],[12,8]]},
    {id:'wc',name:'廁所',sub:'RESET YOURSELF',x:10,z:-9,w:6,d:8,color:'#b2ccd1',door:[10,-4],route:[[10,-3],[12,-3],[12,8]]},
    {id:'board',name:'董事會',sub:'THE BOARD',x:18,z:2,w:8,d:9,color:'#e7ce87',door:[18,8]},
    {id:'core',name:'神秘機房',sub:'RESTRICTED / C',x:19.5,z:-9,w:7,d:8,color:'#d2ef96',door:[19.5,-4],route:[[19.5,-3],[12,-3],[12,8]],private:true},
    {id:'M',name:'行銷工作室',sub:'MAKE IT MATTER',x:-12,z:13,w:14,d:8,color:'#e6a6ae',door:[-12,8]},
    {id:'atrium',name:'中央大廳',sub:'GOLDEN BOX',x:9,z:13,w:26,d:8,color:'#aac9c6',door:[9,8]}
  ];
  G.PHASE_IDS = G.PHASES.map(p => p.id);

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
    A: { id: 'A', name: '研發一處', plan: '方案 A', color: '#297c7b', soft: '#dcefeb' },
    B: { id: 'B', name: '研發二處', plan: '方案 B', color: '#3977bc', soft: '#dde8f5' },
    C: { id:'C',name:'自主 AI',plan:'方案 C',color:'#d2ef96',soft:'#293727' },
    M: { id: 'M', name: '行銷處',   plan: '行銷',   color: '#9566ac', soft: '#eee3f3' }
  };

  // 職級：budget = 同時可擁有的積木數
  G.RANKS = {
    board: {name:'董事',level:5,budget:0,color:'#e7ce87',perks:['董事互選董事長；不能投自己','巡視公司、參與評選與市調']},
    boss:    { name: '董事長', level: 5, budget: 0,  color: '#c88d2e',
               perks: ['不用蓋，負責拍板', '可以「巡視」任一隊，讓全隊螢幕跳出老闆', '可以貼金色「老闆的關心」', '決定開案方向、上市方案、官方海報'] },
    lead:    { name: '處長',   level: 4, budget: 6,  color: '#7a4f9a',
               perks: ['只有 6 塊積木（主管不用親自動手）', '可以拆任何隊員的積木', '可以貼意見貼紙', '每 45 秒可對全隊發一次「方向調整」'] },
    manager: { name: '經理',   level: 3, budget: 15, color: '#3977bc',
               perks: ['15 塊積木', '可以拆任何隊員的積木', '可以貼意見貼紙指點江山'] },
    staff:   { name: '基層',   level: 2, budget: 40, color: '#297c7b',
               perks: ['40 塊積木，主力就是你', '只能拆自己的積木', '主管的貼紙…看看就好'] },
    intern:  { name: '實習生', level: 1, budget: 30, color: '#6b7e82',
               perks: ['遲到的人來當實習生', '30 塊積木', '只能拆自己的積木'] }
  };

  G.TITLES = {
    lead: { A: '研發一處 處長', B: '研發二處 處長', M: '行銷處 處長' },
    manager: {
      A: ['ID 經理', '機構經理', '散熱經理', '電子經理', '聲學經理', '韌體經理'],
      B: ['ID 經理', '機構經理', '散熱經理', '電子經理', '聲學經理', '韌體經理'],
      M: ['品牌經理', '產品行銷經理', '通路經理']
    },
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

