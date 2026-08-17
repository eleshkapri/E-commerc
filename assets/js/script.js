'use strict';

/**
 * Anon eCommerce - Master Application Logic
 */

// ==========================================
// 1. STATE & STORAGE
// ==========================================

const AppState = {
  cart: JSON.parse(localStorage.getItem('anon_cart')) || [],
  wishlist: JSON.parse(localStorage.getItem('anon_wishlist')) || [],
  currency: localStorage.getItem('anon_currency') || 'USD',
  appliedPromo: null,
  activeCategory: 'all',
  searchQuery: '',
  quickViewCurrentProduct: null,
  quickViewSelectedSize: 'M',
  quickViewQty: 1
};

const ExchangeRates = {
  USD: { symbol: '$', rate: 1.0 },
  EUR: { symbol: '€', rate: 0.92 },
  GBP: { symbol: '£', rate: 0.79 },
  INR: { symbol: '₹', rate: 83.5 }
};

// ==========================================
// 2. HELPER & FORMATTING FUNCTIONS
// ==========================================

function formatPrice(usdAmount) {
  const rateInfo = ExchangeRates[AppState.currency] || ExchangeRates.USD;
  const converted = Number(usdAmount) * rateInfo.rate;
  if (AppState.currency === 'INR') {
    return `${rateInfo.symbol}${Math.round(converted).toLocaleString('en-IN')}`;
  }
  return `${rateInfo.symbol}${converted.toFixed(2)}`;
}

function updateAllPricesOnPage() {
  // Update all elements with data-usd-price
  document.querySelectorAll('[data-usd-price]').forEach(el => {
    const usd = parseFloat(el.getAttribute('data-usd-price'));
    if (!isNaN(usd)) {
      el.textContent = formatPrice(usd);
    }
  });

  // Update all elements with data-usd-del-price
  document.querySelectorAll('[data-usd-del-price]').forEach(el => {
    const usd = parseFloat(el.getAttribute('data-usd-del-price'));
    if (!isNaN(usd)) {
      el.textContent = formatPrice(usd);
    }
  });

  // Update Quick View if open
  if (AppState.quickViewCurrentProduct) {
    const priceEl = document.querySelector('.quick-view-price');
    const origPriceEl = document.querySelector('.quick-view-original-price');
    if (priceEl) priceEl.textContent = formatPrice(AppState.quickViewCurrentProduct.price);
    if (origPriceEl) origPriceEl.textContent = formatPrice(AppState.quickViewCurrentProduct.originalPrice);
  }
}

function saveCart() {
  localStorage.setItem('anon_cart', JSON.stringify(AppState.cart));
}

function saveWishlist() {
  localStorage.setItem('anon_wishlist', JSON.stringify(AppState.wishlist));
}

function saveCurrency() {
  localStorage.setItem('anon_currency', AppState.currency);
}

