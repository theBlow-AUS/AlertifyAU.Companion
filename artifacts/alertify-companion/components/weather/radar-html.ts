import type { WeatherRadar, WeatherEvent } from '@workspace/api-client-react';
import colors from '@/constants/colors';
export type RadarProps = {
  radar: WeatherRadar; points: { latitude: number; longitude: number }[];
  coordinates: [number, number][] | null; radius: number; events: WeatherEvent[];
};
export function radarHtml(props: RadarProps) {
  const data = JSON.stringify(props).replace(/</g, '\\u003c');
  const c = colors.light;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body{margin:0;height:100%;font:12px system-ui;color:${c.foreground}}#map{height:calc(100% - 72px)}#controls{height:72px;box-sizing:border-box;padding:8px;background:${c.background}}button{padding:6px 10px;margin-right:5px}#status{font-size:11px;margin-top:5px}#failure{position:absolute;top:8px;left:8px;background:${c.warningSoft};padding:8px;z-index:1000;display:none;max-width:80%}</style></head><body><div id="map"></div><div id="failure"></div><div id="controls"><button id="prev" aria-label="Previous radar frame">Back</button><button id="play">Play radar</button><button id="next" aria-label="Next radar frame">Next</button><span id="time"></span><div id="status">Radar may be absent outside provider coverage. Blank areas are not an all-clear.</div></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
  const data=${data};const fail=m=>{document.getElementById('failure').style.display='block';document.getElementById('failure').textContent=m};
  if(!window.L){fail('Map library unavailable. Check your connection and retry.')}else{try{
  const map=L.map('map',{scrollWheelZoom:false});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(map);
  const bounds=[];for(const p of data.points){const ll=[p.latitude,p.longitude];bounds.push(ll);L.circleMarker(ll,{radius:5,color:'${c.primary}'}).addTo(map)}
  if(data.coordinates&&data.coordinates.length){const line=data.coordinates.map(p=>[p[1],p[0]]);L.polyline(line,{color:'${c.primary}',weight:5}).addTo(map);map.fitBounds(line,{padding:[20,20]})}else if(data.points.length){const p=data.points[0];const zone=L.circle([p.latitude,p.longitude],{radius:data.radius*1000,color:'${c.primary}',fillOpacity:.04}).addTo(map);map.fitBounds(zone.getBounds())}
  for(const e of data.events){if(e.kind==='hail'&&e.polygon.length)L.geoJSON({type:'Polygon',coordinates:e.polygon},{style:{color:'${c.destructive}',weight:2,fillOpacity:.15}}).addTo(map);else if(e.latitude!==null&&e.longitude!==null)L.circleMarker([e.latitude,e.longitude],{radius:4,color:'${c.warning}'}).addTo(map)}
  let index=data.radar.frames.length-1,layer=null,timer=null,errors=0;const render=()=>{const f=data.radar.frames[index];if(!f)return;if(layer)map.removeLayer(layer);errors=0;document.getElementById('failure').style.display='none';layer=L.tileLayer(data.radar.host+f.path+'/256/{z}/{x}/{y}/2/1_1.png',{opacity:.65,maxNativeZoom:7,maxZoom:18,attribution:'Radar © RainViewer'});layer.on('tileerror',()=>{if(++errors>=2)fail('Radar tiles could not load. Base map alone does not show current rain.')});layer.addTo(map);document.getElementById('time').textContent=new Date(f.time*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});document.getElementById('time').title=new Date(f.time*1000).toLocaleString()};render();
  const step=n=>{index=(index+n+data.radar.frames.length)%data.radar.frames.length;render()};document.getElementById('prev').onclick=()=>step(-1);document.getElementById('next').onclick=()=>step(1);document.getElementById('play').onclick=()=>{if(timer){clearInterval(timer);timer=null;document.getElementById('play').textContent='Play radar'}else{timer=setInterval(()=>step(1),1200);document.getElementById('play').textContent='Pause radar'}};window.addEventListener('pagehide',()=>clearInterval(timer));setTimeout(()=>map.invalidateSize(),250);
  }catch(e){fail('Unable to display radar: '+e.message)}}
  </script></body></html>`;
}
