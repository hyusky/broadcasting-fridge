/**
 * Beverage Sales & Inventory Management – Script
 * All UI strings are in Korean (한국어).
 * Data is persisted via localStorage.
 */

// ═══════════════════════════════════════════════
// DATA LAYER – localStorage helpers
// ═══════════════════════════════════════════════

const STORAGE_KEYS = {
  DRINKS: 'fridge_drinks',
  ORDERS: 'fridge_orders',
  VERSION: 'fridge_data_version',
};

// Bump this to force a localStorage reset when seed data changes
const DATA_VERSION = 2;

// Emoji map for drink types (fallback decoration)
const DRINK_EMOJIS = ['🥤', '🧃', '☕', '🍵', '🧋', '🥛', '🍺', '🫧', '🍹', '🍷'];

/**
 * Default seed data – pre-populated drinks
 */
function getDefaultDrinks() {
  return [
    { id: genId(), name: '포카리스웨트', price: 1500, stock: 48, emoji: '💧' },
    { id: genId(), name: '오예스', price: 0, stock: 56, emoji: '🍫' },
  ];
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadDrinks() {
  // Check data version – reset if seed data has changed
  const storedVersion = parseInt(localStorage.getItem(STORAGE_KEYS.VERSION), 10);
  if (storedVersion !== DATA_VERSION) {
    localStorage.removeItem(STORAGE_KEYS.DRINKS);
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.setItem(STORAGE_KEYS.VERSION, DATA_VERSION);
  }

  const raw = localStorage.getItem(STORAGE_KEYS.DRINKS);
  if (!raw) {
    const defaults = getDefaultDrinks();
    saveDrinks(defaults);
    return defaults;
  }
  return JSON.parse(raw);
}

function saveDrinks(drinks) {
  localStorage.setItem(STORAGE_KEYS.DRINKS, JSON.stringify(drinks));
}

function loadOrders() {
  const raw = localStorage.getItem(STORAGE_KEYS.ORDERS);
  return raw ? JSON.parse(raw) : [];
}

function saveOrders(orders) {
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
}

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════

let currentDrinks = loadDrinks();
let currentOrders = loadOrders();
let selectedDrink = null; // drink object selected for ordering

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

// ═══════════════════════════════════════════════
// USER VIEW – DRINK GRID
// ═══════════════════════════════════════════════

function refreshDrinkGrid() {
  currentDrinks = loadDrinks();
  const grid = document.getElementById('drink-grid');
  const emptyMsg = document.getElementById('empty-drinks-msg');

  if (currentDrinks.length === 0) {
    grid.innerHTML = '';
    emptyMsg.style.display = 'block';
    return;
  }

  emptyMsg.style.display = 'none';
  grid.innerHTML = currentDrinks.map(drink => {
    const outOfStock = drink.stock <= 0;
    const stockClass = outOfStock ? 'empty' : drink.stock <= 3 ? 'low' : '';
    const stockLabel = outOfStock ? '품절' : `${drink.stock}개 남음`;

    return `
      <div class="drink-card ${outOfStock ? 'out-of-stock' : ''}" id="drink-${drink.id}">
        <div class="drink-img-wrapper">
          <span class="drink-emoji">${drink.emoji || '🥤'}</span>
          <span class="stock-badge ${stockClass}">${stockLabel}</span>
        </div>
        <div class="drink-info">
          <div class="drink-name">${escapeHtml(drink.name)}</div>
          <div class="drink-price">${drink.price.toLocaleString()}원 <small>/ 1잔</small></div>
          <button class="btn-order" onclick="openOrderModal('${drink.id}')" ${outOfStock ? 'disabled' : ''}>
            🛒 주문하기
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════════════
// ORDER MODAL
// ═══════════════════════════════════════════════

function openOrderModal(drinkId) {
  currentDrinks = loadDrinks();
  selectedDrink = currentDrinks.find(d => d.id === drinkId);
  if (!selectedDrink || selectedDrink.stock <= 0) {
    showToast('해당 음료는 품절되었습니다.', 'error');
    refreshDrinkGrid();
    return;
  }

  // Fill modal – drink info
  document.getElementById('modal-drink-info').innerHTML = `
    <div class="drink-name-modal">${selectedDrink.emoji} ${escapeHtml(selectedDrink.name)}</div>
    <div class="drink-price-modal">${selectedDrink.price.toLocaleString()}원</div>
  `;

  // Fill transfer section – show amount in the prominent button
  const amountText = `${selectedDrink.price.toLocaleString()}원`;
  document.getElementById('modal-transfer-amount').textContent = amountText;

  // Show/hide the payment button section based on price
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
    showToast('음료를 선택해주세요.', 'error');
    return;
  }

  // Re-check stock
  currentDrinks = loadDrinks();
  const drink = currentDrinks.find(d => d.id === selectedDrink.id);
  if (!drink || drink.stock <= 0) {
    showToast('죄송합니다. 해당 음료가 품절되었습니다.', 'error');
    closeOrderModal();
    refreshDrinkGrid();
    return;
  }

  // Create order
  const order = {
    id: genId(),
    userName,
    drinkId: drink.id,
    drinkName: drink.name,
    drinkEmoji: drink.emoji || '🥤',
    drinkPrice: drink.price,
    status: 'pending', // pending | completed
    timestamp: Date.now(),
  };

  currentOrders = loadOrders();
  currentOrders.unshift(order);
  saveOrders(currentOrders);

  closeOrderModal();
  document.getElementById('input-user-name').value = '';
  showToast(`${escapeHtml(drink.name)} 주문이 접수되었습니다! 입금 확인 후 처리됩니다.`, 'success');
  refreshDrinkGrid();
}

// ═══════════════════════════════════════════════
// ADMIN VIEW
// ═══════════════════════════════════════════════

function refreshAdminView() {
  currentDrinks = loadDrinks();
  currentOrders = loadOrders();
  renderAdminStats();
  renderOrderQueue();
  renderInventoryList();
}

function renderAdminStats() {
  const totalDrinks = currentDrinks.length;
  const totalStock = currentDrinks.reduce((s, d) => s + d.stock, 0);
  const pendingOrders = currentOrders.filter(o => o.status === 'pending').length;
  const completedOrders = currentOrders.filter(o => o.status === 'completed').length;

  document.getElementById('admin-stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${totalDrinks}</div>
      <div class="stat-label">음료 종류</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${totalStock}</div>
      <div class="stat-label">총 재고</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: var(--warning);">${pendingOrders}</div>
      <div class="stat-label">대기 중</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: var(--success);">${completedOrders}</div>
      <div class="stat-label">완료</div>
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
    const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;

    return `
      <div class="order-row" id="order-${order.id}">
        <div class="order-cell name">
          <span class="order-cell-label">주문자</span>
          <span class="order-cell-value">${escapeHtml(order.userName)}</span>
        </div>
        <div class="order-cell drink">
          <span class="order-cell-label">음료</span>
          <span class="order-cell-value">${order.drinkEmoji} ${escapeHtml(order.drinkName)} (${order.drinkPrice.toLocaleString()}원)</span>
        </div>
        <div class="order-cell status">
          <span class="order-cell-label">상태</span>
          <span class="status-tag ${statusClass}">${statusText}</span>
        </div>
        <div class="order-cell" style="flex: 0 0 auto;">
          <span class="order-cell-label">시간</span>
          <span class="order-cell-value" style="color: var(--text-muted);">${timeStr}</span>
        </div>
        <div class="order-cell actions">
          ${isPending ? `<button class="btn btn-success btn-sm" onclick="approveOrder('${order.id}')">✅ 승인</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function approveOrder(orderId) {
  currentOrders = loadOrders();
  currentDrinks = loadDrinks();

  const order = currentOrders.find(o => o.id === orderId);
  if (!order || order.status !== 'pending') {
    showToast('해당 주문을 찾을 수 없거나 이미 처리되었습니다.', 'error');
    refreshAdminView();
    return;
  }

  // Decrement stock
  const drink = currentDrinks.find(d => d.id === order.drinkId);
  if (drink) {
    drink.stock = Math.max(0, drink.stock - 1);
    saveDrinks(currentDrinks);
  }

  // Update order status
  order.status = 'completed';
  saveOrders(currentOrders);

  showToast(`${escapeHtml(order.userName)}님의 ${escapeHtml(order.drinkName)} 주문이 승인되었습니다.`, 'success');
  refreshAdminView();
}

// ═══════════════════════════════════════════════
// INVENTORY MANAGEMENT
// ═══════════════════════════════════════════════

function renderInventoryList() {
  const list = document.getElementById('inventory-list');

  if (currentDrinks.length === 0) {
    list.innerHTML = '<div class="empty-state"><span class="empty-icon">📦</span><p>등록된 음료가 없습니다.</p></div>';
    return;
  }

  list.innerHTML = currentDrinks.map(drink => `
    <div class="inventory-row" id="inv-${drink.id}">
      <span class="inv-emoji">${drink.emoji || '🥤'}</span>
      <div class="inv-details">
        <div class="inv-name">${escapeHtml(drink.name)}</div>
        <div class="inv-price">${drink.price.toLocaleString()}원</div>
      </div>
      <div class="inv-stock">
        ${drink.stock}<small>개</small>
      </div>
      <div class="inv-actions">
        <input type="number" class="restock-input" id="restock-${drink.id}" placeholder="수량" min="1" value="5" />
        <button class="btn btn-primary btn-sm" onclick="restockDrink('${drink.id}')">➕ 입고</button>
        <button class="btn btn-danger btn-sm" onclick="deleteDrink('${drink.id}')">🗑 삭제</button>
      </div>
    </div>
  `).join('');
}

function addNewDrink() {
  const nameInput = document.getElementById('input-new-name');
  const priceInput = document.getElementById('input-new-price');
  const stockInput = document.getElementById('input-new-stock');

  const name = nameInput.value.trim();
  const price = parseInt(priceInput.value, 10);
  const stock = parseInt(stockInput.value, 10);

  if (!name) {
    showToast('음료 이름을 입력해주세요.', 'error');
    nameInput.focus();
    return;
  }
  if (isNaN(price) || price < 0) {
    showToast('올바른 가격을 입력해주세요.', 'error');
    priceInput.focus();
    return;
  }
  if (isNaN(stock) || stock < 0) {
    showToast('올바른 재고 수량을 입력해주세요.', 'error');
    stockInput.focus();
    return;
  }

  // Pick a random emoji
  const emoji = DRINK_EMOJIS[Math.floor(Math.random() * DRINK_EMOJIS.length)];

  currentDrinks = loadDrinks();
  currentDrinks.push({ id: genId(), name, price, stock, emoji });
  saveDrinks(currentDrinks);

  // Clear inputs
  nameInput.value = '';
  priceInput.value = '';
  stockInput.value = '';

  showToast(`'${escapeHtml(name)}' 음료가 추가되었습니다!`, 'success');
  refreshAdminView();
}

function restockDrink(drinkId) {
  const input = document.getElementById(`restock-${drinkId}`);
  const qty = parseInt(input.value, 10);
  if (isNaN(qty) || qty <= 0) {
    showToast('입고 수량을 올바르게 입력해주세요.', 'error');
    return;
  }

  currentDrinks = loadDrinks();
  const drink = currentDrinks.find(d => d.id === drinkId);
  if (!drink) {
    showToast('음료를 찾을 수 없습니다.', 'error');
    return;
  }

  drink.stock += qty;
  saveDrinks(currentDrinks);
  showToast(`${escapeHtml(drink.name)} +${qty}개 입고 완료! (현재: ${drink.stock}개)`, 'success');
  refreshAdminView();
}

function deleteDrink(drinkId) {
  if (!confirm('정말 이 음료를 삭제하시겠습니까?')) return;

  currentDrinks = loadDrinks();
  currentDrinks = currentDrinks.filter(d => d.id !== drinkId);
  saveDrinks(currentDrinks);
  showToast('음료가 삭제되었습니다.', 'info');
  refreshAdminView();
}

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
// CROSS-TAB SYNC via storage event
// ═══════════════════════════════════════════════

window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEYS.DRINKS || e.key === STORAGE_KEYS.ORDERS) {
    // Another tab updated data – refresh current view
    if (document.getElementById('user-view').classList.contains('active')) {
      refreshDrinkGrid();
    } else {
      refreshAdminView();
    }
  }
});

// ═══════════════════════════════════════════════
// AUTO-REFRESH for admin view (poll localStorage every 3s)
// ═══════════════════════════════════════════════

let adminRefreshInterval = null;

function startAdminAutoRefresh() {
  if (adminRefreshInterval) clearInterval(adminRefreshInterval);
  adminRefreshInterval = setInterval(() => {
    if (document.getElementById('admin-view').classList.contains('active')) {
      refreshAdminView();
    }
  }, 3000);
}

// ═══════════════════════════════════════════════
// KEYBOARD SHORTCUT – Escape closes modal
// ═══════════════════════════════════════════════

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeOrderModal();
  }
});

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  refreshDrinkGrid();
  startAdminAutoRefresh();
});
