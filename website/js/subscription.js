document.addEventListener('DOMContentLoaded', function() {
    // Handle subscription button clicks
    const subscriptionButtons = document.querySelectorAll('.plan-cta a');

    if (subscriptionButtons.length > 0) {
        subscriptionButtons.forEach(button => {
            button.addEventListener('click', async function(e) {
                e.preventDefault();
                
                // Get plan ID from the button's parent elements
                const planCard = this.closest('.plan-card');
                const planName = planCard.querySelector('.plan-header h3').textContent.toLowerCase();
                
                // Direct action without authentication
                alert(`Thank you for your interest in the ${planName} plan! Please download the app to subscribe.`);
                window.location.href = 'download.html';
            });
        });
    }
});
