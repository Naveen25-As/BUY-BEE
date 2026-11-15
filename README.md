# 🛒 BUY-BEE – Full-Stack E-Commerce Platform

A modern, responsive full-stack e-commerce platform for technology products, featuring secure authentication, product management, shopping cart, wishlist, order processing, and a comprehensive admin dashboard.

Built using **React, Node.js, Express.js, and Supabase PostgreSQL**.

---

## 🚀 Project Overview

BUY-BEE is a full-stack e-commerce application designed to provide a seamless online shopping experience.

Customers can browse products, manage shopping carts, place orders, track purchases, and manage their accounts. Administrators can manage products, categories, inventory, orders, customers, coupons, and reviews through a dedicated dashboard.

The application follows a client-server architecture with a React frontend, Express REST API, and Supabase PostgreSQL database.

---

## ✨ Key Features

### 👤 Customer Features

- **Authentication:** User registration, login, logout, and JWT-based authentication.
- **Password Management:** Forgot password, password reset, and change password.
- **Product Browsing:** Search, filter, sort, and paginate products.
- **Product Details:** Product images, specifications, related products, and reviews.
- **Shopping Cart:** Add products, update quantities, and manage cart items.
- **Wishlist:** Save favorite products and move items to the shopping cart.
- **Checkout:** Multi-step checkout with address, order summary, and coupon validation.
- **Payment Options:** Cash on Delivery and online payment architecture.
- **Order Management:** Order history, order details, tracking timeline, and cancellation.
- **Product Reviews:** Verified-purchase reviews with ratings and comments.
- **User Profile:** Update personal information and manage multiple delivery addresses.

### 🛠️ Admin Features

- **Admin Dashboard:** Analytics for revenue, orders, customers, and products.
- **Product Management:** Create, update, view, and deactivate products.
- **Category Management:** Manage product categories.
- **Order Management:** View orders and update order statuses.
- **User Management:** View customers and manage account status and roles.
- **Inventory Management:** Monitor stock levels and low-stock products.
- **Coupon Management:** Create, update, activate, and deactivate discount coupons.
- **Review Moderation:** Manage and moderate customer reviews.
- **Role-Based Access:** Protected administrative functionality.

---

## 💻 Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React 19, Vite, React Router |
| Styling | Tailwind CSS v4, CSS |
| Backend | Node.js, Express.js |
| Database | Supabase PostgreSQL |
| Authentication | JWT, bcrypt |
| API Communication | Axios, REST API |
| Security | Helmet, CORS, Rate Limiting |
| Notifications | React Hot Toast |
| Charts | Recharts |
| Development Tools | Git, GitHub, npm |
| Deployment Options | Vercel, Render, Railway |

---

## 🏗️ Application Architecture

```text
             CUSTOMER / ADMIN
                    |
                    |
             React Frontend
                (Vite)
                    |
                    |
                Axios
                    |
                    |
             Express REST API
                    |
          ---------------------
          |         |         |
       Routes   Middleware  Controllers
          |         |         |
          ---------------------
                    |
                    |
             Supabase Client
                    |
                    |
           Supabase PostgreSQL
```

The frontend communicates with the backend through REST APIs. The backend handles authentication, authorization, business logic, and database operations.

The Supabase service role key is used exclusively on the server side and must never be exposed to the frontend.

---

## 📁 Project Structure

```text
BUY-BEE/
│
├── client/                      # React frontend
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── context/
│   │   ├── layouts/
│   │   ├── pages/
│   │   │   └── admin/
│   │   └── utils/
│   ├── .env.example
│   └── package.json
│
├── server/                      # Express backend
│   ├── scripts/
│   ├── src/
│   │   ├── config/
│   │   ├── db/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── seed/
│   │   └── utils/
│   ├── supabase/
│   │   ├── local/
│   │   └── migrations/
│   ├── tests/
│   ├── .env.example
│   └── package.json
│
├── DEPLOYMENT.md
├── SUPABASE_SETUP.md
├── package.json
├── package-lock.json
└── README.md
```

---

## ⚙️ Installation and Setup

### Prerequisites

Make sure you have installed:

- Node.js 20 or later
- npm
- Git
- A Supabase project
- Code editor (VS Code recommended)

### 1. Clone the Repository

```bash
git clone https://github.com/Naveen25-As/BUY-BEE.git
```

Navigate into the project:

```bash
cd BUY-BEE
```

### 2. Install Dependencies

Install root dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
npm install --prefix server
```

Install frontend dependencies:

```bash
npm install --prefix client
```

### 3. Configure Supabase

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Execute the migration files in the correct order:

```text
server/supabase/migrations/
    0001_initial_schema.sql
    0002_functions.sql
    0003_security.sql
