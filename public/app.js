// Hedgile Navigation - Prevent locked items from navigating

document.addEventListener('DOMContentLoaded', function() {
    // Get all locked navigation links
    const lockedLinks = document.querySelectorAll('.nav-link.locked');
    
    // Add click event listeners to prevent navigation
    lockedLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Visual feedback - slight shake animation
            this.style.animation = 'shake 0.3s ease-in-out';
            
            // Remove animation after it completes
            setTimeout(() => {
                this.style.animation = '';
            }, 300);
            
            // Optional: Show a tooltip or notification
            console.log('Navigation locked: ' + this.textContent.trim());
        });
    });
    
    // Add active class to clicked navigable links
    const navigableLinks = document.querySelectorAll('.nav-link:not(.locked)');
    
    navigableLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Remove active class from all links
            navigableLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Here you would typically load the content for the selected menu item
            // For now, we'll just prevent default navigation
            e.preventDefault();
            
            // Update content area
            updateContent(this);
        });
    });
    
    // Set first non-locked link as active by default
    const firstActiveLink = document.querySelector('.nav-link:not(.locked)');
    if (firstActiveLink) {
        firstActiveLink.classList.add('active');
    }
});

// Update content area based on selected menu item
function updateContent(link) {
    const contentArea = document.querySelector('.content');
    const linkText = link.textContent.trim();
    
    contentArea.innerHTML = `
        <h2>${linkText}</h2>
        <p>Content for ${linkText} will be displayed here.</p>
        <p>This is a placeholder for the actual ${linkText} functionality.</p>
    `;
}

// Add CSS animation for shake effect
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20%, 60% { transform: translateX(-3px); }
        40%, 80% { transform: translateX(3px); }
    }
`;
document.head.appendChild(style);
