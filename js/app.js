/**
 * ComfortStay — Shared Application Logic
 * Работает с localStorage как с "базой данных"
 * Синхронизирует данные между вкладками через BroadcastChannel
 */

const App = {
  // 🔑 Ключи хранилища
  STORAGE_KEY: 'cs_bookings',
  AUTH_KEY: 'cs_admin_auth',
  CHANNEL_NAME: 'cs_sync',

  // 📡 BroadcastChannel для синхронизации вкладок
  channel: null,

  /**
   * Инициализация (вызывать в DOMContentLoaded)
   */
  init() {
    this.setupBroadcastChannel();
    this.setupMinDates();
  },

  /**
   * Настройка синхронизации между вкладками
   */
  setupBroadcastChannel() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(this.CHANNEL_NAME);
      this.channel.onmessage = (event) => {
        // Можно добавить кастомные обработчики при необходимости
        if (event.data?.type === 'refresh') {
          window.dispatchEvent(new Event('app:dataUpdated'));
        }
      };
    }
  },

  /**
   * Отправить сигнал другим вкладкам об обновлении данных
   */
  notifyUpdate() {
    if (this.channel) {
      this.channel.postMessage({ type: 'refresh' });
    }
    // Fallback для старых браузеров
    window.dispatchEvent(new Event('storage'));
  },

  /**
   * Получить все бронирования из localStorage
   * @returns {Array}
   */
  getBookings() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Ошибка чтения bookings:', e);
      return [];
    }
  },

  /**
   * Сохранить массив бронирований в localStorage
   * @param {Array} bookings
   */
  saveBookings(bookings) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(bookings));
      this.notifyUpdate();
      return true;
    } catch (e) {
      console.error('Ошибка записи bookings:', e);
      return false;
    }
  },

  /**
   * Добавить новое бронирование
   * @param {Object} booking
   * @returns {Object} созданная запись с ID
   */
  addBooking(booking) {
    const bookings = this.getBookings();
    const newBooking = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      status: 'pending',
      ...booking
    };
    bookings.push(newBooking);
    this.saveBookings(bookings);
    return newBooking;
  },

  /**
   * Обновить статус бронирования
   * @param {number|string} id
   * @param {string} status - 'pending' | 'approved'
   * @returns {boolean}
   */
  updateStatus(id, status) {
    const bookings = this.getBookings();
    const idx = bookings.findIndex(b => b.id == id);
    if (idx === -1) return false;
    bookings[idx].status = status;
    return this.saveBookings(bookings);
  },

  /**
   * Удалить бронирование по ID
   * @param {number|string} id
   * @returns {boolean}
   */
  deleteBooking(id) {
    let bookings = this.getBookings();
    const before = bookings.length;
    bookings = bookings.filter(b => b.id != id);
    if (bookings.length < before) {
      return this.saveBookings(bookings);
    }
    return false;
  },

  /**
   * Найти бронирование по ID
   * @param {number|string} id
   * @returns {Object|undefined}
   */
  findBooking(id) {
    return this.getBookings().find(b => b.id == id);
  },

  /**
   * Установить минимальные даты для полей checkin/checkout
   * @param {string} checkinId - ID поля заезда
   * @param {string} checkoutId - ID поля выезда
   */
  setupMinDates(checkinId = 'checkin', checkoutId = 'checkout') {
    const today = new Date().toISOString().split('T')[0];
    const checkin = document.getElementById(checkinId);
    const checkout = document.getElementById(checkoutId);
    
    if (checkin) {
      checkin.min = today;
      checkin.addEventListener('change', function() {
        if (checkout) checkout.min = this.value;
      });
    }
    if (checkout) checkout.min = today;
  },

  /**
   * Экранировать HTML-сущности (защита от XSS)
   * @param {string} text
   * @returns {string}
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Форматировать дату для отображения
   * @param {string} isoDate
   * @returns {string}
   */
  formatDate(isoDate) {
    if (!isoDate) return '';
    return new Date(isoDate).toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  },

  /**
   * Проверить авторизацию админа
   * @returns {boolean}
   */
  isAdmin() {
    return sessionStorage.getItem(this.AUTH_KEY) === '1';
  },

  /**
   * Войти как админ
   * @param {string} username
   * @param {string} password
   * @returns {boolean}
   */
  login(username, password) {
    // 🔐 Простая проверка для демо (в продакшене — сервер!)
    if (username === 'admin' && password === 'admin123') {
      sessionStorage.setItem(this.AUTH_KEY, '1');
      return true;
    }
    return false;
  },

  /**
   * Выйти из админки
   */
  logout() {
    sessionStorage.removeItem(this.AUTH_KEY);
  },

  /**
   * Перенаправить неавторизованного пользователя
   */
  requireAuth(redirectUrl = 'login.html') {
    if (!this.isAdmin()) {
      window.location.href = redirectUrl;
      return false;
    }
    return true;
  },

  /**
   * Счётчики для админки
   * @returns {{total: number, pending: number, approved: number}}
   */
  getCounters() {
    const bookings = this.getBookings();
    return {
      total: bookings.length,
      pending: bookings.filter(b => b.status === 'pending').length,
      approved: bookings.filter(b => b.status === 'approved').length
    };
  }
};

// 🚀 Авто-инициализация при загрузке страницы
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}

// 🌍 Сделать App доступным глобально для inline-обработчиков
window.App = App;