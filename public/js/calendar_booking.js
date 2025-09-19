document.addEventListener('DOMContentLoaded', function () {
  let flatpickrInstance = null;
  let availableTimesData = [];
  let selectedService = null;

  async function loadAvailableDates() {
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    const dateInput = document.getElementById('SelectDate') || document.getElementById('bookingDate');

    try {
      loadingMessage.style.display = 'block';
      errorMessage.style.display = 'none';

      const response = await fetch('/users/api/available-dates');
      const data = await response.json();

      if (!data.success) throw new Error(data.message || 'ไม่สามารถโหลดข้อมูลได้');

      const availableDates = data.availableDates;
      loadingMessage.style.display = 'none';

      if (availableDates.length === 0) {
        errorMessage.textContent = 'ขออภัย ไม่มีวันที่เปิดให้บริการในขณะนี้';
        errorMessage.style.display = 'block';
        return;
      }

      dateInput.disabled = false;
      dateInput.placeholder = 'เลือกวันที่...';

      // สำหรับ booking.ejs (user side)
      if (document.getElementById('SelectDate')) {
        flatpickrInstance = flatpickr("#SelectDate", {
          locale: "th",
          dateFormat: "Y-m-d",
          disableMobile: true,
          altInput: true,
          altFormat: "d/m/Y",
          allowInput: false,
          enable: availableDates,
          defaultDate: new Date(),
          onChange: (selectedDates, dateStr) => {
            if (dateStr && availableDates.includes(dateStr)) {
              checkAndLoadTimes(dateStr);
            }
          }
        });
      }
      
      // สำหรับ pet_service.ejs (admin side)  
      if (document.getElementById('bookingDate')) {
        flatpickrInstance = flatpickr("#bookingDate", {
          locale: "th", 
          dateFormat: "Y-m-d",
          disableMobile: true,
          altInput: true,
          altFormat: "d/m/Y",
          allowInput: false,
          enable: availableDates,
          defaultDate: new Date(),
          onChange: (selectedDates, dateStr) => {
            if (dateStr && availableDates.includes(dateStr)) {
              checkAndLoadTimes(dateStr);
            }
          }
        });
      }

    } catch (error) {
      console.error('❌ Error loading available dates:', error);
      loadingMessage.style.display = 'none';
      errorMessage.textContent = 'เกิดข้อผิดพลาดในการโหลดวันที่ให้บริการ กรุณาลองใหม่อีกครั้ง';
      errorMessage.style.display = 'block';
    }
  }

  // ✅ ฟังก์ชันตรวจสอบและโหลด time slots
  function checkAndLoadTimes(selectedDate) {
    // ตรวจสอบว่าเลือกบริการแล้วหรือยัง
    const serviceRadios = document.querySelectorAll('input[name="service_id"]');
    let selectedServiceId = null;
    
    serviceRadios.forEach(radio => {
      if (radio.checked) {
        selectedServiceId = radio.value;
      }
    });

    if (selectedServiceId && selectedDate) {
      loadAvailableTimes(selectedDate, selectedServiceId);
    } else if (!selectedServiceId) {
      console.log('⚠️ กรุณาเลือกบริการก่อน');
      // อาจจะแสดง alert หรือ message ให้ user เลือกบริการก่อน
    }
  }

  // ✅ ฟังก์ชันโหลด available times พร้อมส่ง service_id
  async function loadAvailableTimes(selectedDate, serviceId = null) {
    try {
      let apiUrl;
      
      // กำหนด API URL ตาม context
      if (window.location.pathname.includes('/admin/')) {
        // Admin side - ใช้ API ของ admin ที่รองรับ service_id
        apiUrl = serviceId 
          ? `/admin/pet_service/api/available-times?date=${selectedDate}&service_id=${serviceId}`
          : `/admin/pet_service/api/available-times?date=${selectedDate}&service_id=1`; // fallback
      } else {
        // User side
        apiUrl = `/users/api/available-times/${selectedDate}`;
      }

      console.log('🔄 Loading times from:', apiUrl);
      
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (!data.success) throw new Error(data.message || 'ไม่สามารถโหลดข้อมูลเวลาได้');

      availableTimesData = data.availableTimes || data.availableSlots || [];

      if (availableTimesData.length === 0) {
        console.log('⚠️ ไม่มีช่วงเวลาให้บริการในวันที่นี้');
        return;
      }

      console.log('✅ Loaded time slots:', availableTimesData);

    } catch (error) {
      console.error('❌ Error loading available times:', error);
    }
  }

  // ✅ ฟังก์ชันเปิด modal แสดง time slots
  async function openTimeModal(date) {
    // ตรวจสอบว่าเลือกบริการแล้วหรือยัง
    const serviceRadios = document.querySelectorAll('input[name="service_id"]');
    let selectedServiceId = null;
    
    serviceRadios.forEach(radio => {
      if (radio.checked) {
        selectedServiceId = radio.value;
      }
    });

    if (!selectedServiceId) {
      alert('กรุณาเลือกประเภทบริการก่อน');
      return;
    }

    try {
      let apiUrl;
      
      if (window.location.pathname.includes('/admin/')) {
        apiUrl = `/admin/pet_service/api/available-times?date=${date}&service_id=${selectedServiceId}`;
      } else {
        apiUrl = `/users/api/available-times/${date}`;
      }

      console.log('🔄 Loading times for modal from:', apiUrl);
      
      const response = await fetch(apiUrl);
      const data = await response.json();

      const container = document.getElementById('timeSlotsContainer');

      if (data.success && (data.availableTimes?.length > 0 || data.availableSlots?.length > 0)) {
        const timeSlots = data.availableTimes || data.availableSlots || [];
        
        timeSlots.forEach(timeSlot => {
          const btn = document.createElement("button");
          btn.className = "btn btn-add";
          
          // รองรับทั้ง format เก่าและใหม่
          if (typeof timeSlot === 'string') {
            btn.textContent = timeSlot;
            btn.onclick = () => selectTime(timeSlot);
          } else {
            btn.textContent = `${timeSlot.time || timeSlot.display_time} `;
            btn.onclick = () => selectTime(timeSlot.time || timeSlot.display_time, timeSlot.vet_id);
          }
          
          container.appendChild(btn);
        });
      } else {
        container.innerHTML = "<p class='text-gray-500 col-span-2 text-center py-4'>ไม่มีเวลาว่างในวันนี้</p>";
      }

      document.getElementById("timeModal").classList.remove("hidden");
      
    } catch (error) {
      console.error('❌ Error in openTimeModal:', error);
      const container = document.getElementById('timeSlotsContainer');
      container.innerHTML = "<p class='text-red-500 col-span-2 text-center py-4'>เกิดข้อผิดพลาดในการโหลดเวลา</p>";
      document.getElementById("timeModal").classList.remove("hidden");
    }
  }

  // ✅ ฟังก์ชันปิด modal
  function closeTimeModal() {
    document.getElementById("timeModal").classList.add("hidden");
  }

  // ✅ ฟังก์ชันเลือกเวลา
  function selectTime(time, vetId = null) {
    document.getElementById("selectedTime").value = time;
    document.getElementById('selectedTimeText').textContent = time;
    document.getElementById('selectedTimeDisplay').classList.remove('hidden');


    if (vetId && document.getElementById("selectedVetId")) {
      document.getElementById("selectedVetId").value = vetId;
    }
    
    // console.log('✅ Selected time:', time, 'Vet ID:', vetId);
    closeTimeModal();
    
    // เปิดใช้งานปุ่ม submit ถ้ามี
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.disabled = false;
    }
  }

  // ✅ ฟังก์ชันตรวจสอบการเลือกบริการ
  function updateService() {
    const serviceRadios = document.querySelectorAll('input[name="service_id"]');
    let selectedServiceId = null;
    
    serviceRadios.forEach(radio => {
      if (radio.checked) {
        selectedServiceId = radio.value;
      }
    });

    selectedService = selectedServiceId;
    console.log('🔄 Service selected:', selectedServiceId);
    
    // ถ้าเลือกวันที่แล้ว ให้โหลด time slots ใหม่
    const dateInput = document.getElementById('SelectDate') || document.getElementById('bookingDate');
    if (dateInput && dateInput.value && selectedServiceId) {
      checkAndLoadTimes(dateInput.value);
    }
  }

  // ✅ Event listeners
  document.addEventListener('change', function(e) {
    if (e.target.name === 'service_id') {
      updateService();
    }
  });

  // ✅ Global functions สำหรับใช้ใน HTML
  window.openTimeModal = openTimeModal;
  window.closeTimeModal = closeTimeModal;
  window.selectTime = selectTime;
  window.updateService = updateService;

  // ✅ เริ่มต้นโหลดวันที่
  loadAvailableDates();
});

