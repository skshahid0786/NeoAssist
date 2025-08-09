

/* ----------------- Utilities & UI ----------------- */
const chatEl = document.getElementById('chat');
const textInput = document.getElementById('textInput');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const clearBtn = document.getElementById('clearBtn');

function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function addBubble(text, who='bot', meta=''){
  const b = document.createElement('div');
  b.className = 'bubble ' + (who==='user'?'user':'bot');
  b.innerHTML = `<div>${escapeHtml(text).replace(/\n/g,'<br/>')}</div>` + (meta ? `<div class="meta">${escapeHtml(meta)}</div>` : '');
  chatEl.appendChild(b);
  chatEl.scrollTop = chatEl.scrollHeight;
}
function addOptionList(options){
  document.querySelectorAll('.option-box').forEach(n=>n.remove());
  const box = document.createElement('div'); box.className='option-box';
  box.style.padding='12px'; box.style.margin='6px 0 12px'; box.style.borderTop='1px solid rgba(255,255,255,0.02)';
  box.innerHTML = `<div class="option-list">${options.map((o,i)=> `<div class="option" data-idx="${i}">${i+1}. <strong>${escapeHtml(o.name)}</strong><small>${escapeHtml(o.hint||'')}</small></div>`).join('')}</div>`;
  chatEl.appendChild(box); chatEl.scrollTop = chatEl.scrollHeight;
  box.querySelectorAll('.option').forEach(el=> el.addEventListener('click', ()=> runChoice(Number(el.dataset.idx)) ));
}
document.getElementById('wikiBtn').addEventListener('click', () => {
  const topic = prompt('Enter 1-2 word topic for search:');
  if (topic) {
    handleInputText('wiki search ' + topic);
  }
});

/* ----------------- Speech ----------------- */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false;
if(SpeechRecognition){
  rec = new SpeechRecognition();
  rec.lang = 'en-IN';
  rec.interimResults = false;
  rec.continuous = true;
  rec.onstart = ()=>{ listening=true; micBtn.textContent='🔴'; micBtn.title='Listening... Tap to stop'; }
  rec.onend = ()=>{ listening=false; micBtn.textContent='🎤'; micBtn.title='Start listening'; }
  rec.onerror = (e)=> { console.warn('Speech error', e); speak('Speech recognition error'); }
  rec.onresult = (ev)=> { const last = ev.results[ev.results.length-1][0].transcript.trim(); userSays(last); };
} else { micBtn.disabled = true; micBtn.title = 'Speech not supported'; }

