(() => {
  const lq = [], logBusy = {val:false}, logEl = document.getElementById('log') || (() => {
    const e = document.createElement('pre');
    e.id = 'log'; document.body.appendChild(e);
    return e;
  })();
  
  function lg(t) {
    lq.push(t);
    if (!logBusy.val) {
      logBusy.val = true;
      setTimeout(() => {
        while (lq.length) logEl.textContent += lq.shift() + "\n";
        logBusy.val = false;
      }, 0);
    }
  }

  function clean(b64) {
    return b64.replace(/\s/g, '');
  }

  function encode(desc, ice) {
    return btoa(JSON.stringify({ s: desc, c: ice }));
  }

  function decode(b64) {
    return JSON.parse(atob(clean(b64)));
  }

  function init(mode, { onConnect, onMessage, onDisconnect }) {
    let pc = new RTCPeerConnection({ iceServers: [], iceTransportPolicy: 'all', iceCandidatePoolSize: 0 });
    let dc, ice = [];

    if (mode === 'peer') {
      dc = pc.createDataChannel('c-' + Math.random().toString(36).slice(2, 6), { ordered: false, maxRetransmits: 0 });
      dc.onopen = () => { lg('🟢 peer open'); onConnect?.(dc); };
      dc.onclose = () => { lg('🔴 peer closed'); onDisconnect?.(dc); };
      dc.onmessage = e => { lg('⬅️ '+e.data); onMessage?.(dc, e.data); };
    } else {
      pc.ondatachannel = e => {
        dc = e.channel;
        dc.onopen = () => { lg('🟢 host open: '+dc.label); onConnect?.(dc); };
        dc.onclose = () => { lg('🔴 host closed: '+dc.label); onDisconnect?.(dc); };
        dc.onmessage = ev => {
          lg('⬅️ ['+dc.label+']: '+ev.data);
          onMessage?.(dc, ev.data);
        };
      };
    }

    pc.onicecandidate = e => {
      if (e.candidate) ice.push(e.candidate.toJSON());
      else {
        document.getElementById('output').value = encode(pc.localDescription, ice);
        lg('📤 local complete');
      }
    };

    pc.createOffer().then(o => pc.setLocalDescription(o));

    function accept(b64) {
      try {
        let d = decode(b64);
        pc.setRemoteDescription(d.s);
        d.c.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)));
        if (mode === 'host') {
          pc.createAnswer().then(a => pc.setLocalDescription(a));
        }
        lg('📥 remote accepted');
      } catch (e) {
        lg('❌ accept error: ' + e);
      }
    }

    function send(msg) {
      if (dc && dc.readyState === 'open') {
        dc.send(msg);
        lg('➡️ ' + msg);
      } else lg('❌ send failed: not open');
    }

    window.easywebrtc_accept = accept;
    if (mode === 'peer') window.easywebrtc_send = send;
  }

  window.initWebRTC = init;
})();
