export const CITIES = [
  { id: 'hongkong', name: '香港', en: 'HONG KONG', lat: 22.3, lng: 114.17, color: '#74b8ad', region: '海港边，留着一扇窗', rooms: ['hotel'], description: '大窗、海面的光、沿岸的楼群。短暂住过的地方，也能成为值得回来的地方。' },
  { id: 'turin', name: '都灵', en: 'TORINO', lat: 45.07, lng: 7.69, color: '#d4a178', region: '各自的房间，一起亮着的客厅', rooms: ['turin'], description: '三间卧室，一个共享客厅。每天结束后，钥匙放回熟悉的位置，门内有人生活。' },
  { id: 'shanghai', name: '上海', en: 'SHANGHAI', lat: 31.23, lng: 121.47, color: '#96ad79', region: '松江校园里，四个人的三年', rooms: ['dorm'], description: '校园的风穿过小阳台。四张床桌、走廊与夜谈，把普通的日子连在了一起。' },
];
export const ROOMS = [
  { id: 'hotel', cityId: 'hongkong', name: '嘉里酒店', short: '海景客房', subtitle: '香港 · 红磡湾 · 高层海景', duration: '一段短住', seed: 'HARBOUR-01', people: ['阿绵'], image: './assets/preview-world-hotel.png', description: '海港在大窗外展开。这里保留的是房间与城市的记忆意象。', memories: ['hotel-room-card', 'hotel-suitcase', 'hotel-tea'] },
  { id: 'turin', cityId: 'turin', name: '都灵合租公寓', short: '合租公寓', subtitle: '都灵 · 三室一厅 · 2 楼', duration: '住过一年', seed: 'TORINO-01', people: ['阿绵', '小榆', '洛洛'], image: './assets/preview-world-turin.png', description: '三个人各有自己的房间，也共享客厅。楼层按地面为 0 楼计算。', memories: ['turin-keys', 'turin-note', 'turin-mug'] },
  { id: 'dorm', cityId: 'shanghai', name: '松江 30 号楼', short: '大学宿舍', subtitle: '上海 · 东华大学松江校区', duration: '住过三年', seed: 'CAMPUS-30', people: ['阿绵', '小榆', '洛洛', '小禾'], image: './assets/preview-world-dorm.png', description: '四组上床下桌，一个共享阳台，公共卫浴在房间外。', memories: ['dorm-timetable', 'dorm-mug', 'dorm-balcony-shirt'] },
];
export const MEMORIES = [
  { id: 'hotel-room-card', roomId: 'hotel', name: '房卡', title: '退房前的房卡', story: '海港天色暗下来时，房卡被留在桌边。短短几天，也足以让一个陌生房间变得熟悉。' },
  { id: 'hotel-suitcase', roomId: 'hotel', name: '行李箱', title: '还没合上的行李箱', story: '行李箱停在房间一角。它提醒人们，酒店房间总有一个暂住的时间；也正因为会离开，才更记得窗外那片海。' },
  { id: 'hotel-tea', roomId: 'hotel', name: '纸杯', title: '窗边的一杯热饮', story: '杯子放在窗边，海面的光落进来。或许什么都没有发生，只是有人在这里慢下来了一会儿。' },
  { id: 'turin-keys', roomId: 'turin', name: '钥匙串', title: '回家时放下的钥匙', story: '钥匙被放在客厅顺手的位置。它不只属于一扇门，也意味着一天结束后，还有室友和亮着灯的房间。' },
  { id: 'turin-note', roomId: 'turin', name: '便笺', title: '书桌边的便笺', story: '纸上没有写满计划，只留了一点空白。住在这里的日子，由许多没被特别标记的普通一天组成。' },
  { id: 'turin-mug', roomId: 'turin', name: '茶杯', title: '客厅桌边的杯子', story: '傍晚时杯子被留在客厅。有人先回房，有人还在说今天的事；同一张桌子把各自的生活接在了一起。' },
  { id: 'dorm-timetable', roomId: 'dorm', name: '课程表', title: '床桌旁的课程表', story: '课程表贴在床桌旁，日子被上课、吃饭和回宿舍切成一小格一小格。三年里，普通的一天也慢慢变成了共同生活的形状。' },
  { id: 'dorm-mug', roomId: 'dorm', name: '暖水杯', title: '书桌上的暖水杯', story: '杯子在桌角占着一个小位置。四个人住在同一个房间，每个人还是会给自己留下一点熟悉的秩序。' },
  { id: 'dorm-balcony-shirt', roomId: 'dorm', name: '阳台衣物', title: '阳台上晾着的衣物', story: '阳台很小，却能让房间透一口气。晾着的衣物轻轻摆动，门内是四个人各自的床桌，门外是校园的风。' },
];
export const cityById = id => CITIES.find(x => x.id === id);
export const roomById = id => ROOMS.find(x => x.id === id);
export const memoryById = id => MEMORIES.find(x => x.id === id);
export const clockText = hours => { const m = Math.floor(((hours % 24 + 24) % 24) * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export const roomDay = room => Math.floor(room.simHour / 24) + 1;
export const DEFAULT_ORDER = ROOMS.map(r => r.id);
