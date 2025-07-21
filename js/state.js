// state.js - Fixed version

// Ensure Firebase is initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Listen for auth state changes
firebase.auth().onAuthStateChanged(user => {
    const currentPage = window.location.pathname.split('/').pop();
    
    // If user is not logged in and not on the login page
    if (!user && currentPage !== 'login.html' && currentPage !== 'index.html') {
        window.location.href = 'login.html';
        return;
    }
    
    // If user is logged in and tries to access login.html
    if (user && (currentPage === 'login.html' || currentPage === 'index.html')) {
        window.location.href = 'landing.html';
        return;
    }
});