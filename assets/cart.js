/* ==============================
   LEAN AJAX CART LOGIC (PRO)
   ============================== */

// Drawer öffnen/schließen
function openCartDrawer() {
  document.getElementById('CartDrawer').classList.add('is-open');
  const overlay = document.querySelector('.drawer-overlay');
  if (overlay) overlay.classList.add('is-open');
  document.body.classList.add('no-scroll');
}

function closeCartDrawer() {
  document.getElementById('CartDrawer').classList.remove('is-open');
  const overlay = document.querySelector('.drawer-overlay');
  if (overlay) overlay.classList.remove('is-open');
  document.body.classList.remove('no-scroll');
}

// 1. Drawer Inhalt aktualisieren (HTML Render API)
async function refreshCartDrawer() {
  try {
    const response = await fetch('/?section_id=cart-drawer');
    const text = await response.text();
    
    // HTML parsen und austauschen
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(text, 'text/html');
    const newDrawerContent = htmlDoc.querySelector('#CartDrawer').innerHTML;
    
    document.querySelector('#CartDrawer').innerHTML = newDrawerContent;
  } catch (e) {
    console.error('Fehler beim Laden des Warenkorbs:', e);
  }
}

// 2. Header Zähler aktualisieren (JSON API)
async function updateCartBadge() {
  try {
    const response = await fetch('/cart.js');
    const cart = await response.json();
    const count = cart.item_count;

    // Wir suchen alle Icons (Desktop & Mobile falls vorhanden)
    const wrappers = document.querySelectorAll('.cart-icon-wrapper');

    wrappers.forEach(wrapper => {
      let badge = wrapper.querySelector('.cart-count');
      
      if (count > 0) {
        // Wenn noch kein Badge da ist -> Erstellen
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'cart-count';
          wrapper.appendChild(badge);
        }
        // Zahl updaten (kleine Animation)
        badge.innerText = count;
        badge.classList.remove('bump'); // Reset Animation
        void badge.offsetWidth; // Trigger Reflow
        badge.classList.add('bump'); // Animation starten
      } else {
        // Wenn Warenkorb leer -> Badge entfernen
        if (badge) badge.remove();
      }
    });

  } catch (e) {
    console.error('Fehler beim Zählen:', e);
  }
}

// "In den Warenkorb" Events abfangen
document.addEventListener('submit', function(event) {
  const form = event.target;
  
  // Prüfen, ob es ein "Add to Cart" Formular ist
  if (form.getAttribute('action') === '/cart/add') {
    event.preventDefault(); // Stoppt das normale Neuladen
    
    const submitBtn = form.querySelector('[type="submit"]');
    if(!submitBtn) return;

    const originalText = submitBtn.innerText;
    
    // Feedback geben
    submitBtn.innerText = 'Wird hinzugefügt...';
    submitBtn.disabled = true;

    const formData = new FormData(form);
    
    // Daten senden
    fetch('/cart/add.js', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      // Parallel: Drawer neu laden UND Zähler updaten
      Promise.all([refreshCartDrawer(), updateCartBadge()]).then(() => {
        openCartDrawer(); // Drawer öffnen
        
        // Button zurücksetzen
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
      });
    })
    .catch(error => {
      console.error('Error:', error);
      submitBtn.innerText = originalText;
      submitBtn.disabled = false;
    });
  }
});