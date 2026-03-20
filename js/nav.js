// js/nav.js - Hamburger menu mobile, toast, scroll-to-top

// ── TOAST ────────────────────────────────────────────
const _toastContainer = document.createElement('div');
_toastContainer.className = 'toast-container';
document.body.appendChild(_toastContainer);

window.showToast = function (message, duration = 2500) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    _toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 280);
    }, duration);
};

// ── SCROLL TO TOP ─────────────────────────────────────
const _scrollBtn = document.createElement('button');
_scrollBtn.id = 'scroll-to-top';
_scrollBtn.title = 'Torna su';
_scrollBtn.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
document.body.appendChild(_scrollBtn);

window.addEventListener('scroll', () => {
    _scrollBtn.classList.toggle('visible', window.scrollY > 300);
}, { passive: true });

_scrollBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── HAMBURGER MENU ────────────────────────────────────
// Il CSS in style.css controlla la visibilità tramite classe .nav-open
// Questo script aggiunge/rimuove quella classe
(function () {
    const menuBtn = document.getElementById('nav-menu-btn');
    const navLinks = document.getElementById('nav-links');
    const menuIcon = document.getElementById('nav-menu-icon');

    if (!menuBtn || !navLinks) return;

    function openMenu() {
        navLinks.classList.add('nav-open');
        if (menuIcon) {
            menuIcon.classList.remove('fa-bars');
            menuIcon.classList.add('fa-xmark');
        }
    }

    function closeMenu() {
        navLinks.classList.remove('nav-open');
        if (menuIcon) {
            menuIcon.classList.remove('fa-xmark');
            menuIcon.classList.add('fa-bars');
        }
    }

    menuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        navLinks.classList.contains('nav-open') ? closeMenu() : openMenu();
    });

    // Chiudi cliccando su un link (mobile)
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 768) closeMenu();
        });
    });

    // Chiudi cliccando fuori
    document.addEventListener('click', function (e) {
        if (navLinks.classList.contains('nav-open') &&
            !navLinks.contains(e.target) &&
            e.target !== menuBtn &&
            !menuBtn.contains(e.target)) {
            closeMenu();
        }
    });
}());
