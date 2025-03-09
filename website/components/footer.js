document.addEventListener('DOMContentLoaded', function() {
  // Find all elements with the class 'site-footer'
  const footerContainers = document.querySelectorAll('.site-footer');
  
  if (footerContainers.length > 0) {
    console.log('Found footer containers:', footerContainers.length);
    // Insert the footer HTML into each container
    footerContainers.forEach(container => {
      container.innerHTML = `
        <div class="container">
            <div class="footer-grid">
                <div class="footer-col">
                    <div class="footer-logo">
                        <h2>DUO<span>AI</span></h2>
                    </div>
                    <p>The next evolution in gaming assistance technology.</p>
                    <div class="social-icons">
                        <a href="#"><i class="fab fa-twitter"></i></a>
                        <a href="#"><i class="fab fa-discord"></i></a>
                        <a href="#"><i class="fab fa-youtube"></i></a>
                        <a href="#"><i class="fab fa-twitch"></i></a>
                    </div>
                </div>
                
                <div class="footer-col">
                    <h3>Product</h3>
                    <ul>
                        <li><a href="index.html#features">Features</a></li>
                        <li><a href="quests.html">Quests</a></li>
                        <li><a href="pricing.html">Pricing</a></li>
                        <li><a href="download.html">Download</a></li>
                    </ul>
                </div>
                
                <div class="footer-col">
                    <h3>Resources</h3>
                    <ul>
                        <li><a href="#">Documentation</a></li>
                        <li><a href="#">API</a></li>
                        <li><a href="#">Community</a></li>
                        <li><a href="#">Blog</a></li>
                    </ul>
                </div>
                
                <div class="footer-col">
                    <h3>Company</h3>
                    <ul>
                        <li><a href="about.html">About Us</a></li>
                        <li><a href="careers.html">Careers</a></li>
                        <li><a href="contact.html">Contact</a></li>
                        <li><a href="press-kit.html">Press Kit</a></li>
                    </ul>
                </div>
            </div>
            
            <div class="footer-bottom">
                <p>&copy; ${new Date().getFullYear()} DUOAI. All rights reserved.</p>
                <div class="footer-links">
                    <a href="#">Privacy Policy</a>
                    <a href="#">Terms of Service</a>
                </div>
            </div>
        </div>
      `;
      console.log('Footer HTML inserted');
    });
  } else {
    console.warn('No footer containers found with class "site-footer"');
  }
});
