(() => {
  const isIdle = typeof requestIdleCallback === 'function';
  const logElem = document.getElementById("log") || (() => {
    const e = document.createElement("pre");
    e.id = "log"; document.body.appendChild(e); return e;
  })();
  let logQ = [], logB = false;
  function log(t) {
    logQ.push(t);
    if (!logB) { logB = true; flush(); }
  }
  function flush() {
    (isIdle ? requestIdleCallback : f => setTimeout(f, 0))(() => {
      while (logQ.length) logElem.textContent += logQ.shift() + "\n";
      logB = false;
    });
  }

  function base64CleanInput(txt) {
    return txt.replace(/\s/g, '');
  }

  function encodeConnection(sdp, ice) {
    return btoa(JSON.stringify({ s: sdp, c: ice }));
  }

  function decodeConnection(b64) {
    return JSON.parse(atob(base64CleanInput(b64)));
  }

  function initWebRTC(mode, callbacks) {
    if (mode === "host") initHost(callbacks);
    else if (mode === "peer") initPeer(callbacks);
    else throw new Error("Gebruik 'host' of 'peer'");
  }

  function initHost({ onMessage, onConnect, onDisconnect }) {
    const connections = [];

    window.acceptConnection = function (b64) {
      try {
        const data = decodeConnection(b64);
        const pc = new RTCPeerConnection();
        const ice = [];
        pc.onicecandidate = e => {
          if (e.candidate) ice.push(e.candidate.toJSON());
          else document.getElementById("output").value = encodeConnection(pc.localDescription, ice);
        };
        pc.ondatachannel = e => {
          const dc = e.channel;
          dc.onopen = () => { log("🟢 Verbonden: " + dc.label); onConnect && onConnect(dc); };
          dc.onclose = () => { log("🔴 Verbroken: " + dc.label); onDisconnect && onDisconnect(dc); };
          dc.onmessage = ev => { log("⬅️ [" + dc.label + "]: " + ev.data); onMessage && onMessage(dc, ev.data); };
        };
        pc.setRemoteDescription(data.s).then(() => {
          data.c.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)));
          return pc.createAnswer();
        }).then(a => pc.setLocalDescription(a));
        connections.push(pc);
        log("👥 Nieuwe verbinding, totaal: " + connections.length);
      } catch (e) {
        log("❌ Fout bij connectie: " + e.message);
      }
    };
  }

  function initPeer({ onMessage, onConnect, onDisconnect }) {
    const pc = new RTCPeerConnection();
    const ice = [];
    const dc = pc.createDataChannel("c-" + Math.random().toString(36).slice(2, 5), { ordered: false, maxRetransmits: 0 });

    dc.onopen = () => { log("🟢 Verbonden"); onConnect && onConnect(dc); };
    dc.onclose = () => { log("🔴 Verbroken"); onDisconnect && onDisconnect(dc); };
    dc.onmessage = ev => { log("⬅️ " + ev.data); onMessage && onMessage(dc, ev.data); };

    pc.onicecandidate = e => {
      if (e.candidate) ice.push(e.candidate.toJSON());
      else document.getElementById("output").value = encodeConnection(pc.localDescription, ice);
    };

    pc.createOffer().then(o => pc.setLocalDescription(o));

    window.acceptAnswer = function (b64) {
      try {
        const data = decodeConnection(b64);
        pc.setRemoteDescription(data.s);
        data.c.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)));
      } catch (e) {
        log("❌ Fout bij antwoord: " + e.message);
      }
    };

    window.sendToHost = msg => {
      if (dc.readyState === "open") {
        dc.send(msg);
        log("➡️ " + msg);
      } else {
        log("❌ Niet verbonden");
      }
    };
  }

  window.initWebRTC = initWebRTC;
})();
