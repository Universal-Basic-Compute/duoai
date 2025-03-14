// Load header and footer components
function loadComponents() {
  console.log('Loading components...');
  
  // Load header component
  const headerScript = document.createElement('script');
  headerScript.src = 'components/header.js';
  headerScript.onload = () => console.log('Header script loaded');
  headerScript.onerror = (e) => console.error('Error loading header script:', e);
  document.head.appendChild(headerScript);
  
  // Load footer component with a slight delay to ensure DOM is ready
  setTimeout(() => {
    const footerScript = document.createElement('script');
    footerScript.src = 'components/footer.js';
    footerScript.onload = () => console.log('Footer script loaded');
    footerScript.onerror = (e) => console.error('Error loading footer script:', e);
    document.head.appendChild(footerScript);
  }, 100);
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing components');
    // Load components
    loadComponents();
    
    // Mobile menu toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('nav');
    
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            nav.classList.toggle('active');
        });
    }
    
    // Pricing toggle
    const billingToggle = document.getElementById('billing-toggle');
    if (billingToggle) {
        billingToggle.addEventListener('change', function() {
            const monthlyPrices = document.querySelectorAll('.monthly');
            const annualPrices = document.querySelectorAll('.annually');
            
            monthlyPrices.forEach(price => {
                price.style.display = this.checked ? 'none' : 'inline';
            });
            
            annualPrices.forEach(price => {
                price.style.display = this.checked ? 'inline' : 'none';
            });
        });
    }
    
    // FAQ accordion
    const faqItems = document.querySelectorAll('.faq-item');
    if (faqItems.length > 0) {
        faqItems.forEach(item => {
            const question = item.querySelector('.faq-question');
            question.addEventListener('click', () => {
                // Close all other items
                faqItems.forEach(otherItem => {
                    if (otherItem !== item) {
                        otherItem.classList.remove('active');
                    }
                });
                
                // Toggle current item
                item.classList.toggle('active');
            });
        });
    }
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            if (this.getAttribute('href') !== '#') {
                e.preventDefault();
                
                const targetId = this.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                
                if (targetElement) {
                    // Close mobile menu if open
                    if (nav.classList.contains('active')) {
                        nav.classList.remove('active');
                    }
                    
                    window.scrollTo({
                        top: targetElement.offsetTop - 100,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
    
    // Animate elements on scroll
    const animateOnScroll = () => {
        const elements = document.querySelectorAll('.feature-card, .platform-item, .roadmap-item');
        
        elements.forEach(element => {
            const elementPosition = element.getBoundingClientRect().top;
            const screenPosition = window.innerHeight / 1.2;
            
            if (elementPosition < screenPosition) {
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }
        });
    };
    
    // Run on load
    animateOnScroll();
    
    // Run on scroll
    window.addEventListener('scroll', animateOnScroll);
    
    // Form submission handling
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Simple validation
            let valid = true;
            const inputs = this.querySelectorAll('input, textarea');
            
            inputs.forEach(input => {
                if (input.hasAttribute('required') && !input.value) {
                    valid = false;
                    input.classList.add('error');
                } else {
                    input.classList.remove('error');
                }
            });
            
            if (valid) {
                // Show success message or redirect
                const successMessage = document.createElement('div');
                successMessage.classList.add('success-message');
                successMessage.textContent = 'Thank you! We will be in touch soon.';
                
                this.innerHTML = '';
                this.appendChild(successMessage);
            }
        });
    });
    
    // Check if footer is loaded properly
    setTimeout(() => {
        const footers = document.querySelectorAll('.site-footer');
        if (footers.length === 0) {
            console.error('No footer elements found on page');
        } else {
            footers.forEach((footer, index) => {
                if (footer.innerHTML.trim() === '') {
                    console.error(`Footer ${index} exists but is empty`);
                    // Try to reload the footer component
                    const footerScript = document.createElement('script');
                    footerScript.src = 'components/footer.js';
                    document.head.appendChild(footerScript);
                } else {
                    console.log(`Footer ${index} loaded successfully`);
                }
            });
        }
    }, 1000); // Check after 1 second
});