document.addEventListener('DOMContentLoaded', () => {
  flatpickr("#bookingDate", {
    locale: "th",
    minDate: "today",
    dateFormat: "Y-m-d",
    onChange: loadAvailableTimes
  });
  loadAvailableDates();
});

async function loadAvailableDates() {
  const res = await fetch('/admin/pet_service/api/available-dates');
  const data = await res.json();
  if (data.success) {
    console.log('วันที่ให้บริการ:', data.availableDates);
  }
}

async function loadAvailableTimes(selectedDates, serviceId) {
  if (!selectedDates || !serviceId) return;
  const date = selectedDates[0];
  const res = await fetch(`/admin/pet_service/api/vet-available-times?date=${date}&service_id=${serviceId}`);
  const data = await res.json();
  if (data.success) {
    console.log('เวลาว่าง:', data.availableSlots);
  }
}




// เพิ่มเติมใน calendar_booking.js

// ✅ ฟังก์ชันตรวจสอบและแสดงปุ่มดูเวลา
function checkSelectionStatus() {
  const serviceSelected = document.querySelector('input[name="service_id"]:checked');
  const dateSelected = (document.getElementById('SelectDate') || document.getElementById('bookingDate'))?.value;
  
  const timeSection = document.getElementById('timeSelectionSection');
  const instructionMsg = document.getElementById('instructionMessage');
  
  if (serviceSelected && dateSelected) {
    // เลือกครบแล้ว - แสดงปุ่มดูเวลา
    if (timeSection) {
      timeSection.classList.remove('hidden');
    }
    if (instructionMsg) {
      instructionMsg.textContent = '✅ พร้อมเลือกเวลาที่สะดวก';
      instructionMsg.className = 'text-sm text-green-600 my-2';
    }
  } else {
    // ยังเลือกไม่ครบ - ซ่อนปุ่ม
    if (timeSection) {
      timeSection.classList.add('hidden');
    }
    if (instructionMsg) {
      let missingItems = [];
      if (!serviceSelected) missingItems.push('ประเภทบริการ');
      if (!dateSelected) missingItems.push('วันที่');
      
      instructionMsg.textContent = `📌 กรุณาเลือก: ${missingItems.join(' และ ')}`;
      instructionMsg.className = 'text-sm text-blue-600 my-2';
    }
  }
}




