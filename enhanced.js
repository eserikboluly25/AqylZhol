/* Additive AqylJol experience. All transport positions and journey times are demo data. */
'use strict';
const fleetMotion = {
 segmentSeconds: 24, dwellSeconds: 5,
 itinerary(bus) {
  const forward=bus.order.slice();
  return forward[0]===forward.at(-1) ? forward : forward.concat(forward.slice(1,-1).reverse(),forward[0]);
 },
 sample(bus,seconds) {
  const order=this.itinerary(bus), span=this.segmentSeconds+this.dwellSeconds;
  const cycle=(order.length-1)*span;
  const phase=((seconds%cycle)+cycle)%cycle;
  const segment=Math.floor(phase/span), elapsed=phase%span;
  const waiting=elapsed<this.dwellSeconds;
  const fraction=waiting?0:(elapsed-this.dwellSeconds)/this.segmentSeconds;
  const a=CITIES[city].points[order[segment]],b=CITIES[city].points[order[segment+1]];
  return {latlng:[a[0]+(b[0]-a[0])*fraction,a[1]+(b[1]-a[1])*fraction],waiting,
   stop:order[segment],next:order[segment+1],seconds:Math.ceil(span-elapsed),fraction,
   percent:phase/cycle*100};
 }
};

function mapPage(){
 const c=CITIES[city];
 $('#app').innerHTML=heading('Город в движении',`${c.name} · выбери автобус и следи за его поездкой`)+`
 <div class="live-banner"><span class="live-dot"></span><b>Демо-движение</b><span>8 автобусов · условные маршруты</span><span class="banner-end">Остановка → посадка → в путь</span></div>
 <div class="mapgrid"><section><div class="mapwrap"><div id="map" class="map" aria-label="Карта ${c.name}"></div><div class="map-caption">${icon('bus')} AQYLJOL <span>ТРАНСПОРТ ГОРОДА</span></div></div>
 <div class="maptools"><button id="center-map" class="secondary">${icon('target')} Весь маршрут</button><button id="pause" class="secondary" aria-pressed="false">Пауза</button><button id="follow-bus" class="secondary" aria-pressed="false">Следить</button><label class="speed-control">Скорость <select id="sim-speed" aria-label="Скорость симуляции"><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label></div>
 <p id="map-status" class="mapstatus" role="status">Загружаем карту…</p><p class="footnote">Это симуляция, не GPS-трансляция. Названия мест реальные; координаты остановок приблизительные. Автобусы движутся по условным линиям, не по дорожной сети. Время на панели — секунды симуляции.</p></section>
 <aside><div class="tracking-card"><div class="eyebrow">НАБЛЮДАЕМ ЗА ПОЕЗДКОЙ</div><div class="tracking-title"><strong id="tracking-number"></strong><span id="motion-state"></span></div><p id="next-stop"></p><div class="motion-progress"><i id="motion-progress"></i></div><span id="arrival-count" class="muted"></span></div><div id="selected-bus"></div><div class="card"><h2>Остановки маршрута</h2><ol id="stops" class="stops"></ol></div><div class="filters fleet-picker">${BUSES.map(b=>`<button class="chip" data-select="${b.id}" aria-pressed="false">№ ${b.id}</button>`).join('')}</div></aside></div>`;
 let selected=route(params.get('bus'))||BUSES[0], map, line, stopsLayer, paused=matchMedia('(prefers-reduced-motion: reduce)').matches, following=false,speed=1;
 const markers=new Map(), clocks=new Map(BUSES.map((b,i)=>[b.id,i*19+7]));
 const markerIcon=(b,chosen)=>L.divIcon({className:'bus-pin',html:`<div class="mapmarker ${chosen?'chosen':''}" style="--bus-color:${b.color}">${icon('bus')}<b>${b.id}</b></div>`,iconSize:[64,40],iconAnchor:[32,20]});
 function updateTelemetry(){
  const state=fleetMotion.sample(selected,clocks.get(selected.id));
  $('#tracking-number').textContent='№ '+selected.id;
  $('#motion-state').textContent=paused?'На паузе':state.waiting?'На остановке':'В пути';
  $('#next-stop').textContent=(state.waiting?'Посадка: ':'Следующая: ')+c.stops[state.waiting?state.stop:state.next];
  $('#arrival-count').textContent=state.waiting?`Отправление через ${Math.ceil(fleetMotion.dwellSeconds-(clocks.get(selected.id)%(fleetMotion.segmentSeconds+fleetMotion.dwellSeconds)))} с`:`До следующей остановки: ${state.seconds} с`;
  $('#motion-progress').style.width=state.percent+'%';
  document.querySelectorAll('#stops li').forEach(el=>el.classList.toggle('next-stop',Number(el.dataset.stop)===(state.waiting?state.stop:state.next)));
 }
 function select(id,fit=true){
  selected=route(id)||selected;
  $('#selected-bus').innerHTML=busCard(selected,true);
  $('#stops').innerHTML=selected.order.map((i,j)=>`<li data-stop="${i}"><small>${String(j+1).padStart(2,'0')}</small>${c.stops[i]}</li>`).join('');
  document.querySelectorAll('.chip[data-select]').forEach(el=>{el.classList.toggle('active',el.dataset.select===selected.id);el.setAttribute('aria-pressed',String(el.dataset.select===selected.id))});
  const next=new URL(location.href);next.searchParams.set('bus',selected.id);history.replaceState(null,'',next);
  if(map){
   if(line)map.removeLayer(line);if(stopsLayer)map.removeLayer(stopsLayer);
   line=L.polyline(selected.order.map(i=>c.points[i]),{color:selected.color,weight:5,opacity:.85}).addTo(map);
   stopsLayer=L.layerGroup([...new Set(selected.order)].map(i=>L.marker(c.points[i],{icon:L.divIcon({className:'',html:'<div class="stopdot"></div>',iconSize:[14,14],iconAnchor:[7,7]}),title:c.stops[i]}).bindPopup(c.stops[i]))).addTo(map);
   markers.forEach((m,id)=>{m.setIcon(markerIcon(route(id),id===selected.id));m.setZIndexOffset(id===selected.id?1000:500)});
   if(fit)map.fitBounds(line.getBounds(),{padding:[48,48]});
  }
  updateTelemetry();
 }
 select(selected.id);
 document.addEventListener('click',e=>{const b=e.target.closest('[data-select]');if(b)select(b.dataset.select)});
 const pauseButton=$('#pause');
 function syncPause(){pauseButton.textContent=paused?'Продолжить':'Пауза';pauseButton.setAttribute('aria-pressed',String(paused));updateTelemetry()}
 syncPause();pauseButton.addEventListener('click',()=>{paused=!paused;syncPause()});
 $('#sim-speed').addEventListener('change',e=>speed=Number(e.target.value));
 $('#follow-bus').addEventListener('click',()=>{following=!following;$('#follow-bus').setAttribute('aria-pressed',String(following));$('#follow-bus').textContent=following?'Слежение включено':'Следить';if(map&&following)map.panTo(markers.get(selected.id).getLatLng())});
 if(window.L){
  map=L.map('map',{scrollWheelZoom:true}).setView(c.center,13);
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  let errors=false;tiles.on('tileerror',()=>{errors=true;$('#map-status').textContent='Подложка недоступна. Движение и условные линии продолжают работать.'});
  tiles.on('load',()=>{if(!errors)$('#map-status').textContent='OpenStreetMap · движение рассчитано локально'});
  BUSES.forEach(b=>markers.set(b.id,L.marker(fleetMotion.sample(b,clocks.get(b.id)).latlng,{icon:markerIcon(b,b.id===selected.id),title:`Демо-автобус ${b.id}`,zIndexOffset:500}).addTo(map).on('click',()=>select(b.id,false))));
  select(selected.id);$('#center-map').addEventListener('click',()=>map.fitBounds(line.getBounds(),{padding:[48,48]}));
  map.on('dragstart',()=>{following=false;$('#follow-bus').setAttribute('aria-pressed','false');$('#follow-bus').textContent='Следить'});
 }else{
  $('#map').innerHTML='<div class="offline-map"><span class="botavatar">↗</span><h2>Карта ждёт подключения</h2><p>Для подложки нужен интернет.<br>Симуляция поездок работает на панели справа.</p><button class="primary" id="retry-map">Повторить загрузку</button></div>';
  $('#retry-map').onclick=()=>location.reload();$('#map-status').textContent='Библиотека карты не загрузилась';$('#center-map').disabled=true;$('#follow-bus').disabled=true;
 }
 let previous=performance.now(),lastUI=0;
 function frame(now){
  const dt=Math.min((now-previous)/1000,.1);previous=now;
  if(!paused&&!document.hidden){BUSES.forEach(b=>{clocks.set(b.id,clocks.get(b.id)+dt*speed);if(markers.has(b.id))markers.get(b.id).setLatLng(fleetMotion.sample(b,clocks.get(b.id)).latlng)});
   if(now-lastUI>250){updateTelemetry();if(map&&following)map.panTo(markers.get(selected.id).getLatLng(),{animate:false});lastUI=now}}
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
 simulateDisruptions(()=>{$('#selected-bus').innerHTML=busCard(selected,true)});
}

function journeyOptions(from,to){
 if(from===to)return [];
 const results=[];
 function legs(bus,a,b){const order=fleetMotion.itinerary(bus);let best=Infinity;for(let i=0;i<order.length-1;i++)if(order[i]===a){for(let n=1;n<order.length;n++)if(order[(i+n)%(order.length-1)]===b){best=Math.min(best,n);break}}return best}
 for(const bus of BUSES){const count=legs(bus,from,to);if(Number.isFinite(count))results.push({buses:[bus],minutes:bus.eta+count*3,count})}
 if(!results.length)for(const a of BUSES)for(const b of BUSES){if(a===b)continue;for(const via of new Set(a.order)){if(via===from||via===to)continue;const first=legs(a,from,via),second=legs(b,via,to);if(Number.isFinite(first+second))results.push({buses:[a,b],minutes:a.eta+b.eta+(first+second)*3,count:first+second,via})}}
 return results.sort((a,b)=>a.minutes-b.minutes).slice(0,3);
}

document.addEventListener('DOMContentLoaded',()=>{
 // Accessible names remain available when navigation captions collapse on small screens.
 document.querySelectorAll('#nav a').forEach(a=>a.setAttribute('aria-label',a.textContent.trim()));
 const headerNote=document.createElement('span');headerNote.className='header-note';headerNote.innerHTML='<i></i> Твой ритм. Твой маршрут.';$('.brand').after(headerNote);
 if(page!=='home')return;
 $('.pageheading').insertAdjacentHTML('beforeend','<span class="today-label">КАЗАХСТАН / ГОРОДСКАЯ МОБИЛЬНОСТЬ</span>');
 const hero=$('.hero');hero.insertAdjacentHTML('beforeend',`<div class="city-art" aria-hidden="true"><svg viewBox="0 0 480 330"><defs><pattern id="city-grid" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M38 0H0V38" fill="none" stroke="#ffffff" stroke-opacity=".06"/></pattern></defs><rect width="480" height="330" fill="url(#city-grid)"/><g fill="#264c45" stroke="#52766b" stroke-width="1"><path d="M280 30l50-20 40 22v80l-50 20-40-22z"/><path d="M370 162l48-20 40 22v60l-48 20-40-22z"/><path d="M100 70l42-18 32 20v53l-42 18-32-20z"/><path d="M165 222l50-20 35 21v70l-50 20-35-21z"/></g><path d="M-10 213L122 155Q149 144 174 157L244 193Q269 208 295 195L485 108" fill="none" stroke="#0b211c" stroke-width="44"/><path d="M-10 213L122 155Q149 144 174 157L244 193Q269 208 295 195L485 108" fill="none" stroke="#c9f24e" stroke-width="2" stroke-dasharray="6 9"/><g transform="translate(220 155) rotate(25)"><rect x="-49" y="-24" width="98" height="48" rx="13" fill="#c9f24e"/><rect x="-35" y="-18" width="51" height="36" rx="7" fill="#ecffb8"/><path d="M23-16h13v32H23" fill="#244c42"/><path d="M-26-28h18m-18 56h18m33-56h13m-13 56h13" stroke="#071d16" stroke-width="7"/><text x="-12" y="6" fill="#183d2b" text-anchor="middle" font-size="18" font-weight="bold">14</text></g><circle cx="125" cy="155" r="7" fill="#c9f24e"/><circle cx="378" cy="157" r="7" fill="#c9f24e"/></svg><div class="art-label"><i></i> Поехали с комфортом <span>↗</span></div></div>`);
 const planner=document.createElement('section');planner.className='card journey-planner';
 planner.innerHTML=`<div class="planner-heading"><div><span class="eyebrow">ТВОЯ СЛЕДУЮЩАЯ ПОЕЗДКА</span><h2>Из точки А — в твои планы.</h2></div><span class="badge">${icon('spark')} Подбор маршрута</span></div><form id="journey-form"><label class="field">Откуда<select id="journey-from" aria-label="Остановка отправления">${CITIES[city].stops.map((s,i)=>`<option value="${i}">${s}</option>`).join('')}</select></label><button class="swap-stops" type="button" id="swap-stops" aria-label="Поменять остановки местами">⇄</button><label class="field">Куда<select id="journey-to" aria-label="Остановка назначения">${CITIES[city].stops.map((s,i)=>`<option value="${i}" ${i===3?'selected':''}>${s}</option>`).join('')}</select></label><button class="primary" type="submit">Найти поездку ${icon('arrow')}</button></form><div id="journey-results" aria-live="polite"></div><p class="footnote">Демо-подбор по условным маршрутам. Время оценено из расчёта 3 минуты между остановками и ожидания автобуса.</p>`;
 $('.twocol').after(planner);
 $('#swap-stops').onclick=()=>{const a=$('#journey-from'),b=$('#journey-to');[a.value,b.value]=[b.value,a.value];$('#journey-results').replaceChildren()};
 for(const id of ['#journey-from','#journey-to'])$(id).onchange=()=>$('#journey-results').replaceChildren();
 $('#journey-form').onsubmit=e=>{e.preventDefault();const from=Number($('#journey-from').value),to=Number($('#journey-to').value);const options=journeyOptions(from,to);$('#journey-results').innerHTML=from===to?'<p class="planner-message">Ты уже в нужном месте — выбери другую остановку.</p>':options.length?options.map((o,i)=>`<a class="journey-result" href="${url('map.html',{bus:o.buses[0].id})}"><span class="journey-route">${o.buses.map(b=>`<b style="background:${b.color}">${b.id}</b>`).join('<span>→</span>')}</span><span><strong>${i===0?'Быстрее среди найденных':'Ещё один вариант'}</strong><small>${o.buses.length===1?'Без пересадок':'Пересадка: '+CITIES[city].stops[o.via]}</small></span><strong>≈ ${o.minutes} мин</strong>${icon('arrow')}</a>`).join(''):'<p class="planner-message">Связь между остановками не найдена. Попробуй соседнюю остановку.</p>'};
 $('.journey-planner').insertAdjacentHTML('afterend',`<div class="city-metrics"><div><strong>${Object.keys(CITIES).length}</strong><span>городов Казахстана</span></div><div><strong>${BUSES.length}</strong><span>демо-маршрутов</span></div><div><strong>А → Б</strong><span>с заботой о комфорте</span></div><a href="${url('map.html')}"><span class="live-dot"></span> Посмотреть движение ${icon('arrow')}</a></div>`);
});
