# Bharat Museum Tickets - Production Deployment Checklist

## ⚠️ CRITICAL: Before Deploying to Production

### 1. Environment Variables

#### Client (.env)
- [ ] Remove any fallback/default credentials
- [ ] Update `VITE_API_BASE_URL` to production API URL
- [ ] Verify all Firebase credentials are for production project
- [ ] Never expose `.env` file publicly

#### Server (.env)
- [ ] **CRITICAL**: Change `JWT_SECRET` to a strong random value (min 64 characters)
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- [ ] Update `CLIENT_URL` to production frontend URL
- [ ] Update `CHATBOT_ENGINE_URL` to production chatbot URL
- [ ] Use production Firebase Admin SDK credentials
- [ ] Verify `FIREBASE_PRIVATE_KEY` has proper newlines

#### Chatbot (.env)
- [ ] Set `FLASK_ENV=production`
- [ ] Set `DEBUG=False`
- [ ] Update `PORT` if needed

### 2. Security

- [ ] Enable HTTPS/SSL for all services
- [ ] Review and adjust rate limiting values in `rateLimiter.js`
- [ ] Set up Firebase Security Rules properly
- [ ] Enable Firebase App Check (recommended)
- [ ] Review CORS origins in `server.js`
- [ ] Scan dependencies for vulnerabilities:
  ```bash
  npm audit
  pip check
  ```

### 3. Firebase Configuration

- [ ] Firestore indexes created (check `firestore.indexes.json`)
- [ ] Firestore Security Rules deployed
- [ ] Realtime Database Security Rules configured
- [ ] Authentication providers configured
- [ ] Billing enabled (important for production traffic)
- [ ] Monitoring and alerts set up

### 4. Performance

- [ ] Build client for production: `npm run build`
- [ ] Optimize images and assets
- [ ] Enable compression middleware on server
- [ ] Set up CDN for static assets
- [ ] Configure caching headers
- [ ] Database query optimization

### 5. Monitoring & Logging

- [ ] Set up error tracking (e.g., Sentry)
- [ ] Configure server logging to file
- [ ] Set up uptime monitoring
- [ ] Configure Firebase Analytics
- [ ] Set up performance monitoring

### 6. Testing

- [ ] Run all unit tests
- [ ] Perform load testing
- [ ] Test all API endpoints
- [ ] Test authentication flows
- [ ] Test booking creation and retrieval
- [ ] Test chatbot functionality
- [ ] Cross-browser testing
- [ ] Mobile responsiveness testing

### 7. Deployment

#### Client (Vite React App)
Options:
- Vercel (recommended)
- Netlify
- Firebase Hosting
- AWS S3 + CloudFront

```bash
cd client
npm run build
# Deploy dist/ folder
```

#### Server (Node.js API)
Options:
- Railway
- Heroku
- AWS EC2/ECS
- Google Cloud Run
- DigitalOcean

```bash
cd server
# Ensure all production dependencies are installed
npm install --production
node server.js
```

#### Chatbot (Python Flask)
Options:
- Railway
- Heroku
- AWS EC2
- Google Cloud Run
- PythonAnywhere

```bash
cd chatbot-engine
pip install -r requirements.txt
gunicorn -w 4 -b 0.0.0.0:5001 app:app
# or
python app.py
```

### 8. Post-Deployment

- [ ] Verify all services are running
- [ ] Test complete user flow end-to-end
- [ ] Check server logs for errors
- [ ] Monitor performance metrics
- [ ] Set up automated backups for database
- [ ] Document rollback procedures

### 9. Domain & DNS

- [ ] Configure custom domain
- [ ] Set up DNS records
- [ ] Configure SSL certificates
- [ ] Update environment variables with production URLs

### 10. Compliance

- [ ] Add Privacy Policy
- [ ] Add Terms of Service
- [ ] GDPR compliance (if applicable)
- [ ] Cookie consent (if applicable)
- [ ] Accessibility compliance

## 🔍 Environment Variables Checklist

### Must Change
- `JWT_SECRET` - **CRITICAL**
- `CLIENT_URL`
- `VITE_API_BASE_URL`
- `CHATBOT_ENGINE_URL` (if deploying separately)

### Must Verify
- All Firebase credentials
- Port numbers
- Debug/production modes

## 🚨 Common Deployment Issues

### Issue: CORS Errors
**Solution**: Update `CLIENT_URL` in server `.env` to match production frontend URL

### Issue: Firebase Connection Failed
**Solution**: Verify Firebase credentials and ensure production project is active

### Issue: Rate Limiting Too Aggressive
**Solution**: Adjust values in `server/middleware/rateLimiter.js`

### Issue: Environment Variables Not Loading
**Solution**: Ensure `.env` files exist and are properly formatted (no quotes around values unless needed)

## 📊 Performance Targets

- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- API Response Time: < 500ms
- Chatbot Response Time: < 2s
- Lighthouse Score: > 90

## 🔐 Security Targets

- All traffic over HTTPS
- Strong JWT secrets (min 64 chars)
- Rate limiting enabled
- Input validation on all endpoints
- No hardcoded credentials in code
- Regular dependency updates

## ✅ Final Checklist

- [ ] All `.env` files configured correctly
- [ ] Production builds tested locally
- [ ] Security audit completed
- [ ] Performance optimization verified
- [ ] Error tracking configured
- [ ] Backups configured
- [ ] Monitoring active
- [ ] DNS configured
- [ ] SSL certificates active
- [ ] All services deployed and running
- [ ] End-to-end testing completed
- [ ] Documentation updated

---

**Only proceed with deployment after ALL items are checked!**

## 📞 Emergency Contact

Keep these handy during deployment:
- Firebase Console: https://console.firebase.google.com
- Deployment platform dashboard
- DNS provider
- SSL certificate provider

Good luck with your deployment! 🚀
