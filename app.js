// ---------- CONFIGURATION ----------
const API_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"; // REPLACE WITH YOUR URL
let shipments = [];       // will hold all shipment objects
let tableHeaders = [];    // column names
let editingRowNumber = null;  // for update
