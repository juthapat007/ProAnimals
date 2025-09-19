document.addEventListener("DOMContentLoaded", function () {
    const searchInput = document.getElementById("searchInput"); 
    const tableBody = document.getElementById("customerTableBody");
    const allRows = Array.from(tableBody.querySelectorAll("tr"));

    const submitBtn = document.getElementById("addBtn"); // ปุ่มเพิ่ม/อัพเดต
    const deleteBtn = document.getElementById("deleteBtn");
    const clearBtn = document.getElementById("clearBtn");

    // ✅ ฟังก์ชันค้นหาลูกค้า
    function searchCustomer() {
        const keyword = searchInput.value.toLowerCase().trim();
        let found = false;

        allRows.forEach(row => {
            const customerName = row.querySelector("td:nth-child(2)").textContent.toLowerCase();
            if (customerName.includes(keyword)) {
                row.classList.remove("hidden-row");
                found = true;
            } else {
                row.classList.add("hidden-row");
            }
        });

        // แสดง/ซ่อน "ไม่พบลูกค้า"
        let noResults = document.getElementById("noResults");
        if (!noResults) {
            noResults = document.createElement("tr");
            noResults.id = "noResults";
            noResults.innerHTML = `
                <td colspan="5" class="text-center py-4 text-gray-500">
                    ไม่พบลูกค้า
                </td>`;
            tableBody.appendChild(noResults);
        }

        if (!found && keyword !== "") {
            noResults.classList.remove("hidden-row");
        } else {
            noResults.classList.add("hidden-row");
        }

        // ถ้าช่องค้นหาว่าง → แสดงข้อมูลทั้งหมด
        if (keyword === "") {
            allRows.forEach(row => row.classList.remove("hidden-row"));
            noResults.classList.add("hidden-row");
        }

        resetForm(); // รีเซ็ตฟอร์มเวลาเปลี่ยนการค้นหา
    }

    // ✅ ฟังก์ชันรีเซ็ตฟอร์ม
  function resetForm() {
    document.getElementById("cus_id").value = "";
    document.getElementById("cus_name").value = "";
    document.getElementById("cus_email").value = "";
    document.getElementById("cus_phon").value = "";
    submitBtn.textContent = "เพิ่ม";
    submitBtn.dataset.mode = "add";   // ✅ reset กลับไป
    submitBtn.classList.remove("btn-edit");
    document.querySelectorAll(".clickable-row").forEach(r => r.classList.remove("bg-primary/10"));
}


    // ✅ เลือกแถวลูกค้า
    document.querySelectorAll(".clickable-row").forEach(row => {
        row.addEventListener("click", function () {
            const id = this.dataset.id;
            const name = this.dataset.name;
            const email = this.dataset.email;
            const phon = this.dataset.phon;

            document.getElementById("cus_id").value = id;
            document.getElementById("cus_name").value = name;
            document.getElementById("cus_email").value = email;
            document.getElementById("cus_phon").value = phon;

            // เปลี่ยนปุ่มเป็นโหมดอัพเดต
            submitBtn.textContent = "อัพเดต";
            submitBtn.dataset.mode = "edit";   // ✅ ต้องใส่ตรงนี้
            submitBtn.classList.add("btn-edit");

            // ไฮไลต์แถว
            document.querySelectorAll(".clickable-row").forEach(r => r.classList.remove("bg-primary/10"));
            this.classList.add("bg-primary/10");
        });
    });

    // ✅ ปุ่มลบ
    deleteBtn.addEventListener("click", function () {
        const id = document.getElementById("cus_id").value;
        if (!id) return alert("กรุณาเลือกลูกค้าก่อน");

        if (!confirm("คุณแน่ใจว่าจะลบข้อมูลลูกค้าคนนี้หรือไม่?")) return;
        fetch(`/admin/contact_customer/delete/${id}`)
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    alert(result.message);
                    location.reload();
                } else {
                    alert(result.error || "เกิดข้อผิดพลาด");
                }
            })
            .catch(err => console.error(err));
    });

    // ✅ ปุ่มเพิ่ม/อัพเดต
// ปุ่มเพิ่ม/อัพเดต
submitBtn.addEventListener("click", function(e) {
    e.preventDefault();
    const id = document.getElementById("cus_id").value;
    const name = document.getElementById("cus_name").value.trim();
    const email = document.getElementById("cus_email").value.trim();
    const phon = document.getElementById("cus_phon").value.trim();

    if (!name || !phon) {
        alert("กรุณากรอกชื่อและเบอร์โทร");
        return;
    }

    let url = "/admin/contact_customer/add";
    let method = "POST";

    if (this.dataset.mode === "edit") {
        if (!id) return alert("กรุณาเลือกลูกค้าที่ต้องการแก้ไข");
        url = `/admin/contact_customer/edit/${id}`;
        method = "POST";   // ✅ สำคัญมาก ต้องใส่
    }

    fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone: phon })
    })
    .then(res => res.json())
    .then(result => {
        if (result.success) {
            alert(result.message || "สำเร็จ");
            location.reload();
        } else {
            alert(result.error || "เกิดข้อผิดพลาด");
        }
    })
    .catch(err => console.error(err));
});


    // ✅ ปุ่มเคลียร์ฟอร์ม
    clearBtn.addEventListener("click", function (e) {
        e.preventDefault();
        resetForm();
    });

    // ✅ Event input ค้นหา
    searchInput.addEventListener("input", searchCustomer);
});
