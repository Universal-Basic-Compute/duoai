module.exports = {
  // Development URL (for local testing)
  devApiUrl: 'http://localhost:3000',
  
  // Production URL (your Vercel deployment)
  prodApiUrl: 'https://duoai.vercel.app',
  
  // Set this to true for production builds
  isProduction: process.env.NODE_ENV === 'production'
};
