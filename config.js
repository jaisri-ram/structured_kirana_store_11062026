// ─────────────────────────────────────────────
// config.js  —  shared constants for shop + admin
// ─────────────────────────────────────────────

// ✏️ OWNER: Paste your Apps Script URL here (one place for both pages)
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyVsJX5ZOgLcPSE09tUj1oQ3YYfSSqW8P8W03itJ5df2-XzcEx5HeXco_HsHbDsZZ7u/exec";

const APPS_SCRIPT_PLACEHOLDER = "https://script.google.com/macros/s......";
const DEFAULT_PASSWORD = "kirana123";

// Demo products — shown when SCRIPT_URL is not configured
const DEMO_PRODUCTS = [
  { id: "1", name: "Basmati Rice",    nameTel: "బాస్మతి బియ్యం",         category: "Grains",     price: 85,  mrp: 100, unit: "per kg",    imageUrl: "", qtyOptions: "500g, 1kg, 2kg" },
  { id: "2", name: "Toor Dal",        nameTel: "కందిపప్పు",               category: "Pulses",     price: 120, mrp: 130, unit: "per kg",    imageUrl: "", qtyOptions: "250g, 500g, 1kg" },
  { id: "3", name: "Sunflower Oil",   nameTel: "పొద్దుతిరుగుడు నూనె",    category: "Oils",       price: 130, mrp: 145, unit: "per litre",  imageUrl: "", qtyOptions: "500ml, 1L, 2L" },
  { id: "4", name: "Sugar",           nameTel: "చక్కెర",                  category: "Essentials", price: 45,  mrp: "",  unit: "per kg",    imageUrl: "", qtyOptions: "" },
  { id: "5", name: "Salt",            nameTel: "ఉప్పు",                   category: "Essentials", price: 20,  mrp: "",  unit: "per kg",    imageUrl: "", qtyOptions: "" },
];

// Demo orders — shown when SCRIPT_URL is not configured
const DEMO_ORDERS = [
  { orderId: "ORD-001", timestamp: "20/03/2026, 10:30:00", customerName: "Ravi Kumar",  phone: "9876543210", address: "12-34, Gandhi Nagar, Hyderabad",  notes: "Please deliver before 7pm", items: "Rice x2 = ₹170, Dal x1 = ₹130", totalAmount: 300, status: "New" },
  { orderId: "ORD-002", timestamp: "20/03/2026, 11:15:00", customerName: "Sunita Devi", phone: "8765432109", address: "5-6, MG Road, Secunderabad",        notes: "",                          items: "Sugar x1 = ₹45, Salt x2 = ₹40",  totalAmount: 85,  status: "Delivered" },
];
