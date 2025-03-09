document.addEventListener('DOMContentLoaded', function() {
  // Find all elements with the class 'site-header'
  const headerContainers = document.querySelectorAll('.site-header');
  
  if (headerContainers.length > 0) {
    // Insert the header HTML into each container
    headerContainers.forEach(container => {
      container.innerHTML = `
        <div class="container">
            <div class="logo">
                <h1>DUO<span>AI</span></h1>
            </div>
            <nav>
                <ul>
                    <li><a href="index.html#features">Features</a></li>
                    <li><a href="index.html#architecture">Technology</a></li>
                    <li><a href="index.html#roadmap">Roadmap</a></li>
                    <li><a href="quests.html">Quests</a></li>
                    <li><a href="pricing.html" class="btn-secondary">Pricing</a></li>
                    <li><a href="download.html" class="btn-primary">Download</a></li>
                </ul>
            </nav>
            <div class="menu-toggle">
                <i class="fas fa-bars"></i>
            </div>
        </div>
      `;
    });
    
    // Add mobile menu toggle functionality
    const menuToggles = document.querySelectorAll('.menu-toggle');
    menuToggles.forEach(toggle => {
      toggle.addEventListener('click', function() {
        const nav = this.parentElement.querySelector('nav');
        nav.classList.toggle('active');
      });
    });
  }
});
