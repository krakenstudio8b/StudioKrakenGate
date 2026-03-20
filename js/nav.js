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
// Lo script è posizionato dopo il </nav>, quindi gli elementi esistono già nel DOM
(function () {
    const menuBtn = document.getElementById('nav-menu-btn');
    const navLinks = document.getElementById('nav-links');
    const menuIcon = document.getElementById('nav-menu-icon');

    if (!menuBtn || !navLinks) return;

    let menuOpen = false;

    function openMenu() {
        menuOpen = true;
        navLinks.style.display = 'flex';
        navLinks.style.flexDirection = 'column';
        navLinks.classList.remove('hidden');
        if (menuIcon) { menuIcon.classList.replace('fa-bars', 'fa-xmark'); }
    }

    function closeMenu() {
        menuOpen = false;
        navLinks.style.display = '';
        navLinks.classList.add('hidden');
        if (menuIcon) { menuIcon.classList.replace('fa-xmark', 'fa-bars'); }
    }

    menuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        menuOpen ? closeMenu() : openMenu();
    });

    // Chiudi cliccando su un link (mobile)
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 768) closeMenu();
        });
    });

    // Chiudi cliccando fuori dal menu
    document.addEventListener('click', function (e) {
        if (menuOpen && !navLinks.contains(e.target) && e.target !== menuBtn) {
            closeMenu();
        }
    });
}());
