/* VOID MAP 2.0 - client-only map application
   Data: OpenStreetMap/Nominatim/Overpass/OSRM/Open-Meteo.
   No API key is required for the demo. Public services have usage limits.
*/
(() => {
'use strict';

const $ = id => document.getElementById(id);
const map = L.map('map', { zoomControl:false }).setView([28.6139,77.2090], 12);
const normalMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri'});
const darkMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:20,attribution:'© OpenStreetMap © CARTO'});

let userLocation=null,userMarker=null,accuracyCircle=null,searchMarker=null,currentPlace=null,routeLine=null,routeAlternatives=[],nearbyLayer=L.layerGroup().addTo(map);
let watchId=null,follow=false,selectedTransport='driving',dark=false,satellite=false,traffic=false,weather=false,searchTimer=null;
let safeTimer=null,safeEnd=0;
const storage={saved:'voidSavedPlaces',history:'voidRecentSearches',date:'voidDatePlan'};
const el={search:$('searchInput'),suggestions:$('suggestions'),clear:$('clearBtn'),placeCard:$('placeCard'),placeName:$('placeName'),placeAddress:$('placeAddress'),placeMeta:$('placeMeta'),directions:$('directionsCard'),routeDistance:$('routeDistance'),routeTime:$('routeTime'),routeStatus:$('routeStatus'),turnList:$('turnList'),toast:$('toast')};

