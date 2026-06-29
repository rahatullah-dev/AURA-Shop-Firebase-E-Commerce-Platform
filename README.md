# Aura Shop

A production-ready, modern e-commerce storefront built with vanilla HTML5, CSS3, and JavaScript. Aura Shop features a premium, sleek user interface with seamless integration to Firebase backend services and Cloudinary for media management.

## 🎯 Overview

Aura Shop is a full-featured e-commerce platform designed with performance, scalability, and user experience in mind. It delivers a responsive, accessible shopping experience without relying on heavy front-end frameworks.

### Key Features

- **Responsive Design** - Mobile-first approach with seamless experience across all devices
- **User Authentication** - Firebase Auth integration for secure login and registration
- **Product Management** - Browse, search, and filter products with detailed information
- **Shopping Cart** - Add, update, and manage items in your cart
- **Order Management** - Complete checkout process with order tracking
- **Admin Dashboard** - Manage products, categories, orders, and customer messages
- **Media Management** - Cloudinary integration for optimized image delivery
- **Real-time Database** - Firestore for instant data synchronization

## 🛠 Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla HTML5, CSS3, JavaScript (ES6+) |
| **Build Tool** | Vite 5.2.0 |
| **Backend** | Firebase (Firestore, Authentication) |
| **Media Hosting** | Cloudinary |
| **Database** | Firestore (NoSQL) |
| **Bundler** | Vite |

## 📁 Project Structure

```
aura-shop/
├── public/
│   ├── admin/                    # Admin dashboard pages
│   │   ├── login.html
│   │   ├── dashboard.html
│   │   ├── products.html
│   │   ├── categories.html
│   │   ├── orders.html
│   │   ├── messages.html
│   │   ├── profile.html
│   │   └── settings.html
│   ├── assets/
│   │   └── images/              # Product images organized by category
│   │       ├── 0/
│   │       ├── 10_Book/
│   │       ├── 11_Camera/
│   │       ├── 12_Clothes/
│   │       ├── 13_Computer/
│   │       └── ...
│   ├── css/                     # Global and component stylesheets
│   │   ├── main.css
│   │   └── testimonial.css
│   ├── js/                      # Client-side logic
│   │   ├── firebase-config.js
│   │   └── [page-specific scripts]
│   ├── 404.html                 # Error page
│   └── index.html               # Home page
├── src/                         # Source files (Vite entry point)
├── dist/                        # Production build output
├── firebase.json                # Firebase hosting configuration
├── firestore.rules              # Firestore security rules
├── firestore.indexes.json       # Firestore index configuration
├── package.json
├── index.html
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 16.0 or higher
- **npm** or **yarn** package manager
- Firebase project with Firestore and Authentication enabled
- Cloudinary account for media management

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/aura-shop.git
   cd aura-shop
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Create a `.env.local` file (or update `firebase-config.js`) with your Firebase credentials:
     ```javascript
     const firebaseConfig = {
       apiKey: "YOUR_API_KEY",
       authDomain: "your-project.firebaseapp.com",
       projectId: "your-project-id",
       storageBucket: "your-project.appspot.com",
       messagingSenderId: "your-sender-id",
       appId: "your-app-id"
     };
     ```

4. **Configure Cloudinary** (if using media uploads)
   - Add your Cloudinary cloud name to your configuration

### Development

Start the development server with hot-reload:

```bash
npm run dev
```

The development server will typically run on `http://localhost:5173`

### Building for Production

Create an optimized production build:

```bash
npm run build
```

The output will be generated in the `../dist` directory.

### Preview Production Build

Test the production build locally:

```bash
npm run preview
```

## 🎨 Design System

### Colors

The application uses a carefully curated color palette designed for a premium e-commerce experience:

| Category | Color | CSS Variable |
|----------|-------|--------------|
| **Primary Background** | `#f5f7fa` | `--bg` |
| **Surface/White** | `#ffffff` | `--white` |
| **Dark Text** | `#0f172a` | `--dark` |
| **Muted Text** | `#475569` | `--mid` |
| **Light/Borders** | `#94a3b8` | `--light` |
| **Border** | `#e2e8f0` | `--border` |
| **Primary Accent** | `#2563eb` | `--accent` |
| **Accent Hover** | `#1d4ed8` | `--accent2` |
| **Accent Background** | `#eff6ff` | `--accent-soft` |
| **Gold/Rating** | `#f59e0b` | `--gold` |
| **Success** | `#16a34a` | `--green` |
| **Success Background** | `#dcfce7` | `--green-soft` |
| **Error/Danger** | `#dc2626` | `--red` |
| **Error Background** | `#fef2f2` | `--red-soft` |

### Typography

- **Primary Font**: `Outfit` - Used for body text, buttons, and general UI
- **Secondary Font**: `Plus Jakarta Sans` - Available for specialized use

Both fonts are loaded from Google Fonts for optimal performance.

### Spacing & Layout

- **Border Radius**: `--radius: 14px` (default), `--radius-sm: 8px` (small elements)
- **Shadows**: Subtle shadows for depth and elevation
- **Transitions**: Smooth animations with `cubic-bezier(.4, 0, .2, 1)` timing
- **Layout**: Flexbox and CSS Grid for responsive, adaptive layouts

## 🔐 Authentication & Security

### Firebase Authentication

Users can register and log in via Firebase Authentication. The system supports:
- Email/password authentication
- Secure session management
- Protected admin routes

### Firestore Security Rules

Security rules are defined in `firestore.rules` to ensure:
- Users can only access their own data
- Admin operations are restricted to authenticated admin users
- Public data (products, categories) is readable by all

## 📊 Database Schema

### Firestore Collections

The database is organized into collections for:
- **users** - User profiles and preferences
- **products** - Product catalog with descriptions, prices, images
- **categories** - Product categories and subcategories
- **orders** - Customer orders and order history
- **messages** - Customer inquiries and messages
- **cart** - Shopping cart data

## 🔄 Deployment

### Firebase Hosting

Deploy to Firebase Hosting:

```bash
# Install Firebase CLI globally (if not already installed)
npm install -g firebase-tools

# Log in to Firebase
firebase login

# Deploy
firebase deploy
```

The `firebase.json` configuration file specifies hosting settings and build output directory.

## 📱 Browser Support

Aura Shop is optimized for:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari 14+, Chrome Mobile)

## ♿ Accessibility

The project follows WCAG 2.1 guidelines:
- Semantic HTML structure
- Proper heading hierarchy
- ARIA labels where necessary
- Keyboard navigation support
- Color contrast ratios meet AA standards

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🐛 Issues & Support

Found a bug or have a feature request? Please [open an issue](https://github.com/yourusername/aura-shop/issues) on GitHub.

For general support, contact us at support@aurashop.com

## 📞 Contact

- **Website**: [www.aurashop.com](https://www.aurashop.com)
- **Email**: info@aurashop.com
- **GitHub**: [@yourusername](https://github.com/yourusername)

## 🙏 Acknowledgments

- Vite for the blazing-fast build tool
- Firebase for backend infrastructure
- Cloudinary for media management
- Google Fonts for beautiful typography

---

**Last Updated**: 2024
