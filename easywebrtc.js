(() => {
  const logQueue = [], logState = { busy: false };
  const logElement = document.getElementById('log') || (() => {
    const el = document.createElement('pre');
    el.id = 'log';
    el.style.cssText = 'padding:1em;background:#111;color:#0f0;font-family:monospace;white-space:pre-wrap;';
    document.body.appendChild(el);
    return el;
  })();

  const log = msg => {
    logQueue.push(msg);
    if (!logState.busy) {
      logState.busy = true;
      queueMicrotask(() => {
        while (logQueue.length) logElement.textContent += logQueue.shift() + '\n';
        logElement.scrollTop = logElement.scrollHeight;
        logState.busy = false;
      });
    }
  };

  const clean = str => str.replace(/\s+/g, '');
  const encode = (desc, ice) => btoa(JSON.stringify({ s: desc, c: ice }));
  const decode = str => JSON.parse(atob(clean(str)));

  const peers = [], controllers = [];

  function createPeer(mode, callbacks) {
    const pc = new RTCPeerConnection({ iceServers: [] });
    const ice = [];
    let dc = null;

    const id = Math.random().toString(36).slice(2, 8);

    if (mode === 'peer') {
      dc = pc.createDataChannel('c-' + id, { ordered: false, maxRetransmits: 0 });
      attachDC(dc, id);
    } else {
      pc.ondatachannel = e => attachDC(e.channel, id);
    }

    pc.onicecandidate = e => {
      if (e.candidate) ice.push(e.candidate.toJSON());
      else document.getElementById('output').value = encode(pc.localDescription, ice);
    };

    async function attachDC(channel, label) {
      dc = channel;
      dc.onopen = () => {
        log('🟢 CONNECT ' + label);
        if (mode === 'host') {
          controllers.push(dc);
          updateControllerUI();
        }
        callbacks.onConnect?.(dc, label);
      };
      dc.onclose = () => {
        log('🔴 DISCONNECT ' + label);
        if (mode === 'host') {
          const i = controllers.indexOf(dc);
          if (i !== -1) controllers.splice(i, 1);
          updateControllerUI();
        }
        callbacks.onDisconnect?.(dc, label);
      };
      dc.onmessage = e => callbacks.onMessage?.(dc, e.data, label);
    }

    async function generateOffer() {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
    }

    generateOffer();

    return {
      id,
      accept: async str => {
        const { s, c } = decode(str);
        await pc.setRemoteDescription(s);
        for (const cand of c) await pc.addIceCandidate(new RTCIceCandidate(cand));
        if (mode === 'host') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
        }
        log('📥 ACCEPTED ' + id);
      },
      send: msg => {
        if (dc?.readyState === 'open') {
          dc.send(msg);
          log('➡️ ' + msg);
        } else {
          log('❌ NOT OPEN');
        }
      },
      getId: () => id,
      getDC: () => dc
    };
  }

  function updateControllerUI() {
    const list = document.getElementById('controllers');
    if (list) {
      list.innerHTML = controllers.map(dc => `<li>${dc.label || 'controller'}</li>`).join('');
      document.getElementById('controllerCount').textContent = controllers.length;
    }
  }

  window.initWebRTC = (mode, cb) => {
    const peer = createPeer(mode, cb);
    if (mode === 'peer') window.easywebrtc_send = peer.send;
    window.easywebrtc_accept = peer.accept;
    window.easywebrtc_id = peer.getId();
  };
})();