function toast(msg){el.toast.textContent=msg;el.toast.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.toast.classList.remove('show'),2800);}
function escapeHTML(v){const d=document.createElement('div');d.textContent=v??'';return d.innerHTML;}
function closePanels(){document.querySelectorAll('.panel').forEach(p=>p.classList.remove('open'));}
function openPanel(id){closePanels();$(id).classList.add('open');}
function saveJSON(k,v){localStorage.setItem(k,JSON.stringify(v));}
function getJSON(k,f=[]){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
function fmtDuration(min){min=Math.round(min);if(min<1)return '<1 min';if(min<60)return `${min} min`;const h=Math.floor(min/60),m=min%60;return m?`${h}h ${m}m`:`${h}h`;}
function fmtDistance(m){return m<1000?`${Math.round(m)} m`:`${(m/1000).toFixed(1)} km`;}
function currentCenter(){const c=map.getCenter();return {lat:c.lat,lon:c.lng};}

// 1) Advanced search + autocomplete + recent searches
async function searchPlaces(q,limit=8){
 const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&namedetails=1&limit=${limit}&q=${encodeURIComponent(q)}`;
 const r=await fetch(url,{headers:{'Accept':'application/json'}});if(!r.ok)throw Error('Search failed');return r.json();
}
async function searchPlace(q,chosen=null){q=(q||'').trim();if(!q)return;el.suggestions.style.display='none';
 try{const data=chosen?[chosen]:await searchPlaces(q,1);if(!data.length)return toast('Place not found.');showPlace(data[0]);addHistory(data[0].display_name);}
 catch(e){console.error(e);toast('Search is unavailable right now.');}
}
function showPlace(p){currentPlace={...p,lat:Number(p.lat),lon:Number(p.lon)};const ll=[currentPlace.lat,currentPlace.lon];map.setView(ll,16);if(searchMarker)map.removeLayer(searchMarker);searchMarker=L.marker(ll).addTo(map).bindPopup(`<b>${escapeHTML(p.display_name)}</b>`).openPopup();
 el.placeName.textContent=p.name||p.display_name.split(',')[0];el.placeAddress.textContent=p.display_name;el.placeMeta.innerHTML=`<span>📍 ${p.type||'place'}</span>${p.address?.city?`<span>🏙️ ${escapeHTML(p.address.city)}</span>`:''}`;el.placeCard.classList.add('open');
 const saved=getJSON(storage.saved);$('savePlaceBtn').textContent=saved.some(x=>Number(x.lat)===currentPlace.lat&&Number(x.lon)===currentPlace.lon)?'⭐ Saved':'⭐ Save';
}
el.search.addEventListener('input',()=>{el.clear.style.display=el.search.value?'block':'none';clearTimeout(searchTimer);const q=el.search.value.trim();if(q.length<3){el.suggestions.style.display='none';return;}searchTimer=setTimeout(async()=>{try{const data=await searchPlaces(q,6);el.suggestions.innerHTML='';data.forEach(p=>{const d=document.createElement('button');d.className='suggestion';d.innerHTML=`<b>📍</b><span>${escapeHTML(p.display_name)}</span>`;d.onclick=()=>{el.search.value=p.display_name;searchPlace(p.display_name,p)};el.suggestions.appendChild(d)});el.suggestions.style.display=data.length?'block':'none';}catch{}} ,350);});
$('searchBtn').onclick=()=>searchPlace(el.search.value);el.search.addEventListener('keydown',e=>{if(e.key==='Enter')searchPlace(el.search.value)});el.clear.onclick=()=>{el.search.value='';el.clear.style.display='none';el.suggestions.style.display='none';};
document.addEventListener('click',e=>{if(!e.target.closest('.search-container'))el.suggestions.style.display='none';});
function addHistory(v){let a=getJSON(storage.history);a=[v,...a.filter(x=>x!==v)].slice(0,15);saveJSON(storage.history,a);}
function renderHistory(){const box=$('historyList');const a=getJSON(storage.history);box.innerHTML=a.length?'':'<p class="muted">No searches yet.</p>';a.forEach(v=>{const b=document.createElement('button');b.className='result-item';b.textContent='🕘 '+v;b.onclick=()=>searchPlace(v);box.appendChild(b)});}

// 2) Live location, accuracy, follow, heading
function startLocation(){if(!navigator.geolocation)return toast('Geolocation is not supported.');$('locationBtn').disabled=true;$('locationBtn').innerHTML='📍 Locating...';if(watchId!==null)navigator.geolocation.clearWatch(watchId);watchId=navigator.geolocation.watchPosition(updateLocation,err=>{toast(err.code===1?'Location permission denied.':'Unable to get location.');$('locationBtn').disabled=false;$('locationBtn').innerHTML='📍 <span>My Location</span>';},{enableHighAccuracy:true,maximumAge:5000,timeout:15000});}
function updateLocation(pos){const {latitude:lat,longitude:lon,accuracy,heading}=pos.coords;userLocation={lat,lon,accuracy,heading};const icon=L.divIcon({className:'user-marker',html:`<div class="heading" style="transform:rotate(${Number.isFinite(heading)?heading:0}deg)"></div><div class="user-dot"></div>`,iconSize:[34,34],iconAnchor:[17,17]});if(!userMarker)userMarker=L.marker([lat,lon],{icon}).addTo(map);else userMarker.setLatLng([lat,lon]).setIcon(icon);if(!accuracyCircle)accuracyCircle=L.circle([lat,lon],{radius:accuracy,weight:1,fillOpacity:.08}).addTo(map);else accuracyCircle.setLatLng([lat,lon]).setRadius(accuracy);if(follow)map.setView([lat,lon],Math.max(map.getZoom(),16),{animate:true});$('locationBtn').disabled=false;$('locationBtn').innerHTML='📍 <span>My Location</span>';}
$('locationBtn').onclick=()=>{startLocation();if(userLocation)map.setView([userLocation.lat,userLocation.lon],16)};$('followBtn').onclick=()=>{follow=!follow;$('followBtn').classList.toggle('active',follow);if(follow&&userLocation)map.setView([userLocation.lat,userLocation.lon],16);toast(follow?'Follow mode on':'Follow mode off');};map.on('dragstart',()=>{if(follow){follow=false;$('followBtn').classList.remove('active')}});

// 3) Layers: light/dark/satellite/traffic/weather. Traffic is an OpenStreetMap live-coverage overlay when tiles are available.
function setBase(){[normalMap,satelliteMap,darkMap].forEach(l=>{if(map.hasLayer(l))map.removeLayer(l)});(dark?darkMap:(satellite?satelliteMap:normalMap)).addTo(map);}
$('darkModeBtn').onclick=()=>{dark=!dark;setBase();document.body.classList.toggle('dark-mode',dark);$('darkModeBtn').textContent=dark?'☀️':'🌙';};
$('satelliteBtn').onclick=()=>{satellite=!satellite;dark=false;setBase();$('satelliteBtn').textContent=satellite?'🗺️':'🛰️';};
let trafficLayer=null; // OpenStreetMap traffic events are not universally tiled; we use a transparent event overlay from Overpass below.
$('trafficBtn').onclick=async()=>{traffic=!traffic;$('trafficBtn').classList.toggle('active',traffic);if(traffic){await loadTrafficEvents()}else{if(trafficLayer)map.removeLayer(trafficLayer)}};
async function loadTrafficEvents(){if(trafficLayer)map.removeLayer(trafficLayer);trafficLayer=L.layerGroup().addTo(map);const c=currentCenter();const q=`[out:json][timeout:20];(node[highway=traffic_signals](around:5000,${c.lat},${c.lon});way[highway](around:5000,${c.lat},${c.lon}););out tags center 80;`;try{const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:q});if(!r.ok)throw Error();const d=await r.json();d.elements.filter(x=>x.tags?.highway==='traffic_signals').slice(0,150).forEach(x=>L.circleMarker([x.lat,x.lon],{radius:4,color:'#ef4444',fillColor:'#ef4444',fillOpacity:.8}).bindTooltip('Traffic signal').addTo(trafficLayer));toast('Traffic signal overlay loaded (OSM data)');}catch{toast('Traffic overlay is temporarily unavailable.')}}
$('weatherBtn').onclick=async()=>{openPanel('weatherPanel');await loadWeather();};
async function loadWeather(){if(!userLocation){startLocation();return $('weatherContent').innerHTML='<p class="muted">Allow location to get local weather.</p>';}const {lat,lon}=userLocation;try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=precipitation_probability&forecast_days=1&timezone=auto`);const d=await r.json(),c=d.current;$('weatherContent').innerHTML=`<div class="weather-main">${weatherEmoji(c.weather_code)} <strong>${Math.round(c.temperature_2m)}°C</strong></div><div class="weather-grid"><span>Feels ${Math.round(c.apparent_temperature)}°C</span><span>💧 ${c.relative_humidity_2m}%</span><span>💨 ${Math.round(c.wind_speed_10m)} km/h</span><span>☔ ${d.hourly.precipitation_probability[0]}%</span></div>`;}catch{$('weatherContent').textContent='Weather unavailable.'}}
function weatherEmoji(code){if(code===0)return'☀️';if(code<4)return'🌤️';if(code<60)return'🌫️';if(code<80)return'🌧️';if(code<90)return'🌨️';return'⛈️'}

