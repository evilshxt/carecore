/**
 * Marketplace Application - Main JavaScript File
 * 
 * This file handles:
 * - Firebase initialization and authentication
 * - Product fetching from Firestore (with demo fallback)
 * - Shopping cart functionality
 * - Stripe checkout integration
 * - UI interactions and modals
 */

// DOM Elements
const productGrid = document.getElementById('product-grid');
const cartModal = document.getElementById('cart-modal');
const profileModal = document.getElementById('profile-modal');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalElement = document.getElementById('cart-total');
const cartCountElement = document.getElementById('cart-count');
const checkoutBtn = document.getElementById('checkout-btn');
const profileInfo = document.getElementById('profile-info');
const logoutBtn = document.getElementById('logout-btn');

// Demo products (fallback if Firestore is not available)
const demoProducts = [
{
    id: "1",
    name: "Digital Thermometer",
    description: "Fast and accurate digital thermometer for home use.",
    price: 14.99,
    image: "https://images.unsplash.com/photo-1584515933487-779824d29309?w=400&h=400&fit=crop",
    vendorId: "vendor1",
    vendorName: "HealthTech Inc.",
    category: "medical",
    approved: true
},
{
    id: "2",
    name: "Blood Pressure Monitor",
    description: "Automatic blood pressure monitor with large display.",
    price: 49.99,
    image: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=400&fit=crop",
    vendorId: "vendor1",
    vendorName: "HealthTech Inc.",
    category: "medical",
    approved: true
},
{
    id: "3",
    name: "Multivitamin Supplement",
    description: "Complete daily multivitamin for all ages.",
    price: 19.99,
    image: "https://images.unsplash.com/photo-1550572017-edd951aa8ca6?w=400&h=400&fit=crop",
    vendorId: "vendor2",
    vendorName: "Wellness Co.",
    category: "supplements",
    approved: true
},
{
    id: "4",
    name: "Yoga Mat",
    description: "Eco-friendly non-slip yoga mat.",
    price: 29.99,
    image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=400&fit=crop",
    vendorId: "vendor3",
    vendorName: "FitLife",
    category: "wellness",
    approved: true
},
{
    id: "5",
    name: "Resistance Bands Set",
    description: "Set of 5 resistance bands for home workouts.",
    price: 24.99,
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop",
    vendorId: "vendor3",
    vendorName: "FitLife",
    category: "wellness",
    approved: true
},
{
    id: "6",
    name: "Vitamin D3",
    description: "High potency vitamin D3 supplements.",
    price: 12.99,
    image: "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=400&h=400&fit=crop",
    vendorId: "vendor2",
    vendorName: "Wellness Co.",
    category: "supplements",
    approved: true
}
];

// App State
let cart = [];
let currentFilter = 'all';
let currentUser = null;
let stripe = null;

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase if not already initialized
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    // Initialize Stripe
    stripe = Stripe(stripeConfig.publishableKey);
    
    // Set up auth state listener
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            init();
        } else {
            window.location.href = 'login.html';
        }
    });
});

// Initialize the app
function init() {
    renderProducts();
    setupEventListeners();
    showUserProfile();
    updateCartCount();
}

/**
 * Fetches products from Firestore or uses demo data as fallback
 */
async function fetchProducts() {
    try {
        const db = firebase.firestore();
        const productsRef = db.collection('products').where('approved', '==', true);
        const snapshot = await productsRef.get();
        
        if (snapshot.empty) {
            console.log('No products in Firestore, using demo data');
            return demoProducts;
        }
        
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data
            };
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        return demoProducts;
    }
}

/**
 * Renders products to the grid
 */
async function renderProducts() {
    productGrid.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading products...</div>';
    
    const products = await fetchProducts();
    
    productGrid.innerHTML = '';
    
    const filteredProducts = currentFilter === 'all' ? 
        products : 
        products.filter(product => product.category === currentFilter);
    
    if (filteredProducts.length === 0) {
        productGrid.innerHTML = '<div class="no-products">No products found in this category</div>';
        return;
    }
    
    filteredProducts.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
            <div class="product-image" style="background-image: url('${product.image || 'https://via.placeholder.com/250x200?text=No+Image'}')"></div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <p>${product.description}</p>
                <p class="product-price">$${product.price.toFixed(2)}</p>
                <p style="font-size: 0.8rem; color: #666;">by ${product.vendorName || 'Unknown Vendor'}</p>
                <button class="add-to-cart" data-id="${product.id}">Add to Cart</button>
            </div>
        `;
        productGrid.appendChild(productCard);
    });
}

/**
 * Sets up all event listeners
 */
function setupEventListeners() {
    // Cart button
    document.getElementById('cart-btn').addEventListener('click', (e) => {
        e.preventDefault();
        showCartModal();
    });
    
    // Profile button
    document.getElementById('profile-btn').addEventListener('click', (e) => {
        e.preventDefault();
        showProfileModal();
    });
    
    // Logout button
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        firebase.auth().signOut().then(() => {
            window.location.href = 'login.html';
        });
    });
    
    // Close modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            cartModal.classList.remove('show');
            profileModal.classList.remove('show');
        });
    });

    // Close modals when clicking outside
    [cartModal, profileModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });
    
    // Add to cart buttons (delegated)
    productGrid.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-to-cart')) {
            const productId = e.target.getAttribute('data-id');
            addToCart(productId);
        }
    });
    
    // Category filters
    document.querySelectorAll('.filter-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const category = e.target.getAttribute('data-category');
            
            // Update active filter
            document.querySelectorAll('.filter-link').forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
            
            currentFilter = category;
            renderProducts();
        });
    });
    
    // Checkout button
    checkoutBtn.addEventListener('click', handleCheckout);

    // Search functionality
    const searchInput = document.querySelector('.search-bar input');
    const searchButton = document.querySelector('.search-bar button');
    
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
}

/**
 * Performs product search
 */
async function performSearch() {
    const searchInput = document.querySelector('.search-bar input');
    const searchTerm = searchInput.value.toLowerCase();
    
    const products = await fetchProducts();
    const filteredProducts = products.filter(product => 
        product.name.toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm) ||
        (product.vendorName && product.vendorName.toLowerCase().includes(searchTerm))
    );
    
    productGrid.innerHTML = '';
    
    if (filteredProducts.length === 0) {
        productGrid.innerHTML = '<div class="no-products">No products match your search</div>';
        return;
    }
    
    filteredProducts.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
            <div class="product-image" style="background-image: url('${product.image || 'https://via.placeholder.com/250x200?text=No+Image'}')"></div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <p>${product.description}</p>
                <p class="product-price">$${product.price.toFixed(2)}</p>
                <p style="font-size: 0.8rem; color: #666;">by ${product.vendorName || 'Unknown Vendor'}</p>
                <button class="add-to-cart" data-id="${product.id}">Add to Cart</button>
            </div>
        `;
        productGrid.appendChild(productCard);
    });
}

