# Reusable Sidebar Component Refactoring

The current implementation duplicates the sidebar UI across 8 different route files (`index.jsx`, `circle.jsx`, `heatmap.jsx`, `profile.jsx`, `history.jsx`, `privacy.jsx`, `support.jsx`, `settings.jsx`). This leads to visual inconsistencies, code duplication, and unnecessary full-page reloads when navigating between the legacy HTML pages and the modern React pages.

## Goal

Extract the sidebar into a single, reusable React component, and implement a unified layout wrapper in the root routing file so the sidebar is only mounted once and persists seamlessly across navigations.

## Proposed Changes

### 1. Create `<Sidebar />` Component

- **[NEW]** `src/components/Sidebar.jsx`
- Move the exact React implementation of the sidebar from `index.jsx` into this file.
- Use `@tanstack/react-router`'s `<Link>` and `useLocation` hook to automatically resolve active states.
- Dynamically render the user's avatar using the `UserAvatar` component.

### 2. Update Root Layout

- **[MODIFY]** `src/routes/__root.jsx`
- Modify the `AuthGate` component to wrap the `<Outlet />` in a layout container that includes the `<Sidebar />`.
- Define an array of paths that should **not** have a sidebar (e.g., `/login`, `/signup`, `/sos`).
- When the sidebar is active, wrap the `<Outlet />` in a `<main>` container with the appropriate `md:ml-72` margin to accommodate the fixed sidebar.

### 3. Clean Up Route Files

- **[MODIFY]** Remove the duplicated hardcoded `<nav>` and layout wrapper `<div className="w-full min-h-screen md:flex-row...">` from:
  - `src/routes/index.jsx`
  - `src/routes/circle.jsx`
  - `src/routes/heatmap.jsx`
  - `src/routes/profile.jsx`
- **[MODIFY]** Remove the duplicated raw HTML sidebar templates from:
  - `src/routes/history.jsx`
  - `src/routes/privacy.jsx`
  - `src/routes/support.jsx`
  - `src/routes/settings.jsx`

## User Review Required

> [!IMPORTANT]  
> By moving the sidebar into `__root.jsx`, I need to specify which routes should **not** have a sidebar. My proposed "No Sidebar" list is:
>
> - `/login`
> - `/signup`
> - `/sos`
>
> Are there any other routes that should NOT display the desktop sidebar? (e.g., `/add-contact`, `/report`, `/respond.$sessionId`).

## Verification Plan

### Manual Verification

1. I will load the app and navigate from Home → Safety History → Settings.
2. Verify that the sidebar does not jitter, reload, or change structure at all.
3. Verify that the active styling correctly shifts to the active tab.
4. Verify that layout constraints (margins and padding) are preserved for the main content on all pages.
