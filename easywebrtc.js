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

  const hostPeers = new Map();

  async function initWebRTC(mode, { onConnect, onMessage, onDisconnect }) {
    if (mode === 'peer') {

      const pc = new RTCPeerConnection({
        iceServers: [],
        iceTransportPolicy: 'all',
        iceCandidatePoolSize: 0
      });
      const iceCandidates = [];
      const dataChannel = pc.createDataChannel('ch-' + Math.random().toString(36).slice(2, 6), {
        ordered: false,
        maxRetransmits: 0
      });

      dataChannel.onopen = () => { log('🟢 Connected'); onConnect?.(dataChannel); };
      dataChannel.onclose = () => { log('🔴 Disconnected'); onDisconnect?.(dataChannel); };
      dataChannel.onmessage = e => { log('⬅️ ' + e.data); onMessage?.(dataChannel, e.data); };

      pc.onicecandidate = e => {
        if (e.candidate) {
          iceCandidates.push(e.candidate.toJSON());
        } else {
          const out = document.getElementById('output');
          if (out) out.value = encodeData(pc.localDescription, iceCandidates);
          log('📤 ICE complete (peer)');
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      window.easywebrtc_accept = async base64 => {
        try {
          const { s, c } = decodeData(base64);
          await pc.setRemoteDescription(s);
          for (const cand of c) await pc.addIceCandidate(new RTCIceCandidate(cand));
          log('📥 Remote accepted (peer)');
        } catch (err) {
          log('❌ Accept error (peer): ' + err);
        }
      };

      window.easywebrtc_send = msg => {
        if (dataChannel.readyState === 'open') {
          dataChannel.send(msg);
          log('➡️ ' + msg);
        } else {
          log('❌ Send failed (peer not open)');
        }
      };

    } else if (mode === 'host') {

      window.easywebrtc_hostCreatePeer = async (id) => {
        if (hostPeers.has(id)) {
          log(`⚠️ Host peer ${id} bestaat al`);
          return;
        }
        const pc = new RTCPeerConnection({
          iceServers: [],
          iceTransportPolicy: 'all',
          iceCandidatePoolSize: 0
        });
        const iceCandidates = [];
        let dataChannel;

        pc.onicecandidate = e => {
          if (e.candidate) {
            iceCandidates.push(e.candidate.toJSON());
          } else {

            const out = encodeData(pc.localDescription, iceCandidates);
            log(`📤 Host ICE complete voor peer ${id}`);

            const outEl = document.getElementById('output-' + id);
            if (outEl) outEl.value = out;
          }
        };

        pc.ondatachannel = e => {
          dataChannel = e.channel;
          dataChannel.onopen = () => {
            log(`🟢 Host connected peer ${id}`);
            onConnect?.(id, dataChannel);
          };
          dataChannel.onclose = () => {
            log(`🔴 Host disconnected peer ${id}`);
            onDisconnect?.(id);
            hostPeers.delete(id);
          };
          dataChannel.onmessage = ev => {
            log(`⬅️ Peer ${id}: ${ev.data}`);
            onMessage?.(id, ev.data);
          };
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        hostPeers.set(id, { pc, dataChannel, iceCandidates });
      };

      window.easywebrtc_hostAccept = async (id, base64) => {
        const peer = hostPeers.get(id);
        if (!peer) {
          log(`❌ Geen peer ${id} gevonden om accept te doen`);
          return;
        }
        try {
          const { s, c } = decodeData(base64);
          await peer.pc.setRemoteDescription(s);
          for (const cand of c) await peer.pc.addIceCandidate(new RTCIceCandidate(cand));
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          log(`📥 Host accepteerde remote voor peer ${id}`);
        } catch (err) {
          log(`❌ Host accept error voor peer ${id}: ` + err);
        }
      };

      window.easywebrtc_hostSend = (id, msg) => {
        const peer = hostPeers.get(id);
        if (!peer || !peer.dataChannel || peer.dataChannel.readyState !== 'open') {
          log(`❌ Host send failed naar peer ${id}`);
          return;
        }
        peer.dataChannel.send(msg);
        log(`➡️ Naar peer ${id}: ${msg}`);
      };
    }
  }

  window.initWebRTC = initWebRTC;
})();
