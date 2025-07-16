(() => {
  const logQueue = [];
  const logState = { busy: false };
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
      setTimeout(() => {
        while (logQueue.length) {
          logElement.textContent += logQueue.shift() + '\n';
        }
        logState.busy = false;
      }, 0);
    }
  };

  const cleanBase64 = str => str.replace(/\s+/g, '');
  const encodeData = (desc, ice) => btoa(JSON.stringify({ s: desc, c: ice }));
  const decodeData = str => JSON.parse(atob(cleanBase64(str)));

  async function initWebRTC(mode, name, { onConnect, onMessage, onDisconnect }) {
    const pc = new RTCPeerConnection({
      iceServers: [],
      iceTransportPolicy: 'all',
      iceCandidatePoolSize: 0
    });

    let dataChannel;
    const iceCandidates = [];
    const peerId = Math.random().toString(36).slice(2, 8);
    const peerName = name || (mode === 'peer' ? `Controller-${peerId}` : 'HOST');

    if (mode === 'peer') {
      dataChannel = pc.createDataChannel('ch-' + peerId, { ordered: false, maxRetransmits: 0 });
      setupDataChannel(dataChannel);
    } else {
      pc.ondatachannel = e => setupDataChannel(e.channel);
    }

    pc.onicecandidate = e => {
      if (e.candidate) {
        iceCandidates.push(e.candidate.toJSON());
      } else {
        const out = document.getElementById('output');
        if (out) out.value = encodeData(pc.localDescription, iceCandidates);
        else log('📤 ICE complete (geen output element)');
      }
    };

    function setupDataChannel(dc) {
      dataChannel = dc;
      dc.onopen = () => {
        log(`🟢 CONNECTED ${peerName}`);
        onConnect?.(dc, peerName);
      };
      dc.onclose = () => {
        log(`🔴 DISCONNECTED ${peerName}`);
        onDisconnect?.(dc, peerName);
      };
      dc.onmessage = e => {
        log(`${peerName}: ${e.data}`);
        onMessage?.(dc, peerName, e.data);
      };
      dc.label = peerName; // label = naam voor eenvoud
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    window.easywebrtc_accept = async base64 => {
      try {
        const { s, c } = decodeData(base64);
        await pc.setRemoteDescription(s);
        for (const cand of c) await pc.addIceCandidate(new RTCIceCandidate(cand));
        if (mode === 'host') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
        }
        log(`📥 ACCEPTED ${peerName}`);
      } catch (err) {
        log('❌ Accept error: ' + err);
      }
    };

    if (mode === 'peer') {
      window.easywebrtc_send = msg => {
        if (dataChannel?.readyState === 'open') {
          dataChannel.send(msg);
          log(`${peerName}: ${msg}`);
        } else {
          log('❌ Send failed (not open)');
        }
      };
    }
  }

  window.initWebRTC = initWebRTC;
  window.log = log;
})();
