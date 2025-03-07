document.addEventListener('DOMContentLoaded', function() {
    // Handle subscription button clicks
    const subscriptionButtons = document.querySelectorAll('.plan-cta a');

    if (subscriptionButtons.length > 0) {
        subscriptionButtons.forEach(button => {
            button.addEventListener('click', async function(e) {
                e.preventDefault();
                
                // Check if user is logged in
                try {
                    const response = await fetch('/api/auth/status');
                    const data = await response.json();
                    
                    if (!data.isAuthenticated) {
                        // Redirect to login if not authenticated
                        window.location.href = '/auth/google';
                        return;
                    }
                    
                    // Get plan ID from the button's parent elements
                    const planCard = this.closest('.plan-card');
                    const planName = planCard.querySelector('.plan-header h3').textContent.toLowerCase();
                    
                    // Subscribe to the plan
                    const subscribeResponse = await fetch('/api/subscription', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ planId: planName })
                    });
                    
                    if (subscribeResponse.ok) {
                        const subscription = await subscribeResponse.json();
                        alert(`Successfully subscribed to ${subscription.plan} plan!`);
                        // Redirect to app or dashboard
                        window.location.href = '/';
                    } else {
                        const error = await subscribeResponse.json();
                        alert(`Subscription failed: ${error.error}`);
                    }
                } catch (error) {
                    console.error('Error subscribing:', error);
                    alert('An error occurred while processing your subscription.');
                }
            });
        });
    }
});