```

For additional instructions, refer to `SUPABASE_SETUP.md`.

### 4. Configure Environment Variables

Create the backend environment file:

```bash
copy server\.env.example server\.env
```

Create the frontend environment file:

```bash
copy client\.env.example client\.env
```

Configure the backend `server/.env`:

```env
PORT=5000
NODE_ENV=development

SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

JWT_SECRET=YOUR_STRONG_RANDOM_SECRET
JWT_EXPIRES_IN=7d

CLIENT_URL=http://localhost:5173

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=YOUR_EMAIL
SMTP_PASS=YOUR_EMAIL_APP_PASSWORD
EMAIL_FROM=noreply@buybee.com
```

Configure the frontend `client/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

**Security Note:** Never commit actual `.env` files, database credentials, service role keys, SMTP passwords, or JWT secrets to GitHub.

### 5. Seed the Database

Run the database seed command:

```bash
npm run seed
```

The seed script should populate the database with the initial application data.

Use only local development accounts for testing. Never reuse development credentials in production.

### 6. Start the Application

Start the frontend and backend:

```bash
npm run dev
```

Alternatively, start them separately:

Backend:

```bash
npm run dev:server
```

Frontend:

```bash
npm run dev:client
```

### Local Development URLs

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:5000 |
| API Base URL | http://localhost:5000/api |

---

## 🔌 API Documentation

The backend exposes RESTful API endpoints.

| Module | Base Endpoint | Functionality |
|---|---|---|
| Authentication | `/api/auth` | Registration, login, password management |
| Products | `/api/products` | Product browsing and management |
| Categories | `/api/categories` | Category management |
| Cart | `/api/cart` | Shopping cart operations |
| Wishlist | `/api/wishlist` | Wishlist management |
| Orders | `/api/orders` | Order creation and tracking |
| Users | `/api/users` | User profiles and addresses |
| Reviews | `/api/reviews` | Product reviews and moderation |
| Coupons | `/api/coupons` | Discount coupon management |
| Admin | `/api/admin` | Dashboard and inventory management |

Protected endpoints require authentication. Administrative endpoints additionally require appropriate authorization.

---

## 🔐 Security Features

BUY-BEE incorporates several backend security mechanisms:

- Password hashing using bcrypt.
- JWT-based authentication.
- Role-based authorization.
- Protected administrative routes.
- Express Helmet security headers.
- CORS configuration.
- API rate limiting.
- Request validation using express-validator.
- Centralized error handling.
- Server-side Supabase credentials.
- PostgreSQL constraints and database security policies.
- Secure separation of frontend and backend environment variables.

---

## 🚀 Deployment

The application can be deployed using the following services.

### Frontend – Vercel

Recommended configuration:

```text
Root Directory: client
Build Command: npm run build
```

Environment variable:

```env
VITE_API_URL=https://YOUR_BACKEND_URL/api
```

### Backend – Render / Railway

Recommended configuration:

```text
Root Directory: server
Start Command: npm start
```

Required environment variables:

```env
PORT
NODE_ENV
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET
CLIENT_URL
```

### Database – Supabase

1. Create a Supabase project.
2. Execute the SQL migrations.
3. Configure the backend environment variables.
4. Verify database connectivity.
5. Test authentication and database operations.

Refer to `DEPLOYMENT.md` for detailed deployment instructions.

---

## 🧪 Testing

The project includes an API test suite under:

```text
server/tests/api.test.js
```

Run the tests using the scripts configured in the backend package.

### Customer Testing Checklist

- [ ] User registration and login
- [ ] Product browsing and searching
- [ ] Product filtering and sorting
- [ ] Shopping cart operations
- [ ] Wishlist operations
- [ ] Coupon validation
- [ ] Checkout and order creation
- [ ] Order history and tracking
- [ ] Order cancellation
- [ ] Product reviews
- [ ] Profile and address management

### Admin Testing Checklist

- [ ] Admin authentication
- [ ] Dashboard analytics
- [ ] Product management
- [ ] Category management
- [ ] Order management
- [ ] User management
- [ ] Inventory management
- [ ] Coupon management
- [ ] Review moderation

---

## 🔮 Future Enhancements

- Razorpay / Stripe payment gateway integration.
- Automated order confirmation emails.
- Cloudinary or AWS S3 product image uploads.
- Advanced product recommendations.
- Real-time order tracking.
- Google and social authentication.
- Multi-language support.
- Mobile application using React Native.
- Advanced business analytics.

---

## 🤝 Contributing

Contributions, suggestions, and improvements are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Push your branch.
5. Submit a Pull Request.

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 👨‍💻 Developer

**Naveen Asundi**

BCA Student | Aspiring Software Developer

- GitHub: [Naveen25-As](https://github.com/Naveen25-As)
- Project: [BUY-BEE](https://github.com/Naveen25-As/BUY-BEE)

---

<p align="center">
  <b>BUY-BEE – Your Smart Shopping Destination 🛒</b>
  <br>
  Built with React, Node.js, Express.js and Supabase.
</p>
