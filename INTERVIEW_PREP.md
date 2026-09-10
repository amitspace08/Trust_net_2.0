# TrustNet - Interview Preparation Guide

This document is designed to help you confidently discuss the TrustNet project during technical interviews, portfolio reviews, and architecture deep dives.

## 1. The Elevator Pitch

> "TrustNet is a full-stack personal safety and SOS application I built. The problem it solves is that standard SOS apps only alert people you know—who might be asleep or miles away—or they just call 911, which isn't always the right first step. I wanted to build something smarter. So if you trigger an SOS and your direct contacts don't respond, the system automatically traverses your social graph to alert 'friends of friends' who happen to be nearby, without leaking your exact location until they accept. If that fails, it falls back to verified community volunteers. It's built with React, Node, MongoDB, and uses Socket.io to handle the live GPS broadcasting and the complex state transitions of the escalation cascade."

## 2. Architecture Overview

At a high level, the application is divided into a decoupled **Client (React/Vite)** and **Server (Node/Express)**, communicating over two distinct channels: REST for data fetching, and WebSockets (Socket.io) for real-time events.

- **The Client (`client/`)**: It's a React Single Page Application using `@tanstack/react-router`. It handles authentication state via JWTs and maintains a persistent Socket.io connection. Maps and geospatial UI are rendered using Leaflet (`react-leaflet`).
- **The Server (`server/`)**: An Express application structured with modular routes and controllers. It handles REST requests and acts as the central coordinator for the SOS escalation state machine.
- **The Database (MongoDB Atlas)**: Connected via Mongoose. The most critical collections are `Users`, `TrustRelationships`, and `UserLocations`.
- **Real-Time Layer (Socket.io)**: Instead of the client polling the database, the server pushes state changes. For example, when an SOS escalates from Layer 1 to Layer 2, the server evaluates the logic and emits `sos:layer2Alert` to specific socket rooms targeting the required users.

## 3. The Technically Interesting Part: Graph Traversal

**If asked: "What was the hardest part you built?" or "Walk me through a complex technical challenge."**

> "The most interesting technical challenge was the Layer 2 escalation—the social graph traversal. When someone triggers an SOS and their direct contacts (Layer 1) don't answer within 45 seconds, we need to find nearby people who know their contacts (friends of friends). 
> 
> To do this, when the timer expires, the server runs a function called `getLayer2Candidates`. It queries the `TrustRelationships` collection to find all the distressed user's accepted Layer 1 friends. Then, it maps over those friends and queries their accepted friends. It flattens this into a massive candidate pool, filters out anyone who is already in Layer 1, and filters out the distressed user themselves.
> 
> But that's just the graph part. I then had to rank them by distance using a geospatial query (`$geoNear` or `$near`) on their last known location, and then ping them one by one. To respect privacy, the payload sent to these candidates includes a 'fuzzed' location—an approximate distance rather than exact GPS coordinates. The actual live coordinates are only shared via a dedicated socket room once they actively accept the request."

## 4. Architectural Decisions ("Why X over Y?")

- **MongoDB vs Firestore (The original spec)**
  - *Answer*: "I started with Firebase, but the relational nature of the Trust Circle social graph made NoSQL document fetching very cumbersome—specifically querying 'friends of friends'. MongoDB's aggregation pipelines and robust `$geoNear` 2dsphere indexes for location queries made ranking responders infinitely cleaner than trying to manage Geohash queries in Firestore."
- **Socket.io vs Firebase Cloud Messaging (FCM)**
  - *Answer*: "FCM is fantastic for native mobile push notifications, but for a web-based app requiring high-frequency bidirectional communication—like streaming live GPS coordinates every 5 seconds—WebSockets are vastly superior. Socket.io's room feature (`io.to(sessionId).emit()`) made it trivial to broadcast locations only to authorized responders."
- **JWT vs Firebase Auth (Phone OTP)**
  - *Answer*: "I moved to JWTs to keep the entire stack self-contained within the Node ecosystem. It allows for a completely decoupled REST API that relies on standard Bearer tokens in headers, rather than relying on a proprietary third-party SDK to manage auth state."
- **Leaflet (OpenStreetMap) vs Google Maps SDK**
  - *Answer*: "Google Maps requires billing setup and strict API key restrictions, which adds friction for a portfolio project. Leaflet is open-source, entirely free, extremely lightweight, and integrates perfectly with React via `react-leaflet`, while still providing all the necessary marker, polyline, and circle primitives."

## 5. Known Limitations / "What I'd do differently at scale"

Interviewers respect honesty about technical debt. If asked about limitations, mention these:

1. **Graph Traversal Efficiency**: "Right now, `getLayer2Candidates` does sequential database fetches per Layer 1 contact. At scale, this would be highly inefficient. I would replace this with a single MongoDB Aggregation Pipeline using `$graphLookup` to resolve the friends-of-friends tree in one database operation, or move the graph entirely to a GraphDB like Neo4j."
2. **WebSocket Scaling**: "Currently, the Socket.io state (like the active session timers) is held in Node's memory. If I needed to scale this horizontally across multiple server instances (e.g., behind a load balancer), I'd have to implement the `@socket.io/redis-adapter` so events and active sessions are shared across the cluster."
3. **Location Privacy**: "The location fuzzing for Layer 2 is currently a simple randomization offset. For true privacy, I'd want to implement formal differential privacy algorithms or hexagonal binning (like Uber's H3) to prevent triangulation attacks."
4. **Guardian Verification**: "The Guardian Angel verification is currently a boolean flag in the database. In a real product, this would require integration with a KYC (Know Your Customer) or background check API like Checkr."

## 6. "If I had one more week..."

1. **WebRTC Audio/Video**: "I'd integrate WebRTC so the distressed user could stream live audio/video to the responders directly from their browser, creating a tamper-proof record of the incident."
2. **Offline Mesh Networking**: "I'd love to explore Web Bluetooth API to allow nearby users to relay SOS beacons even if the distressed user is in a cellular dead zone, hopping off nearby devices until it hits someone with an internet connection."
3. **Automated End-to-End Testing**: "I'd write Cypress or Playwright tests specifically for the WebSocket event cascade, setting up multiple browser instances to automate the 'User A triggers, User B ignores, User C responds' flow."
