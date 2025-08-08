document.addEventListener('DOMContentLoaded', () => {
    // Register GSAP plugins
    gsap.registerPlugin(ScrollTrigger);
    
    // Create floating health icons
    const floatingIcons = document.getElementById('floating-icons');
    const healthIcons = [
        'fa-heartbeat', 'fa-stethoscope', 'fa-pills', 'fa-ambulance', 
        'fa-hospital', 'fa-user-md', 'fa-heart', 'fa-leaf',
        'fa-eye', 'fa-ear-listen', 'fa-brain', 'fa-lungs'
    ];
    
    for (let i = 0; i < 15; i++) {
        const icon = document.createElement('i');
        icon.className = `fas ${healthIcons[Math.floor(Math.random() * healthIcons.length)]} text-primary floating-icon`;
        icon.style.position = 'absolute';
        icon.style.fontSize = `${Math.random() * 20 + 10}px`;
        icon.style.left = `${Math.random() * 100}%`;
        icon.style.top = `${Math.random() * 100}%`;
        icon.style.animationDelay = `${Math.random() * 5}s`;
        icon.style.animationDuration = `${Math.random() * 10 + 5}s`;
        floatingIcons.appendChild(icon);
    }
    
    // Animate feature cards on scroll
    gsap.utils.toArray('.feature-card').forEach((card, i) => {
        gsap.from(card, {
            scrollTrigger: {
                trigger: card,
                start: "top 80%",
                toggleActions: "play none none none"
            },
            y: 50,
            opacity: 0,
            duration: 0.8,
            delay: i * 0.1,
            ease: "power2.out"
        });
    });
    
    // Animate hero section
    gsap.from('.hero h1', {
        duration: 1,
        y: -50,
        opacity: 0,
        ease: "power2.out"
    });
    
    gsap.from('.hero p', {
        duration: 1,
        y: -30,
        opacity: 0,
        delay: 0.3,
        ease: "power2.out"
    });
    
    gsap.from('.hero a', {
        duration: 1,
        y: -20,
        opacity: 0,
        delay: 0.6,
        stagger: 0.2,
        ease: "power2.out"
    });
});

// Add this to your existing animations.js

// Animate form inputs on focus
document.querySelectorAll("footer form input, footer form textarea").forEach(input => {
    input.addEventListener("focus", () => {
        gsap.to(input, {
            scale: 1.02,
            duration: 0.3,
            ease: "power2.out"
        });
    });
    
    input.addEventListener("blur", () => {
        gsap.to(input, {
            scale: 1,
            duration: 0.3,
            ease: "power2.out"
        });
    });
});

// Smooth feature cards animation
gsap.utils.toArray('.feature-card').forEach((card, i) => {
    gsap.from(card, {
        scrollTrigger: {
            trigger: card,
            start: "top 90%", // Start animation a bit later
            toggleActions: "play none none none",
            markers: false // Remove in production
        },
        y: 30, // Reduced from 50
        opacity: 0,
        duration: 1, // Increased duration
        delay: i * 0.15, // Reduced stagger delay
        ease: "power3.out" // Smoother easing
    });
});

// Smoother footer animation
gsap.from("footer", {
    scrollTrigger: {
        trigger: "footer",
        start: "top 90%",
        toggleActions: "play none none none"
    },
    y: 30,
    opacity: 0,
    duration: 1.2,
    ease: "power3.out"
});

// Add this for the About section
gsap.from("#about", {
    scrollTrigger: {
        trigger: "#about",
        start: "top 85%",
        toggleActions: "play none none none"
    },
    y: 40,
    opacity: 0,
    duration: 1,
    ease: "power3.out"
});