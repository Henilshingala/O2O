| Category                    | Technology / Solution                                                      | Purpose                                                                         |
| --------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Architecture**            | Monorepo (pnpm Workspaces)                                                 | Manage Mobile, Web, Backend, Shared Libraries in one repository                 |
| **Mobile Framework**        | React Native CLI                                                           | Native Android & iOS application                                                |
| **Web Framework**           | React + React Native Web                                                   | Web application from the same codebase                                          |
| **Backend Framework**       | Node.js + Express.js                                                       | REST APIs, Authentication, Business Logic                                       |
| **Runtime**                 | Node.js (LTS)                                                              | Backend runtime environment                                                     |
| **Package Manager**         | pnpm                                                                       | Fast and efficient dependency management                                        |
| **API Architecture**        | REST API                                                                   | Communication between frontend and backend                                      |
| **Real-time Communication** | Socket.IO                                                                  | Real-time chat, typing indicators, online status, notifications                 |
| **Database**                | PostgreSQL                                                                 | Primary relational database                                                     |
| **ORM**                     | Drizzle ORM                                                                | Type-safe database access and migrations                                        |
| **Database Hosting**        | Neon PostgreSQL                                                            | Cloud-hosted PostgreSQL database                                                |
| **Authentication**          | JWT (Access + Refresh Tokens)                                              | Secure user authentication                                                      |
| **Authorization**           | Role-Based Access Control (RBAC)                                           | User/Admin/Seller/Buyer permissions                                             |
| **State Management**        | React Context API                                                          | Global application state                                                        |
| **Server State**            | TanStack React Query                                                       | API caching, synchronization, optimistic updates                                |
| **Media Storage**           | Cloudinary                                                                 | Image and video hosting                                                         |
| **File Upload**             | Multer + FormData                                                          | Multipart file uploads                                                          |
| **Image Picker**            | react-native-image-picker                                                  | Gallery image selection                                                         |
| **Camera**                  | react-native-image-picker                                                  | Capture photos                                                                  |
| **Video Recording**         | react-native-image-picker                                                  | Record videos                                                                   |
| **Location Services**       | react-native-geolocation-service                                           | Access device GPS                                                               |
| **Maps Integration**        | Google Maps / Apple Maps (Linking API)                                     | Open shared locations                                                           |
| **Push Notifications**      | Firebase Cloud Messaging (FCM)                                             | Background and push notifications                                               |
| **Email Service**           | Nodemailer                                                                 | Email delivery                                                                  |
| **OTP Service**             | Nodemailer + Secure OTP Backend                                            | Email verification and password reset                                           |
| **Caching**                 | React Query (Current) • Redis (Future)                                     | API cache now, server cache later                                               |
| **Background Jobs**         | BullMQ (Future)                                                            | Notifications, scheduled jobs, queues                                           |
| **Validation**              | Zod                                                                        | Request and schema validation                                                   |
| **Environment Management**  | dotenv                                                                     | Environment variable management                                                 |
| **Logging**                 | Pino + pino-http                                                           | Structured backend logging                                                      |
| **Security Headers**        | Helmet                                                                     | Secure HTTP headers                                                             |
| **Rate Limiting**           | express-rate-limit                                                         | Protect APIs against abuse                                                      |
| **Password Hashing**        | Node.js Crypto (scrypt)                                                    | Secure password storage                                                         |
| **Admin Panel**             | React Admin Panel                                                          | Application administration and database management                              |
| **Charts & Analytics**      | react-native-svg + Backend Analytics APIs                                  | Dashboards and reports                                                          |
| **Web Bundler**             | Vite                                                                       | Fast web development and production builds                                      |
| **Backend Bundler**         | ESBuild                                                                    | Backend compilation and optimization                                            |
| **Android Build System**    | Gradle                                                                     | Android builds (APK/AAB)                                                        |
| **iOS Build System**        | Xcode + CocoaPods                                                          | iOS builds                                                                      |
| **Backend Deployment**      | Render                                                                     | Express.js hosting                                                              |
| **Web Deployment**          | Render                                                                     | Web application hosting                                                         |
| **Android Distribution**    | Google Play Console                                                        | Android release distribution                                                    |
| **iOS Distribution**        | Apple App Store / TestFlight                                               | iOS release distribution                                                        |
| **CI/CD**                   | GitHub Actions (Recommended)                                               | Automated build, test, and deployment                                           |
| **Testing**                 | Jest + React Native Testing Library + Supertest + Playwright (Recommended) | Unit, API, mobile, and web testing                                              |
| **Code Quality**            | TypeScript (Strict Mode)                                                   | Type safety and maintainability                                                 |
| **Linting**                 | ESLint                                                                     | Static code analysis                                                            |
| **Formatting**              | Prettier                                                                   | Consistent code formatting                                                      |
| **Version Control**         | Git + GitHub                                                               | Source code management                                                          |
| **Future Scalability**      | Redis + BullMQ                                                             | High-performance caching, queues, background processing, and scalable Socket.IO |
