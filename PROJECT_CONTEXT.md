# Aura Shop - Project Context

This document provides a high-level overview of the Aura Shop e-commerce project to help developers or AI agents understand the stack, architecture, and design system.

## Project Overview
**Aura Shop** is a production-ready, modern e-commerce storefront. It features a premium, sleek user interface and connects to a backend for data and authentication. 

## Technology Stack
- **Frontend**: Vanilla HTML5, CSS3, and JavaScript (No UI frameworks like React or Vue).
- **Bundler / Dev Server**: [Vite](https://vitejs.dev/) for fast development and building the production bundle.
- **Backend / Database / Auth**: [Firebase](https://firebase.google.com/) (Firestore for database, Firebase Auth for user management).
- **Media Hosting**: Cloudinary is used for image and media asset management.

## Architecture
- **`/public`**: Contains all the HTML pages (`index.html`, `products.html`, `product-detail.html`, `my-account.html`, etc.) and static assets.
- **`/public/css`**: Contains external stylesheets (`main.css`, `testimonial.css`).
- **`/public/js`**: Contains client-side JavaScript logic.
- **`/public/auth`**: Likely contains authentication-specific scripts or pages.
- **Firebase Configuration**: `firebase-config.js` initializes the Firebase app, while `firestore.rules` and `firestore.indexes.json` manage database security and indexing.

## Design System & Styling
The project uses custom **Vanilla CSS** with a robust set of CSS variables (`:root`) defined globally. It does **not** use Tailwind CSS or any other utility-first framework.

### Typography
The application uses Google Fonts for a modern, clean look:
- **Primary Font**: `Outfit` (used for body, buttons, and general text)
- **Secondary Font**: `Plus Jakarta Sans`

### Color Palette
The color scheme is designed to feel premium, featuring a light background with dark text and vibrant accents.

- **Backgrounds**: 
  - Base Background: `#f5f7fa` (`--bg`)
  - Surface/Cards: `#ffffff` (`--white`)
- **Text & UI Elements**:
  - Dark Text: `#0f172a` (`--dark`)
  - Mid/Muted Text: `#475569` (`--mid`)
  - Light/Borders: `#94a3b8` (`--light`), `#e2e8f0` (`--border`)
- **Accents (Primary Brand)**:
  - Primary Blue: `#2563eb` (`--accent`)
  - Dark Blue (Hover/Active): `#1d4ed8` (`--accent2`)
  - Soft Blue (Backgrounds): `#eff6ff` (`--accent-soft`)
- **Semantic Colors**:
  - Warning/Star Ratings: `#f59e0b` (`--gold`)
  - Success: `#16a34a` (`--green`), `#dcfce7` (`--green-soft`)
  - Danger/Error: `#dc2626` (`--red`), `#fef2f2` (`--red-soft`)

### UI Components & Effects
- **Radii**: Soft, modern corners using `--radius: 14px;` and `--radius-sm: 8px;`.
- **Shadows**: Subtle drop shadows for depth (`--shadow`, `--shadow-lg`).
- **Animations**: The site features smooth transitions (`--tr: .22s cubic-bezier(.4, 0, .2, 1);`), hover effects (scaling, box-shadows), and micro-animations (like the shine effect on the announcement bar).
- **Layout**: Heavy use of CSS Flexbox and Grid for responsive layouts. Mobile responsiveness is handled via media queries and mobile drawer navigation.
