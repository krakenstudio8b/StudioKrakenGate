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
document.addEventListener('DOMContentLoaded', function () {
    const menuBtn = document.getElementById('nav-menu-btn');
    const navLinks = document.getElementById('nav-links');
    const menuIcon = document.getElementById('nav-menu-icon');

    if (!menuBtn || !navLinks) return;

    menuBtn.addEventListener('click', function () {
        const isHidden = navLinks.classList.toggle('hidden');
        if (menuIcon) {
            menuIcon.classList.toggle('fa-bars', isHidden);
            menuIcon.classList.toggle('fa-xmark', !isHidden);
        }
    });

    // Chiudi menu quando si clicca su un link
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 768) {
                navLinks.classList.add('hidden');
            }
        });
    });
});
