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
        while (logQueue.length) logElement.textContent += logQueue.shift() + '\n';
        logState.busy = false;
      }, 0);
    }
  };

  const clean = str => str.replace(/\s+/g, '');
  const encode = (desc, ice) => btoa(JSON.stringify({ s: desc, c: ice }));
  const decode = str => JSON.parse(atob(clean(str)));

  const peers = {};
  let hostMode = false;

  function initWebRTC(mode, { onConnect, onMessage, onDisconnect }) {
    hostMode = (mode === 'host');

    function createPeer() {
      const pc = new RTCPeerConnection({ iceServers: [] });
      const ice = [];
      let dc;
      const id = 'c-' + Math.random().toString(36).slice(2, 8);

      function setupDC(dataChannel) {
        dc = dataChannel;
        dc.onopen = () => log(`🟢 CONNECT ${id}`);
        dc.onmessage = e => {
          try {
            const obj = JSON.parse(e.data);
            if (obj.type === 'hello' && obj.name) {
              dc.name = obj.name;
              peers[id] = { id, name: obj.name, dc };
              updateStatus();
              onConnect?.(dc, id, obj.name);
            } else {
              onMessage?.(dc, e.data, id, dc.name);
            }
          } catch {
            onMessage?.(dc, e.data, id, dc.name);
          }
        };
        dc.onclose = () => {
          log(`🔴 DISCONNECT ${id}`);
          delete peers[id];
          updateStatus();
          onDisconnect?.(dc, id, dc.name);
        };
      }

      return {
        pc,
        dc,
        ice,
        id,
        setupDC,
        offer: async () => {
          if (!hostMode) {
            dc = pc.createDataChannel(id, { ordered: false });
            setupDC(dc);
          } else {
            pc.ondatachannel = e => setupDC(e.channel);
          }

          pc.onicecandidate = e => {
            if (e.candidate) ice.push(e.candidate.toJSON());
            else document.getElementById('output').value = encode(pc.localDescription, ice);
          };

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
        },
        accept: async b64 => {
          const { s, c } = decode(b64);
          await pc.setRemoteDescription(s);
          for (const i of c) await pc.addIceCandidate(new RTCIceCandidate(i));
          if (hostMode) {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
          }
          log(`📥 ACCEPTED ${id}`);
        },
        send: msg => {
          if (dc?.readyState === 'open') dc.send(msg);
        }
      };
    }

    const instance = createPeer();
    instance.offer();

    window.easywebrtc_accept = instance.accept;
    if (!hostMode) {
      window.easywebrtc_send = instance.send;
      window.easywebrtc_hello = name => {
        setTimeout(() => {
          instance.send(JSON.stringify({ type: 'hello', name }));
        }, 100);
      };
    }

    function updateStatus() {
      if (hostMode) {
        const div = document.getElementById('controllers');
        if (div) {
          div.innerHTML = `<b>Verbonden controllers:</b> ${Object.keys(peers).length}<br>` +
            Object.values(peers).map(p => `${p.name} (${p.id})`).join('<br>');
        }
      }
    }

    window.easywebrtc_peers = peers;
  }

  window.initWebRTC = initWebRTC;
})();