// 4) Explore / nearby using Overpass
const cat={cafe:'amenity=cafe',restaurant:'amenity=restaurant',hospital:'amenity=hospital',fuel:'amenity=fuel',hotel:'tourism=hotel',cinema:'amenity=cinema',shopping:'shop',atm:'amenity=atm',college:'amenity=college',park:'leisure=park'};
async function nearby(category, radius=5000){const c=userLocation||currentCenter();const key=cat[category];let selector=key.includes('=')?`node[${key}](around:${radius},${c.lat},${c.lon});way[${key}](around:${radius},${c.lat},${c.lon});`:`node[shop](around:${radius},${c.lat},${c.lon});way[shop](around:${radius},${c.lat},${c.lon});`;const q=`[out:json][timeout:25];(${selector});out center tags 100;`;const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:q});if(!r.ok)throw Error();const d=await r.json();return d.elements.map(x=>({id:x.id,name:x.tags?.name||category,lat:x.lat??x.center?.lat,lon:x.lon??x.center?.lon,tags:x.tags||{}})).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon));}
async function showNearby(category){$('exploreResults').innerHTML='<p class="muted">Finding nearby places…</p>';nearbyLayer.clearLayers();try{const data=await nearby(category);data.forEach(p=>{const m=L.marker([p.lat,p.lon]).bindPopup(`<b>${escapeHTML(p.name)}</b><br>${escapeHTML(p.tags.amenity||p.tags.shop||category)}`).addTo(nearbyLayer);m.on('click',()=>showPlace({name:p.name,display_name:p.name,lat:p.lat,lon:p.lon,type:category,address:{}}));});$('exploreResults').innerHTML=data.slice(0,30).map((p,i)=>`<button class="result-item" data-i="${i}">📍 ${escapeHTML(p.name)}</button>`).join('');[...$('exploreResults').querySelectorAll('.result-item')].forEach((b,i)=>b.onclick=()=>showPlace(data[i]));map.setView([data[0]?.lat||currentCenter().lat,data[0]?.lon||currentCenter().lon],15);toast(`${data.length} places found`);}catch{toast('Nearby search unavailable.');$('exploreResults').innerHTML='<p class="muted">Try again in a moment.</p>';}}
document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>showNearby(b.dataset.category));$('exploreBtn').onclick=()=>openPanel('explorePanel');$('placesBtn').onclick=()=>{openPanel('nearbyPanel');showNearby('cafe').then(()=>{ $('nearbyResults').innerHTML=$('exploreResults').innerHTML;})};

