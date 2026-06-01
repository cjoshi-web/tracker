// ---------- CONFIGURATION ----------
const API_URL = "https://script.google.com/macros/s/AKfycby14JV7jqQ3gEUu3ASbWrc9KslyQJfzUOuPlfPMK4AVKqLxG_afahK61kBXKuTSTpyJZg/exec"; // REPLACE WITH YOUR URL
let shipments = [];       // will hold all shipment objects
let tableHeaders = [];    // column names
let editingRowNumber = null;  // for update

// ========== EXCEL FORMULAS IN JS ==========
function calculateShipmentID(rowIndex) {
    // Simulating =IFERROR("OM-"&TEXT(MATCH(AU2,AU:AU,0)-1,"0000"),"⌛ Awaiting...")
    // We'll generate a sequential ID based on row position
    if (!rowIndex) return "⌛ Awaiting...";
    return "OM-" + String(rowIndex).padStart(4, '0');
}

function calculateInvoiceAmountInOMR(invoiceAmount, invoiceCurrency, exchangeRate) {
    // ='Import Tracker'!$R2*'Import Tracker'!$P2
    if (invoiceCurrency === "OMR") return invoiceAmount;
    return invoiceAmount * exchangeRate;
}

function calculateTotalLogisticsCost(row) {
    // Based on your formula: =IF('Import Tracker'!$Z2="DDP",0,'Import Tracker'!$BG2+...)
    if (row["Inco Terms"] === "DDP") return 0;
    let total = 0;
    // Add all logistics cost components
    const components = ["Local Truck Charges In OMR", "Helper Charges In OMR", "Freight Charges OMR", "DO / THC / Clearance"];
    components.forEach(comp => {
        total += parseFloat(row[comp]) || 0;
    });
    return total;
}

function calculateTransitDays(etd, eta) {
    if (!etd || !eta) return 0;
    const start = new Date(etd);
    const end = new Date(eta);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// You will continue adding other formulas similarly.

async function fetchData() {
  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      mode: 'cors',  // or omit this line (default is cors)
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    shipments = data;
    if (shipments.length > 0) {
      tableHeaders = Object.keys(shipments[0]);
      renderTable();
      updateDashboard();
    }
  } catch (error) {
    console.error("Fetch error:", error);
    alert("Failed to load data. Check console for details.");
  }
}

function renderTable() {
    // render headers
    let headerHtml = "<tr>";
    tableHeaders.forEach(h => headerHtml += `<th>${h}</th>`);
    headerHtml += "<th>Actions</th></tr>";
    document.getElementById("tableHead").innerHTML = headerHtml;
    
    // render rows
    let bodyHtml = "";
    shipments.forEach((ship, idx) => {
        bodyHtml += "<tr>";
        tableHeaders.forEach(h => {
            bodyHtml += `<td>${ship[h] || ""}</td>`;
        });
        bodyHtml += `<td><button onclick="editRow(${idx})">Edit</button> <button onclick="deleteRow(${idx})">Delete</button></td>`;
        bodyHtml += "</tr>";
    });
    document.getElementById("tableBody").innerHTML = bodyHtml;
}

function updateDashboard() {
    document.getElementById("totalShipments").innerText = shipments.length;
    let totalLogCost = shipments.reduce((sum, s) => sum + (parseFloat(s["Total Logistics Cost In OMR"]) || 0), 0);
    document.getElementById("totalCost").innerText = totalLogCost.toFixed(2);
    let avgTransit = shipments.reduce((sum, s) => sum + (parseInt(s["Actual Transit Days"]) || 0), 0) / shipments.length;
    document.getElementById("avgTransit").innerText = avgTransit.toFixed(1);
}

// Edit, Delete, Add functions will call the API using POST
async function addOrUpdateShipment(data, action, rowNumber = null) {
  const payload = { action, data, rowNumber };
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    console.log(result);
    fetchData(); // refresh
  } catch (error) {
    console.error("Save error:", error);
    alert("Failed to save. Check console.");
  }
}

// Show modal with form fields
function showModal(isEdit = false, rowData = null, rowIdx = null) {
    // generate dynamic form based on tableHeaders
    let formHtml = "";
    tableHeaders.forEach(header => {
        let value = rowData ? rowData[header] : "";
        formHtml += `<label>${header}:</label><input name="${header}" value="${value}"><br>`;
    });
    document.getElementById("formFields").innerHTML = formHtml;
    document.getElementById("modalTitle").innerText = isEdit ? "Edit Shipment" : "Add Shipment";
    document.getElementById("modalOverlay").style.display = "block";
    document.getElementById("modal").style.display = "block";
    editingRowNumber = rowIdx;
}

// Form submission
document.getElementById("shipmentForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    let shipmentData = {};
    for (let [key, value] of formData.entries()) {
        shipmentData[key] = value;
    }
    // Recalculate formula-based fields before saving
    // Example: recalculate total logistics cost using your JS function
    shipmentData["Total Logistics Cost In OMR"] = calculateTotalLogisticsCost(shipmentData);
    shipmentData["Actual Transit Days"] = calculateTransitDays(shipmentData["ETD"], shipmentData["ETA"]);
    // ... add other recalculations
    
    if (editingRowNumber !== null) {
        addOrUpdateShipment(shipmentData, "update", editingRowNumber);
    } else {
        addOrUpdateShipment(shipmentData, "add");
    }
    closeModal();
});

function closeModal() {
    document.getElementById("modalOverlay").style.display = "none";
    document.getElementById("modal").style.display = "none";
    editingRowNumber = null;
}

window.onload = () => {
    fetchData();
    document.getElementById("addBtn").onclick = () => showModal(false);
    document.getElementById("cancelBtn").onclick = closeModal;
    document.getElementById("pdfBtn").onclick = exportToPDF;
};

function exportToPDF() {
    const element = document.getElementById("dataTable");
    html2pdf().from(element).save();
}
