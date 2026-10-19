/* SkyClash original score and sound design. No downloads or audio assets. */
(() => {
  'use strict';
  let ctx, master, musicBus, sfxBus, musicFx, sfxFx, noiseBuffer, timer;
  let enabled = true, scene = 'menu', musicVolume = .65, sfxVolume = .8;
  let nextTime = 0, step = 0;
  const sources = new Set();
  const bpm = 132, tick = 60 / bpm / 4;
  const active = () => enabled && !document.hidden && scene !== 'paused';
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  function gain(value, dest) { const n = ctx.createGain(); n.gain.value = value; n.connect(dest); return n; }
  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -15; limiter.knee.value = 12; limiter.ratio.value = 8;
      limiter.attack.value = .003; limiter.release.value = .18; limiter.connect(ctx.destination);
      master = gain(.68, limiter); musicBus = gain(musicVolume, master); sfxBus = gain(sfxVolume, master);

      const impulse = ctx.createBuffer(2, ctx.sampleRate * 1.35, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = impulse.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3) * .4; }
      const effects = bus => {
        const verb = ctx.createConvolver(), echo = ctx.createDelay(.6);
        verb.buffer = impulse; verb.connect(gain(.21, bus));
        echo.delayTime.value = 60 / bpm * .75;
        echo.connect(gain(.22, echo)); echo.connect(gain(.13, bus));
        return { verb, echo };
      };
      musicFx = effects(musicBus); sfxFx = effects(sfxBus);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuffer.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch (_) { ctx = null; return false; }
  }
  function tone(freq, time, duration, volume, type = 'sine', bus = sfxBus, endFreq, wet = 0, cutoff = 6000) {
    const o = ctx.createOscillator(), filter = ctx.createBiquadFilter(), env = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(Math.max(20, freq), time);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), time + duration);
    filter.type = 'lowpass'; filter.frequency.value = cutoff;
    env.gain.setValueAtTime(.0001, time); env.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), time + Math.min(.012, duration / 5));
    env.gain.exponentialRampToValueAtTime(.0001, time + duration);
    o.connect(filter); filter.connect(env); env.connect(bus);
    const sends = [];
    if (wet) { const fx = bus === musicBus ? musicFx : sfxFx; sends.push(gain(wet, fx.verb), gain(wet * .4, fx.echo)); sends.forEach(send => env.connect(send)); }
    sources.add(o); o.start(time); o.stop(time + duration + .03);
    o.onended = () => { sources.delete(o); o.disconnect(); filter.disconnect(); env.disconnect(); sends.forEach(send => send.disconnect()); };
  }
  function noise(time, duration, volume, frequency = 3000, q = .7, bus = sfxBus) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), e = ctx.createGain();
    s.buffer = noiseBuffer; f.type = 'bandpass'; f.frequency.setValueAtTime(frequency, time); f.frequency.exponentialRampToValueAtTime(Math.max(100, frequency * .35), time + duration); f.Q.value = q;
    e.gain.setValueAtTime(.0001, time); e.gain.exponentialRampToValueAtTime(volume, time + .006); e.gain.exponentialRampToValueAtTime(.0001, time + duration);
    s.connect(f); f.connect(e); e.connect(bus); sources.add(s); s.start(time, Math.random()); s.stop(time + duration + .02);
    s.onended = () => { sources.delete(s); s.disconnect(); f.disconnect(); e.disconnect(); };
  }
  // Broadband transients and inharmonic resonances: impact, not a pitched beep.
  const hits = {};
  function impact(t, weight=1, metal=false, bus=sfxBus) {
    const key=metal?'metal':'body';
    if(!hits[key]) {
      const duration=metal?.65:.95, b=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),d=b.getChannelData(0);
      let low=0;
      for(let i=0;i<d.length;i++) {
        const x=i/ctx.sampleRate,n=Math.random()*2-1;low=low*.94+n*.06;
        const crack=n*Math.exp(-x*95)*.5;
        const body=(Math.sin(2*Math.PI*68*x)*.46+Math.sin(2*Math.PI*126*x)*.25+Math.sin(2*Math.PI*183*x)*.14)*Math.exp(-x*9);
        const rubble=low*3.2*Math.exp(-x*5);
        const ring=(Math.sin(2*Math.PI*317*x)+.6*Math.sin(2*Math.PI*529*x)+.25*Math.sin(2*Math.PI*911*x))*Math.exp(-x*13)*.22;
        d[i]=Math.tanh((crack+(metal?ring:body)+rubble*.6)*1.9)*Math.min(1,x/.0015)*.7;
      }
      hits[key]=b;
    }
    const source=ctx.createBufferSource(),env=ctx.createGain();source.buffer=hits[key];source.playbackRate.value=metal?1: .93+Math.random()*.1;env.gain.value=weight;
    source.connect(env);env.connect(bus);sources.add(source);source.start(t);source.onended=()=>{sources.delete(source);source.disconnect();env.disconnect();};
  }
  function duck(t){musicBus.gain.cancelScheduledValues(t);musicBus.gain.setValueAtTime(musicVolume*.42,t);musicBus.gain.setTargetAtTime(musicVolume,t+.09,.18);}
  const roots = [33,33,29,29,36,36,31,31,33,33,29,29,36,36,31,28];
  function sequence(t, s) {
    const bar=Math.floor(s/16)%16,p=s%16,root=roots[bar],battle=scene==='battle',power=battle?1:.35;
    if(p===0) [0,7,12,15].forEach((n,i)=>{
      tone(midi(root+12+n)*.997,t+i*.01,tick*15,.027*power,'sawtooth',musicBus,null,.25,850);
      tone(midi(root+12+n)*1.003,t+i*.01,tick*15,.027*power,'sawtooth',musicBus,null,.25,850);
    });
    if([0,3,6,8,10,14].includes(p)) {
      const note=root+(p===14?7:0);
      tone(midi(note),t,tick*1.7,.24*power,'sawtooth',musicBus,null,0,550);
      tone(midi(note+12)*1.006,t,tick*1.3,.1*power,'sawtooth',musicBus,null,0,700);
      tone(midi(note),t,tick*1.8,.17*power,'sine',musicBus);
    }
    if([0,6,8].includes(p)||(bar%4===3&&p===14)) impact(t,.55*power,false,musicBus);
    if(p===4||p===12) { impact(t,.4*power,true,musicBus);noise(t,.18,.22*power,1700,.45,musicBus); }
    if(p%2===0) noise(t,.035,.025*power,6500,.5,musicBus);
    if(battle&&bar>=8&&[0,6,10].includes(p)) {
      const note=root+24+([0,7,10][[0,6,10].indexOf(p)]);
      tone(midi(note)*.994,t,tick*4,.038,'sawtooth',musicBus,null,.18,1100);
      tone(midi(note)*1.006,t,tick*4,.038,'sawtooth',musicBus,null,.18,1100);
    }
    if(battle&&bar%4===3&&p>=14) impact(t,.22,false,musicBus);
  }
  function stop() { clearInterval(timer); timer = null; nextTime = 0; for (const source of sources) { try { source.stop(); } catch (_) {} } sources.clear(); }
  function schedule() {
    if (!ctx || ctx.state !== 'running' || !active()) { stop(); return; }
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + .04;
    while (nextTime < ctx.currentTime + .13) { sequence(nextTime, step++); nextTime += tick; }
  }
  function start() { if (!timer && ctx && ctx.state === 'running' && active()) { nextTime = ctx.currentTime + .04; schedule(); timer = setInterval(schedule, 30); } }
  function update() {
    if (!ctx) return;
    musicBus.gain.setTargetAtTime(musicVolume * (scene === 'result' ? .6 : 1), ctx.currentTime, .1);
    sfxBus.gain.setTargetAtTime(sfxVolume, ctx.currentTime, .02);
    if (!active()) { stop(); ctx.suspend().catch(() => {}); }
    else ctx.resume().then(start).catch(() => {});
  }
  const last = Object.create(null);
  function play(name, opts = {}) {
    if (!ctx || ctx.state !== 'running' || !active()) return;
    const t = ctx.currentTime + .005;
    if (last[name] && t - last[name] < (name === 'hit' ? .045 : .065)) return;
    last[name] = t;
    const strength = Math.max(.4, Math.min(1.5, Number(opts.strength) || 1));
    const n = (d,v,f,q) => noise(t,d,v * strength,f,q);
    const o = (f,d,v,type,end,wet) => tone(f,t,d,v * strength,type,sfxBus,end,wet);
    switch (name) {
      case 'jump': case 'doubleJump': n(.2,.14,850,.5);noise(t+.025,.13,.08,2200,.4);break;
      case 'slash': n(.11,.20,1900,.45);noise(t+.015,.12,.12,650,.4);break;
      case 'special': n(.4,.32,1200,.6);impact(t,.55);tone(82,t,.35,.12,'sawtooth',sfxBus,null,.25,500);break;
      case 'hit': impact(t,1.05*strength);o(115,.19,.3,'sine',44,0);n(.055,.12,1500,.5);noise(t+.025,.23,.17*strength,420,.5);duck(t);break;
      case 'guard': impact(t,.7,true);n(.09,.15,3300,1);break;
      case 'break': impact(t,1.0,true);n(.65,.35,2300,.45);impact(t+.065,.75);duck(t);break;
      case 'smash': impact(t,1.2);impact(t+.045,.55,true);n(.5,.27,600,.45);duck(t);break;
      case 'count': impact(t,.4,true);break;
      case 'go': impact(t,1.1);n(.5,.24,1700,.4);duck(t);break;
      case 'pickup': [220,330].forEach(f=>tone(f,t,.28,.065,'sine',sfxBus,null,.2,700));break;
      case 'win': case 'lose':
        impact(t,.7);(name==='win'?[45,52,57,60]:[40,47,50,55]).forEach((note,i)=>tone(midi(note),t+i*.08,1.2,.07,'sawtooth',sfxBus,null,.4,1000));break;
      case 'ko': impact(t,1.3);impact(t+.08,.8,true);n(.95,.45,480,.4);noise(t+.04,.5,.23,2100,.5);duck(t);break;
      case 'ui': noise(t,.04,.07,1200,.5);break;
    }
  }

  window.SkyAudio = {
    async unlock() { if (!init()) return false; if (!enabled) return true; try { await ctx.resume(); start(); return true; } catch (_) { return false; } },
    setEnabled(value) { enabled = !!value; update(); },
    setScene(value) { if (!['menu','battle','paused','result'].includes(value)) return; if (scene !== value && value === 'battle') step = 0; scene = value; update(); },
    setVolumes(music, sfx) { musicVolume = Math.max(0, Math.min(1, Number(music) || 0)); sfxVolume = Math.max(0, Math.min(1, Number(sfx) || 0)); update(); },
    play
  };
  document.addEventListener('visibilitychange', update);
})();


