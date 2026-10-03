# BUY BEE

Modern full-stack e-commerce platform for technology products — built with React, Node.js, Express, and MongoDB.

## Features

### Customer Features
- **Authentication:** Registration, login, logout with JWT
- **Password Management:** Forgot password, reset password, change password
- **Product Browsing:** Browse, search, filter, sort, and paginate products
- **Product Details:** Image gallery, specifications, related products, reviews
- **Wishlist:** Add/remove products, move to cart, duplicate prevention
- **Shopping Cart:** Add items, quantity management, stock validation, real-time totals
- **Checkout:** Multi-step checkout (address → summary → coupon → payment → confirm)
- **Payment Methods:** Cash on Delivery, online payment architecture
- **Orders:** Order history, detailed tracking timeline, order cancellation
- **Reviews:** Verified purchase reviews with star ratings and comments
- **Profile:** Edit profile, manage multiple addresses, change password

### Admin Features
- **Secure Admin Panel:** Role-based access control
- **Dashboard Analytics:** Real-time MongoDB-based analytics (revenue, orders, customers, products)
- **Product Management:** Create, read, update, delete products with search
- **Category Management:** Full CRUD operations for product categories
- **Order Management:** View, search, filter, and update order status
- **User Management:** View users, manage roles and account status
- **Inventory Management:** Stock monitoring, low-stock alerts, bulk updates
- **Coupon Management:** Create, edit, delete, activate/deactivate coupons
- **Review Moderation:** Approve, hide, or delete customer reviews

## Tech Stack

| Layer | Technology |
|--------|------------|
| **Frontend** | React 19, Vite, React Router, Tailwind CSS v4, Axios, Recharts, React Hot Toast |
| **Backend** | Node.js, Express.js, JWT, bcrypt, helmet, cors, rate limiting |
| **Database** | MongoDB, Mongoose |
| **DevOps** | Vercel (frontend), Render/Railway (backend), MongoDB Atlas (database) |

## Project Structure

```
Buybee/
├── client/                    # React frontend application
│   ├── src/
│   │   ├── api/              # Axios client and API configuration
│   │   ├── components/       # Reusable components (Navbar, Footer, ProductCard, etc.)
│   │   ├── context/          # React Context (AuthContext)
│   │   ├── layouts/          # Layout components (MainLayout, AdminLayout)
│   │   ├── pages/            # Page components (Home, Products, Cart, etc.)
│   │   │   └── admin/        # Admin pages (Dashboard, Products, Orders, etc.)
│   │   ├── utils/            # Utility functions (formatting)
│   │   ├── App.jsx           # Main app component with routing
│   │   └── index.css         # Global styles and Tailwind config
│   ├── public/               # Static assets
│   ├── .env.example          # Environment variables template
│   ├── package.json          # Frontend dependencies
│   └── vite.config.js        # Vite configuration
├── server/                   # Express backend API
│   ├── src/
│   │   ├── config/           # Database configuration
│   │   ├── middleware/       # Custom middleware (auth, error handling)
│   │   ├── models/           # Mongoose models (User, Product, Order, etc.)
│   │   ├── routes/           # API routes (auth, products, orders, etc.)
│   │   ├── seed/             # Database seeding script
│   │   ├── utils/            # Utility functions (token generation, order helpers)
│   │   └── index.js          # Server entry point
│   ├── .env.example          # Environment variables template
│   └── package.json          # Backend dependencies
├── images/                   # Original BUY BEE assets
├── *.html                    # Legacy static pages (preserved for reference)
├── MONGODB_SETUP.md          # MongoDB setup guide
├── DEPLOYMENT.md             # Deployment guide
├── .gitignore                # Git ignore rules
├── package.json              # Root package.json with scripts
└── README.md                 # This file
```

## Installation

### Prerequisites
- Node.js 18+ 
- MongoDB (local installation or MongoDB Atlas account)
- Git

### Local Development Setup

1. **Clone the repository:**
   [```bash
   git clone <(https://github.com/Naveen25-As/BUY-BEE)>
   cd Buybee
   ```]