/**
 * Adds a product to the cart
 */
async function addToCart(productId) {
    const products = await fetchProducts();
    const product = products.find(p => p.id === productId);
    
    if (!product) {
        showToast('Product not found');
        return;
    }
    
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            ...product,
            quantity: 1
        });
    }
    
    updateCart();
    updateCartCount();
    showToast(`${product.name} added to cart`);
}

/**
 * Updates cart count in header
 */
function updateCartCount() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCountElement.textContent = totalItems;
}

/**
 * Updates cart display
 */
function updateCart() {
    cartItemsContainer.innerHTML = '';
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p>Your cart is empty</p>';
        cartTotalElement.textContent = '0.00';
        return;
    }
    
    let total = 0;
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-image" style="background-image: url('${item.image || 'https://via.placeholder.com/60x60?text=No+Image'}')"></div>
                <div>
                    <h4>${item.name}</h4>
                    <p>$${item.price.toFixed(2)}</p>
                </div>
            </div>
            <div class="cart-item-quantity">
                <button class="quantity-btn minus" data-id="${item.id}">-</button>
                <span>${item.quantity}</span>
                <button class="quantity-btn plus" data-id="${item.id}">+</button>
                <button class="remove-item" data-id="${item.id}"><i class="fas fa-trash"></i></button>
            </div>
            <div class="cart-item-total">
                $${itemTotal.toFixed(2)}
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
    });
    
    cartTotalElement.textContent = total.toFixed(2);
    
    // Add event listeners for quantity buttons
    document.querySelectorAll('.quantity-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = e.target.getAttribute('data-id');
            const isPlus = e.target.classList.contains('plus');
            updateCartItemQuantity(productId, isPlus);
        });
    });
    
    // Add event listeners for remove buttons
    document.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = e.target.getAttribute('data-id');
            removeFromCart(productId);
        });
    });
}

/**
 * Updates cart item quantity
 */
function updateCartItemQuantity(productId, isPlus) {
    const item = cart.find(item => item.id === productId);
    if (!item) return;
    
    if (isPlus) {
        item.quantity += 1;
    } else {
        item.quantity = Math.max(1, item.quantity - 1);
    }
    
    updateCart();
    updateCartCount();
}

/**
 * Removes item from cart
 */
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCart();
    updateCartCount();
    showToast('Item removed from cart');
}

/**
 * Shows cart modal
 */
function showCartModal() {
    updateCart();
    cartModal.classList.add('show');
}

/**
 * Shows profile modal
 */
function showProfileModal() {
    profileModal.classList.add('show');
}

/**
 * Shows user profile info
 */
function showUserProfile() {
    profileInfo.innerHTML = `
        <div class="profile-avatar" style="background-image: url('${currentUser.photoURL || ''}')">
            ${currentUser.photoURL ? '' : '<i class="fas fa-user"></i>'}
        </div>
        <div class="profile-info">
            <p><strong>Name:</strong> ${currentUser.displayName || 'Not set'}</p>
            <p><strong>Email:</strong> ${currentUser.email}</p>
            <p><strong>User ID:</strong> ${currentUser.uid}</p>
        </div>
    `;
}

/**
 * Handles the checkout process with Stripe
 */
async function handleCheckout() {
    if (cart.length === 0) {
        showToast('Your cart is empty!');
        return;
    }

    const total = parseFloat(cartTotalElement.textContent);
    
    try {
        // In a real app, you would create a checkout session on your server
        // For demo purposes, we'll simulate this with a direct Stripe integration
        
        // Create line items for Stripe
        const lineItems = cart.map(item => ({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.name,
                    description: item.description,
                    images: [item.image],
                },
                unit_amount: Math.round(item.price * 100),
            },
            quantity: item.quantity,
        }));
        
        // Create the checkout session (in a real app, this would be a server-side call)
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${window.location.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${window.location.origin}/cancel.html`,
            customer_email: currentUser.email,
        });
        
        // Redirect to Stripe checkout
        const result = await stripe.redirectToCheckout({ sessionId: session.id });
        
        if (result.error) {
            showToast(result.error.message);
        }
    } catch (error) {
        console.error('Checkout error:', error);
        showToast('Error processing payment. Please try again.');
    }
}

/**
 * Shows toast notification
 */
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}