// Action Toast Alert Notification
function showActionToast(message, type = 'success') {
  let container = document.querySelector('.action-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'action-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `action-toast ${type}`;
  const icon = type === 'success' ? 'checkmark-circle-outline' : 'information-circle-outline';
  
  toast.innerHTML = `
    <ion-icon name="${icon}"></ion-icon>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ==========================================
// 3. OVERLAYS & MODALS MANAGER
// ==========================================

const overlay = document.querySelector('[data-overlay]');

function closeAllDrawersAndModals() {
  document.querySelectorAll('.cart-drawer, .wishlist-drawer, .sidebar, .mobile-navigation-menu, .quick-view-modal, .auth-modal, .checkout-modal, .order-success-modal').forEach(el => {
    el.classList.remove('active');
  });
  if (overlay) overlay.classList.remove('active');
}

if (overlay) {
  overlay.addEventListener('click', closeAllDrawersAndModals);
}

// Keyboard ESC listener
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllDrawersAndModals();
    const newsletterModal = document.querySelector('[data-modal]');
    if (newsletterModal) newsletterModal.classList.add('closed');
  }
});

// ==========================================
// 4. CART MANAGEMENT
// ==========================================

const cartDrawer = document.getElementById('cart-drawer');
const cartOpenBtns = document.querySelectorAll('[data-cart-open-btn]');
const cartCloseBtn = document.getElementById('cart-close-btn');
const cartItemsContainer = document.getElementById('cart-items-container');
const cartBadges = document.querySelectorAll('.cart-count-badge');
const cartSubtotalEl = document.getElementById('cart-subtotal');
const cartDiscountRow = document.getElementById('cart-discount-row');
const cartDiscountAmountEl = document.getElementById('cart-discount-amount');
const cartShippingEl = document.getElementById('cart-shipping');
const cartTotalEl = document.getElementById('cart-total');
const cartShippingNotice = document.getElementById('cart-shipping-notice');
const shippingProgressFill = document.getElementById('shipping-progress-fill');

function updateCartBadges() {
  const totalItems = AppState.cart.reduce((sum, item) => sum + item.quantity, 0);
  cartBadges.forEach(badge => {
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? 'inline-block' : 'inline-block';
  });
}

function getCartCalculations() {
  const subtotal = AppState.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  let discount = 0;
  if (AppState.appliedPromo === 'ANON20') {
    discount = subtotal * 0.20;
  }
  const shippingThreshold = 55.00;
  const isFreeShipping = subtotal >= shippingThreshold || subtotal === 0;
  const shippingCost = isFreeShipping ? 0 : 10.00;
  const total = Math.max(0, subtotal - discount + shippingCost);

  return { subtotal, discount, shippingCost, isFreeShipping, shippingThreshold, total };
}

function renderCartDrawer() {
  if (!cartItemsContainer) return;

  if (AppState.cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="cart-empty-state">
        <ion-icon name="bag-handle-outline"></ion-icon>
        <h4>Your Cart is Empty</h4>
        <p>Looks like you haven't added any products yet.</p>
        <button class="btn-primary" onclick="closeAllDrawersAndModals()">Start Shopping</button>
      </div>
    `;
    if (cartSubtotalEl) cartSubtotalEl.textContent = formatPrice(0);
    if (cartShippingEl) cartShippingEl.textContent = formatPrice(0);
    if (cartTotalEl) cartTotalEl.textContent = formatPrice(0);
    if (cartDiscountRow) cartDiscountRow.style.display = 'none';
    if (shippingProgressFill) shippingProgressFill.style.width = '0%';
    if (cartShippingNotice) {
      cartShippingNotice.querySelector('span').textContent = `Free shipping on orders over ${formatPrice(55)}!`;
    }
    return;
  }

  const { subtotal, discount, shippingCost, isFreeShipping, shippingThreshold, total } = getCartCalculations();

  // Update Free Shipping Progress Bar
  if (shippingProgressFill && cartShippingNotice) {
    const progressPercent = Math.min(100, (subtotal / shippingThreshold) * 100);
    shippingProgressFill.style.width = `${progressPercent}%`;
    if (isFreeShipping) {
      cartShippingNotice.querySelector('span').innerHTML = `🎉 <b>Congratulations!</b> You get <b>FREE Delivery</b>!`;
    } else {
      const needed = shippingThreshold - subtotal;
      cartShippingNotice.querySelector('span').innerHTML = `Add <b>${formatPrice(needed)}</b> more to qualify for <b>FREE Delivery</b>!`;
    }
  }

  // Render items
  cartItemsContainer.innerHTML = AppState.cart.map(item => `
    <div class="cart-item" data-cart-id="${item.product.id}">
      <img src="${item.product.image}" alt="${item.product.title}" class="cart-item-img">
      <div class="cart-item-details">
        <h4 class="cart-item-title">${item.product.title}</h4>
        <p class="cart-item-price">${formatPrice(item.product.price)} <small style="color: var(--sonic-silver); font-weight: normal;">(Size: ${item.selectedSize})</small></p>
        <div class="cart-quantity-controls">
          <button class="qty-btn" onclick="updateCartItemQty('${item.product.id}', -1)">-</button>
          <span class="qty-display">${item.quantity}</span>
          <button class="qty-btn" onclick="updateCartItemQty('${item.product.id}', 1)">+</button>
        </div>
      </div>
      <button class="cart-item-remove-btn" onclick="removeFromCart('${item.product.id}')" title="Remove item">
        <ion-icon name="trash-outline"></ion-icon>
      </button>
    </div>
  `).join('');

  if (cartSubtotalEl) cartSubtotalEl.textContent = formatPrice(subtotal);
  if (cartShippingEl) cartShippingEl.textContent = isFreeShipping ? 'FREE' : formatPrice(shippingCost);
  if (cartTotalEl) cartTotalEl.textContent = formatPrice(total);

  if (cartDiscountRow && cartDiscountAmountEl) {
    if (discount > 0) {
      cartDiscountRow.style.display = 'flex';
      cartDiscountAmountEl.textContent = `-${formatPrice(discount)}`;
    } else {
      cartDiscountRow.style.display = 'none';
    }
  }
}

function addToCart(productId, quantity = 1, size = 'M', color = 'Default') {
  const product = productsData.find(p => p.id === productId);
  if (!product) return;

  const existingItemIndex = AppState.cart.findIndex(item => item.product.id === productId && item.selectedSize === size);

  if (existingItemIndex > -1) {
    AppState.cart[existingItemIndex].quantity += quantity;
  } else {
    AppState.cart.push({
      product,
      quantity,
      selectedSize: size,
      selectedColor: color
    });
  }

  saveCart();
  updateCartBadges();
  renderCartDrawer();
  showActionToast(`Added "${product.title}" to cart!`);
}

