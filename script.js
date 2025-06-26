// script.js
import { db, auth } from './firebase.js';
import { 
  collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, 
  query, where, addDoc, onSnapshot 
} from "firebase/firestore";
import { 
  signInWithEmailAndPassword, onAuthStateChanged 
} from "firebase/auth";

// Constants
const PATHS = {
  PRODUCTS: "products",
  SALES: "sales",
  SHIFTS: "shifts",
  SHIFT_HISTORY: "shiftHistory"
};

// State Management
let unsubscribeCallbacks = [];

// Utility Functions
function showErrorToast(message) {
  const toast = document.createElement('div');
  toast.className = 'cart-notification error';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function sanitizeInput(input) {
  if (typeof input === 'string') {
    return input.replace(/<[^>]*>/g, "").trim();
  }
  return input;
}

async function safeFirestoreOperation(operation, errorMessage) {
  try {
    return await operation();
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    showErrorToast(errorMessage);
    throw error;
  }
}

// Authentication
async function checkAuth() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        showLoginModal();
        resolve(false);
      } else {
        resolve(true);
      }
    }, (error) => {
      console.error("Auth state error:", error);
      showErrorToast("Authentication error. Working in offline mode.");
      resolve(false);
    });
    unsubscribeCallbacks.push(unsubscribe);
  });
}

function showLoginModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'block';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 400px;">
      <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
      <h2><i class="fas fa-lock"></i> Login</h2>
      <div style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
        <input type="email" id="login-email" placeholder="Email" required style="padding: 10px; border-radius: 5px; border: 1px solid #ddd;">
        <input type="password" id="login-password" placeholder="Password" required style="padding: 10px; border-radius: 5px; border: 1px solid #ddd;">
        <button id="login-btn" class="btn" style="margin-top: 10px;">
          <i class="fas fa-sign-in-alt"></i> Login
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('login-btn').addEventListener('click', async () => {
    const email = sanitizeInput(document.getElementById('login-email').value);
    const password = document.getElementById('login-password').value;
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      modal.remove();
    } catch (error) {
      showErrorToast("Login failed: " + error.message);
    }
  });
}

// Data Operations
async function getProducts() {
  return safeFirestoreOperation(async () => {
    const querySnapshot = await getDocs(collection(db, PATHS.PRODUCTS));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }, "Failed to load products");
}

async function saveProducts(products) {
  return safeFirestoreOperation(async () => {
    const batch = [];
    const productsCollection = collection(db, PATHS.PRODUCTS);
    
    // Clear existing products
    const existingProducts = await getDocs(productsCollection);
    existingProducts.forEach(doc => batch.push(deleteDoc(doc.ref)));
    
    // Add new products
    products.forEach(product => {
      const productRef = doc(productsCollection, product.id);
      batch.push(setDoc(productRef, {
        name: sanitizeInput(product.name),
        price: Number(product.price),
        quantity: product.quantity === 'unlimited' ? 'unlimited' : Number(product.quantity)
      }));
    });
    
    await Promise.all(batch);
  }, "Failed to save products");
}

async function getSales() {
  return safeFirestoreOperation(async () => {
    const querySnapshot = await getDocs(collection(db, PATHS.SALES));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }, "Failed to load sales");
}

async function saveSales(sales) {
  return safeFirestoreOperation(async () => {
    const batch = [];
    const salesCollection = collection(db, PATHS.SALES);
    
    const existingSales = await getDocs(salesCollection);
    existingSales.forEach(doc => batch.push(deleteDoc(doc.ref)));
    
    sales.forEach(sale => {
      const saleRef = doc(salesCollection, sale.id);
      batch.push(setDoc(saleRef, {
        date: sale.date,
        items: sale.items.map(item => ({
          productId: item.productId,
          name: sanitizeInput(item.name),
          price: Number(item.price),
          quantity: Number(item.quantity)
        })),
        total: Number(sale.total),
        paymentMethod: sale.paymentMethod,
        shiftId: sale.shiftId,
        refunded: Boolean(sale.refunded),
        refundDate: sale.refundDate || null,
        refundShiftId: sale.refundShiftId || null
      }));
    });
    
    await Promise.all(batch);
  }, "Failed to save sales");
}

async function getActiveShift() {
  return safeFirestoreOperation(async () => {
    const docRef = doc(db, PATHS.SHIFTS, "active");
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  }, "Failed to load shift data");
}

async function saveActiveShift(shift) {
  return safeFirestoreOperation(async () => {
    await setDoc(doc(db, PATHS.SHIFTS, "active"), {
      ...shift,
      cashTotal: Number(shift.cashTotal),
      momoTotal: Number(shift.momoTotal),
      total: Number(shift.total),
      startingCash: Number(shift.startingCash)
    });
  }, "Failed to save shift data");
}

async function getShiftHistory() {
  return safeFirestoreOperation(async () => {
    const querySnapshot = await getDocs(collection(db, PATHS.SHIFT_HISTORY));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }, "Failed to load shift history");
}

async function saveShiftHistory(history) {
  return safeFirestoreOperation(async () => {
    const batch = [];
    const historyCollection = collection(db, PATHS.SHIFT_HISTORY);
    
    const existingHistory = await getDocs(historyCollection);
    existingHistory.forEach(doc => batch.push(deleteDoc(doc.ref)));
    
    history.forEach(shift => {
      const shiftRef = doc(historyCollection, shift.id);
      batch.push(setDoc(shiftRef, {
        startTime: shift.startTime,
        endTime: shift.endTime,
        sales: shift.sales || [],
        cashTotal: Number(shift.cashTotal || 0),
        momoTotal: Number(shift.momoTotal || 0),
        total: Number(shift.total || 0),
        Cashier: sanitizeInput(shift.Cashier || "Cashier"),
        startingCash: Number(shift.startingCash || 0),
        refunds: shift.refunds || [],
        date: shift.startTime.split('T')[0],
        duration: formatDuration(shift.startTime, shift.endTime)
      }));
    });
    
    await Promise.all(batch);
  }, "Failed to save shift history");
}

// Core Application Logic
async function initApp() {
  showLoader();
  
  try {
    // Initialize Firebase listeners
    setupRealtimeUpdates();
    
    // Check authentication
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) return;
    
    // Initialize tabs
    initTabSystem();
    initPOSTab();
    initReceiptsTab();
    initSummaryTab();
    initStockTab();
    initShiftTab();
    
    // Load initial data
    await checkActiveShift();
    await checkLowStock();
  } catch (error) {
    console.error("Initialization error:", error);
    showErrorToast("Failed to initialize app");
  } finally {
    hideLoader();
  }
}

function initTabSystem() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  // Deactivate all tab buttons
  document.querySelectorAll('.tab-btn').forEach(button => {
    button.classList.remove('active');
  });

  // Activate the selected tab
  document.getElementById(tabId).classList.add('active');
  document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');

  // Refresh the tab content
  switch(tabId) {
    case 'pos':
      loadProducts();
      updateCartDisplay();
      break;
    case 'receipts':
      loadReceipts();
      break;
    case 'summary':
      loadSummary();
      break;
    case 'stock':
      loadStockItems();
      checkLowStock();
      break;
    case 'shift':
      updateShiftDisplay();
      break;
  }
}

// ... [Rest of the code remains the same but with added error handling]
// Note: Due to length, I've shown the critical updates. The complete file would include
// all your original functions but wrapped with error handling like the examples above.

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  initApp();
});

// Clean up listeners when page unloads
window.addEventListener('beforeunload', () => {
  unsubscribeCallbacks.forEach(unsubscribe => unsubscribe());
});