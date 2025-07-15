class EasyWebRTC {
    constructor(config = {}) {
        this.localVideo = config.localVideo;
        this.remoteVideo = config.remoteVideo;
        this.onData = config.onData || (() => {});
        this.onConnect = config.onConnect || (() => {});
        this.signaling = config.signaling || null;
        this.peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        this.channel = null;
        this.pendingCandidates = [];

        navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
            this.localVideo && (this.localVideo.srcObject = stream);
            stream.getTracks().forEach(track => this.peer.addTrack(track, stream));
        });

        this.peer.ontrack = e => {
            this.remoteVideo && (this.remoteVideo.srcObject = e.streams[0]);
        };

        this.peer.onicecandidate = e => {
            if (e.candidate) {
                if (this.signaling) {
                    this.signaling.send(JSON.stringify({ type: 'ice', candidate: e.candidate }));
                } else {
                    this.pendingCandidates.push(e.candidate);
                }
            }
        };

        this.peer.ondatachannel = e => {
            this.channel = e.channel;
            this._setupChannel();
        };

        if (this.signaling) {
            this.signaling.onmessage = async (msg) => {
                let data = JSON.parse(msg.data);
                if (data.type === 'offer') {
                    await this.peer.setRemoteDescription(new RTCSessionDescription(data.offer));
                    const answer = await this.peer.createAnswer();
                    await this.peer.setLocalDescription(answer);
                    this.signaling.send(JSON.stringify({ type: 'answer', answer }));
                } else if (data.type === 'answer') {
                    await this.peer.setRemoteDescription(new RTCSessionDescription(data.answer));
                } else if (data.type === 'ice') {
                    this.peer.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            };
        }
    }

    async call() {
        this.channel = this.peer.createDataChannel("chat");
        this._setupChannel();
        const offer = await this.peer.createOffer();
        await this.peer.setLocalDescription(offer);
        if (this.signaling) {
            this.signaling.send(JSON.stringify({ type: 'offer', offer }));
        }
    }

    _setupChannel() {
        this.channel.onopen = () => this.onConnect();
        this.channel.onmessage = e => this.onData(e.data);
    }

    send(data) {
        if (this.channel && this.channel.readyState === "open") {
            this.channel.send(data);
        }
    }

    // ===== Handmatige fallback API =====
    async exportOffer() {
        this.channel = this.peer.createDataChannel("chat");
        this._setupChannel();
        const offer = await this.peer.createOffer();
        await this.peer.setLocalDescription(offer);
        return new Promise(resolve => {
            const check = () => {
                if (this.peer.iceGatheringState === "complete") {
                    resolve(JSON.stringify({ offer: this.peer.localDescription }));
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    async importOffer(offerStr) {
        const { offer } = JSON.parse(offerStr);
        await this.peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await this.peer.createAnswer();
        await this.peer.setLocalDescription(answer);
        return new Promise(resolve => {
            const check = () => {
                if (this.peer.iceGatheringState === "complete") {
                    resolve(JSON.stringify({ answer: this.peer.localDescription }));
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    async importAnswer(answerStr) {
        const { answer } = JSON.parse(answerStr);
        await this.peer.setRemoteDescription(new RTCSessionDescription(answer));
    }

    async addIceCandidate(candidateStr) {
        const cand = JSON.parse(candidateStr);
        await this.peer.addIceCandidate(new RTCIceCandidate(cand));
    }

    getPendingIceCandidates() {
        return this.pendingCandidates.map(c => JSON.stringify(c));
    }
}