function updateCartItemQty(productId, change) {
  const itemIndex = AppState.cart.findIndex(item => item.product.id === productId);
  if (itemIndex === -1) return;

  AppState.cart[itemIndex].quantity += change;
  if (AppState.cart[itemIndex].quantity <= 0) {
    AppState.cart.splice(itemIndex, 1);
    showActionToast('Item removed from cart', 'info');
  }

  saveCart();
  updateCartBadges();
  renderCartDrawer();
}

function removeFromCart(productId) {
  const itemIndex = AppState.cart.findIndex(item => item.product.id === productId);
  if (itemIndex > -1) {
    const itemTitle = AppState.cart[itemIndex].product.title;
    AppState.cart.splice(itemIndex, 1);
    saveCart();
    updateCartBadges();
    renderCartDrawer();
    showActionToast(`Removed "${itemTitle}" from cart`, 'info');
  }
}

function openCartDrawer() {
  closeAllDrawersAndModals();
  if (cartDrawer) {
    cartDrawer.classList.add('active');
    if (overlay) overlay.classList.add('active');
    renderCartDrawer();
  }
}

cartOpenBtns.forEach(btn => btn.addEventListener('click', openCartDrawer));
if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeAllDrawersAndModals);

// Apply Promo Code
const promoBtn = document.getElementById('apply-promo-btn');
const promoInput = document.getElementById('promo-code-input');

if (promoBtn && promoInput) {
  promoBtn.addEventListener('click', () => {
    const code = promoInput.value.trim().toUpperCase();
    if (code === 'ANON20') {
      AppState.appliedPromo = 'ANON20';
      showActionToast('20% Discount applied successfully!');
      renderCartDrawer();
    } else if (code === '') {
      showActionToast('Please enter a promo code', 'info');
    } else {
      showActionToast('Invalid promo code. Try "ANON20"', 'info');
    }
  });
}

// ==========================================
// 5. WISHLIST MANAGEMENT
// ==========================================

const wishlistDrawer = document.getElementById('wishlist-drawer');
const wishlistOpenBtns = document.querySelectorAll('[data-wishlist-open-btn]');
const wishlistCloseBtn = document.getElementById('wishlist-close-btn');
const wishlistItemsContainer = document.getElementById('wishlist-items-container');
const wishlistBadges = document.querySelectorAll('.wishlist-count-badge');

function updateWishlistBadges() {
  const count = AppState.wishlist.length;
  wishlistBadges.forEach(badge => {
    badge.textContent = count;
  });

  // Sync heart buttons across page
  document.querySelectorAll('[data-wishlist-toggle]').forEach(btn => {
    const prodId = btn.getAttribute('data-product-id');
    const isSaved = AppState.wishlist.includes(prodId);
    if (isSaved) {
      btn.classList.add('active-wishlist');
      const icon = btn.querySelector('ion-icon');
      if (icon) icon.setAttribute('name', 'heart');
    } else {
      btn.classList.remove('active-wishlist');
      const icon = btn.querySelector('ion-icon');
      if (icon) icon.setAttribute('name', 'heart-outline');
    }
  });
}

function toggleWishlist(productId) {
  const product = productsData.find(p => p.id === productId);
  if (!product) return;

  const index = AppState.wishlist.indexOf(productId);
  if (index > -1) {
    AppState.wishlist.splice(index, 1);
    showActionToast(`Removed "${product.title}" from wishlist`, 'info');
  } else {
    AppState.wishlist.push(productId);
    showActionToast(`Added "${product.title}" to wishlist!`);
  }

  saveWishlist();
  updateWishlistBadges();
  renderWishlistDrawer();
}

function renderWishlistDrawer() {
  if (!wishlistItemsContainer) return;

  if (AppState.wishlist.length === 0) {
    wishlistItemsContainer.innerHTML = `
      <div class="cart-empty-state">
        <ion-icon name="heart-outline"></ion-icon>
        <h4>Your Wishlist is Empty</h4>
        <p>Save items you love to review them anytime.</p>
        <button class="btn-primary" onclick="closeAllDrawersAndModals()">Explore Products</button>
      </div>
    `;
    return;
  }

  const savedProducts = productsData.filter(p => AppState.wishlist.includes(p.id));

  wishlistItemsContainer.innerHTML = savedProducts.map(prod => `
    <div class="wishlist-item" data-wishlist-id="${prod.id}">
      <img src="${prod.image}" alt="${prod.title}" class="wishlist-item-img">
      <div class="wishlist-item-details">
        <h4 class="wishlist-item-title">${prod.title}</h4>
        <p class="wishlist-item-price">${formatPrice(prod.price)}</p>
        <div class="wishlist-item-actions">
          <button class="wishlist-move-cart-btn" onclick="moveWishlistToCart('${prod.id}')">
            Move to Cart
          </button>
        </div>
      </div>
      <button class="wishlist-remove-btn" onclick="toggleWishlist('${prod.id}')" title="Remove from wishlist">
        <ion-icon name="close-outline"></ion-icon>
      </button>
    </div>
  `).join('');
}