// 5) Place card + saved places
$('closeCard').onclick=()=>el.placeCard.classList.remove('open');$('savePlaceBtn').onclick=()=>{if(!currentPlace)return;let a=getJSON(storage.saved);if(a.some(x=>x.lat===currentPlace.lat&&x.lon===currentPlace.lon))return toast('Already saved.');a.push({name:currentPlace.name||currentPlace.display_name.split(',')[0],display_name:currentPlace.display_name,lat:currentPlace.lat,lon:currentPlace.lon,label:currentPlace.name||''});saveJSON(storage.saved,a);$('savePlaceBtn').textContent='⭐ Saved';renderSaved();toast('Place saved');};
function renderSaved(){const box=$('savedList'),a=getJSON(storage.saved);box.innerHTML=a.length?'':'<p class="muted">No saved places yet.</p>';a.forEach((p,i)=>{const d=document.createElement('div');d.className='result-row';d.innerHTML=`<button class="result-item">⭐ ${escapeHTML(p.label||p.name)}</button><button class="delete-btn">×</button>`;d.querySelector('.result-item').onclick=()=>showPlace(p);d.querySelector('.delete-btn').onclick=()=>{a.splice(i,1);saveJSON(storage.saved,a);renderSaved()};box.appendChild(d)});}
$('savedBtn').onclick=()=>{openPanel('savedPanel');renderSaved()};$('saveCurrentBtn').onclick=()=>{if(!currentPlace)return toast('Select a place first.');let a=getJSON(storage.saved);a.push({name:currentPlace.name||'Saved place',label:$('saveLabel').value||currentPlace.name||'Saved place',display_name:currentPlace.display_name,lat:currentPlace.lat,lon:currentPlace.lon});saveJSON(storage.saved,a);$('saveLabel').value='';renderSaved();toast('Saved');};
$('historyBtn').onclick=()=>{openPanel('historyPanel');renderHistory()};$('clearHistoryBtn').onclick=()=>{localStorage.removeItem(storage.history);renderHistory()};

