document.addEventListener("DOMContentLoaded", function () {
  flatpickr("#SelectDate", {
    dateFormat: "Y-m-d",
    defaultDate: document.getElementById("SelectDate").value || new Date(),
    onChange: function (selectedDates, dateStr) {
      document.getElementById("SelectDate").form.submit();
    }
  });
});