function moveWishlistToCart(productId) {
  addToCart(productId);
  toggleWishlist(productId);
}

function openWishlistDrawer() {
  closeAllDrawersAndModals();
  if (wishlistDrawer) {
    wishlistDrawer.classList.add('active');
    if (overlay) overlay.classList.add('active');
    renderWishlistDrawer();
  }
}

wishlistOpenBtns.forEach(btn => btn.addEventListener('click', openWishlistDrawer));
if (wishlistCloseBtn) wishlistCloseBtn.addEventListener('click', closeAllDrawersAndModals);

// ==========================================
// 6. QUICK VIEW MODAL
// ==========================================

const quickViewModal = document.getElementById('quick-view-modal');
const quickViewCloseBtn = document.getElementById('quick-view-close-btn');

function openQuickView(productId) {
  const product = productsData.find(p => p.id === productId);
  if (!product || !quickViewModal) return;

  AppState.quickViewCurrentProduct = product;
  AppState.quickViewSelectedSize = 'M';
  AppState.quickViewQty = 1;

  // Set fields
  const mainImg = quickViewModal.querySelector('.quick-view-main-img');
  const thumbsContainer = quickViewModal.querySelector('.quick-view-thumbnails');
  const catEl = quickViewModal.querySelector('.quick-view-cat');
  const titleEl = quickViewModal.querySelector('.quick-view-title');
  const starsEl = quickViewModal.querySelector('.quick-view-stars');
  const reviewsEl = quickViewModal.querySelector('.quick-view-reviews-count');
  const priceEl = quickViewModal.querySelector('.quick-view-price');
  const origPriceEl = quickViewModal.querySelector('.quick-view-original-price');
  const badgeEl = quickViewModal.querySelector('.quick-view-badge');
  const descEl = quickViewModal.querySelector('.quick-view-desc');
  const qtyDisplay = quickViewModal.querySelector('.modal-qty-display');

  if (mainImg) mainImg.src = product.image;
  if (catEl) catEl.textContent = product.category;
  if (titleEl) titleEl.textContent = product.title;
  if (descEl) descEl.textContent = product.description;
  if (priceEl) priceEl.textContent = formatPrice(product.price);
  if (origPriceEl) origPriceEl.textContent = formatPrice(product.originalPrice);
  if (qtyDisplay) qtyDisplay.textContent = '1';

  if (badgeEl) {
    if (product.discount) {
      badgeEl.textContent = product.discount;
      badgeEl.style.display = 'inline-block';
    } else {
      badgeEl.style.display = 'none';
    }
  }

  // Render Stars
  if (starsEl) {
    starsEl.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      starsEl.innerHTML += `<ion-icon name="${i <= product.rating ? 'star' : 'star-outline'}"></ion-icon>`;
    }
  }
  if (reviewsEl) reviewsEl.textContent = `(${product.reviews} customer reviews)`;

  // Thumbnails
  if (thumbsContainer) {
    thumbsContainer.innerHTML = `
      <img src="${product.image}" class="quick-view-thumb active" onclick="changeQuickViewImg('${product.image}', this)">
      <img src="${product.hoverImage}" class="quick-view-thumb" onclick="changeQuickViewImg('${product.hoverImage}', this)">
    `;
  }

  // Size buttons reset
  const sizeBtns = quickViewModal.querySelectorAll('.size-btn');
  sizeBtns.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-size') === 'M');
  });

  closeAllDrawersAndModals();
  quickViewModal.classList.add('active');
  if (overlay) overlay.classList.add('active');
}

function changeQuickViewImg(src, thumbEl) {
  const mainImg = quickViewModal.querySelector('.quick-view-main-img');
  if (mainImg) mainImg.src = src;
  const thumbs = quickViewModal.querySelectorAll('.quick-view-thumb');
  thumbs.forEach(t => t.classList.remove('active'));
  if (thumbEl) thumbEl.classList.add('active');
}

function updateQuickViewQty(delta) {
  AppState.quickViewQty = Math.max(1, AppState.quickViewQty + delta);
  const qtyDisplay = quickViewModal.querySelector('.modal-qty-display');
  if (qtyDisplay) qtyDisplay.textContent = AppState.quickViewQty;
}

function addQuickViewToCart() {
  if (!AppState.quickViewCurrentProduct) return;
  addToCart(AppState.quickViewCurrentProduct.id, AppState.quickViewQty, AppState.quickViewSelectedSize);
  closeAllDrawersAndModals();
}

function addQuickViewToWishlist() {
  if (!AppState.quickViewCurrentProduct) return;
  toggleWishlist(AppState.quickViewCurrentProduct.id);
}

if (quickViewCloseBtn) quickViewCloseBtn.addEventListener('click', closeAllDrawersAndModals);

// Size buttons click handling in modal
document.querySelectorAll('.size-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    AppState.quickViewSelectedSize = this.getAttribute('data-size');
  });
});