// 6) Navigation: turn-by-turn, alternatives, recenter. Transit/taxi hand off to Google Maps with the selected coordinates.
const modes=document.querySelectorAll('.transport-btn');modes.forEach(b=>b.onclick=()=>{modes.forEach(x=>x.classList.remove('active'));b.classList.add('active');selectedTransport=b.dataset.mode;if(currentPlace&&userLocation)getRoute()});
$('directionsBtn').onclick=()=>{if(!currentPlace)return toast('Select a destination first.');if(!userLocation)return toast('Allow location first.');openPanel('directionsCard');getRoute();};
$('closeDirections').onclick=()=>{el.directions.classList.remove('open');if(routeLine)map.removeLayer(routeLine);routeLine=null};
async function getRoute(){if(!currentPlace||!userLocation)return;if(selectedTransport==='transit'||selectedTransport==='taxi'){const mode=selectedTransport==='transit'?'transit':'driving';const u=`https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lon}&destination=${currentPlace.lat},${currentPlace.lon}&travelmode=${mode}`;window.open(u,'_blank','noopener');el.routeStatus.textContent=`Opened ${selectedTransport} directions in Google Maps.`;return;}
 const profile=selectedTransport==='bike'||selectedTransport==='cycling'?'cycling':selectedTransport==='walking'?'foot':'driving';el.routeStatus.textContent=`Finding ${getTransportName(selectedTransport).toLowerCase()} route…`;el.turnList.innerHTML='';try{const u=`https://router.project-osrm.org/route/v1/${profile}/${userLocation.lon},${userLocation.lat};${currentPlace.lon},${currentPlace.lat}?overview=full&geometries=geojson&steps=true&alternatives=true`;const r=await fetch(u);const d=await r.json();if(!r.ok||d.code!=='Ok'||!d.routes?.length)throw Error(d.message);routeAlternatives=d.routes;if(routeLine)map.removeLayer(routeLine);routeLine=L.geoJSON(d.routes[0].geometry,{style:{weight:6,opacity:.9}}).addTo(map);map.fitBounds(routeLine.getBounds(),{padding:[70,70]});el.routeDistance.textContent=fmtDistance(d.routes[0].distance);el.routeTime.textContent=fmtDuration(d.routes[0].duration/60);el.routeStatus.textContent=`${getTransportName(selectedTransport)} route ready • ${d.routes.length} option(s)`;renderTurns(d.routes[0]);}catch(e){console.error(e);el.routeStatus.textContent='Route unavailable. Try another mode.'}}
function renderTurns(route){el.turnList.innerHTML=(route.legs?.[0]?.steps||[]).slice(0,30).map(s=>`<div class="turn"><b>${turnIcon(s.maneuver?.type,s.maneuver?.modifier)}</b><span>${escapeHTML(s.maneuver?.instruction||`${s.name||'Continue'}`)}</span><small>${fmtDistance(s.distance)}</small></div>`).join('')||'<p class="muted">No turn instructions available.</p>';}
function turnIcon(t,m){if(t==='arrive')return'🏁';if(t==='depart')return'🚦';if(m?.includes('left'))return'↰';if(m?.includes('right'))return'↱';if(t==='roundabout')return'🔄';return'⬆️'}
$('alternativeBtn').onclick=()=>{if(routeAlternatives.length<2)return toast('No alternative route available.');const next=routeAlternatives[1];if(routeLine)map.removeLayer(routeLine);routeLine=L.geoJSON(next.geometry,{style:{weight:6,opacity:.9,dashArray:'8 8'}}).addTo(map);el.routeDistance.textContent=fmtDistance(next.distance);el.routeTime.textContent=fmtDuration(next.duration/60);renderTurns(next);toast('Alternative route selected');};$('recenterRouteBtn').onclick=()=>{if(routeLine)map.fitBounds(routeLine.getBounds(),{padding:[70,70]})};
function getTransportName(m){return({driving:'Driving',walking:'Walking',cycling:'Cycling',bike:'Bike',transit:'Transit',taxi:'Taxi'})[m]||'Driving'}

// 7) Meet halfway + date planner
$('meetHalfwayBtn').onclick=()=>{if(!userLocation)return toast('Allow your location first.');if(!currentPlace)return;const lat=(userLocation.lat+currentPlace.lat)/2,lon=(userLocation.lon+currentPlace.lon)/2;const midpoint={name:'Meet halfway',display_name:`Halfway point between you and ${currentPlace.name||'destination'}`,lat,lon,type:'meeting point',address:{}};showPlace(midpoint);map.setView([lat,lon],14);toast('Halfway point calculated');};
$('safeDateBtn').onclick=()=>openPanel('safePanel');$('saveDateBtn').onclick=()=>{if(!currentPlace)return toast('Select a place first.');const p={place:currentPlace,date:$('dateInput').value,time:$('timeInput').value};saveJSON(storage.date,p);$('datePlanOutput').innerHTML=`<div class="success">❤️ Date saved for ${escapeHTML(p.date||'unscheduled')} ${escapeHTML(p.time||'')} at ${escapeHTML(p.place.name||p.place.display_name)}</div>`;toast('Date plan saved')};

