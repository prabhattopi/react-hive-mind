# react-hive-mind-hook 🧠

Multiplayer React, without the server. Sync state across multiple browsers instantly using a Peer-to-Peer WebRTC Mesh Network.

Building live multiplayer features usually requires spinning up complex WebSocket servers (Socket.io) or paying for third-party services. `react-hive-mind-hook` is a drop-in replacement for `useState` that instantly mesh-networks everyone looking at the same "room". When one person updates the state, it updates on all screens globally in milliseconds, bypassing servers entirely.

## ✨ Features
- **🌍 Zero Server Backend:** Uses a temporary public MQTT broker for handshaking, then switches to pure P2P WebRTC data channels.
- **⚡ Lightning Fast:** State updates are shot directly from browser to browser.
- **⚛️ Drop-in Hook:** As simple to use as standard React `useState`.
- **🔌 Auto-Mesh Routing:** Handles peer discovery, connection drops, and routing automatically.

## 📦 Installation

```bash
npm install react-hive-mind-hook mqtt
```
## 🚀 Quick Start
There are two primary ways to use the Hive Mind: for simple shared values, or for complex multiplayer objects.

### 1. Simple State (Collaborative Text)
Drop the useHiveMind hook into any component. Pass a unique, unguessable "room hash" and an initial state. It works exactly like useState.

```
import { useHiveMind } from 'react-hive-mind-hook';

export default function CollaborativeDoc() {
  // Anyone in 'secret-doc-xyz' will share this text string
  const [text, setText, connectedPeers] = useHiveMind('secret-doc-xyz', '');

  return (
    <div>
      <p>{connectedPeers} Peer(s) Connected</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type here to sync globally..."
      />
    </div>
  );
}
```

2. Complex State (Live Mouse Cursors)
You can pass objects to useHiveMind to build complex real-time UI, like Figma-style multiplayer cursors.

```
import { useHiveMind } from 'react-hive-mind-hook';

export default function SharedCanvas() {
  // Track X and Y coordinates globally
  const [cursor, setCursor, peers] = useHiveMind('canvas-room-1', { x: 0, y: 0 });

  return (
    <div 
      style={{ width: '100vw', height: '100vh' }}
      onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
    >
      <p>{peers} users in canvas</p>
      
      {/* Renders the remote cursor */}
      <div style={{
        position: 'absolute',
        left: cursor.x,
        top: cursor.y,
        width: 20,
        height: 20,
        background: 'red',
        borderRadius: '50%'
      }} />
    </div>
  );
}
```

## 🧰 API Reference

### `useHiveMind<T>(roomHash, initialState)`
The core networking hook. It returns a tuple, functioning exactly like a standard React `useState` hook, but with a third value for the live peer count.

| Parameter / Return | Type | Description |
| :--- | :--- | :--- |
| **`roomHash`** | `string` | **(Argument)** The unique connection ID. Browsers with the same hash will sync. |
| **`initialState`** | `T` | **(Argument)** The starting state before any network sync happens. |
| `[0] state` | `T` | **(Return)** The real-time, globally synced state data. |
| `[1] setState` | `function` | **(Return)** Updates the local state AND instantly broadcasts the new state over P2P. |
| `[2] connectedPeers` | `number` | **(Return)** The live count of other browsers currently connected to your mesh. |

## ⚠️ How it works
1. **The Handshake:** When the component mounts, it briefly connects to a free, public MQTT broker to announce its presence to the `roomHash`.
2. **The Connection:** Any other browsers in that room hear the shout and automatically exchange WebRTC connection offers.
3. **The P2P Tunnel:** Once the browsers connect to each other, a direct Peer-to-Peer tunnel is opened and the public broker is bypassed.
4. **The Broadcast:** When you call the setter function, the new JSON state is blasted directly to the connected browsers via WebRTC Data Channels.

*Note: Because this is a Full Mesh network (everyone connects to everyone), it is heavily optimized for small-to-medium collaborative rooms (2 to 20 users). Do not put 10,000 users in the same room hash, or the browser will struggle to maintain the connections!*

## 📜 License
MIT

## 💖 Support the Project
If this package helped you bypass complex cloud architectures or saved you hours of server configuration, consider supporting my late-night open-source experiments!

[![Sponsor Prabhat on GitHub](https://img.shields.io/badge/Sponsor_Prabhat-GitHub-%23EA4AAA?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sponsors/prabhattopi)