// ==========================================
// 7. LIVE SEARCH & FILTERING
// ==========================================

const searchInput = document.querySelector('.header-search-container .search-field');
const searchBtn = document.querySelector('.header-search-container .search-btn');
const searchDropdown = document.getElementById('search-dropdown');
const productGrid = document.querySelector('.product-grid');
const filterStatusBar = document.getElementById('filter-status-bar');

function handleSearchInput(e) {
  const query = e.target.value.trim().toLowerCase();
  if (!query || !searchDropdown) {
    if (searchDropdown) searchDropdown.classList.remove('active');
    return;
  }

  const matches = productsData.filter(p => 
    p.title.toLowerCase().includes(query) ||
    p.category.toLowerCase().includes(query) ||
    p.tags.some(t => t.toLowerCase().includes(query))
  );

  if (matches.length === 0) {
    searchDropdown.innerHTML = `<div class="search-no-result">No products found matching "${query}"</div>`;
  } else {
    searchDropdown.innerHTML = matches.slice(0, 6).map(prod => `
      <div class="search-result-item" onclick="openQuickView('${prod.id}')">
        <img src="${prod.image}" alt="${prod.title}" class="search-result-img">
        <div class="search-result-info">
          <div class="search-result-title">${prod.title}</div>
          <div class="search-result-cat">${prod.category}</div>
        </div>
        <div class="search-result-price">${formatPrice(prod.price)}</div>
      </div>
    `).join('');
  }

  searchDropdown.classList.add('active');
}

