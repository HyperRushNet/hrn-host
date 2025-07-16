(() => {
  const logQueue = [];
  let logBusy = false;
  const logElement = document.getElementById('log') || (() => {
    const el = document.createElement('pre');
    el.id = 'log';
    el.style.cssText = 'padding:1em;background:#111;color:#0f0;font-family:monospace;white-space:pre-wrap;';
    document.body.appendChild(el);
    return el;
  })();

  function log(msg) {
    logQueue.push(msg);
    if (!logBusy) {
      logBusy = true;
      setTimeout(() => {
        while (logQueue.length) {
          logElement.textContent += logQueue.shift() + '\n';
        }
        logBusy = false;
        logElement.scrollTop = logElement.scrollHeight;
      }, 0);
    }
  }

  const cleanBase64 = str => str.replace(/\s+/g, '');
  const encodeData = (desc, ice) => btoa(JSON.stringify({ s: desc, c: ice }));
  const decodeData = str => JSON.parse(atob(cleanBase64(str)));

  // Generate random ID string
  const randomID = () => Math.random().toString(36).slice(2, 8);

  async function initWebRTC(mode, { name, onConnect, onMessage, onDisconnect, onPeersChange }) {
    if (!name) name = mode === 'host' ? 'HOST' : 'Controller-' + randomID();

    if (mode === 'peer') {
      // Peer (controller)
      const pc = new RTCPeerConnection({ iceServers: [] });
      const dcLabel = 'dc-' + randomID();
      let dataChannel = pc.createDataChannel(dcLabel, { ordered: false, maxRetransmits: 0 });

      let iceCandidates = [];

      function setupDataChannel(dc) {
        dataChannel = dc;
        dc.onopen = () => { log(`🟢 Connected (${name})`); onConnect?.(dc, name); };
        dc.onclose = () => { log(`🔴 Disconnected (${name})`); onDisconnect?.(dc, name); };
        dc.onmessage = e => { onMessage?.(dc, e.data, null, name); log(`${name}: ${e.data}`); };
      }

      setupDataChannel(dataChannel);

      pc.onicecandidate = e => {
        if (e.candidate) iceCandidates.push(e.candidate.toJSON());
        else {
          const out = document.getElementById('output');
          if (out) out.value = encodeData(pc.localDescription, iceCandidates);
          log('📤 ICE complete (offer)');
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      window.easywebrtc_accept = async base64 => {
        try {
          const { s, c } = decodeData(base64);
          await pc.setRemoteDescription(s);
          for (const cand of c) await pc.addIceCandidate(new RTCIceCandidate(cand));
          log('📥 ACCEPTED (answer)');
        } catch (err) {
          log('❌ Accept error: ' + err);
        }
      };

      window.easywebrtc_send = msg => {
        if (dataChannel?.readyState === 'open') {
          dataChannel.send(msg);
          log(`${name}: ${msg}`);
        } else {
          log('❌ Send failed (not open)');
        }
      };

      return;

    } else {
      // Host (game) - accept multiple controllers
      const pcs = new Map(); // id => { pc, dc, name }

      let iceCandidatesMap = new Map();

      async function createPeerConnection(id) {
        const pc = new RTCPeerConnection({ iceServers: [] });
        let iceCandidates = [];
        let dc;

        pc.ondatachannel = e => {
          dc = e.channel;
          dc.onopen = () => {
            pcs.get(id).dc = dc;
            log(`🟢 Connected (${pcs.get(id).name})`);
            onConnect?.(dc, pcs.get(id).name, id);
            onPeersChange?.(getPeers());
          };
          dc.onclose = () => {
            log(`🔴 Disconnected (${pcs.get(id).name})`);
            onDisconnect?.(dc, pcs.get(id).name, id);
            pcs.delete(id);
            onPeersChange?.(getPeers());
          };
          dc.onmessage = e => {
            onMessage?.(dc, e.data, id, pcs.get(id).name);
            log(`${pcs.get(id).name}: ${e.data}`);
          };
        };

        pc.onicecandidate = e => {
          if (e.candidate) iceCandidates.push(e.candidate.toJSON());
          else {
            iceCandidatesMap.set(id, iceCandidates);
            const out = document.getElementById('output');
            if (out) {
              // Encode all pc offers+ices for all peers in JSON array
              const allData = Array.from(pcs.entries()).map(([pid, p]) => ({
                id: pid,
                name: p.name,
                offer: p.pc.localDescription,
                ice: iceCandidatesMap.get(pid) || []
              }));
              out.value = btoa(JSON.stringify(allData));
              log('📤 ICE complete (all peers)');
            }
          }
        };

        pcs.set(id, { pc, dc: null, name: name }); // name initially the host name until updated

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        return pc;
      }

      function getPeers() {
        return Array.from(pcs.values()).map(p => p.name);
      }

      window.easywebrtc_accept = async base64 => {
        try {
          const allData = JSON.parse(atob(cleanBase64(base64)));
          for (const { id, name: peerName, offer, ice } of allData) {
            if (!pcs.has(id)) {
              await createPeerConnection(id);
              pcs.get(id).name = peerName || id;
            }
            const pc = pcs.get(id).pc;
            await pc.setRemoteDescription(offer);
            for (const cand of ice) await pc.addIceCandidate(new RTCIceCandidate(cand));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
          }
          log('📥 ACCEPTED all peers');
          onPeersChange?.(getPeers());
        } catch (err) {
          log('❌ Accept error: ' + err);
        }
      };

      window.easywebrtc_send = (id, msg) => {
        const dc = pcs.get(id)?.dc;
        if (dc && dc.readyState === 'open') {
          dc.send(msg);
          log(`${pcs.get(id).name}: ${msg}`);
        } else {
          log(`❌ Send failed to ${id} (not open)`);
        }
      };

      onPeersChange?.(getPeers());

      window.getPeers = getPeers;

      return;
    }
  }

  window.initWebRTC = initWebRTC;
  window.easywebrtc_log = log;
})();
