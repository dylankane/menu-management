function openImageModal(imageUrl, itemName, itemDescription) {
  const modal = document.getElementById('imageModal');
  const modalImage = document.getElementById('modalImage');
  modalImage.src = imageUrl;
  modalImage.alt = itemName || 'Menu item image';
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeImageModal() {
  const modal = document.getElementById('imageModal');
  modal.classList.add('closing');
  setTimeout(() => {
    modal.classList.remove('closing');
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }, 1500);
}

function getScrollOffset() {
  const topbar    = document.querySelector('.menu-topbar');
  const catNav    = document.getElementById('categoryNav');
  const topbarH   = topbar  ? topbar.offsetHeight  : 0;
  const catNavH   = catNav  ? catNav.offsetHeight   : 0;
  return topbarH + catNavH;
}

function updateActiveCategory() {
  const sections = document.querySelectorAll('.category-section');
  const navLinks = document.querySelectorAll('.category-nav-link');
  const offset   = getScrollOffset() + 20;

  let currentSection = '';
  const scrollPosition = window.scrollY + offset;

  sections.forEach(section => {
    const sectionTop    = section.offsetTop;
    const sectionHeight = section.offsetHeight;
    if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
      currentSection = section.getAttribute('id');
    }
  });

  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === '#' + currentSection) {
      link.classList.add('active');
    }
  });
}

function openInfoModal(itemName, dietary, allergens) {
  const modal          = document.getElementById('infoModal');
  const modalTitle     = document.getElementById('infoModalTitle');
  const dietarySection = document.getElementById('dietarySection');
  const allergenSection= document.getElementById('allergenSection');
  const dietaryTags    = document.getElementById('dietaryTags');
  const allergenTags   = document.getElementById('allergenTags');
  const noInfoMessage  = document.getElementById('noInfoMessage');

  modalTitle.textContent = itemName;
  dietaryTags.innerHTML  = '';
  allergenTags.innerHTML = '';

  const hasDietary  = dietary  && dietary.length  > 0;
  const hasAllergens= allergens && allergens.length > 0;

  if (hasDietary) {
    dietarySection.style.display = 'block';
    dietary.forEach(tag => {
      const span = document.createElement('span');
      span.className   = 'tag tag-dietary';
      span.textContent = tag;
      dietaryTags.appendChild(span);
    });
  } else {
    dietarySection.style.display = 'none';
  }

  if (hasAllergens) {
    allergenSection.style.display = 'block';
    allergens.forEach(tag => {
      const span = document.createElement('span');
      span.className   = 'tag tag-allergen';
      span.textContent = tag;
      allergenTags.appendChild(span);
    });
  } else {
    allergenSection.style.display = 'none';
  }

  noInfoMessage.style.display = (!hasDietary && !hasAllergens) ? 'block' : 'none';

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeInfoModal() {
  const modal = document.getElementById('infoModal');
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', function () {
  // ── Image modal ───────────────────────────────────────────────
  const imageModal = document.getElementById('imageModal');
  const closeBtn   = document.querySelector('.image-modal-close');

  if (closeBtn) closeBtn.addEventListener('click', closeImageModal);
  if (imageModal) {
    imageModal.addEventListener('click', function (e) {
      if (e.target === imageModal) closeImageModal();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeImageModal(); closeInfoModal(); }
  });

  document.querySelectorAll('.menu-item-image-trigger').forEach(trigger => {
    trigger.addEventListener('click', function () {
      openImageModal(
        this.getAttribute('data-image'),
        this.getAttribute('data-name'),
        this.getAttribute('data-description')
      );
    });
  });

  // ── Info modal ────────────────────────────────────────────────
  const infoModal = document.getElementById('infoModal');
  if (infoModal) {
    infoModal.querySelectorAll('[data-close-modal]').forEach(el => {
      el.addEventListener('click', closeInfoModal);
    });
  }

  document.querySelectorAll('.info-btn, .menu-item-info-trigger').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      const dietary  = JSON.parse(this.getAttribute('data-dietary')  || '[]');
      const allergens= JSON.parse(this.getAttribute('data-allergens') || '[]');
      openInfoModal(this.getAttribute('data-item-name'), dietary, allergens);
    });
  });

  // ── Category nav ──────────────────────────────────────────────
  const categoryNav = document.getElementById('categoryNav');
  if (categoryNav) {
    categoryNav.querySelectorAll('.category-nav-link').forEach(link => {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId      = this.getAttribute('href').substring(1);
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
          const offset        = getScrollOffset() + 20;
          const targetPosition= targetSection.offsetTop - offset;
          window.scrollTo({ top: targetPosition, behavior: 'smooth' });
        }
      });
    });

    // Toggle `.stuck` shadow when category nav is pinned below the topbar
    function updateStuck() {
      const topbar  = document.querySelector('.menu-topbar');
      const topbarH = topbar ? topbar.offsetHeight : 0;
      categoryNav.classList.toggle('stuck', window.scrollY > categoryNav.offsetTop - topbarH);
    }

    window.addEventListener('scroll', updateActiveCategory);
    window.addEventListener('scroll', updateStuck);
    updateActiveCategory();
    updateStuck();
  }
});
