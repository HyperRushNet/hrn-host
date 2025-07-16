(() => {
  const logQ = [], busy = { v: false };
  const logEl = document.getElementById('log') || (() => {
    const e = document.createElement('pre');
    e.id = 'log';
    document.body.appendChild(e);
    return e;
  })();

  function log(m) {
    logQ.push(m);
    if (!busy.v) {
      busy.v = true;
      queueMicrotask(() => {
        while (logQ.length) logEl.textContent += logQ.shift() + '\n';
        logEl.scrollTop = logEl.scrollHeight;
        busy.v = false;
      });
    }
  }

  const clean = s => s.replace(/\s+/g, '');
  const enc = (s, ice) => btoa(JSON.stringify({ s, c: ice }));
  const dec = x => JSON.parse(atob(clean(x)));

  window.initWebRTC = async (mode, cb) => {
    const pc = new RTCPeerConnection({ iceServers: [] });
    const ice = [];
    const id = 'id-' + Math.random().toString(36).slice(2, 8);
    let dc;

    const peers = {};

    function bind(dc, id, name) {
      dc.label = id;
      dc.onopen = () => cb.onConnect({ dc, id, name });
      dc.onmessage = e => {
        const m = JSON.parse(e.data);
        if (m.type === 'intro') {
          dc.name = m.name;
          peers[id] = { id, name: m.name, dc };
          cb.onIntro(id, m.name);
        } else {
          cb.onMessage(id, dc.name || id, m.msg);
        }
      };
      dc.onclose = () => {
        delete peers[id];
        cb.onDisconnect(id, dc.name || id);
      };
    }

    if (mode === 'peer') {
      dc = pc.createDataChannel(id);
      bind(dc, id);
    } else {
      pc.ondatachannel = e => {
        const ch = e.channel;
        bind(ch, ch.label);
      };
    }

    pc.onicecandidate = e => {
      if (e.candidate) ice.push(e.candidate.toJSON());
      else document.getElementById('output').value = enc(pc.localDescription, ice);
    };

    await pc.setLocalDescription(await pc.createOffer());

    window.easywebrtc_accept = async x => {
      const { s, c } = dec(x);
      await pc.setRemoteDescription(s);
      for (const cand of c) await pc.addIceCandidate(new RTCIceCandidate(cand));
      if (mode === 'host') {
        await pc.setLocalDescription(await pc.createAnswer());
      }
      log('📥 Connected');
    };

    if (mode === 'peer') window.easywebrtc_send = msg => {
      try { dc.send(JSON.stringify({ type:'msg', msg })); }
      catch{}
    };
    if (mode === 'peer') window.easywebrtc_intro = name => {
      try { dc.send(JSON.stringify({ type:'intro', name })); }
      catch{}
    };
  };
})();