2. **Install dependencies:**
   ```bash
   npm install
   npm install --prefix server
   npm install --prefix client
   ```

3. **Set up MongoDB:**
   - Follow the instructions in `MONGODB_SETUP.md`
   - Either install MongoDB locally or set up MongoDB Atlas

4. **Configure environment variables:**
   ```bash
   # Copy environment templates
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   
   # Edit server/.env with your MongoDB URI and JWT secret
   # Edit client/.env with your API URL (usually http://localhost:5000/api)
   ```

5. **Seed the database:**
   ```bash
   npm run seed
   ```

6. **Start the development servers:**
   ```bash
   # Start both frontend and backend
   npm run dev
   
   # Or start individually:
   npm run dev:server  # Backend on http://localhost:5000
   npm run dev:client  # Frontend on http://localhost:5173
   ```

### Demo Accounts (after seeding)

| Role | Email | Password |
|------|--------|----------|
| Admin | admin@buybee.com | Admin@12345 |
| Customer | customer@buybee.com | Customer@123 |

### Demo Coupons
- `WELCOME10` - 10% off for new customers (min ₹999)
- `FLAT500` - Flat ₹500 off on orders above ₹5000

## Environment Variables

### Server (`server/.env`)
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/buybee
JWT_SECRET=your_long_random_secret_at_least_32_characters
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
SMTP_HOST=smtp.gmail.com  # Optional for password reset emails
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@buybee.com
```

### Client (`client/.env`)
```env
VITE_API_URL=http://localhost:5000/api
```

## API Documentation

### Authentication (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - Login user
- `GET /me` - Get current user (protected)
- `POST /forgot-password` - Request password reset
- `PUT /reset-password/:token` - Reset password
- `PUT /change-password` - Change password (protected)

### Products (`/api/products`)
- `GET /` - List products with filtering, sorting, pagination
- `GET /brands` - Get all product brands
- `GET /:id/related` - Get related products
- `GET /:id` - Get single product details
- `POST /` - Create product (admin only)
- `PUT /:id` - Update product (admin only)
- `DELETE /:id` - Deactivate product (admin only)

### Categories (`/api/categories`)
- `GET /` - List categories
- `POST /` - Create category (admin only)
- `PUT /:id` - Update category (admin only)
- `DELETE /:id` - Delete category (admin only)

### Cart (`/api/cart`)
- `GET /` - Get user cart (protected)
- `POST /items` - Add item to cart (protected)
- `PATCH /items/:itemId` - Update item quantity (protected)
- `DELETE /items/:itemId` - Remove item from cart (protected)
- `DELETE /` - Clear cart (protected)

### Wishlist (`/api/wishlist`)
- `GET /` - Get user wishlist (protected)
- `POST /:productId` - Add to wishlist (protected)
- `DELETE /:productId` - Remove from wishlist (protected)
- `POST /:productId/move-to-cart` - Move to cart (protected)

### Orders (`/api/orders`)
- `POST /` - Create order (protected)
- `GET /my` - Get user orders (protected)
- `GET /:id` - Get order details (protected)
- `POST /:id/cancel` - Cancel order (protected)
- `PATCH /:id/status` - Update order status (admin only)
- `GET /` - Get all orders (admin only)

### Users (`/api/users`)
- `PUT /profile` - Update profile (protected)
- `POST /addresses` - Add address (protected)
- `PUT /addresses/:addressId` - Update address (protected)
- `DELETE /addresses/:addressId` - Delete address (protected)
- `GET /` - Get all users (admin only)
- `PATCH /:id/status` - Update user status (admin only)

### Reviews (`/api/reviews`)
- `GET /product/:productId` - Get product reviews
- `POST /` - Submit review (protected, verified purchase only)
- `GET /` - Get all reviews (admin only)
- `PATCH /:id/moderate` - Moderate review (admin only)
- `DELETE /:id` - Delete review (admin only)

### Coupons (`/api/coupons`)
- `POST /validate` - Validate coupon (protected)
- `GET /` - Get all coupons (admin only)
- `POST /` - Create coupon (admin only)
- `PUT /:id` - Update coupon (admin only)
- `DELETE /:id` - Delete coupon (admin only)

### Admin (`/api/admin`)
- `GET /dashboard` - Get dashboard analytics (admin only)
- `GET /inventory` - Get inventory (admin only)
- `PATCH /inventory/:id` - Update stock (admin only)

## Security Features

- **Password Hashing:** All passwords hashed with bcrypt (12 rounds)
- **JWT Authentication:** Secure token-based authentication
- **Role-Based Authorization:** Admin routes protected with role checks
- **Rate Limiting:** Protection against brute force attacks
- **CORS Configuration:** Proper cross-origin resource sharing
- **Helmet:** Security headers for Express
- **MongoDB Sanitization:** Protection against NoSQL injection
- **Input Validation:** Request validation with express-validator
- **Error Handling:** Global error handling without exposing stack traces

## Deployment

For detailed deployment instructions, see `DEPLOYMENT.md`.

### Quick Deployment Summary

**Frontend (Vercel):**
- Root directory: `client`
- Build command: `npm run build`
- Environment: `VITE_API_URL=https://your-backend-url/api`