function applyGridFilter(category = 'all', searchQuery = '') {
  AppState.activeCategory = category;
  AppState.searchQuery = searchQuery;

  let filtered = productsData.filter(p => p.section === 'product-grid' || p.section === 'new-arrivals' || p.section === 'trending');

  if (category !== 'all') {
    filtered = productsData.filter(p => p.categorySlug === category || p.category.toLowerCase() === category.toLowerCase());
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = productsData.filter(p => 
      p.title.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  // Update Filter Status Bar
  if (filterStatusBar) {
    if (category !== 'all' || searchQuery) {
      filterStatusBar.style.display = 'flex';
      const label = searchQuery ? `Search results for "${searchQuery}"` : `Category: ${category.toUpperCase()}`;
      filterStatusBar.innerHTML = `
        <span>Showing <b>${label}</b> (${filtered.length} products found)</span>
        <button class="clear-filter-btn" onclick="clearFilters()">
          <ion-icon name="close-circle-outline"></ion-icon> Clear Filter
        </button>
      `;
    } else {
      filterStatusBar.style.display = 'none';
    }
  }

  // Render filtered cards into productGrid
  if (productGrid) {
    if (filtered.length === 0) {
      productGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px;">
          <ion-icon name="search-outline" style="font-size: 48px; color: var(--spanish-gray); margin: 0 auto 10px;"></ion-icon>
          <h3 style="color: var(--eerie-black); margin-bottom: 8px;">No products match your criteria</h3>
          <p style="color: var(--sonic-silver); margin-bottom: 20px;">Try searching for jacket, shirt, shoes, watch, jewellery, or clear filters.</p>
          <button class="btn-primary" onclick="clearFilters()">Show All Products</button>
        </div>
      `;
      return;
    }

    productGrid.innerHTML = filtered.map(prod => `
      <div class="showcase" data-product-id="${prod.id}">
        <div class="showcase-banner">
          <img src="${prod.image}" alt="${prod.title}" width="300" class="product-img default">
          <img src="${prod.hoverImage}" alt="${prod.title}" width="300" class="product-img hover">
          ${prod.discount ? `<p class="showcase-badge ${prod.badgeClass || 'sale'}">${prod.discount}</p>` : ''}
          <div class="showcase-actions">
            <button class="btn-action ${AppState.wishlist.includes(prod.id) ? 'active-wishlist' : ''}" data-wishlist-toggle data-product-id="${prod.id}" onclick="toggleWishlist('${prod.id}')" title="Add to Wishlist">
              <ion-icon name="${AppState.wishlist.includes(prod.id) ? 'heart' : 'heart-outline'}"></ion-icon>
            </button>
            <button class="btn-action" onclick="openQuickView('${prod.id}')" title="Quick View">
              <ion-icon name="eye-outline"></ion-icon>
            </button>
            <button class="btn-action" onclick="addToCart('${prod.id}')" title="Add to Cart">
              <ion-icon name="bag-add-outline"></ion-icon>
            </button>
          </div>
        </div>
        <div class="showcase-content">
          <a href="#" class="showcase-category" onclick="filterByCategory('${prod.categorySlug || prod.category.toLowerCase()}'); return false;">${prod.category}</a>
          <a href="#" onclick="openQuickView('${prod.id}'); return false;">
            <h3 class="showcase-title">${prod.title}</h3>
          </a>
          <div class="showcase-rating">
            ${Array.from({ length: 5 }, (_, i) => `<ion-icon name="${i < prod.rating ? 'star' : 'star-outline'}"></ion-icon>`).join('')}
          </div>
          <div class="price-box">
            <p class="price">${formatPrice(prod.price)}</p>
            <del>${formatPrice(prod.originalPrice)}</del>
          </div>
        </div>
      </div>
    `).join('');
  }
}

function filterByCategory(catSlug) {
  applyGridFilter(catSlug, '');
  const productSection = document.querySelector('.product-main');
  if (productSection) {
    productSection.scrollIntoView({ behavior: 'smooth' });
  }
}

function clearFilters() {
  if (searchInput) searchInput.value = '';
  applyGridFilter('all', '');
}

if (searchInput) {
  searchInput.addEventListener('input', handleSearchInput);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (searchDropdown) searchDropdown.classList.remove('active');
      applyGridFilter('all', searchInput.value.trim());
    }
  });
}

if (searchBtn && searchInput) {
  searchBtn.addEventListener('click', () => {
    if (searchDropdown) searchDropdown.classList.remove('active');
    applyGridFilter('all', searchInput.value.trim());
  });
}

// Close search dropdown on click outside
document.addEventListener('click', (e) => {
  if (searchDropdown && !e.target.closest('.header-search-container')) {
    searchDropdown.classList.remove('active');
  }
});

// Category pills click handler
document.querySelectorAll('.category-item').forEach(item => {
  item.addEventListener('click', function() {
    const title = this.querySelector('.category-item-title')?.textContent.toLowerCase() || '';
    let slug = 'clothes';
    if (title.includes('winter') || title.includes('jacket')) slug = 'jacket';
    else if (title.includes('glasses')) slug = 'glasses';
    else if (title.includes('shorts') || title.includes('jeans')) slug = 'shorts';
    else if (title.includes('t-shirt') || title.includes('shirt')) slug = 'shirt';
    else if (title.includes('watch')) slug = 'watches';
    else if (title.includes('dress')) slug = 'dress';
    else if (title.includes('hat')) slug = 'accessories';
    
    document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
    this.classList.add('active');
    filterByCategory(slug);
  });
});

// ==========================================
// 8. HERO BANNER SLIDER CAROUSEL
// ==========================================

const sliderContainer = document.querySelector('.slider-container');
const bannerSlides = document.querySelectorAll('.slider-item');
let currentSlideIndex = 0;
let bannerInterval = null;

function setupBannerSlider() {
  if (!sliderContainer || bannerSlides.length <= 1) return;

  // Add nav buttons
  const prevBtn = document.createElement('button');
  prevBtn.className = 'banner-nav-btn prev';
  prevBtn.innerHTML = '<ion-icon name="chevron-back-outline"></ion-icon>';
  prevBtn.title = 'Previous slide';

  const nextBtn = document.createElement('button');
  nextBtn.className = 'banner-nav-btn next';
  nextBtn.innerHTML = '<ion-icon name="chevron-forward-outline"></ion-icon>';
  nextBtn.title = 'Next slide';

  const dotsContainer = document.createElement('div');
  dotsContainer.className = 'banner-dots';
  bannerSlides.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = `banner-dot ${i === 0 ? 'active' : ''}`;
    dot.addEventListener('click', () => goToSlide(i));
    dotsContainer.appendChild(dot);
  });

  const bannerEl = document.querySelector('.banner .container');
  if (bannerEl) {
    bannerEl.appendChild(prevBtn);
    bannerEl.appendChild(nextBtn);
    bannerEl.appendChild(dotsContainer);
  }

  prevBtn.addEventListener('click', () => {
    currentSlideIndex = (currentSlideIndex - 1 + bannerSlides.length) % bannerSlides.length;
    goToSlide(currentSlideIndex);
  });

  nextBtn.addEventListener('click', () => {
    currentSlideIndex = (currentSlideIndex + 1) % bannerSlides.length;
    goToSlide(currentSlideIndex);
  });

  function startAutoSlide() {
    bannerInterval = setInterval(() => {
      currentSlideIndex = (currentSlideIndex + 1) % bannerSlides.length;
      goToSlide(currentSlideIndex);
    }, 5000);
  }

  function stopAutoSlide() {
    if (bannerInterval) clearInterval(bannerInterval);
  }

  sliderContainer.addEventListener('mouseenter', stopAutoSlide);
  sliderContainer.addEventListener('mouseleave', startAutoSlide);

  startAutoSlide();
}

function goToSlide(index) {
  if (!sliderContainer || !bannerSlides[index]) return;
  const slideWidth = bannerSlides[index].offsetWidth;
  sliderContainer.scrollTo({
    left: slideWidth * index,
    behavior: 'smooth'
  });

  document.querySelectorAll('.banner-dot').forEach((d, i) => {
    d.classList.toggle('active', i === index);
  });
}

// ==========================================
// 9. DEAL OF THE DAY LIVE COUNTDOWN TIMER
// ==========================================

function startDealCountdown() {
  const daysEl = document.querySelector('.countdown-content:nth-child(1) .display-number');
  const hoursEl = document.querySelector('.countdown-content:nth-child(2) .display-number');
  const minEl = document.querySelector('.countdown-content:nth-child(3) .display-number');
  const secEl = document.querySelector('.countdown-content:nth-child(4) .display-number');

  if (!daysEl || !hoursEl || !minEl || !secEl) return;

  // 4 days from now countdown target
  let targetTime = new Date().getTime() + (4 * 24 * 60 * 60 * 1000) + (14 * 60 * 60 * 1000) + (35 * 60 * 1000);

  function tick() {
    const now = new Date().getTime();
    const diff = targetTime - now;

    if (diff <= 0) {
      targetTime = new Date().getTime() + (5 * 24 * 60 * 60 * 1000);
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    daysEl.textContent = String(days).padStart(2, '0');
    hoursEl.textContent = String(hours).padStart(2, '0');
    minEl.textContent = String(minutes).padStart(2, '0');
    secEl.textContent = String(seconds).padStart(2, '0');
  }

  tick();
  setInterval(tick, 1000);
}

// ==========================================
// 10. CURRENCY SWITCHER
// ==========================================

const currencySelect = document.querySelector('select[name="currency"]');

function setupCurrencySwitcher() {
  if (!currencySelect) return;
  currencySelect.value = AppState.currency.toLowerCase();

  currencySelect.addEventListener('change', (e) => {
    const val = e.target.value.toUpperCase();
    if (ExchangeRates[val]) {
      AppState.currency = val;
      saveCurrency();
      
      // Globally update every price across the entire website
      updateAllPricesOnPage();
      applyGridFilter(AppState.activeCategory, AppState.searchQuery);
      renderCartDrawer();
      renderWishlistDrawer();
      
      const symbol = ExchangeRates[val].symbol;
      showActionToast(`Currency updated to ${val} (${symbol})`);
    }
  });
}

// ==========================================
// 11. SOCIAL PROOF LIVE RECENT PURCHASES TOAST
// ==========================================

function startSocialProofToasts() {
  const toast = document.querySelector('[data-toast]');
  if (!toast || typeof recentPurchases === 'undefined') return;

  const toastClose = document.querySelector('[data-toast-close]');
  if (toastClose) {
    toastClose.addEventListener('click', () => {
      toast.classList.add('closed');
    });
  }

  let purchaseIndex = 0;

  function showNextPurchase() {
    if (toast.classList.contains('user-closed')) return;

    const item = recentPurchases[purchaseIndex];
    purchaseIndex = (purchaseIndex + 1) % recentPurchases.length;

    const img = toast.querySelector('.toast-banner img');
    const msg = toast.querySelector('.toast-message');
    const title = toast.querySelector('.toast-title');
    const meta = toast.querySelector('.toast-meta time');

    if (img) img.src = item.img;
    if (msg) msg.textContent = `Someone in ${item.location} just bought`;
    if (title) title.textContent = item.product;
    if (meta) meta.textContent = item.time;

    toast.classList.remove('closed');

    setTimeout(() => {
      toast.classList.add('closed');
    }, 6000);
  }

  setTimeout(showNextPurchase, 4000);
  setInterval(showNextPurchase, 15000);
}

// ==========================================
// 12. NEWSLETTER SUBSCRIPTION
// ==========================================

function setupNewsletterModal() {
  const modal = document.querySelector('[data-modal]');
  const closeBtn = document.querySelector('[data-modal-close]');
  const closeOverlay = document.querySelector('[data-modal-overlay]');
  const form = modal?.querySelector('form');

  if (!modal) return;

  const isSubscribed = localStorage.getItem('anon_subscribed');
  if (isSubscribed) {
    modal.classList.add('closed');
  }

  const closeModal = () => modal.classList.add('closed');

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (closeOverlay) closeOverlay.addEventListener('click', closeModal);

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = form.querySelector('input[type="email"]');
      if (emailInput && emailInput.value) {
        localStorage.setItem('anon_subscribed', 'true');
        closeModal();
        showActionToast(`Subscribed successfully with ${emailInput.value}!`);
      }
    });
  }
}

// ==========================================
// 13. USER AUTH / ACCOUNT MODAL
// ==========================================

const userAccountBtn = document.querySelector('.header-user-actions .action-btn:first-child');
const authModal = document.getElementById('auth-modal');

function setupAuthModal() {
  if (!userAccountBtn || !authModal) return;

  userAccountBtn.addEventListener('click', () => {
    closeAllDrawersAndModals();
    authModal.classList.add('active');
    if (overlay) overlay.classList.add('active');
  });

  const authTabs = authModal.querySelectorAll('.auth-tab-btn');
  const signinForm = document.getElementById('signin-form');
  const signupForm = document.getElementById('signup-form');

  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      authTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.getAttribute('data-tab');
      if (target === 'signin') {
        signinForm.style.display = 'block';
        signupForm.style.display = 'none';
      } else {
        signinForm.style.display = 'none';
        signupForm.style.display = 'block';
      }
    });
  });

  if (signinForm) {
    signinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      closeAllDrawersAndModals();
      showActionToast('Welcome back! Successfully logged in.');
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      closeAllDrawersAndModals();
      showActionToast('Account created successfully! Welcome to Anon.');
    });
  }
}

// ==========================================
// 14. CHECKOUT SIMULATION & ORDER CONFIRMATION
// ==========================================

const checkoutModal = document.getElementById('checkout-modal');
const orderSuccessModal = document.getElementById('order-success-modal');
const proceedCheckoutBtn = document.getElementById('proceed-checkout-btn');
const checkoutForm = document.getElementById('checkout-form');

function setupCheckout() {
  if (proceedCheckoutBtn) {
    proceedCheckoutBtn.addEventListener('click', () => {
      if (AppState.cart.length === 0) {
        showActionToast('Your cart is empty!', 'info');
        return;
      }
      closeAllDrawersAndModals();
      if (checkoutModal) {
        checkoutModal.classList.add('active');
        if (overlay) overlay.classList.add('active');

        // Populate Checkout Order Preview
        const { subtotal, discount, shippingCost, total } = getCartCalculations();
        const summaryEl = document.getElementById('checkout-summary-box');
        if (summaryEl) {
          summaryEl.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px; color: var(--eerie-black);">Order Summary (${AppState.cart.length} unique items)</div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Subtotal:</span> <span>${formatPrice(subtotal)}</span></div>
            ${discount > 0 ? `<div style="display:flex; justify-content:space-between; margin-bottom:4px; color:var(--ocean-green);"><span>Promo Discount:</span> <span>-${formatPrice(discount)}</span></div>` : ''}
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Shipping:</span> <span>${shippingCost === 0 ? 'FREE' : formatPrice(shippingCost)}</span></div>
            <div style="display:flex; justify-content:space-between; font-weight:700; font-size:16px; border-top:1px solid var(--border-color); padding-top:6px; color:var(--eerie-black);"><span>Total:</span> <span>${formatPrice(total)}</span></div>
          `;
        }
      }
    });
  }

  // Payment method buttons selector
  document.querySelectorAll('.payment-method-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
    });
  });

  if (checkoutForm) {
    checkoutForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const orderId = 'ANON-' + Math.floor(100000 + Math.random() * 900000);
      const name = checkoutForm.querySelector('#checkout-name')?.value || 'Valued Customer';
      
      // Clear cart
      AppState.cart = [];
      saveCart();
      updateCartBadges();
      renderCartDrawer();

      closeAllDrawersAndModals();

      // Show Order Success Modal
      if (orderSuccessModal) {
        const orderIdEl = document.getElementById('success-order-id');
        const customerNameEl = document.getElementById('success-customer-name');
        if (orderIdEl) orderIdEl.textContent = orderId;
        if (customerNameEl) customerNameEl.textContent = name;
        orderSuccessModal.classList.add('active');
        if (overlay) overlay.classList.add('active');
      }

      showActionToast('Order placed successfully! 🎉');
    });
  }
}

