# MongoDB Setup for BUY BEE

The BUY BEE application requires MongoDB to run. You have two options:

## Option 1: MongoDB Atlas (Recommended - Cloud)

1. **Create a free MongoDB Atlas account:**
   - Go to https://www.mongodb.com/cloud/atlas
   - Sign up for a free account

2. **Create a cluster:**
   - Click "Build a Database"
   - Choose "Free" tier (M0)
   - Select a region close to you
   - Name your cluster (e.g., "buybee-cluster")
   - Click "Create"

3. **Set up database access:**
   - Click "Database Access" in the left sidebar
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Create a username and password (save these!)
   - Click "Create User"

4. **Set up network access:**
   - Click "Network Access" in the left sidebar
   - Click "Add IP Address"
   - Choose "Allow Access from Anywhere" (0.0.0.0/0)
   - Click "Confirm"

5. **Get your connection string:**
   - Click "Database" in the left sidebar
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Select Node.js version
   - Copy the connection string

6. **Update your server/.env file:**
   ```env
   MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster0.mongodb.net/buybee?retryWrites=true&w=majority
   ```
   Replace `YOUR_USERNAME` and `YOUR_PASSWORD` with your actual credentials.

## Option 2: Local MongoDB Installation

### Windows:
1. Download MongoDB Community Server from https://www.mongodb.com/try/download/community
2. Run the installer and choose "Complete" setup
3. MongoDB will be installed as a Windows service
4. Start MongoDB from Services or run: `net start MongoDB`

### After Installation:
The project is already configured to use local MongoDB at:
```
mongodb://127.0.0.1:27017/buybee
```

## Verify MongoDB Connection

Once MongoDB is set up, test the connection:

```bash
cd server
npm run seed
```

This will populate the database with sample products, categories, users, and coupons.

## Troubleshooting

**If MongoDB Atlas connection fails:**
- Verify your IP address is whitelisted
- Check that your username/password are correct
- Ensure your cluster is active (not paused)

**If local MongoDB fails:**
- Check that MongoDB service is running
- Verify the connection string matches your installation
- Check Windows Firewall settings
