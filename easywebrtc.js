(() => {
  const logQueue = [];
  const logState = { busy: false };
  const logElement = document.getElementById('log') || (() => {
    const el = document.createElement('pre');
    el.id = 'log';
    el.style.cssText = 'padding:1em;background:#111;color:#0f0;font-family:monospace;white-space:pre-wrap;max-height:200px;overflow:auto;';
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
          logElement.scrollTop = logElement.scrollHeight;
        }
        logState.busy = false;
      }, 0);
    }
  };

  const cleanBase64 = str => str.replace(/\s+/g, '');
  const encodeData = (desc, ice) => btoa(JSON.stringify({ s: desc, c: ice }));
  const decodeData = str => JSON.parse(atob(cleanBase64(str)));

  // Host houdt alle peers bij
  class Host {
    constructor() {
      this.connections = new Map();
      this.onStatusUpdate = null;
    }

    async createConnection(peerId, callbacks) {
      const pc = new RTCPeerConnection({ iceServers: [] });
      const iceCandidates = [];
      let dataChannel;

      pc.ondatachannel = e => {
        dataChannel = e.channel;
        dataChannel.onopen = () => {
          log(`🟢 Connected ${peerId}`);
          this.connections.set(peerId, { pc, dc: dataChannel });
          this._updateStatus();
          callbacks?.onConnect?.(dataChannel, peerId);
        };
        dataChannel.onclose = () => {
          log(`🔴 Disconnected ${peerId}`);
          this.connections.delete(peerId);
          this._updateStatus();
          callbacks?.onDisconnect?.(dataChannel, peerId);
        };
        dataChannel.onmessage = e => {
          log(`${peerId}: ${e.data}`);
          callbacks?.onMessage?.(dataChannel, peerId, e.data);
        };
      };

      pc.onicecandidate = e => {
        if (e.candidate) iceCandidates.push(e.candidate.toJSON());
        else {
          // ICE complete
          if (callbacks?.onIceComplete) callbacks.onIceComplete(encodeData(pc.localDescription, iceCandidates), peerId);
        }
      };

      return { pc, iceCandidates };
    }

    async acceptOffer(peerId, offerB64, callbacks) {
      if (this.connections.has(peerId)) {
        log(`❌ Peer ${peerId} already connected`);
        return;
      }

      const { s, c } = decodeData(offerB64);
      const conn = await this.createConnection(peerId, callbacks);
      await conn.pc.setRemoteDescription(new RTCSessionDescription(s));
      for (const cand of c) await conn.pc.addIceCandidate(new RTCIceCandidate(cand));
      const answer = await conn.pc.createAnswer();
      await conn.pc.setLocalDescription(answer);
      return encodeData(conn.pc.localDescription, conn.iceCandidates);
    }

    sendMessage(peerId, msg) {
      const conn = this.connections.get(peerId);
      if (conn && conn.dc.readyState === 'open') {
        conn.dc.send(msg);
        log(`➡️ ${peerId}: ${msg}`);
      } else {
        log(`❌ Send failed to ${peerId} (not open)`);
      }
    }

    _updateStatus() {
      if (this.onStatusUpdate) {
        const ids = [...this.connections.keys()];
        this.onStatusUpdate(ids);
      }
    }
  }

  // Peer (controller)
  async function createPeer(peerName, callbacks) {
    const pc = new RTCPeerConnection({ iceServers: [] });
    const iceCandidates = [];

    const dc = pc.createDataChannel('data-' + Math.random().toString(36).slice(2, 6), {
      ordered: false,
      maxRetransmits: 0
    });

    dc.onopen = () => {
      log(`🟢 Connected ${peerName}`);
      callbacks?.onConnect?.(dc);
    };
    dc.onclose = () => {
      log(`🔴 Disconnected ${peerName}`);
      callbacks?.onDisconnect?.(dc);
    };
    dc.onmessage = e => {
      log(`${peerName}: ${e.data}`);
      callbacks?.onMessage?.(dc, peerName, e.data);
    };

    pc.onicecandidate = e => {
      if (e.candidate) iceCandidates.push(e.candidate.toJSON());
      else {
        if (callbacks?.onIceComplete) callbacks.onIceComplete(encodeData(pc.localDescription, iceCandidates));
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    async function acceptAnswer(answerB64) {
      const { s, c } = decodeData(answerB64);
      await pc.setRemoteDescription(new RTCSessionDescription(s));
      for (const cand of c) await pc.addIceCandidate(new RTCIceCandidate(cand));
      log(`📥 ACCEPTED ${peerName}`);
    }

    function send(msg) {
      if (dc.readyState === 'open') {
        dc.send(msg);
        log(`➡️ ${peerName}: ${msg}`);
      } else {
        log('❌ Send failed (not open)');
      }
    }

    return { acceptAnswer, send, pc };
  }

  window.EasyWebRTC = {
    Host,
    createPeer,
    log,
  };
})();