// ==========================================
// 15. MOBILE MENU & ACCORDIONS
// ==========================================

function setupMobileNavigation() {
  const mobileMenuOpenBtns = document.querySelectorAll('[data-mobile-menu-open-btn]');
  const mobileMenu = document.querySelector('.mobile-navigation-menu');
  const sidebar = document.querySelector('.sidebar');

  mobileMenuOpenBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-mobile-menu-type');
      closeAllDrawersAndModals();
      if (type === 'sidebar' && sidebar) {
        sidebar.classList.add('active');
      } else if (mobileMenu) {
        mobileMenu.classList.add('active');
      }
      if (overlay) overlay.classList.add('active');
    });
  });

  // Accordion toggles
  document.querySelectorAll('[data-accordion-btn]').forEach(btn => {
    btn.addEventListener('click', function() {
      const submenu = this.nextElementSibling;
      if (submenu) {
        submenu.classList.toggle('active');
        this.classList.toggle('active');
      }
    });
  });
}

// ==========================================
// 16. INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  updateCartBadges();
  updateWishlistBadges();
  updateAllPricesOnPage();
  renderCartDrawer();
  renderWishlistDrawer();
  applyGridFilter('all');
  setupBannerSlider();
  startDealCountdown();
  setupCurrencySwitcher();
  startSocialProofToasts();
  setupNewsletterModal();
  setupAuthModal();
  setupCheckout();
  setupMobileNavigation();

  // Attach deal of the day add to cart button
  document.querySelectorAll('.product-featured .add-cart-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      addToCart('deal-1');
    });
  });
});