**Backend (Render/Railway):**
- Root directory: `server`
- Start command: `npm start`
- Environment: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`

**Database (MongoDB Atlas):**
- Set up free M0 cluster
- Configure IP whitelist
- Get connection string

## Performance Optimizations

- **Frontend:**
  - Lazy loading images with `loading="lazy"` and `decoding="async"`
  - Optimized bundle with Vite
  - Code splitting with React Router
  - Responsive design with Tailwind CSS

- **Backend:**
  - MongoDB connection pooling
  - Indexed database queries
  - Rate limiting to prevent abuse
  - Efficient aggregation pipelines for analytics

- **Database:**
  - Proper indexes on frequently queried fields
  - Text search for product search
  - Connection pooling for better performance

## Testing

### Manual Testing Checklist

**Customer Flow:**
- [ ] Register new account
- [ ] Login with credentials
- [ ] Browse products
- [ ] Search for products
- [ ] Filter by category, brand, price
- [ ] Sort products
- [ ] View product details
- [ ] Add to wishlist
- [ ] Add to cart
- [ ] Update cart quantity
- [ ] Remove from cart
- [ ] Apply coupon code
- [ ] Complete checkout
- [ ] View order history
- [ ] Track order status
- [ ] Cancel order
- [ ] Submit product review
- [ ] Update profile
- [ ] Manage addresses
- [ ] Change password
- [ ] Logout

**Admin Flow:**
- [ ] Admin login
- [ ] View dashboard analytics
- [ ] Create product
- [ ] Edit product
- [ ] Deactivate product
- [ ] Create category
- [ ] Manage inventory
- [ ] View orders
- [ ] Update order status
- [ ] View users
- [ ] Manage user status
- [ ] Create coupon
- [ ] Moderate reviews
- [ ] View low stock alerts

## Troubleshooting

### Common Issues

**MongoDB Connection Failed:**
- Verify MongoDB is running or Atlas connection string is correct
- Check IP whitelist in MongoDB Atlas
- Ensure database user has correct permissions

**CORS Errors:**
- Verify `CLIENT_URL` in backend matches frontend URL
- Check CORS configuration in `server/src/index.js`

**Authentication Issues:**
- Verify `JWT_SECRET` is set and consistent
- Check token expiration settings
- Clear browser localStorage if needed

**Build Errors:**
- Ensure all dependencies are installed
- Check Node.js version compatibility
- Verify environment variables are set

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software. All rights reserved.

## Support

For issues and questions:
- Check the documentation in `MONGODB_SETUP.md` and `DEPLOYMENT.md`
- Review the API documentation above
- Check the troubleshooting section

## Future Enhancements

- Payment gateway integration (Razorpay/Stripe)
- Email notifications for orders and password resets
- Product image upload functionality (Cloudinary/S3)
- Advanced search with Elasticsearch
- Real-time order tracking with WebSocket
- Mobile app development (React Native)
- Advanced analytics and reporting
- Multi-language support
- Currency conversion
- Social login integration (Google, Facebook)
- Product recommendations based on browsing history