// ✅ ฟังก์ชันแสดงเวลาที่ว่าง (เรียกจากปุ่ม)
async function showAvailableTimes() {
  const btn = document.getElementById("showTimeBtn");
  btn.classList.remove('bg-primary');   // ลบสีเก่า
  btn.classList.add('bg-green-600');    // เพิ่มสีใหม่
  btn.textContent = "กำลังโหลด...";     // เปลี่ยนข้อความชั่วคราว

  const serviceSelected = document.querySelector('input[name="service_id"]:checked');
  const dateInput = document.getElementById('SelectDate') || document.getElementById('bookingDate');
  
  if (!serviceSelected || !dateInput?.value) {
    alert('กรุณาเลือกประเภทบริการและวันที่ก่อน');
    return;
  }

  // เปิด modal และโหลดเวลา
  await openTimeModal(dateInput.value);

  btn.textContent = "ดูเวลาที่ว่าง";
  btn.classList.remove('bg-red');
  btn.classList.add('bg-accept');
}

// ✅ ฟังก์ชันอัปเดต UI เมื่อเลือกเวลาแล้ว
function updateSelectedTimeDisplay(timeStr, vetName = '') {
  const display = document.getElementById('selectedTimeDisplay');
  const textElement = document.getElementById('selectedTimeText');
  
  if (display && textElement) {
    display.classList.remove('hidden');
    textElement.textContent = vetName ? `${timeStr} ` : timeStr;
  }
  
  // เปิดใช้งานปุ่มถัดไป
  const submitBtn = document.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-50');
  }
}


function selectTimeUpdated(time, vetId = null, vetName = '') {
  // เก็บข้อมูลจากฟอร์ม
  const serviceRadios = document.querySelectorAll('input[name="service_id"]');
  let selectedServiceId = null;
  serviceRadios.forEach(radio => {
    if (radio.checked) selectedServiceId = radio.value;
  });

  const petId = document.querySelector('input[name="pet_id"]').value;
  const cusId = document.querySelector('input[name="cus_id"]').value;
  const dateInput = document.getElementById('bookingDate');
  const date = dateInput ? dateInput.value : '';

  // สร้าง URL พร้อม parameters
  const params = new URLSearchParams({
    pet_id: petId,
    cus_id: cusId,
    service_id: selectedServiceId,
    date: date,
    time: time,
    vet_id: vetId || ''
  });

  // Redirect ไปหน้า confirm_AM พร้อม parameters
  window.location.href = `/admin/confirm_AM?${params.toString()}`;
}


// ✅ Event listeners สำหรับตรวจสอบการเลือก
document.addEventListener('DOMContentLoaded', function() {
  // เมื่อเลือกบริการ
  document.addEventListener('change', function(e) {
    if (e.target.name === 'service_id') {
      updateService();
      checkSelectionStatus();
    }
  });
  
  // เมื่อเลือกวันที่
  const dateInput = document.getElementById('SelectDate') || document.getElementById('bookingDate');
  if (dateInput) {
    dateInput.addEventListener('change', function() {
      checkSelectionStatus();
    });
  }
  
  // เริ่มต้นตรวจสอบสถานะ
  setTimeout(checkSelectionStatus, 100);
});

// ✅ Global functions
window.checkSelectionStatus = checkSelectionStatus;
window.showAvailableTimes = showAvailableTimes;
window.updateSelectedTimeDisplay = updateSelectedTimeDisplay;
window.selectTimeUpdated = selectTimeUpdated;