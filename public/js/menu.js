function toggleDropdown() {
    const dropdown = document.getElementById('dropdownMenu');
    dropdown.classList.toggle('show');
  }

  // ปิด dropdown เมื่อคลิกข้างนอก
  window.addEventListener('click', function(e) {
    const menu = document.querySelector('.menu');
    if (!menu.contains(e.target)) {
      document.getElementById('dropdownMenu').classList.remove('show');
    }
  });

  