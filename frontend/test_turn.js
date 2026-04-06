const { RTCPeerConnection } = require('wrtc');

const config = {
  iceServers: [
    { urls: 'turn:relay.metered.ca:80', username: 'e29e254c0f8dd6a79e02e27f', credential: 'yv2vWAMF9ctoJoLv' },
    { urls: 'turns:relay.metered.ca:443?transport=tcp', username: 'e29e254c0f8dd6a79e02e27f', credential: 'yv2vWAMF9ctoJoLv' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turns:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
  ],
  iceTransportPolicy: 'relay'
};

const pc = new RTCPeerConnection(config);
pc.onicecandidate = e => {
  if (e.candidate) console.log('✅ Generated TURN Candidate:', e.candidate.candidate);
  else console.log('🏁 ICE Gathering Complete');
};
pc.onicecandidateerror = e => {
  console.log('❌ ICE Error:', e.errorCode, e.errorText, e.url);
};

pc.createDataChannel('test');
pc.createOffer().then(offer => pc.setLocalDescription(offer));

setTimeout(() => { pc.close(); }, 5000);
