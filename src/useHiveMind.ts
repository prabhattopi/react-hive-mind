import { useState, useEffect, useRef, useCallback } from 'react';
import mqtt from 'mqtt';

const STUN_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

export function useHiveMind<T>(roomHash: string, initialState: T) {
  const [state, setLocalState] = useState<T>(initialState);
  const [connectedPeers, setConnectedPeers] = useState(0);

  const clientId = useRef(Math.random().toString(36).substring(2, 10));
  const peers = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channels = useRef<Map<string, RTCDataChannel>>(new Map());
  const mqttClient = useRef<mqtt.MqttClient | null>(null);

  // We use a ref to track the latest state without triggering infinite re-renders in callbacks
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const updatePeersCount = () => setConnectedPeers(channels.current.size);

  useEffect(() => {
    // 1. Connect to Public MQTT for Signaling
    const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt');
    mqttClient.current = client;

    const myChannel = `hive-mind/${roomHash}/#`;
    const signalChannel = `hive-mind/${roomHash}/signal`;

    client.on('connect', () => {
      client.subscribe(myChannel);
      // Shout to the room that we just joined
      client.publish(`${signalChannel}/join`, JSON.stringify({ from: clientId.current }));
    });

    const createPeer = (targetId: string) => {
      if (peers.current.has(targetId)) return peers.current.get(targetId)!;

      const pc = new RTCPeerConnection(STUN_SERVERS);
      peers.current.set(targetId, pc);

      // Handle incoming ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          client.publish(`${signalChannel}/ice`, JSON.stringify({
            to: targetId,
            from: clientId.current,
            candidate: event.candidate
          }));
        }
      };

      // Handle data channel state
      pc.ondatachannel = (event) => setupChannel(targetId, event.channel);

      return pc;
    };

    const setupChannel = (targetId: string, channel: RTCDataChannel) => {
      channels.current.set(targetId, channel);
      
      channel.onopen = () => {
        updatePeersCount();
        // Send our current state to the new guy
        channel.send(JSON.stringify(stateRef.current)); 
      };
      
      channel.onclose = () => {
        channels.current.delete(targetId);
        peers.current.delete(targetId);
        updatePeersCount();
      };
      
      channel.onmessage = (event) => {
        const incomingState = JSON.parse(event.data);
        setLocalState(incomingState); // Update React state from network
      };
    };

    client.on('message', async (topic, message) => {
      const payload = JSON.parse(message.toString());
      if (payload.from === clientId.current) return; // Ignore our own shouts
      if (payload.to && payload.to !== clientId.current) return; // Ignore messages for others

      if (topic.endsWith('/join')) {
        // Someone joined! Create a connection and offer it to them.
        const pc = createPeer(payload.from);
        const channel = pc.createDataChannel('sync-channel');
        setupChannel(payload.from, channel);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        client.publish(`${signalChannel}/offer`, JSON.stringify({
          to: payload.from,
          from: clientId.current,
          offer
        }));
      }

      if (topic.endsWith('/offer')) {
        // We received an offer, send an answer
        const pc = createPeer(payload.from);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        client.publish(`${signalChannel}/answer`, JSON.stringify({
          to: payload.from,
          from: clientId.current,
          answer
        }));
      }

      if (topic.endsWith('/answer')) {
        // Target accepted our offer
        const pc = peers.current.get(payload.from);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
      }

      if (topic.endsWith('/ice')) {
        // Exchange routing info
        const pc = peers.current.get(payload.from);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      }
    });

    return () => {
      client.end();
      channels.current.forEach(ch => ch.close());
      peers.current.forEach(pc => pc.close());
    };
  }, [roomHash]);

  // The function the developer uses to update state across the world
  const setStateAndBroadcast = useCallback((newState: T | ((prev: T) => T)) => {
    setLocalState((prev) => {
      const resolvedState = newState instanceof Function ? newState(prev) : newState;
      
      // Blast the new state to all connected peers over P2P Data Channels
      channels.current.forEach(channel => {
        if (channel.readyState === 'open') {
          channel.send(JSON.stringify(resolvedState));
        }
      });
      
      return resolvedState;
    });
  }, []);

  return [state, setStateAndBroadcast, connectedPeers] as const;
}