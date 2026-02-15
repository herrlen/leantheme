/**
 * LEAN THEME - Cart Drawer JavaScript
 * Complete Ajax Cart with Accessibility Support.
 *
 * Features:
 * - Ajax Add/Update/Remove
 * - Section Rendering API
 * - Focus Trap for A11y
 * - Escape to close
 * - Cart count badge animation
 */

'use strict';

const LeanCart = (() => {
  // State
  let isOpen = false;
  let isUpdating = false;
  let triggerElement = null;
  let focusableElements = [];
  let firstFocusable = null;
  let lastFocusable = null;

  // DOM Cache
  const elements = {};

  // Selectors
  const SELECTORS = {
    drawer: '[data-cart-drawer]',
    backdrop: '.cart-drawer__backdrop',
    panel: '.cart-drawer__panel',
    close: '[data-cart-drawer-close]',
    items: '[data-cart-items]',
    item: '[data-cart-item]',
    footer: '[data-cart-footer]',
    subtotal: '[data-cart-subtotal]',
    count: '[data-cart-count]',
    countBadge: '[data-cart-count-badge]',
    loading: '[data-cart-loading]',
    shippingMeter: '[data-shipping-meter]',
    qtyChange: '[data-qty-change]',
    qtyInput: '.cart-item__qty-input',
    removeItem: '[data-remove-item]',
    cartNote: '[data-cart-note]',
    cartIcon: '[data-cart-icon]'
  };

  /**
   * Cache DOM elements
   */
  const cacheElements = () => {
    elements.drawer = document.querySelector(SELECTORS.drawer);
    elements.backdrop = document.querySelector(SELECTORS.backdrop);
    elements.panel = document.querySelector(SELECTORS.panel);
    elements.items = document.querySelector(SELECTORS.items);
    elements.footer = document.querySelector(SELECTORS.footer);
    elements.loading = document.querySelector(SELECTORS.loading);
    elements.shippingMeter = document.querySelector(SELECTORS.shippingMeter);
  };

  /**
   * Update focusable elements for focus trap
   */
  const updateFocusableElements = () => {
    if (!elements.panel) return;

    const focusableSelectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    focusableElements = [...elements.panel.querySelectorAll(focusableSelectors)];
    firstFocusable = focusableElements[0];
    lastFocusable = focusableElements[focusableElements.length - 1];
  };

  /**
   * Focus trap handler
   * @param {KeyboardEvent} e
   */
  const handleFocusTrap = (e) => {
    if (e.key !== 'Tab' || !isOpen) return;

    updateFocusableElements();

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  };

  /**
   * Open cart drawer
   * @param {Element} [trigger] - Element that triggered the open
   */
  const open = (trigger = null) => {
    if (!elements.drawer || isOpen) return;

    triggerElement = trigger || document.activeElement;
    isOpen = true;

    // Update ARIA
    elements.drawer.setAttribute('aria-hidden', 'false');
    elements.drawer.classList.add('is-open');
    document.body.classList.add('no-scroll');

    // Refresh cart and focus
    refreshCart().then(() => {
      updateFocusableElements();
      elements.panel?.focus();
    });

    // Dispatch event
    document.dispatchEvent(new CustomEvent('cart:opened'));
  };

  /**
   * Close cart drawer
   */
  const close = () => {
    if (!elements.drawer || !isOpen) return;

    isOpen = false;

    // Update ARIA
    elements.drawer.setAttribute('aria-hidden', 'true');
    elements.drawer.classList.remove('is-open');
    document.body.classList.remove('no-scroll');

    // Return focus to trigger
    if (triggerElement && triggerElement.focus) {
      triggerElement.focus();
    }

    triggerElement = null;

    // Dispatch event
    document.dispatchEvent(new CustomEvent('cart:closed'));
  };

  /**
   * Toggle cart drawer
   */
  const toggle = () => {
    isOpen ? close() : open();
  };

  /**
   * Show loading state
   */
  const showLoading = () => {
    elements.loading?.removeAttribute('hidden');
  };

  /**
   * Hide loading state
   */
  const hideLoading = () => {
    elements.loading?.setAttribute('hidden', '');
  };

  /**
   * Fetch cart data
   * @returns {Promise<Object|null>}
   */
  const fetchCart = async () => {
    try {
      const response = await fetch('/cart.js', {
        headers: { 'Content-Type': 'application/json' }
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch cart:', error);
      return null;
    }
  };

  /**
   * Refresh cart drawer using Section Rendering API
   */
  const refreshCart = async () => {
    try {
      const response = await fetch('/?section_id=cart-drawer');
      const html = await response.text();

      // Parse HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const newDrawer = doc.querySelector(SELECTORS.drawer);

      if (newDrawer && elements.drawer) {
        // Preserve open state class
        const wasOpen = elements.drawer.classList.contains('is-open');

        // Replace inner content but keep container
        const newPanel = newDrawer.querySelector(SELECTORS.panel);
        const currentPanel = elements.drawer.querySelector(SELECTORS.panel);

        if (newPanel && currentPanel) {
          currentPanel.innerHTML = newPanel.innerHTML;
        }

        // Re-cache elements
        elements.items = elements.drawer.querySelector(SELECTORS.items);
        elements.footer = elements.drawer.querySelector(SELECTORS.footer);
        elements.loading = elements.drawer.querySelector(SELECTORS.loading);
        elements.shippingMeter = elements.drawer.querySelector(SELECTORS.shippingMeter);

        // Maintain open state
        if (wasOpen) {
          elements.drawer.classList.add('is-open');
        }
      }

      // Update badges
      await updateCartBadges();

    } catch (error) {
      console.error('Failed to refresh cart:', error);
    }
  };

  /**
   * Format money
   * @param {number} cents
   * @returns {string}
   */
  const formatMoney = (cents) => {
    if (window.Shopify?.formatMoney) {
      return window.Shopify.formatMoney(cents);
    }
    if (window.LeanTheme?.formatMoney) {
      return window.LeanTheme.formatMoney(cents);
    }
    return (cents / 100).toFixed(2).replace('.', ',') + ' €';
  };

  /**
   * Update all cart count badges
   */
  const updateCartBadges = async () => {
    const cart = await fetchCart();
    if (!cart) return;

    const count = cart.item_count;

    // Update drawer count
    document.querySelectorAll(SELECTORS.count).forEach(el => {
      el.textContent = `(${count})`;
    });

    // Update icon badges
    document.querySelectorAll(SELECTORS.countBadge).forEach(badge => {
      badge.textContent = count;

      if (count > 0) {
        badge.classList.remove('cart-icon__badge--hidden');
        // Bump animation
        badge.classList.remove('is-bumping');
        void badge.offsetWidth;
        badge.classList.add('is-bumping');
      } else {
        badge.classList.add('cart-icon__badge--hidden');
      }
    });

    // Update shipping meter
    updateShippingMeter(cart.total_price);

    return cart;
  };

  /**
   * Notify shipping meter of updated cart total
   * @param {number} totalPrice - Cart total in cents
   */
  const updateShippingMeter = (totalPrice) => {
    document.dispatchEvent(new CustomEvent('shipping-meter:update', {
      detail: { totalPrice }
    }));
  };

  /**
   * Update cart item quantity
   * @param {string} key - Line item key
   * @param {number} quantity
   */
  const updateItem = async (key, quantity) => {
    if (isUpdating) return;
    isUpdating = true;

    // Show loading on specific item
    const item = document.querySelector(`${SELECTORS.item}[data-line-key="${key}"]`);
    item?.classList.add('is-updating');

    showLoading();

    try {
      const response = await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key, quantity })
      });

      if (!response.ok) throw new Error('Update failed');

      await refreshCart();

      document.dispatchEvent(new CustomEvent('cart:updated'));
    } catch (error) {
      console.error('Cart update error:', error);
      item?.classList.remove('is-updating');
    } finally {
      isUpdating = false;
      hideLoading();
    }
  };

  /**
   * Remove item from cart
   * @param {string} key
   */
  const removeItem = (key) => {
    updateItem(key, 0);
  };

  /**
   * Add item to cart
   * @param {FormData|Object} data
   * @param {boolean} openDrawer
   */
  const addItem = async (data, openDrawer = true) => {
    showLoading();

    try {
      const body = data instanceof FormData ? data : JSON.stringify(data);
      const headers = data instanceof FormData ? {} : { 'Content-Type': 'application/json' };

      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers,
        body
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.description || errorData.message || 'Add to cart failed';
        console.error('Shopify /cart/add.js error:', response.status, errorData);
        throw new Error(msg);
      }

      const item = await response.json();

      await refreshCart();

      if (openDrawer) {
        open();
      }

      document.dispatchEvent(new CustomEvent('cart:item-added', { detail: item }));

      return item;
    } catch (error) {
      console.error('Add to cart error:', error);
      throw error;
    } finally {
      hideLoading();
    }
  };

  /**
   * Update cart note
   * @param {string} note
   */
  const updateNote = async (note) => {
    try {
      await fetch('/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note })
      });
    } catch (error) {
      console.error('Failed to update note:', error);
    }
  };

  /**
   * Handle add to cart form submission
   * @param {Event} e
   */
  const handleAddToCart = async (e) => {
    const form = e.target;
    const action = form.getAttribute('action');

    if (!action || !action.includes('/cart/add')) return;

    // Debug: Log variant ID and form data
    const variantId = form.querySelector('[name="id"]')?.value;
    console.log('[LeanCart] Form action:', action);
    console.log('[LeanCart] Variant ID:', variantId);

    if (!variantId) {
      console.error('[LeanCart] No variant ID found — letting form submit natively');
      return; // Don't prevent default, let native form submit
    }

    e.preventDefault();

    const btn = form.querySelector('[type="submit"]');
    if (!btn) return;

    const originalHTML = btn.innerHTML;

    btn.disabled = true;
    btn.textContent = 'Wird hinzugefügt...';

    try {
      const formData = new FormData(form);

      // Debug: Log all form data entries
      for (const [key, val] of formData.entries()) {
        console.log('[LeanCart] FormData:', key, '=', val);
      }

      const autoOpen = elements.drawer?.dataset.autoOpen !== 'false';
      await addItem(formData, autoOpen);

      btn.textContent = 'Hinzugefügt!';
      btn.classList.add('is-success');

      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        btn.classList.remove('is-success');
      }, 1500);

    } catch (error) {
      console.error('[LeanCart] AJAX failed:', error.message, '— falling back to native submit');
      btn.disabled = false;
      btn.innerHTML = originalHTML;
      form.submit();
    }
  };

  /**
   * Handle quantity button clicks
   * @param {Event} e
   */
  const handleQuantityClick = (e) => {
    const btn = e.target.closest(SELECTORS.qtyChange);
    if (!btn) return;

    const key = btn.dataset.lineKey;
    const change = parseInt(btn.dataset.qtyChange) || 0;
    const item = btn.closest(SELECTORS.item);
    const input = item?.querySelector(SELECTORS.qtyInput);
    const currentQty = parseInt(input?.value) || 1;
    const newQty = Math.max(0, currentQty + change);

    updateItem(key, newQty);
  };

  /**
   * Handle quantity input change
   * @param {Event} e
   */
  const handleQuantityInput = (e) => {
    if (!e.target.matches(SELECTORS.qtyInput)) return;

    const key = e.target.dataset.lineKey;
    const newQty = parseInt(e.target.value) || 0;

    updateItem(key, newQty);
  };

  /**
   * Handle remove button click
   * @param {Event} e
   */
  const handleRemoveClick = (e) => {
    const btn = e.target.closest(SELECTORS.removeItem);
    if (!btn) return;

    const key = btn.dataset.lineKey;
    removeItem(key);
  };

  /**
   * Handle cart icon click
   * @param {Event} e
   */
  const handleCartIconClick = (e) => {
    const icon = e.target.closest(SELECTORS.cartIcon);
    if (!icon) return;

    e.preventDefault();
    open(icon);
  };

  /**
   * Handle close button/backdrop click
   * @param {Event} e
   */
  const handleCloseClick = (e) => {
    if (e.target.closest(SELECTORS.close)) {
      close();
    }
  };

  /**
   * Handle keyboard events
   * @param {KeyboardEvent} e
   */
  const handleKeydown = (e) => {
    if (e.key === 'Escape' && isOpen) {
      close();
    }

    handleFocusTrap(e);
  };

  /**
   * Handle cart note change (debounced)
   * @param {Event} e
   */
  let noteTimeout;
  const handleNoteChange = (e) => {
    if (!e.target.matches(SELECTORS.cartNote)) return;

    clearTimeout(noteTimeout);
    noteTimeout = setTimeout(() => {
      updateNote(e.target.value);
    }, 500);
  };

  /**
   * Initialize event listeners
   */
  const bindEvents = () => {
    // Form submissions
    document.addEventListener('submit', handleAddToCart);

    // Click events (delegated)
    document.addEventListener('click', (e) => {
      handleCartIconClick(e);
      handleCloseClick(e);
      handleQuantityClick(e);
      handleRemoveClick(e);
    });

    // Input changes
    document.addEventListener('change', (e) => {
      handleQuantityInput(e);
      handleNoteChange(e);
    });

    // Keyboard
    document.addEventListener('keydown', handleKeydown);

    // Custom events
    document.addEventListener('cart:open', () => open());
    document.addEventListener('cart:close', () => close());
  };

  /**
   * Initialize cart module
   */
  const init = () => {
    cacheElements();
    bindEvents();

    // Initial badge update
    updateCartBadges();

    // Dispatch ready event
    document.dispatchEvent(new CustomEvent('cart:ready'));
  };

  // Public API
  return {
    init,
    open,
    close,
    toggle,
    refreshCart,
    addItem,
    updateItem,
    removeItem,
    updateNote,
    updateCartBadges,
    isOpen: () => isOpen
  };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', LeanCart.init);
} else {
  LeanCart.init();
}

// Expose for external access
window.LeanCart = LeanCart;
window.openCartDrawer = LeanCart.open;
window.closeCartDrawer = LeanCart.close;
window.refreshCartDrawer = LeanCart.refreshCart;
window.updateCartBadge = LeanCart.updateCartBadges;
