# TrustNet - Advanced Personal Safety & SOS Platform

> **Live Demo:** [https://trustnet-app.vercel.app](https://trustnet-app.vercel.app) *(Replace with actual deployed URL)*

TrustNet is a professional, scalable, full-stack personal safety application built with the MERN stack and Socket.io. It features a sophisticated three-layer SOS escalation system designed to guarantee a response when emergencies happen.

## Core Features

- **Layer 1: Trust Circle (Direct Contacts)**
  - Users add close friends and family to their Trust Circle.
  - When an SOS is triggered, these users are notified immediately with a live GPS tracking link.
- **Layer 2: Social Graph Escalation (Friends of Friends)**
  - If Layer 1 fails to respond within 45 seconds, the system traverses the user's social graph to find nearby "friends of friends".
  - Privacy First: Location data is fuzzed (approximate distance/direction) until a Layer 2 candidate actively accepts the SOS request.
  - Declined candidates are permanently removed from the active session pool.
- **Layer 3: Guardian Angels (Community Volunteers)**
  - If Layer 2 fails to respond, the system alerts verified, background-checked community volunteers (Guardian Angels) in the vicinity.
  - Guardian Angels are pinged sequentially, maintaining privacy and ensuring localized response.
- **Layer 4: Direct Police Escalation**
  - Ultimate fallback if no Guardian Angels are available.
- **Safe Spaces Network**
  - Integrated map highlighting community-verified Safe Spaces (hospitals, pharmacies, 24/7 stores).
  - Users receive turn-by-turn directions to the nearest Safe Space when Layer 3 is exhausted.
- **Real-Time Live Location**
  - High-frequency GPS pinging powered by Socket.io ensures responders always have the distressed user's exact, live coordinates.
  - Handles poor connectivity scenarios with graceful "Offline/Stale Location" UI states.

## Tech Stack

### Frontend (Client)
- **Framework**: React.js + TypeScript + Vite
- **Routing**: @tanstack/react-router
- **Styling**: Tailwind CSS, Radix UI
- **Maps**: react-leaflet, Leaflet.js
- **Real-time**: socket.io-client
- **State**: React Context API

### Backend (Server)
- **Framework**: Node.js + Express.js + TypeScript
- **Database**: MongoDB (via Mongoose)
- **Real-time**: Socket.IO (with robust room-based broadcast logic)
- **Validation**: Zod schema validation
- **Authentication**: JWT (JSON Web Tokens)

## Architecture Highlights
- **Idempotent Socket Events**: The SOS escalation engine on the backend is strictly controlled using MongoDB `findOneAndUpdate` atomic operations to prevent race conditions during rapid escalation transitions.
- **Resilient Connectivity**: Socket auto-reconnection and state refetching ensures users can drop network momentarily and instantly re-sync their session state when they reconnect.

## How to Run Locally

1. **Clone the repository.**
2. **Setup Environment Variables:**
   - Create `server/.env`:
     ```env
     PORT=5000
     MONGODB_URI=mongodb://localhost:27017/trustnet
     JWT_SECRET=your_super_secret_jwt_key
     ```
   - Create `client/.env`:
     ```env
     VITE_API_URL=http://localhost:5000/api
     ```
3. **Start the Backend:**
   ```bash
   cd server
   npm install
   npm run dev
   ```
4. **Start the Frontend:**
   ```bash
   cd client
   npm install
   npm run dev
   ```

## Demo Mode
To bypass hardware geolocation checks and preview the UI in a simulated environment, append `?demo=true` to any URL (e.g., `http://localhost:5173/?demo=true`).
