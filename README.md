# CareCore: Health & Wellness Platform

CareCore is a comprehensive health and wellness platform that connects users with health professionals, AI-powered chat support, community forums, and self-assessment tools for vision and hearing. The platform is built with Firebase, modern JavaScript, and Tailwind CSS, and is designed for accessibility, security, and a seamless user experience.

---

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Setup & Configuration](#setup--configuration)
- [Database Schema](#database-schema)
- [Security Rules](#security-rules)
- [Key Files & Their Roles](#key-files--their-roles)
- [Third-Party Integrations](#third-party-integrations)
- [Custom Styling](#custom-styling)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Landing Page:** Modern, animated introduction to CareCore with navigation to all features.
- **Authentication:** Secure login and registration using Firebase Auth.
- **AI Health Chat:** Chat with an AI assistant for general health information (Voiceflow integration).
- **Community Forum:** Post, reply, tag, mention, whisper, and pin messages in a real-time forum.
- **Marketplace:** Browse and purchase health and wellness products.
- **Vision & Hearing Tests:** Self-assessment tools for eye and ear health.
- **User Profiles:** View and edit user information, including user type (admin, doctor, student, etc.).
- **Dark/Light Mode:** Toggle between themes for accessibility.
- **Mobile Responsive:** Fully responsive design for all devices.

---

## Project Structure

```
/
├── forum.html
├── chat.html
├── landing.html
├── login.html
├── professionals.html
├── mkt.html
├── ear.html
├── eye.html
├── loader.html
├── cancel.html
├── success.html
├── js/
│   ├── forum.js
│   ├── chat.js
│   ├── landing.js
│   ├── mkt.js
│   ├── eye.js
│   ├── ear.js
│   ├── animations.js
│   ├── state.js
│   ├── login.js
│   └── keys.js
├── css/
│   ├── chat.css
│   ├── landing.css
│   ├── mkt.css
│   ├── animations.css
│   ├── login.css
│   └── main.css
├── firestore.rules
├── vercel.json
└── .gitignore
```

---

## Setup & Configuration

1. **Clone the repository** and install dependencies (if any).
2. **Firebase Setup:**
   - Add your Firebase project configuration in `js/keys.js`:
     ```js
     const firebaseConfig = {
       apiKey: "...",
       authDomain: "...",
       projectId: "...",
       storageBucket: "...",
       messagingSenderId: "...",
       appId: "...",
       measurementId: "...",
       databaseURL: "..."
     };
     ```
   - Set up Firestore, Authentication, and Storage in your Firebase console.
3. **Voiceflow Integration:**  
   - Configure your Voiceflow project ID and version in `js/keys.js`.
4. **Stripe Integration:**  
   - Add your Stripe publishable and secret keys in `js/keys.js` for marketplace payments.
5. **Cloudinary (optional):**  
   - Add your Cloudinary config for image uploads in `js/keys.js`.

---

## Database Schema

### **users** (Collection)
| Field      | Type   | Description                       |
|------------|--------|-----------------------------------|
| userId     | string | User UID (matches doc ID)         |
| username   | string | Display name                      |
| userType   | string | 'admin', 'doctor', 'student', etc.|

### **community_messages** (Collection)
| Field        | Type      | Description                                 |
|--------------|-----------|---------------------------------------------|
| userId       | string    | UID of the sender                           |
| username     | string    | Display name of sender                      |
| text         | string    | Message content                             |
| timestamp    | timestamp | When the message was sent                   |
| isWhisper    | boolean   | True if message is a whisper                |
| whisperTo    | string    | UID of whisper recipient (if whisper)       |
| whisperToUsername | string | Username of whisper recipient (if whisper)  |
| tags         | array     | Array of user UIDs mentioned/tagged         |
| flagged      | boolean   | True if flagged for review                  |
| images       | array     | Array of Cloudinary image URLs              |
| replyTo      | string    | ID of message being replied to (if reply)   |
| replyToUsername | string | Username of message being replied to        |

### **eye** (Collection)
| Field      | Type      | Description                       |
|------------|-----------|-----------------------------------|
| userId     | string    | UID of the user                   |
| ...        | ...       | Eye test results (custom fields)  |

### **ear** (Collection)
| Field      | Type      | Description                       |
|------------|-----------|-----------------------------------|
| userId     | string    | UID of the user                   |
| ...        | ...       | Ear test results (custom fields)  |

### **products** (Collection)
| Field      | Type      | Description                       |
|------------|-----------|-----------------------------------|
| productId  | string    | Product ID                        |
| name       | string    | Product name                      |
| price      | number    | Product price                     |
| ...        | ...       | Other product details             |

---

## Security Rules

See `firestore.rules` for full details.  
Key points:
- Only authenticated users can write to their own user document.
- Only authenticated users can create messages; only owners or admins can delete.
- Any user can flag a message.
- Only admins can create/update/delete products.
- Eye/Ear test results are private to the user and admins.

---

## Key Files & Their Roles

- **forum.html / js/forum.js:** Community forum with real-time (polling) messaging, tagging, whispering, pinning, emoji picker, and more.
- **chat.html / js/chat.js:** AI-powered health chat using Voiceflow.
- **landing.html / js/landing.js:** Main landing page, navigation, and feature highlights.
- **login.html / js/login.js:** Authentication and user onboarding.
- **professionals.html:** Directory of health professionals.
- **mkt.html / js/mkt.js:** Health marketplace.
- **eye.html / js/eye.js:** Vision self-assessment tool.
- **ear.html / js/ear.js:** Hearing self-assessment tool.
- **css/**: Custom styles for each major page and animations.

---

## Third-Party Integrations

- **Firebase:** Auth, Firestore, Storage
- **Voiceflow:** AI chat assistant
- **Stripe:** Payments for marketplace
- **Cloudinary:** (Optional) Image uploads
- **Font Awesome:** Icons (via CDN)
- **Tailwind CSS:** Utility-first styling (via CDN and custom CSS)

---

## Custom Styling

- All main pages have their own CSS in `/css/`.
- Animations and transitions are handled via `animations.css` and Tailwind.
- Font Awesome is used for icons, loaded via CDN.

---

## Contributing

1. Fork the repo and create your feature branch (`git checkout -b feature/YourFeature`).
2. Commit your changes (`git commit -am 'Add some feature'`).
3. Push to the branch (`git push origin feature/YourFeature`).
4. Open a Pull Request.

---

## License

This project is for educational and non-commercial use.  
For commercial licensing, please contact the project owner.

---

**For any questions or support, please open an issue or contact the maintainer.** 