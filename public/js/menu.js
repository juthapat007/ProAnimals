document.addEventListener('DOMContentLoaded', function() {
  // สำหรับ header.ejs (ใช้ id)
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const dropdownMenu = document.getElementById('dropdownMenu');
  
  if (hamburgerBtn && dropdownMenu) {
    hamburgerBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      dropdownMenu.classList.toggle('hidden');
    });
  }

  // สำหรับ header_admin.ejs (ใช้ class)
  const hamburgerBtns = document.querySelectorAll('.hamburger-btn');
  
  hamburgerBtns.forEach(btn => {
    const menu = btn.closest('.menu');
    const dropdown = menu.querySelector('.dropdown-menu');
    
    if (dropdown) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
      });
    }
  });

  // ฟังก์ชัน toggleDropdown สำหรับ header.ejs (กรณีใช้ onclick)
  window.toggleDropdown = function() {
    const dropdown = document.getElementById('dropdownMenu');
    if (dropdown) {
      dropdown.classList.toggle('hidden');
    }
  };

  // คลิกข้างนอกเพื่อปิด dropdown ทั้งหมด
  document.addEventListener('click', function(e) {
    // ปิด dropdown ที่ใช้ class
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
      if (!menu.contains(e.target) && !e.target.closest('.hamburger-btn')) {
        menu.classList.add('hidden');
      }
    });
    
    // ปิด dropdown ที่ใช้ id
    const dropdownMenu = document.getElementById('dropdownMenu');
    if (dropdownMenu && !dropdownMenu.contains(e.target) && 
        !e.target.closest('#hamburgerBtn') && 
        !e.target.matches('[onclick*="toggleDropdown"]')) {
      dropdownMenu.classList.add('hidden');
    }
  });
});