/* ----------------- TTS ----------------- */
function speak(text){
  if(!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

/* ----------------- Helper fetch wrappers ----------------- */
async function fetchJson(url){
  const r = await fetch(url, {cache:'no-cache'}); return r.ok ? await r.json() : null;
}

/* ----------------- Free APIs used (no key required) -----------------
JokeAPI: https://v2.jokeapi.dev/
Advice: https://api.adviceslip.com/advice
Quotes: https://api.quotable.io/random
Numbers API: http://numbersapi.com
Bored API: https://www.boredapi.com/api/activity
Cat: https://aws.random.cat/meow
Dog: https://random.dog/woof.json
IP: https://api.ipify.org?format=json
Open-Meteo geocoding: https://geocoding-api.open-meteo.com/v1/search?name=...
Open-Meteo weather: https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...&current_weather=true
WorldTimeAPI: http://worldtimeapi.org/api/timezone/{area}/{city} or http://worldtimeapi.org/api/ip
Numbers API JSON: http://numbersapi.com/random/trivia?json
*/

/* ----------------- Command list (100+). Each command: {name, keywords[], hint, action(input)} ----------------- */
const commands = [
  // Time & Date
  {name:'Tell the current time', keywords:['time','what time','clock','hour'], hint:'Get local time', action: ()=> `⏰ ${new Date().toLocaleTimeString()}`},
  {name:'Tell the date', keywords:['date','today','what day','day is it','month','year'], hint:'Get today\'s date', action: ()=> `📅 ${new Date().toLocaleDateString()}`},
  {name:'Time in city', keywords:['time in','what time in','time at'], hint:'Time in a city: "time in London"', action: async (text)=>{
    const q = text.match(/time in (.+)$/i)?.[1] || text.replace(/.*time in|what time in/i,'').trim();
    if(!q) return 'Tell me the city: e.g. "time in Tokyo"';
    // try WorldTimeAPI search by area using timezone lookup via worldtimeapi org - fallback to ip time
    try{
      // fallback: use geocoding to find timezone? Use worldtimeapi by ipless: try to find timezone by matching substring
      const tzListRes = await fetchJson('http://worldtimeapi.org/api/timezone');
      if(Array.isArray(tzListRes)){
        const match = tzListRes.find(tz => tz.toLowerCase().includes(q.toLowerCase()));
        if(match){
          const info = await fetchJson('http://worldtimeapi.org/api/timezone/' + encodeURIComponent(match));
          if(info && info.datetime) return `🕒 ${q}: ${new Date(info.datetime).toLocaleString()}`;
        }
      }
    } catch(e){}
    return `Couldn't find timezone for "${q}". Try: time in London`;
  }},
  // Greetings
  {name:'Say Hello', keywords:['hello','hi','hey there','greetings'], hint:'Greet the bot', action: ()=> 'Hello! 👋 How can I help you today?'},
  {name:'How are you', keywords:['how are you','how r you','how you doing'], hint:'Ask bot status', action: ()=> "I'm a bot — feeling 100% ready to help you! 😄"},
  // Small utilities
  {name:'Ping', keywords:['ping','are you there','respond'], hint:'Simple ping', action: ()=> 'Pong! 🏓'},
  {name:'Flip a coin', keywords:['flip','coin','heads','tails'], hint:'Flip coin', action: ()=> Math.random()<0.5 ? 'Heads' : 'Tails'},
  {name:'Roll a dice', keywords:['roll','dice','roll a dice','roll a die'], hint:'Roll d6', action: ()=> `🎲 You rolled ${Math.floor(Math.random()*6)+1}`},
  {name:'Random number', keywords:['random number','give me a number','random'], hint:'Random 1-100', action: ()=> Math.floor(Math.random()*100)+1},
  // Text utils
  {name:'Uppercase', keywords:['uppercase','upper case','make uppercase'], hint:'Convert text', action: (t)=> { const m=t.match(/uppercase (.+)$/i)?.[1]; return m? m.toUpperCase() : 'Usage: uppercase Hello world'; }},
  {name:'Lowercase', keywords:['lowercase','lower case','make lowercase'], hint:'Convert text', action: (t)=> { const m=t.match(/lowercase (.+)$/i)?.[1]; return m? m.toLowerCase() : 'Usage: lowercase Hello'; }},
  {name:'Reverse text', keywords:['reverse','backwards','reverse text'], hint:'Reverse text', action: (t)=> { const m=t.match(/reverse (.+)$/i)?.[1]; return m? m.split('').reverse().join('') : 'Usage: reverse hello'; }},
  {name:'Count words', keywords:['count words','word count','words in'], hint:'Count words', action: (t)=> { const m=t.match(/(?:count words|words in) (.+)$/i)?.[1]; const n = m? m.trim().split(/\s+/).length : 0; return `Words: ${n}`; }},
  {name:'Count characters', keywords:['length','characters','char count'], hint:'Character count', action: (t)=> { const m=t.match(/(?:length|characters|char count) (.+)$/i)?.[1]; return m? `Characters: ${m.length}` : 'Usage: length hello'; }},
  // Math & calculator
  {name:'Calculator', keywords:['calculate','what is','solve','plus','minus','times','multiplied','divided','/','+','-','*'], hint:'calculate 5+7', action: (t)=>{
    const expr = (t.match(/(?:calculate|what is|solve)(.+)/i) || [null, t])[1] || '';
    const cleaned = expr.replace(/[^0-9+\-*/(). %]/g,'').trim();
    if(!cleaned) return 'No expression detected. Example: calculate 5+7';
    try{ const res = Function(`return (${cleaned})`)(); return `Result: ${res}`; }catch(e){ return 'Could not calculate that.'; }
  }},
  // Random content (APIs)
  {name:'Tell a joke', keywords:['joke','tell me a joke','make me laugh'], hint:'Fetch from JokeAPI', action: async ()=>{
    try{
      const j = await fetchJson('https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,sexist,political,religious,explicit&type=single');
      if(j && j.joke) return j.joke;
      if(j && j.setup) return (j.setup + ' — ' + (j.delivery || ''));
    }catch(e){}
    return "I couldn't fetch a joke right now. Try again.";
  }},
  {name:'Give advice', keywords:['advice','give advice','i need advice'], hint:'Advice Slip API', action: async ()=> {
    try{ const a = await fetchJson('https://api.adviceslip.com/advice'); return a?.slip?.advice || 'No advice right now.'; }catch(e){ return 'Advice API error.';}
  }},
  {name:'Inspiring quote', keywords:['quote','inspire','motivation','motivational quote'], hint:'Quotable API', action: async ()=> {
    try{ const q = await fetchJson('https://api.quotable.io/random'); return q ? `"${q.content}" — ${q.author}` : 'No quote now.'; }catch(e){ return 'Quote fetch failed.'; }
  }},
  {name:'Random fact', keywords:['fact','tell me a fact','random fact'], hint:'Numbers/Trivial facts', action: async ()=> {
    try{ const n = await fetchJson('http://numbersapi.com/random/trivia?json'); return n?.text || 'No fact right now.'; }catch(e){ return 'Could not fetch a fact.';}
  }},
  {name:'Bored? suggestion', keywords:['bored','what to do','i am bored'], hint:'Bored API', action: async ()=> {
    try{ const b = await fetchJson('https://www.boredapi.com/api/activity'); return b?.activity ? `Try: ${b.activity} (type: ${b.type})` : 'No activity found.'; }catch(e){ return 'Could not fetch suggestion.';}
  }},
  {name:'Cat image', keywords:['cat','cat image','meow','send cat'], hint:'Random cat picture', action: async ()=> {
    try{ const c = await fetchJson('https://aws.random.cat/meow'); return c?.file ? c.file : 'No cat image.'; }catch(e){ return 'Cat API failed.';}
  }},
  {name:'Dog image', keywords:['dog','dog image','woof','send dog'], hint:'Random dog picture', action: async ()=> {
    try{ const d = await fetchJson('https://random.dog/woof.json'); return d?.url || d?.file || 'No dog image.'; }catch(e){ return 'Dog API failed.';}
  }},
  {name:'Your public IP', keywords:['ip address','my ip','show ip','what is my ip'], hint:'ipify', action: async ()=> {
    try{ const p = await fetchJson('https://api.ipify.org?format=json'); return p?.ip ? `Your IP: ${p.ip}` : 'IP not found.'; }catch(e){ return 'IP fetch failed.';}
  }},
  {name:'Weather for city', keywords:['weather','weather in','forecast','temperature in'], hint:'Open-Meteo (free)', action: async (text)=> {
    // parse city from text
    let city = (text.match(/weather in (.+)$/i) || text.match(/in (.+) weather/i) || [null, ''])[1] || '';
    if(!city) {
      // accept "weather <city>" usage
      const s = text.replace(/weather|what's|whats|tell me/g,'').trim();
      if(s) city = s;
    }
    if(!city) return 'Tell me the city: e.g. "weather in London"';
    try{
      // geocoding
      const geo = await fetchJson('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(city) + '&count=1');
      const loc = geo?.results?.[0];
      if(!loc) return `Could not find location "${city}"`;
      const lat = loc.latitude, lon = loc.longitude;
      const w = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
      const cw = w?.current_weather;
      if(cw) return `Weather in ${loc.name}, ${loc.country}: ${cw.temperature}°C, wind ${cw.windspeed} km/h, code ${cw.weathercode}`;
      return 'Weather not available.';
    }catch(e){ return 'Weather fetch failed.';}
  }},
  {name:'Short forecast', keywords:['forecast','weather forecast','tomorrow weather'], hint:'Basic forecast (Open-Meteo)', action: async (text)=> {
    const city = (text.match(/forecast in (.+)$/i) || text.match(/forecast (.+)$/i) || [null, ''])[1] || '';
    if(!city) return 'Say: forecast in London';
    try{
      const geo = await fetchJson('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(city) + '&count=1');
      const loc = geo?.results?.[0]; if(!loc) return `Location not found: ${city}`;
      const lat = loc.latitude, lon = loc.longitude;
      const w = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m&forecast_days=2`);
      if(!w) return 'Forecast failed.';
      return `Fetched forecast for ${loc.name}, ${loc.country}. (Open-Meteo)`;
    }catch(e){ return 'Forecast error.';}
  }},
  // Fun & Trivia
  {name:'Space fact', keywords:['space','space fact','nasa','astronomy'], hint:'Space fact', action: async ()=> {
    try{ const n = await fetchJson('http://numbersapi.com/random/trivia?json'); return n?.text || 'Space is huge!'; }catch(e){ return 'No space fact.'; }
  }},
  {name:'Word definition', keywords:['define','definition of','meaning of'], hint:'Dictionary (basic)', action: async (text)=> {
    const word = text.match(/(?:define|definition of|meaning of) (.+)$/i)?.[1];
    if(!word) return 'Say: define serendipity';
    try{
      const r = await fetchJson('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word));
      if(Array.isArray(r) && r[0]?.meanings?.[0]?.definitions?.[0]?.definition) return `${word}: ${r[0].meanings[0].definitions[0].definition}`;
      return `No definition found for ${word}`;
    }catch(e){ return 'Dictionary fetch error.';}
  }},
  {name:'Synonym', keywords:['synonym of','synonyms','synonym'], hint:'Thesaurus (basic)', action: async (text)=> {
    const w = text.match(/(?:synonym of|synonyms of|synonym) (.+)$/i)?.[1]; if(!w) return 'Say: synonym of happy';
    // use Datamuse API
    try{ const res = await fetchJson('https://api.datamuse.com/words?rel_syn=' + encodeURIComponent(w)); if(res && res.length) return 'Synonyms: ' + res.slice(0,6).map(x=>x.word).join(', '); }catch(e){}
    return 'No synonyms found.';
  }},
  {name:'Antonym', keywords:['antonym of','antonyms','antonym'], hint:'Opposite words', action: async (text)=> {
    const w = text.match(/(?:antonym of|antonyms of|antonym) (.+)$/i)?.[1]; if(!w) return 'Say: antonym of happy';
    try{ const res = await fetchJson('https://api.datamuse.com/words?rel_ant=' + encodeURIComponent(w)); if(res && res.length) return 'Antonyms: ' + res.slice(0,6).map(x=>x.word).join(', '); }catch(e){}
    return 'No antonyms found.';
  }},
  // Games & fun
  {name:'Rock paper scissors', keywords:['rock paper scissors','rps','play rps'], hint:'Play rps', action: (t)=> {
    const choices = ['rock','paper','scissors']; const bot = choices[Math.floor(Math.random()*3)];
    const user = t.match(/(rock|paper|scissors)/i)?.[1] || choices[Math.floor(Math.random()*3)];
    if(!user) return 'Say: rock, paper, or scissors';
    if(user===bot) return `Tie! You: ${user} — Bot: ${bot}`;
    const win = (u,b)=> (u==='rock'&&b==='scissors')||(u==='scissors'&&b==='paper')||(u==='paper'&&b==='rock');
    return win(user,bot) ? `You win! You: ${user} — Bot: ${bot}` : `You lose. You: ${user} — Bot: ${bot}`;
  }},
  {name:'Guess the number', keywords:['guess number','guess a number','number guess'], hint:'Try to guess', action: (()=>{ let secret=null; return (t)=> {
      if(!secret) { secret = Math.floor(Math.random()*100)+1; return 'I\'ve picked a number 1-100. Try guessing it.'; }
      const g = parseInt(t.match(/\d+/)?.[0]); if(!g) return 'Say a number between 1 and 100';
      if(g===secret){ secret=null; return `Correct! It was ${g}. I reset the game.`;}
      return g<secret ? 'Too low.' : 'Too high.';
  }; })()},
  // Media & links
  {name:'Open website', keywords:['open website','open','go to'], hint:'Open a URL (example: open youtube)', action: (t)=> {
    const site = t.match(/open (.+)$/i)?.[1]; if(!site) return 'Say: open youtube';
    const url = site.includes('.') || site.includes('http') ? site : 'https://www.' + site + '.com';
    try{ window.open(url,'_blank'); return `Opened ${site}` }catch(e){ return `Could not open ${site}`; }
  }},
  // Converters
  {name:'Convert km to miles', keywords:['kilometer to miles','km to miles','convert km'], hint:'Distance convert', action: (t)=> {
    const n = parseFloat(t.match(/[\d.]+/)?.[0]); if(!n) return 'Say: convert 10 km to miles';
    return `${n} km = ${(n*0.621371).toFixed(3)} miles`;
  }},
  {name:'Convert c to f', keywords:['c to f','celcius to fahrenheit','celsius to fahrenheit'], hint:'Temp convert', action: (t)=> {
    const n = parseFloat(t.match(/-?[\d.]+/)?.[0]); if(!n && n!==0) return 'Say: convert 25 c to f';
    return `${n}°C = ${(n*9/5+32).toFixed(1)}°F`;
  }},
  // More content & utilities (many smaller commands to reach 100+)
  {name:'Daily horoscope (demo)', keywords:['horoscope','zodiac','star sign'], hint:'Daily horoscope (demo)', action: ()=> 'Horoscope feature not implemented — coming soon.'},
  {name:'Tell a riddle', keywords:['riddle','tell me a riddle'], hint:'Hear a riddle', action: ()=> {
    const r = ["I speak without a mouth and hear without ears. What am I? — An echo.","What has keys but can’t open locks? — A piano."];
    return r[Math.floor(Math.random()*r.length)];
  }},
  {name:'Palindrome check', keywords:['palindrome','is it palindrome'], hint:'Check word', action: (t)=> {
    const s = t.match(/(?:palindrome )(.+)$/i)?.[1] || t; const cleaned = s.replace(/\W/g,'').toLowerCase();
    return cleaned === cleaned.split('').reverse().join('') ? `${s} is a palindrome` : `${s} is not a palindrome`;
  }},
  {name:'Translate (demo)', keywords:['translate','translation','translate to'], hint:'Translate (simple demo)', action: async (t)=> {
    const m = t.match(/translate (.+) to ([a-z]{2})$/i); if(!m) return 'Say: translate hello to es';
    const text = m[1], lang = m[2];
    // quick translate via libretranslate public instance (may be slow); fallback if blocked
    try{ const res = await fetchJson('https://libretranslate.de/translate', { method:'POST' }); }catch(e){}
    return `Translation feature requires a translation API — will add soon.`;
  }},
  // Cute facts
  {name:'Cat fact', keywords:['cat fact','cats fact','tell cat fact'], hint:'Cat fact', action: async ()=> {
    try{ const r = await fetchJson('https://catfact.ninja/fact'); return r?.fact || 'Cat fact not available.';}catch(e){return 'Cat fact error.';}
  }},
  {name:'Dog fact', keywords:['dog fact','dogs fact','tell dog fact'], hint:'Dog fact', action: async ()=> {
    try{ const r = await fetchJson('https://some-random-api.ml/facts/dog'); return r?.fact || 'Dog fact not available.';}catch(e){ return 'Dog fact API failed.';}
  }},
  // Word games & helper commands
  {name:'Spell word', keywords:['spell','how do you spell'], hint:'Spell a word', action: (t)=> {
    const w = t.match(/spell (.+)$/i)?.[1]; if(!w) return 'Say: spell accommodation';
    return w.split('').join(' ');
  }},
  {name:'Anagram (demo)', keywords:['anagram','scramble'], hint:'Scramble a word', action: (t)=> {
    const w = t.match(/(?:anagram|scramble) (.+)$/i)?.[1]; if(!w) return 'Say: scramble apple';
    return w.split('').sort(()=>Math.random()-0.5).join('');
  }},
  {name:'Echo', keywords:['repeat','say','echo'], hint:'Echo back text', action: (t)=> (t.match(/(?:repeat|say|echo) (.+)$/i)?.[1]) || 'Say: repeat hello'},
  // Productivity helpers
  {name:'Set a timer (demo)', keywords:['set timer','timer for','start timer'], hint:'Timer demo', action: (t)=> {
    const m = t.match(/(\d+)\s?(seconds|minutes|secs|mins|s|m)/i);
    if(!m) return 'Say: set timer 1 minute';
    const val = parseInt(m[1]); const unit = m[2].toLowerCase().startsWith('m') ? 60000 : 1000;
    setTimeout(()=> { speak('Timer finished'); addBubble('Timer finished','bot'); }, val * unit);
    return `Timer set for ${m[1]} ${m[2]}`;
  }},
  {name:'Note (local)', keywords:['note','remember','save note'], hint:'Save quick note (localStorage)', action: (t)=> { const note = t.match(/(?:note|remember|save note) (.+)$/i)?.[1]; if(!note) return 'Say: note buy milk'; const list = JSON.parse(localStorage.getItem('neo-notes')||'[]'); list.push({text:note,ts:Date.now()}); localStorage.setItem('neo-notes', JSON.stringify(list)); return 'Saved note.'; }},
  {name:'Show notes', keywords:['show notes','list notes','my notes'], hint:'Show saved notes', action: ()=> { const list = JSON.parse(localStorage.getItem('neo-notes')||'[]'); return list.length ? list.map((n,i)=>`${i+1}. ${n.text}`).join('\n') : 'No notes saved.'; }},
  {name:'Clear notes', keywords:['clear notes','delete notes','remove notes'], hint:'Clear saved notes', action: ()=> { localStorage.removeItem('neo-notes'); return 'Notes cleared.'; }},
  // More utilities & games to reach 100+
  {name:'Binary convert', keywords:['to binary','binary of'], hint:'Convert number to binary', action: (t)=> { const n = parseInt(t.match(/\d+/)?.[0]); return isNaN(n)? 'Say: to binary 12' : n.toString(2); }},
  {name:'Hex convert', keywords:['to hex','hex of'], hint:'Convert number to hex', action: (t)=> { const n = parseInt(t.match(/\d+/)?.[0]); return isNaN(n)? 'Say: to hex 255' : n.toString(16); }},
  {name:'Unix timestamp', keywords:['timestamp','unix time','epoch'], hint:'Current epoch seconds', action: ()=> Math.floor(Date.now()/1000).toString()},
  {name:'Reverse words', keywords:['reverse words','reverse sentence'], hint:'Reverse word order', action: (t)=> { const m = t.match(/(?:reverse words|reverse sentence) (.+)$/i)?.[1]; return m ? m.split(' ').reverse().join(' ') : 'Usage: reverse words hello world'; }},
  {name:'URL short (demo)', keywords:['shorten url','short url'], hint:'Demo (no real shortener)', action: (t)=> { const u = t.match(/https?:\/\/\S+/)?.[0]; return u ? `Shortened: ${u.slice(0,20)}...` : 'Provide a URL.'; }},
  {name:'Weather quick (wttr)', keywords:['wttr','wttr.in','quick weather'], hint:'wttr.in text forecast', action: async (t)=> {
    const city = t.match(/weather in (.+)$/i)?.[1] || t.match(/wttr (.+)$/i)?.[1]; if(!city) return 'Say: wttr London';
    try{ const res = await fetch('https://wttr.in/' + encodeURIComponent(city) + '?format=3'); if(res.ok){ const txt = await res.text(); return txt; } }catch(e){} return 'wttr failed.'; }},
  // filler commands to surpass 100 total - many small helpful replies
  {name:'Motivation tip', keywords:['motivation tip','productivity tip','motivate me'], hint:'Quick tip', action: ()=> 'Break big tasks into 25-minute sprints (Pomodoro).'},
  {name:'Health tip', keywords:['health tip','wellness tip'], hint:'Quick health tip', action: ()=> 'Drink water regularly and take short walks.'},
  {name:'Study tip', keywords:['study tip','exam tip'], hint:'Study smarter', action: ()=> 'Teach the topic to an imaginary student — it improves retention.'},
  {name:'Greet good morning', keywords:['good morning','morning'], hint:'Wish morning', action: ()=> 'Good morning! Have a great day 😊'},
  {name:'Greet good night', keywords:['good night','night'], hint:'Wish night', action: ()=> 'Good night! Sleep well 🌙'},
  {name:'I love you (bot)', keywords:['i love you','love you'], hint:'Cute reply', action: ()=> 'I appreciate you! ❤️'},
  {name:'Thank you', keywords:['thank you','thanks'], hint:'Polite reply', action: ()=> 'You’re welcome! 🙌'},
  {name:'Apology', keywords:['sorry','i am sorry'], hint:'Response', action: ()=> 'It’s okay. Let’s move on.'},
  {name:'Show help', keywords:['help','commands','what can you do'], hint:'List commands', action: ()=> 'You can ask time, date, weather, joke, quote, advice, facts, play games, convert units, take notes, and much more.'},
  // add many tiny commands for coverage (names only)
  {name:'Translate hi to spanish', keywords:['hola','translate hello to spanish'], hint:'Hola', action: ()=> 'Hello → Hola'},
  {name:'Bitcoin price (demo)', keywords:['bitcoin','btc price','crypto price'], hint:'Demo price', action: async ()=> 'BTC price fetch disabled in demo.'},
  {name:'Random emoji', keywords:['emoji','send emoji'], hint:'Emoji', action: ()=> ['😀','🎉','🔥','😎','🤖'][Math.floor(Math.random()*5)] },
  {name:'Fun fact 2', keywords:['did you know','fun fact 2'], hint:'Another fact', action: ()=> ['Octopus hearts: 3','A day on Venus is longer than a year on Venus','Honeybees can recognize faces'][Math.floor(Math.random()*3)] },
  // filler to ensure 100+ commands: replicate minor variations with different keywords (so matching is flexible)
  {name:'Simple hello alt', keywords:['hiya','yo','sup'], hint:'Alternate greetings', action: ()=> 'Hey! 👋'},
  {name:'Calendar note (demo)', keywords:['add event','calendar'], hint:'Calendar (demo)', action: ()=> 'Calendar integration not yet implemented.'},
  {name:'Rate app', keywords:['rate','rating'], hint:'Feedback', action: ()=> 'Thanks for wanting to rate the app! ⭐️'},
  {name:'Developer info', keywords:['who made you','developer','creator'], hint:'About', action: ()=> 'Created by you + NeoAssist code — customize it as you like.'},
  {name:'Clear chat', keywords:['clear chat','reset chat'], hint:'Clear conversation', action: ()=> { document.querySelectorAll('.option-box').forEach(n=>n.remove()); chatEl.innerHTML=''; return 'Chat cleared.'; } },
  {name:'Remind me demo', keywords:['remind me','reminder'], hint:'Reminder demo', action: ()=> 'Use "set timer 1 minute" for quick reminders.'},
  {name:'Show commands count', keywords:['how many commands','commands count'], hint:'Count', action: ()=> `I currently support ${commands.length} commands.`},
  // Add a few more tiny commands to be safe
  {name:'Memory demo', keywords:['memory','remember this'], hint:'Memory demo', action: ()=> 'Persistent memory not implemented yet.'},
  {name:'Calculator advanced', keywords:['sqrt','square root','power of','^'], hint:'Advanced math', action: (t)=> { const m = t.match(/sqrt (\d+)/i); if(m) return Math.sqrt(Number(m[1])); return 'Advanced calc: say "sqrt 16"'; }},
  {name:'ASCII art', keywords:['ascii','ascii art'], hint:'Small ascii', action: (t)=> '¯\\_(ツ)_/¯'},
  {name:'URL encode', keywords:['url encode','encode url'], hint:'Encode', action: (t)=> { const u = t.match(/url encode (.+)$/i)?.[1]; return u? encodeURIComponent(u) : 'Usage: url encode https://example.com'; }},
  {name:'URL decode', keywords:['url decode','decode url'], hint:'Decode', action: (t)=> { const u = t.match(/url decode (.+)$/i)?.[1]; return u? decodeURIComponent(u) : 'Usage: url decode ...'; }},
  {name:'Capitalise words', keywords:['capitalize','title case'], hint:'Title case', action: (t)=> { const m = t.match(/(?:capitalize|title case) (.+)$/i)?.[1]; return m? m.split(' ').map(w=>w[0]?.toUpperCase()+w.slice(1)).join(' ') : 'Usage: capitalize hello world'; }},
  {name:'Shuffle list', keywords:['shuffle','randomize list'], hint:'Shuffle', action: (t)=> { const m = t.match(/(?:shuffle|randomize) (.+)$/i)?.[1]; return m? m.split(',').sort(()=>Math.random()-0.5).join(',') : 'Usage: shuffle a,b,c'; }},
  {name:'Make acronym', keywords:['acronym','initials'], hint:'Acronym', action: (t)=> { const m = t.match(/(?:acronym|initials) (.+)$/i)?.[1]; return m? m.split(' ').map(s=>s[0]?.toUpperCase()).join('') : 'Usage: acronym national aeronautics space administration'; }},
  {name:'Temperature check demo', keywords:['is it hot','is it cold'], hint:'Feels like', action: ()=> 'Use "weather in <city>" for actual temperature.'},
  {name:'Fallback smalltalk', keywords:['tell me something','say something interesting'], hint:'Smalltalk', action: ()=> 'I can tell jokes, facts, or give a suggestion. Try: joke, fact, bored.'},
  {name:'Secret easter egg', keywords:['easter egg','surprise me'], hint:'Surprise', action: ()=> '🎉 Surprise! You found an easter egg.'},
// === Extra commands start ===
{name:'Random yes/no', keywords:['yes or no','yes no'], hint:'Gives random yes/no', action:()=> Math.random()<0.5?'Yes ✅':'No ❌'},
{name:'Random color', keywords:['random color','give me a color'], hint:'Returns random color', action:()=> {
  const c = '#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');
  return `Random color: ${c}`;
}},
{name:'Compliment me', keywords:['compliment','say something nice'], hint:'Nice words', action:()=> {
  const list = ['You have a great sense of humor!','You’re really smart!','You’re awesome!','You’re doing amazing!'];
  return list[Math.floor(Math.random()*list.length)];
}},
{name:'Insult me (fun)', keywords:['insult me','roast me'], hint:'Fun roast', action:()=> {
  const list = ['You’re as bright as a black hole.','If laziness was an Olympic sport, you’d win gold.','You bring everyone so much joy… when you leave the room.'];
  return list[Math.floor(Math.random()*list.length)];
}},
{name:'Random password', keywords:['random password','generate password'], hint:'Strong password', action:()=> {
  return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
}},
{name:'Pick random item', keywords:['pick random','choose random'], hint:'Pick from list', action:(t)=> {
  const m = t.match(/pick random (.+)$/i)?.[1]; if(!m) return 'Usage: pick random apple,banana,grape';
  const arr = m.split(',').map(s=>s.trim()).filter(Boolean);
  return arr.length ? arr[Math.floor(Math.random()*arr.length)] : 'No valid items';
}},
{name:'Roll d20', keywords:['roll d20','d20'], hint:'20-sided dice', action:()=> `🎲 You rolled ${Math.floor(Math.random()*20)+1}`},
{name:'Guess coin flip', keywords:['guess coin','coin guess'], hint:'Try guessing heads/tails', action:(t)=> {
  const guess = t.match(/(heads|tails)/i)?.[1]; const flip = Math.random()<0.5?'heads':'tails';
  if(!guess) return 'Say: guess coin heads';
  return guess.toLowerCase()===flip ? `Correct! It was ${flip}` : `Wrong, it was ${flip}`;
}},
{name:'Random joke (short)', keywords:['short joke'], hint:'Quick short joke', action:()=> {
  const list = ['I told my computer I needed a break… it froze.', 'Why don’t skeletons fight? They don’t have the guts.'];
  return list[Math.floor(Math.random()*list.length)];
}},
{name:'Name meaning demo', keywords:['meaning of name','name meaning'], hint:'Just demo', action:(t)=> {
  const name = t.match(/meaning of name (.+)$/i)?.[1]; return name ? `${name}: A wonderful person!` : 'Usage: meaning of name Alex';
}},
{name:'Random planet fact', keywords:['planet fact','space planet'], hint:'Planet trivia', action:()=> {
  const facts = ['Jupiter has 79 moons.', 'A day on Venus is longer than its year.', 'Mars has the tallest volcano in the solar system.'];
  return facts[Math.floor(Math.random()*facts.length)];
}},
{name:'Random animal', keywords:['random animal','give me an animal'], hint:'Animal name', action:()=> {
  const animals = ['Tiger','Elephant','Penguin','Giraffe','Koala','Shark','Owl'];
  return animals[Math.floor(Math.random()*animals.length)];
}},
{name:'Random number range', keywords:['random between','random from'], hint:'Custom range', action:(t)=> {
  const m = t.match(/random (?:between|from) (\d+) (?:and|to) (\d+)/i);
  if(!m) return 'Usage: random between 5 and 20';
  const min = parseInt(m[1]), max = parseInt(m[2]);
  return Math.floor(Math.random()*(max-min+1))+min;
}},
{name:'Typing speed tip', keywords:['typing tip','keyboard tip'], hint:'Typing advice', action:()=> 'Use all 10 fingers and keep eyes on screen — speed improves fast.'},
{name:'Brain teaser', keywords:['brain teaser','logic puzzle'], hint:'Tease your brain', action:()=> {
  const teasers = ['What has to be broken before you can use it? — An egg.', 'The more of me you take, the more you leave behind. — Footsteps.'];
  return teasers[Math.floor(Math.random()*teasers.length)];
}},
{name:'Positive quote', keywords:['positive quote','happy quote'], hint:'Brighten your day', action:()=> {
  const quotes = ['Happiness is not out there, it’s in you.', 'Every day is a new chance to shine.'];
  return quotes[Math.floor(Math.random()*quotes.length)];
}},
{name:'Random movie', keywords:['random movie','suggest a movie'], hint:'Movie suggestion', action:()=> {
  const movies = ['Inception','Interstellar','The Matrix','Avatar','The Dark Knight','Spirited Away'];
  return movies[Math.floor(Math.random()*movies.length)];
}},
{name:'Random song', keywords:['random song','suggest a song'], hint:'Song suggestion', action:()=> {
  const songs = ['Shape of You','Blinding Lights','Bohemian Rhapsody','Believer','Levitating'];
  return songs[Math.floor(Math.random()*songs.length)];
}},
{name:'Random food', keywords:['random food','suggest food'], hint:'Food idea', action:()=> {
  const foods = ['Pizza','Sushi','Burger','Pasta','Salad','Tacos'];
  return foods[Math.floor(Math.random()*foods.length)];
}},
// === Extra commands end ===


  {
  name: 'search',
  keywords: ['search'],
  hint: 'Search for a topic',
  action: async (text) => {
    let topic = text.match(/(?:search) (.+)$/i)?.[1];
    if (!topic) return 'Please provide a topic. Example: search Albert Einstein';

    try {
      const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`;
      const data = await fetchJson(apiUrl);

      if (data.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') {
        return `No page found for "${topic}"`;
      }

      let result = data.extract || 'No summary available.';

      // Show image with summary in same bubble
      if (data.thumbnail?.source) {
        const imgHtml = `<img src="${escapeHtml(data.thumbnail.source)}" style="max-width:240px;border-radius:8px;display:block;margin:8px 0">`;
        const b = document.createElement('div');
        b.className = 'bubble bot';
        b.innerHTML = `<div>${escapeHtml(result)}</div>${imgHtml}`;
        chatEl.appendChild(b);
        chatEl.scrollTop = chatEl.scrollHeight;
        speak(result);
        return;
      }

      return result;
    } catch (e) {
      return 'Error fetching summary.';
    }
  }
}


  
  ];

/* ----------------- Matching & Execution ----------------- */
let waitingForChoice = false;
let currentMatches = [];

function norm(s){ return (s||'').toString().toLowerCase(); }

async function handleInputText(text){
  if(!text) return;
  addBubble(text,'user');
  if(waitingForChoice){
    const n = parseInt(text.match(/\d+/)?.[0]);
    if(n && n>=1 && n<=currentMatches.length){ runChoice(n-1); return; }
    speak(`Please say a number between 1 and ${currentMatches.length}`);
    addBubble(`Please say a number between 1 and ${currentMatches.length}`,'bot');
    return;
  }

  const t = norm(text);
  // find matches (keyword anywhere in text)
  const matches = commands.filter(cmd => cmd.keywords.some(k => t.includes(norm(k))));
  if(matches.length === 0){
    // try fuzzy token match
    const words = t.split(/\s+/);
    const fuzzy = commands.filter(cmd => cmd.keywords.some(k => words.includes(norm(k))));
    if(fuzzy.length>0){ await presentMatches(fuzzy); return; }
    const resp = "Sorry, I don't know that command. Say 'help' to see examples.";
    addBubble(resp,'bot'); speak(resp); return;
  }
  if(matches.length === 1){ await executeCommand(matches[0], text); return; }
  await presentMatches(matches);
}

function presentMatches(matches){
  waitingForChoice = true; currentMatches = matches;
  addOptionList(matches.map(m=>({name:m.name, hint:m.hint})));
  let speakText = `I found ${matches.length} options. `;
  matches.slice(0,6).forEach((m,i)=> speakText += `Option ${i+1}: ${m.name}. `);
  if(matches.length>6) speakText += 'And more. Tap to view.';
  speak(speakText);
  addBubble('I found multiple commands. Tap one or say the option number.','bot', matches.map((m,i)=>`${i+1}. ${m.name}`).join(' • '));
}

async function runChoice(index){
  if(!currentMatches[index]) return;
  const cmd = currentMatches[index];
  document.querySelectorAll('.option-box').forEach(n=>n.remove());
  waitingForChoice=false; currentMatches=[];
  addBubble(`Running: ${cmd.name}`,'bot');
  await executeCommand(cmd, '');
}

async function executeCommand(cmd, originalText){
  try{
    const out = await Promise.resolve(cmd.action(originalText || ''));
    const resp = (out === undefined || out === null) ? `${cmd.name} executed.` : out.toString();
    // If the resp looks like an image URL or ends with .jpg/.png/.gif, show it specially
    if(/^https?:\/\/.*\.(jpg|jpeg|png|gif|webp)$/i.test(resp) || resp.startsWith('https://') && (resp.includes('random') || resp.includes('cat') || resp.includes('dog'))){
      // show as image if possible
      const imgHtml = `<img src="${escapeHtml(resp)}" style="max-width:240px;border-radius:8px;display:block;margin-top:6px">`;
      const b = document.createElement('div'); b.className='bubble bot'; b.innerHTML = `<div>${escapeHtml(cmd.name)}</div>${imgHtml}`; chatEl.appendChild(b); chatEl.scrollTop = chatEl.scrollHeight;
      speak('Here you go.');
      return;
    }
    addBubble(resp,'bot'); speak(typeof resp==='string' ? resp : JSON.stringify(resp));
  }catch(e){
    console.error(e); addBubble('Error running command.','bot'); speak('Error running the command');
  }
}

/* ----------------- UI events ----------------- */
sendBtn.addEventListener('click', ()=> { const v = textInput.value.trim(); if(!v) return; textInput.value=''; handleInputText(v); });
textInput.addEventListener('keydown', (e)=> { if(e.key === 'Enter') sendBtn.click(); });

micBtn.addEventListener('click', ()=>{
  if(!rec){ speak('Speech recognition not supported in this browser'); return; }
  if(!listening){ try{ rec.start(); }catch(e){ console.warn(e); } }
  else rec.stop();
});

clearBtn.addEventListener('click', ()=> { chatEl.innerHTML=''; addBubble('Chat cleared. Say "hi" to start.','bot'); });

addBubble("Hi — I'm NeoAssist. Tap 🎤 to speak or type below. Try: 'what time is it right now?'",'bot'); speak("Hi, I'm ready.");

function userSays(text){ textInput.value=''; handleInputText(text); }
window.runChoice = runChoice;
  
  document.getElementById('animeBtn').addEventListener('click', () => {
  window.open('https://animeflarebox.linkpc.net/', '_blank');
});