// 8) Safe Date / timed location sharing. Browser-native Web Share or copyable link; no hidden tracking.
$('startSafeBtn').onclick=()=>{if(!userLocation)return toast('Allow location first.');const mins=Number($('shareDuration').value);safeEnd=Date.now()+mins*60000;clearInterval(safeTimer);safeTimer=setInterval(updateSafeStatus,1000);updateSafeStatus();toast(`Safe Date started for ${mins} minutes`);};
function updateSafeStatus(){const left=Math.max(0,safeEnd-Date.now());if(!left){clearInterval(safeTimer);$('safeStatus').innerHTML='<div class="success">Safe Date ended.</div>';return}const m=Math.floor(left/60000),s=Math.floor(left/1000)%60;$('safeStatus').innerHTML=`<div class="safe-live">🛡️ Active • ${m}:${String(s).padStart(2,'0')} remaining${$('safeContact').value?` • ${escapeHTML($('safeContact').value)}`:''}<button id="stopSafe">Stop</button></div>`;$('stopSafe').onclick=()=>{safeEnd=0;clearInterval(safeTimer);updateSafeStatus()};}
function shareURL(lat,lon,label){return `${location.origin}${location.pathname}#loc=${lat.toFixed(6)},${lon.toFixed(6)}&name=${encodeURIComponent(label||'Shared location')}`;}
async function shareLocation(lat,lon,label){const url=shareURL(lat,lon,label);$('shareLink').value=url;if(navigator.share){try{await navigator.share({title:'VOID MAP location',text:label||'Shared location',url});return}catch{}}await navigator.clipboard?.writeText(url);toast('Share link copied');}
$('shareBtn').onclick=()=>openPanel('sharePanel');$('shareCurrentBtn').onclick=()=>{if(!userLocation)return toast('Allow location first.');shareLocation(userLocation.lat,userLocation.lon,'My location')};$('sharePlacePanelBtn').onclick=()=>{if(!currentPlace)return toast('Select a place first.');shareLocation(currentPlace.lat,currentPlace.lon,currentPlace.name||'Selected place')};$('sharePlaceBtn').onclick=()=>{if(currentPlace)shareLocation(currentPlace.lat,currentPlace.lon,currentPlace.name||'Selected place')};
function readSharedHash(){if(!location.hash.startsWith('#loc='))return;const raw=location.hash.slice(5).split('&')[0].split(',');const lat=Number(raw[0]),lon=Number(raw[1]);if(Number.isFinite(lat)&&Number.isFinite(lon)){map.setView([lat,lon],16);L.marker([lat,lon]).addTo(map).bindPopup('📌 Shared location').openPopup();toast('Shared location opened');}}

// 9) Panel wiring and date shortcuts
$('dateInput').valueAsDate=new Date();document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).classList.remove('open'));

// 10) Search/category quick intelligence: natural-language, rule-based AI-style search.
const phrases=[['quiet place','cafe'],['coffee','cafe'],['study','college'],['food','restaurant'],['eat','restaurant'],['fuel','fuel'],['petrol','fuel'],['hospital','hospital'],['movie','cinema'],['shopping','shopping'],['park','park'],['atm','atm']];
const originalSearch=searchPlace;searchPlace=async function(q,chosen=null){const low=(q||'').toLowerCase();if(!chosen){const hit=phrases.find(([p])=>low.includes(p));if(hit&&low.split(' ').length>1){openPanel('explorePanel');return showNearby(hit[1]);}}return originalSearch(q,chosen)};

// 11) Map controls
$('zoomIn').onclick=()=>map.zoomIn();$('zoomOut').onclick=()=>map.zoomOut();
map.on('click',e=>{if(e.originalEvent.shiftKey){showPlace({name:'Pinned location',display_name:`${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`,lat:e.latlng.lat,lon:e.latlng.lng,type:'pin',address:{}})}});

// 12) Load hash + saved state
readSharedHash();renderHistory();renderSaved();
console.log('VOID MAP 2.0 ready');
})();
