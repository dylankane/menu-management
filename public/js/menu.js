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

function updateActiveCategory() {
  const sections = document.querySelectorAll('.category-section');
  const navLinks = document.querySelectorAll('.category-nav-link');
  
  let currentSection = '';
  const scrollPosition = window.scrollY + 150;
  
  sections.forEach(section => {
    const sectionTop = section.offsetTop;
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

document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('imageModal');
  const closeBtn = document.querySelector('.image-modal-close');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', closeImageModal);
  }
  
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeImageModal();
      }
    });
  }
  
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeImageModal();
    }
  });
  
  const imageTriggers = document.querySelectorAll('.menu-item-image-trigger');
  imageTriggers.forEach(trigger => {
    trigger.addEventListener('click', function() {
      const imageUrl = this.getAttribute('data-image');
      const itemName = this.getAttribute('data-name');
      const itemDescription = this.getAttribute('data-description');
      openImageModal(imageUrl, itemName, itemDescription);
    });
  });
  
  const categoryNav = document.getElementById('categoryNav');
  if (categoryNav) {
    const navLinks = document.querySelectorAll('.category-nav-link');
    
    navLinks.forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href').substring(1);
        const targetSection = document.getElementById(targetId);
        
        if (targetSection) {
          const navHeight = categoryNav.offsetHeight;
          const targetPosition = targetSection.offsetTop - navHeight - 20;
          
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
      });
    });
    
    window.addEventListener('scroll', updateActiveCategory);
    updateActiveCategory();
  }
});
