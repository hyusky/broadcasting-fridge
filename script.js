/**
 * Beverage Sales & Inventory Management – Script (Firebase Database Edition)
 * All UI strings are in Korean (한국어).
 * Data is synchronized in real-time via Firebase Realtime Database.
 */

// ═══════════════════════════════════════════════
// DATABASE CONFIGURATION & INITIALIZATION
// ═══════════════════════════════════════════════

const firebaseConfig = {
  databaseURL: "https://broadcasting-fridge-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// Emoji map for new drinks (fallback decoration)
const DRINK_EMOJIS = ['🥤', '🧃', '☕', '🍵', '🧋', '🥛', '🍺', '🫧', '🍹', '🍷'];

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════

let currentDrinks = {};   // Object mapping drinkId -> drinkData
let currentOrders = [];   // Array of orders sorted by timestamp desc
let selectedDrink = null; // Drink object currently selected in modal

// Seed default inventory if database is empty
function seedInventoryIfNeeded() {
  db.ref('inventory').once('value').then(snapshot => {
    if (!snapshot.exists()) {
      const defaultDrinks = {
        "pocarisweat": {
          id: "pocarisweat",
          name: "포카리스웨트",
          price: 1500,
          stock: 48,
          emoji: "💧"
        },
        "ohyes": {
          id: "ohyes",
          name: "오예스",
          price: 0,
          stock: 56,
          emoji: "🍫"
        }
      };
      db.ref('inventory').set(defaultDrinks);
    }
  });
}

// ═══════════════════════════════════════════════
// REAL-TIME LISTENERS
// ═══════════════════════════════════════════════

// Listen to inventory in real-time
db.ref('inventory').on('value', (snapshot) => {
  const data = snapshot.val();
  currentDrinks = data || {};
  
  // Refresh UI based on the active view
  refreshDrinkGrid();
  if (document.getElementById('admin-view').classList.contains('active')) {
    refreshAdminView();
  }
});

// Listen to orders in real-time
db.ref('orders').on('value', (snapshot) => {
  const data = snapshot.val();
  if (data) {
    // Map object to array and sort by timestamp descending
    currentOrders = Object.keys(data).map(key => ({
      id: key,
      ...data[key]
    })).sort((a, b) => b.timestamp - a.timestamp);
  } else {
    currentOrders = [];
  }

  // Refresh UI based on the active view
  if (document.getElementById('admin-view').classList.contains('active')) {
    refreshAdminView();
  }
});

// ═══════════════════════════════════════════════
// VIEW SWITCHING
// ═══════════════════════════════════════════════

function switchView(view) {
  document.getElementById('user-view').classList.toggle('active', view === 'user');
  document.getElementById('admin-view').classList.toggle('active', view === 'admin');
  document.getElementById('btn-user-view').classList.toggle('active', view === 'user');
  document.getElementById('btn-admin-view').classList.toggle('active', view === 'admin');

  if (view === 'admin') {
    refreshAdminView();
  } else {
    refreshDrinkGrid();
  }
}

// Make functions globally accessible for inline HTML handlers
window.switchView = switchView;

// ═══════════════════════════════════════════════
// USER VIEW – DRINK GRID
// ═══════════════════════════════════════════════

function refreshDrinkGrid() {
  const grid = document.getElementById('drink-grid');
  const emptyMsg = document.getElementById('empty-drinks-msg');
  const drinkIds = Object.keys(currentDrinks);

  if (drinkIds.length === 0) {
    grid.innerHTML = '';
    emptyMsg.style.display = 'block';
    return;
  }

  emptyMsg.style.display = 'none';
  grid.innerHTML = drinkIds.map(id => {
    const drink = currentDrinks[id];
    const outOfStock = drink.stock <= 0;
    const stockClass = outOfStock ? 'empty' : drink.stock <= 5 ? 'low' : '';
    const stockLabel = outOfStock ? '품절' : `${drink.stock}개 남음`;
    const priceText = drink.price === 0 ? '0원' : `${drink.price.toLocaleString()}원`;

    return `
      <div class="drink-card ${outOfStock ? 'out-of-stock' : ''}" id="drink-${drink.id}">
        <div class="drink-img-wrapper">
          <span class="drink-emoji">${drink.emoji || '🥤'}</span>
          <span class="stock-badge ${stockClass}">${stockLabel}</span>
        </div>
        <div class="drink-info">
          <div class="drink-name">${escapeHtml(drink.name)}</div>
          <div class="drink-price">${priceText} <small>/ 1개</small></div>
          <button class="btn-order" onclick="openOrderModal('${drink.id}')" ${outOfStock ? 'disabled' : ''}>
            🛒 주문하기
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════════════
// ORDER MODAL & BANK INFO COPY
// ═══════════════════════════════════════════════

function openOrderModal(drinkId) {
  selectedDrink = currentDrinks[drinkId];
  if (!selectedDrink || selectedDrink.stock <= 0) {
    showToast('해당 상품은 품절되었습니다.', 'error');
    return;
  }

  const priceText = selectedDrink.price === 0 ? '0원' : `${selectedDrink.price.toLocaleString()}원`;

  // Fill modal drink info
  document.getElementById('modal-drink-info').innerHTML = `
    <div class="drink-name-modal">${selectedDrink.emoji} ${escapeHtml(selectedDrink.name)}</div>
    <div class="drink-price-modal">${priceText}</div>
  `;

  // Set transfer amount display
  document.getElementById('modal-transfer-amount').textContent = priceText;

  // Hide transfer section completely for 0원 items
  const payBtnSection = document.getElementById('modal-pay-btn-section');
  if (selectedDrink.price > 0) {
    payBtnSection.style.display = 'block';
  } else {
    payBtnSection.style.display = 'none';
  }

  document.getElementById('order-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeOrderModal() {
  document.getElementById('order-modal').classList.remove('open');
  document.body.style.overflow = '';
  selectedDrink = null;
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('order-modal')) {
    closeOrderModal();
  }
}

function copyAccountNumber() {
  const accountNo = "토스뱅크 1002-0214-0999";
  navigator.clipboard.writeText(accountNo).then(() => {
    showToast('계좌번호가 클립보드에 복사되었습니다!', 'success');
  }).catch(() => {
    showToast('계좌번호 복사에 실패했습니다. 직접 복사해주세요.', 'error');
  });
}

// Make modal functions globally accessible
window.openOrderModal = openOrderModal;
window.closeOrderModal = closeOrderModal;
window.closeModalOutside = closeModalOutside;
window.copyAccountNumber = copyAccountNumber;

// ═══════════════════════════════════════════════
// SUBMIT ORDER
// ═══════════════════════════════════════════════

function submitOrder() {
  const userName = document.getElementById('input-user-name').value.trim();
  if (!userName) {
    showToast('주문자 이름을 입력해주세요!', 'error');
    return;
  }
  if (!selectedDrink) {
    showToast('주문할 상품을 선택해주세요.', 'error');
    return;
  }

  // Refresh active check from memory
  const drink = currentDrinks[selectedDrink.id];
  if (!drink || drink.stock <= 0) {
    showToast('죄송합니다. 선택하신 상품이 품절되었습니다.', 'error');
    closeOrderModal();
    return;
  }

  // Create order structure
  const orderData = {
    userName: userName,
    drinkId: drink.id,
    drinkName: drink.name,
    drinkEmoji: drink.emoji || '🥤',
    drinkPrice: drink.price,
    status: 'pending', // pending | completed
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };

  // Push new order to Firebase
  db.ref('orders').push(orderData).then(() => {
    showToast(`${escapeHtml(drink.name)} 주문 완료! 입금이 확인되면 승인됩니다.`, 'success');
    closeOrderModal();
    document.getElementById('input-user-name').value = '';
  }).catch((err) => {
    console.error("Order submission failed:", err);
    showToast('주문 처리에 실패했습니다. 다시 시도해주세요.', 'error');
  });
}

window.submitOrder = submitOrder;

// ═══════════════════════════════════════════════
// ADMIN VIEW RENDERERS
// ═══════════════════════════════════════════════

function refreshAdminView() {
  renderAdminStats();
  renderOrderQueue();
  renderInventoryList();
}

function renderAdminStats() {
  const drinkKeys = Object.keys(currentDrinks);
  const totalDrinks = drinkKeys.length;
  const totalStock = drinkKeys.reduce((s, k) => s + (currentDrinks[k].stock || 0), 0);
  const pendingOrders = currentOrders.filter(o => o.status === 'pending').length;
  const completedOrders = currentOrders.filter(o => o.status === 'completed').length;

  document.getElementById('admin-stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${totalDrinks}</div>
      <div class="stat-label">상품 종류</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${totalStock}</div>
      <div class="stat-label">총 재고 수량</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: var(--warning);">${pendingOrders}</div>
      <div class="stat-label">대기 중 주문</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: var(--success);">${completedOrders}</div>
      <div class="stat-label">승인 완료</div>
    </div>
  `;
}

function renderOrderQueue() {
  const queue = document.getElementById('order-queue');
  const emptyMsg = document.getElementById('empty-orders-msg');
  const pendingBadge = document.getElementById('pending-count-badge');
  const pendingCount = currentOrders.filter(o => o.status === 'pending').length;
  pendingBadge.textContent = pendingCount;

  if (currentOrders.length === 0) {
    queue.innerHTML = '';
    emptyMsg.style.display = 'block';
    return;
  }

  emptyMsg.style.display = 'none';
  queue.innerHTML = currentOrders.map(order => {
    const isPending = order.status === 'pending';
    const statusText = isPending ? '⏳ 입금 대기' : '✅ 완료';
    const statusClass = isPending ? 'pending' : 'completed';
    const time = new Date(order.timestamp);
    const timeStr = isNaN(time.getTime()) ? '-' : `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
    const priceText = order.drinkPrice === 0 ? '0원' : `${order.drinkPrice.toLocaleString()}원`;

    return `
      <div class="order-row" id="order-${order.id}">
        <div class="order-cell name">
          <span class="order-cell-label">주문자</span>
          <span class="order-cell-value">${escapeHtml(order.userName)}</span>
        </div>
        <div class="order-cell drink">
          <span class="order-cell-label">상품</span>
          <span class="order-cell-value">${order.drinkEmoji} ${escapeHtml(order.drinkName)} (${priceText})</span>
        </div>
        <div class="order-cell status">
          <span class="order-cell-label">상태</span>
          <span class="status-tag ${statusClass}">${statusText}</span>
        </div>
        <div class="order-cell" style="flex: 0 0 auto;">
          <span class="order-cell-label">주문 시간</span>
          <span class="order-cell-value" style="color: var(--text-muted);">${timeStr}</span>
        </div>
        <div class="order-cell actions">
          ${isPending ? `<button class="btn btn-success btn-sm" onclick="approveOrder('${order.id}')">✅ 승인</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderInventoryList() {
  const list = document.getElementById('inventory-list');
  const drinkIds = Object.keys(currentDrinks);

  if (drinkIds.length === 0) {
    list.innerHTML = '<div class="empty-state"><span class="empty-icon">📦</span><p>등록된 상품이 없습니다.</p></div>';
    return;
  }

  list.innerHTML = drinkIds.map(id => {
    const drink = currentDrinks[id];
    const priceText = drink.price === 0 ? '0원' : `${drink.price.toLocaleString()}원`;

    return `
      <div class="inventory-row" id="inv-${drink.id}">
        <span class="inv-emoji">${drink.emoji || '🥤'}</span>
        <div class="inv-details">
          <div class="inv-name">${escapeHtml(drink.name)}</div>
          <div class="inv-price">${priceText}</div>
        </div>
        <div class="inv-stock">
          ${drink.stock}<small>개</small>
        </div>
        <div class="inv-actions">
          <input type="number" class="restock-input" id="restock-${drink.id}" placeholder="수량" min="1" value="10" />
          <button class="btn btn-primary btn-sm" onclick="restockDrink('${drink.id}')">➕ 입고</button>
          <button class="btn btn-danger btn-sm" onclick="deleteDrink('${drink.id}')">🗑 삭제</button>
        </div>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════════════
// ADMIN ACTIONS (FIREBASE WRITE & TRANSACTIONS)
// ═══════════════════════════════════════════════

function approveOrder(orderId) {
  const order = currentOrders.find(o => o.id === orderId);
  if (!order || order.status !== 'pending') {
    showToast('유효하지 않은 주문이거나 이미 승인되었습니다.', 'error');
    return;
  }

  // Transactionally decrement drink stock in Firebase
  const stockRef = db.ref(`inventory/${order.drinkId}/stock`);
  stockRef.transaction((currentStock) => {
    if (currentStock === null) return 0;
    return Math.max(0, currentStock - 1);
  }, (error, committed) => {
    if (error) {
      console.error("Stock decrement failed:", error);
      showToast('재고 반영 중 오류가 발생했습니다.', 'error');
    } else if (committed) {
      // Update order status in Firebase
      db.ref(`orders/${orderId}`).update({ status: 'completed' })
        .then(() => {
          showToast(`${escapeHtml(order.userName)}님의 주문이 승인 완료되었습니다.`, 'success');
        })
        .catch(err => {
          console.error("Order status update failed:", err);
          showToast('주문 상태 업데이트에 실패했습니다.', 'error');
        });
    }
  });
}

function restockDrink(drinkId) {
  const input = document.getElementById(`restock-${drinkId}`);
  const qty = parseInt(input.value, 10);
  if (isNaN(qty) || qty <= 0) {
    showToast('올바른 입고 수량을 입력해주세요.', 'error');
    return;
  }

  const drink = currentDrinks[drinkId];
  if (!drink) {
    showToast('해당 상품을 찾을 수 없습니다.', 'error');
    return;
  }

  db.ref(`inventory/${drinkId}/stock`).transaction((currentStock) => {
    return (currentStock || 0) + qty;
  }, (error) => {
    if (error) {
      console.error("Restock failed:", error);
      showToast('입고 처리에 실패했습니다.', 'error');
    } else {
      showToast(`${escapeHtml(drink.name)} 상품 +${qty}개 입고 완료!`, 'success');
      input.value = 10;
    }
  });
}

function deleteDrink(drinkId) {
  const drink = currentDrinks[drinkId];
  if (!drink) return;

  if (!confirm(`정말 '${drink.name}' 상품을 영구 삭제하시겠습니까?`)) return;

  db.ref(`inventory/${drinkId}`).remove()
    .then(() => {
      showToast('상품이 정상적으로 삭제되었습니다.', 'info');
    })
    .catch((err) => {
      console.error("Deletion failed:", err);
      showToast('상품 삭제에 실패했습니다.', 'error');
    });
}

function addNewDrink() {
  const nameInput = document.getElementById('input-new-name');
  const priceInput = document.getElementById('input-new-price');
  const stockInput = document.getElementById('input-new-stock');

  const name = nameInput.value.trim();
  const price = parseInt(priceInput.value, 10);
  const stock = parseInt(stockInput.value, 10);

  if (!name) {
    showToast('상품 이름을 입력해주세요.', 'error');
    nameInput.focus();
    return;
  }
  if (isNaN(price) || price < 0) {
    showToast('올바른 가격을 입력해주세요.', 'error');
    priceInput.focus();
    return;
  }
  if (isNaN(stock) || stock < 0) {
    showToast('올바른 초기 재고 수량을 입력해주세요.', 'error');
    stockInput.focus();
    return;
  }

  // Select a semi-random emoji matching the theme
  const emoji = DRINK_EMOJIS[Math.floor(Math.random() * DRINK_EMOJIS.length)];

  // Generate a key in Firebase
  const newRef = db.ref('inventory').push();
  const newId = newRef.key;

  newRef.set({
    id: newId,
    name: name,
    price: price,
    stock: stock,
    emoji: emoji
  }).then(() => {
    showToast(`'${escapeHtml(name)}' 상품이 성공적으로 추가되었습니다!`, 'success');
    nameInput.value = '';
    priceInput.value = '';
    stockInput.value = '';
  }).catch((err) => {
    console.error("Addition failed:", err);
    showToast('상품 추가에 실패했습니다.', 'error');
  });
}

// Make admin functions globally accessible
window.approveOrder = approveOrder;
window.restockDrink = restockDrink;
window.deleteDrink = deleteDrink;
window.addNewDrink = addNewDrink;

// ═══════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3000);
}

// ═══════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ═══════════════════════════════════════════════
// KEYBOARD SHORTCUTS & INIT
// ═══════════════════════════════════════════════

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeOrderModal();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // Seed defaults if empty
  seedInventoryIfNeeded();
});
