import { roomById } from './data.js';

export const STATIONS = Object.freeze({"hongkong":-1.0832890202872154,"turin":-0.1126170926227339,"shanghai":1.2910510217991575});
export const DEFAULT_JOURNEY = ['hotel', 'turin', 'dorm'];
const clamp = n => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

// Position is derived only from the audio clock: pausing freezes the traveller;
// seeking is deterministic, and changing the visit order never changes memories.
export function journeyAt(progress, order = DEFAULT_JOURNEY) {
  const p = clamp(progress);
  const stops = order.map(id => ({ roomId:id, cityId:roomById(id).cityId, angle:STATIONS[roomById(id).cityId] }));
  const arrivals=[.12,.45,.78], departures=[.22,.55,.90];
  for(let i=0;i<3;i++) {
    const stop=stops[i];
    if(p<arrivals[i]) {
      const start=i?departures[i-1]:0, from=i?stops[i-1].angle:stop.angle-.30;
      const t=(p-start)/(arrivals[i]-start);
      return { ...stop, index:i, progress:p, angle:from+(stop.angle-from)*t, walking:true, arrived:false, direction:Math.sign(stop.angle-from)||1 };
    }
    if(p<=departures[i]) return { ...stop,index:i,progress:p,angle:stop.angle,walking:false,arrived:true,direction:i===2?1:Math.sign(stops[i+1].angle-stop.angle)||1 };
  }
  const last=stops[2];
  return { ...last,index:2,progress:p,angle:last.angle+(p-.90)/.10*.23,walking:p<1,arrived:false,direction:1 };
}
