const { RTCPeerConnection } = require('wrtc');

const config = {
  iceServers: [
    { urls: 'turn:159.89.101.120:3478', username: 'ari_admin', credential: 'zmzir_secure_relay_2026' },
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
