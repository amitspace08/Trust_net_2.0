# TrustNet - Deployment Reference Guide

This document outlines the architecture, environment variables, and steps required to deploy TrustNet to production for live demonstrations.

## 1. Hosting Architecture Recommendation

Because TrustNet relies heavily on persistent, bi-directional WebSockets (Socket.io) for live GPS broadcasting, you **cannot** host the backend on a standard serverless platform like Vercel Functions. Serverless functions spin down immediately after an HTTP response is sent, immediately severing any WebSocket connections.

Therefore, the recommended split is:
- **Client (Frontend)**: Vercel or Netlify. These are perfect for static React/Vite builds.
- **Server (Backend)**: Render, Railway, or Fly.io. These providers offer persistent containers/VMs that keep Node.js applications running continuously to maintain Socket.io connections.
- **Database**: MongoDB Atlas. The free shared cluster tier (M0) provides ample storage and performance for portfolio demos.

## 2. Environment Variables Setup

You will need two separate sets of environment variables configured on your respective hosting platforms.

### Backend (Render / Railway)
- `PORT`: (Usually auto-assigned by the platform, but good practice to set to `5000` locally).
- `MONGODB_URI`: Your production connection string from MongoDB Atlas. 
  - *Format*: `mongodb+srv://<username>:<password>@cluster0.mongodb.net/trustnet`
  - **Security Note**: For a demo, you may need to configure your Atlas Network Access IP Allowlist to `0.0.0.0/0` (allow from anywhere) if your hosting provider doesn't offer static IPs on their free tier. *In a real production environment, this is a security risk—you would peer your database VPC exclusively with your server VPC.*
- `JWT_SECRET`: A strong, randomly generated string. Do not reuse your local dev secret. (e.g., generate one using `openssl rand -base64 32`).
- `CLIENT_URL`: The deployed URL of your frontend (e.g., `https://trustnet-app.vercel.app`). This is critical. Both Express and Socket.io use this variable to configure CORS securely, preventing cross-origin attacks from unauthorized domains.

### Frontend (Vercel / Netlify)
- `VITE_API_URL`: The deployed URL of your backend (e.g., `https://trustnet-api.onrender.com/api`).
  - *Note*: The frontend `socket.js` configuration is written to automatically strip the `/api` suffix to deduce the correct WebSocket URL (e.g., `https://trustnet-api.onrender.com`).

## 3. Deployment Steps

### Deploying the Database
1. Create a free cluster on MongoDB Atlas.
2. Create a database user and save the password.
3. Whitelist `0.0.0.0/0` in Network Access.
4. Copy the connection string.

### Deploying the Backend
1. Connect your GitHub repository to Render/Railway.
2. Set the Root Directory to `server`.
3. Set the Build Command: `npm install && npm run build` (Note: Ensure your `server/package.json` has a build script if using TypeScript, or deploy directly if running via `tsx` or `ts-node`).
4. Set the Start Command: `npm start` (or `npm run dev` if relying on `tsx` for the demo).
5. Add the Backend Environment Variables.
6. Deploy. Note the generated URL (e.g., `https://trustnet-api.onrender.com`).

### Deploying the Frontend
1. Connect your GitHub repository to Vercel/Netlify.
2. Set the Framework Preset to `Vite`.
3. Set the Root Directory to `client`.
4. Add the `VITE_API_URL` environment variable (using the backend URL generated above).
5. Deploy. Note the generated URL (e.g., `https://trustnet-app.vercel.app`).

### Updating Backend CORS
1. Return to your Backend dashboard.
2. Update the `CLIENT_URL` environment variable to match the Frontend URL generated in the previous step.
3. Redeploy the Backend to apply the new CORS policy.

## 4. Seeding the Production Database

Since your deployed database is empty, you need to populate it with test users, safe spaces, and relationships to effectively demonstrate the Layer 1 and Layer 2 escalation mechanics.

To do this from your local machine:
1. Open your terminal and navigate to the `server` directory.
2. Run the seed script, passing in your **production** MongoDB URI inline:
   ```bash
   MONGODB_URI="mongodb+srv://<username>:<password>@cluster0.mongodb.net/trustnet" npm run seed
   ```
3. This will clear existing records and generate the base users (Priya, Rahul, Dev), their Layer 1/2 Trust Relationships, and dummy geospatial Safe Spaces and ratings in your live database.

## 5. Cold Starts & Sanity Checks

- **Cold Starts**: If you use Render's free tier, the server spins down after 15 minutes of inactivity. The next request (such as opening the app) will wake it up, which can take 30–60 seconds. The frontend features a "Waking up server..." UI state in `__root.jsx` to gracefully handle this delay during live demos.
- **Mixed Content**: Ensure `VITE_API_URL` uses `https://`. Browsers will block HTTP requests (Mixed Content) originating from an HTTPS site.
- **WebSockets over HTTPS**: Socket.io seamlessly upgrades from HTTPS polling to WSS (WebSocket Secure). No additional configuration is required assuming `VITE_API_URL` uses `https://`.
