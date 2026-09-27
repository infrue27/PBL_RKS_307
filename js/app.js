
/* ---------- DATA / DB (localStorage) ---------- */
const CATS = [
  {key:"Sofa",icon:"🛋️"},{key:"Meja",icon:"🪑"},{key:"Kursi",icon:"💺"},{key:"Lemari",icon:"🚪"}
];

function seedIfEmpty(){
  if(!localStorage.getItem("hw_products")){
    const products = [
      {id:1,name:"Sofa Kain Linen Naima 3-Seater",category:"Sofa",material:"Kayu Jati",price:5850000,stock:8,desc:"Sofa 3 dudukan dengan rangka kayu jati solid dan pelapis linen premium yang lembut dan tahan lama.",icon:"🛋️",rating:4.8},
      {id:2,name:"Meja Makan Kayu Solid Wijaya",category:"Meja",material:"Kayu Mahoni",price:4200000,stock:5,desc:"Meja makan 6 kursi dari kayu mahoni solid dengan finishing natural.",icon:"🍽️",rating:4.7},
      {id:3,name:"Kursi Santai Rotan Elegan",category:"Kursi",material:"Rotan",price:1850000,stock:12,desc:"Kursi santai anyaman rotan asli, ringan dan nyaman untuk teras.",icon:"💺",rating:4.6},
      {id:4,name:"Lemari Baju 3 Pintu Klasik",category:"Lemari",material:"Kayu Jati",price:3950000,stock:6,desc:"Lemari pakaian 3 pintu kayu jati dengan cermin dan rak dalam luas.",icon:"🚪",rating:4.9},
      {id:5,name:"Meja Kerja Solid Aksara",category:"Meja",material:"Kayu Mahoni",price:2450000,stock:9,desc:"Meja kerja minimalis kayu solid, cocok untuk ruang kerja di rumah.",icon:"🖥️",rating:4.5},
      {id:6,name:"Kursi Makan Kayu Klasik",category:"Kursi",material:"Kayu Jati",price:950000,stock:20,desc:"Kursi makan kayu jati dengan desain klasik dan kokoh.",icon:"🪑",rating:4.4},
      {id:7,name:"Sofa 2-Seater Tropical Suede",category:"Sofa",material:"Kayu Mahoni",price:4650000,stock:7,desc:"Sofa dua dudukan berbahan suede lembut dengan kaki kayu solid.",icon:"🛋️",rating:4.7},
      {id:8,name:"Rak Buku Kayu Minimalis",category:"Lemari",material:"Kayu Jati",price:1650000,stock:10,desc:"Rak buku terbuka dari kayu solid, cocok untuk ruang baca maupun kerja.",icon:"📚",rating:4.6}
    ];
    localStorage.setItem("hw_products",JSON.stringify(products));
  }
  if(!localStorage.getItem("hw_users")){
    const users = [
      {id:1,name:"Admin Homey Wood",email:"admin@homeywood.com",phone:"081200000000",address:"Kantor Pusat Homey Wood, Jakarta",password:"admin123",role:"admin",joined:"01 Januari 2026"}
    ];
    localStorage.setItem("hw_users",JSON.stringify(users));
  }
  if(!localStorage.getItem("hw_orders")) localStorage.setItem("hw_orders","[]");
  if(!localStorage.getItem("hw_carts")) localStorage.setItem("hw_carts","{}");
  if(!localStorage.getItem("hw_messages")) localStorage.setItem("hw_messages","[]");
}
seedIfEmpty();

const db = {
  products:()=>JSON.parse(localStorage.getItem("hw_products")),
  saveProducts:(p)=>localStorage.setItem("hw_products",JSON.stringify(p)),
  users:()=>JSON.parse(localStorage.getItem("hw_users")),
  saveUsers:(u)=>localStorage.setItem("hw_users",JSON.stringify(u)),
  orders:()=>JSON.parse(localStorage.getItem("hw_orders")),
  saveOrders:(o)=>localStorage.setItem("hw_orders",JSON.stringify(o)),
  carts:()=>JSON.parse(localStorage.getItem("hw_carts")),
  saveCarts:(c)=>localStorage.setItem("hw_carts",JSON.stringify(c)),
  messages:()=>JSON.parse(localStorage.getItem("hw_messages")),
  saveMessages:(m)=>localStorage.setItem("hw_messages",JSON.stringify(m))
};

let session = JSON.parse(sessionStorage.getItem("hw_session")||"null"); // {userId}
let currentDetailId = null;
let currentFilterCat = "Semua";

function currentUser(){
  if(!session) return null;
  return db.users().find(u=>u.id===session.userId) || null;
}
function fmt(n){ return "Rp " + n.toLocaleString("id-ID"); }
function toast(msg){
  const t=document.getElementById("toast");
  t.textContent=msg;
  t.classList.add("show");
  clearTimeout(window._toastTimer);
  window._toastTimer=setTimeout(()=>t.classList.remove("show"),2200);
}

/* ---------- NAV / ROUTER (fetches pages/<name>.html into #app) ---------- */
async function go(page){
  const app = document.getElementById("app");
  const bar = document.getElementById("routeBar");
  if(bar){ bar.classList.add("active"); bar.style.width="70%"; }
  try{
    const res = await fetch("pages/"+page+".html");
    if(!res.ok) throw new Error("Halaman tidak ditemukan: "+page);
    const html = await res.text();
    app.innerHTML = html;
  }catch(e){
    app.innerHTML = '<div class="container section" style="text-align:center"><h2>Halaman tidak ditemukan</h2><p style="color:var(--muted)">Silakan coba lagi atau kembali ke beranda.</p><button class="btn btn-primary" onclick="go(\'home\')">Ke Beranda</button></div>';
    console.error(e);
  }
  if(bar){ bar.style.width="100%"; setTimeout(()=>{ bar.classList.remove("active"); bar.style.width="0"; },250); }

  app.classList.remove("page-in");
  void app.offsetWidth;
  app.classList.add("page-in");

  document.querySelectorAll("[data-nav]").forEach(n=>n.classList.toggle("on",n.dataset.nav===page));
  const dd = document.getElementById("dropdownMenu");
  if(dd) dd.parentElement.classList.remove("open");
  window.scrollTo(0,0);

  const isAdminPage = page.indexOf("admin")===0;
  const navbar = document.querySelector(".navbar");
  if(navbar) navbar.style.display = isAdminPage ? "none" : "";
  const siteFooter = document.getElementById("siteFooter");
  if(siteFooter){
    if(isAdminPage){ siteFooter.style.display="none"; siteFooter.innerHTML=""; }
    else { siteFooter.style.display=""; siteFooter.innerHTML = footerHTML(); }
  }

  if(page==="home") renderHome();
  if(page==="katalog") renderKatalog();
  if(page==="detail") renderDetail();
  if(page==="keranjang") renderCart();
  if(page==="checkout") renderCheckout();
  if(page==="profile") renderProfile();
  if(page==="lupa-sandi") initResetForm();
  if(page==="admin-dashboard") renderAdminDashboard();
  if(page==="admin-katalog") renderAdminKatalog();
  if(page==="admin-user") renderAdminUser();
  if(page==="admin-verifikasi") renderAdminVerifikasi();

  if(!isAdminPage) renderNavbar();
  initScrollReveal();
}

function toggleDropdown(){
  document.getElementById("profileDropdown").classList.toggle("open");
}
document.addEventListener("click",(e)=>{
  const dd=document.getElementById("profileDropdown");
  if(dd && !dd.contains(e.target)) dd.classList.remove("open");
});

function onProfileIconClick(){
  if(currentUser()){ toggleDropdown(); }
  else { go("login"); }
}

function renderNavbar(){
  const u = currentUser();
  const menu = document.getElementById("dropdownMenu");
  const cartWrap = document.getElementById("cartIconWrap");
  cartWrap.style.display="flex";
  if(u){
    menu.innerHTML = `<div class="who">Halo, <b>${u.name}</b></div>
      <a onclick="go('profile')">Profil Saya</a>
      <a onclick="go('keranjang')">Keranjang Saya</a>
      <button onclick="logout()">Keluar</button>`;
  } else {
    menu.innerHTML = "";
  }
  updateCartBadge();
}

const ICONS = {
  dashboard:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="20" x2="4" y2="12"/><line x1="12" y1="20" x2="12" y2="6"/><line x1="20" y1="20" x2="20" y2="14"/></svg>',
  produk:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><line x1="12" y1="11" x2="12" y2="21"/></svg>',
  user:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M2 20c0-3.2 3.1-5.4 7-5.4s7 2.2 7 5.4"/><circle cx="17.5" cy="8.3" r="2.5"/><path d="M17 13.3c2.8.2 5 2.2 5 4.7"/></svg>',
  verifikasi:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/></svg>',
  bell:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>'
};

function adminSidebarHTML(active){
  const items=[
    ["admin-dashboard",ICONS.dashboard,"Dashboard Laporan"],
    ["admin-katalog",ICONS.produk,"Kelola Produk"],
    ["admin-user",ICONS.user,"Kelola User"],
    ["admin-verifikasi",ICONS.verifikasi,"Verifikasi Bayar"]
  ];
  const u=currentUser();
  return `
    <div>
      <div class="sidebar-brand">
        <div class="sidebar-avatar">H</div>
        <div><div class="sidebar-title">Homey Wood</div><div class="sidebar-sub">Admin Portal</div></div>
      </div>
      <nav class="sidebar-nav">
        ${items.map(([key,icon,label])=>`<a class="${active===key?'on':''}" onclick="go('${key}')">${icon}<span>${label}</span></a>`).join("")}
      </nav>
    </div>
    <div class="sidebar-footer">
      <div class="sidebar-user">${u?u.name:''}</div>
      <button class="sidebar-logout" onclick="logout()">Keluar</button>
    </div>`;
}

function adminHeaderHTML(title,subtitle){
  return `<div>
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </div>
    <div class="admin-header-right">
      <div class="status-online">Sistem Online</div>
      <div class="bell-btn">${ICONS.bell}</div>
    </div>`;
}

/* ---------- AUTH ---------- */
function doLogin(){
  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPass").value;
  if(!email||!pass){toast("Isi email dan password.");return;}
  const u = db.users().find(x=>x.email.toLowerCase()===email.toLowerCase() && x.password===pass);
  if(!u){toast("Email atau password salah.");return;}
  session={userId:u.id};
  sessionStorage.setItem("hw_session",JSON.stringify(session));
  document.getElementById("loginEmail").value="";
  document.getElementById("loginPass").value="";
  if(u.role==="admin"){ toast("Berhasil masuk sebagai Admin."); go("admin-dashboard"); }
  else { toast("Selamat datang kembali, "+u.name+"!"); go("home"); }
}

function doRegister(){
  const name=document.getElementById("regName").value.trim();
  const email=document.getElementById("regEmail").value.trim();
  const phone=document.getElementById("regPhone").value.trim();
  const address=document.getElementById("regAddress").value.trim();
  const pass=document.getElementById("regPass").value;
  const passConfirm=document.getElementById("regPassConfirm").value;
  const termsOk=document.getElementById("regTerms").checked;
  if(!name||!email||!phone||!address||!pass||!passConfirm){toast("Lengkapi semua data terlebih dahulu.");return;}
  if(pass.length<8){toast("Kata sandi minimal 8 karakter.");return;}
  if(pass!==passConfirm){toast("Konfirmasi kata sandi tidak cocok.");return;}
  if(!termsOk){toast("Setujui Syarat & Ketentuan dan Kebijakan Privasi terlebih dahulu.");return;}
  const users=db.users();
  if(users.find(u=>u.email.toLowerCase()===email.toLowerCase())){toast("Email sudah terdaftar.");return;}
  const joined=new Date().toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
  const newUser={id:Date.now(),name,email,phone,address,password:pass,role:"user",joined};
  users.push(newUser); db.saveUsers(users);
  session={userId:newUser.id};
  sessionStorage.setItem("hw_session",JSON.stringify(session));
  document.getElementById("regPass").value="";
  document.getElementById("regPassConfirm").value="";
  toast("Akun berhasil dibuat. Selamat datang, "+name+"!");
  go("home");
}

function logout(){
  session=null; sessionStorage.removeItem("hw_session");
  toast("Anda telah keluar.");
  go("home");
}

function requireLogin(){
  if(!currentUser()){ toast("Silakan masuk terlebih dahulu."); go("login"); return false; }
  return true;
}

/* ---------- HOME ---------- */
function productCardHTML(p){
  return `<div class="pcard" onclick="openDetail(${p.id})">
    <div class="thumb">${p.icon}</div>
    <div class="info">
      <div class="name">${p.name}</div>
      <div class="price">${fmt(p.price)}</div>
      <div class="row">
        <span class="stars">★★★★★</span>
        <button class="add-btn" onclick="event.stopPropagation();addToCart(${p.id})">+</button>
      </div>
    </div>
  </div>`;
}

function renderHome(){
  document.getElementById("catRow").innerHTML = CATS.map(c=>`
    <div class="cat-item" onclick="goToKatalogCat('${c.key}')">
      <div class="cat-circle">${c.icon}</div><span>${c.key}</span>
    </div>`).join("");
  const top = db.products().slice(0,4);
  document.getElementById("homeProducts").innerHTML = top.map(productCardHTML).join("");
}
async function goToKatalogCat(cat){
  currentFilterCat=cat;
  await go("katalog");
  const r=document.querySelector(`input[name=fcat][value="${cat}"]`);
  if(r){ r.checked=true; renderKatalog(); }
}

/* ---------- KATALOG ---------- */
function renderKatalog(){
  const checked = document.querySelector('input[name="fcat"]:checked');
  const cat = checked ? checked.value : currentFilterCat;
  const mats = Array.from(document.querySelectorAll('.fmat:checked')).map(m=>m.value);
  let list = db.products();
  if(cat && cat!=="Semua") list = list.filter(p=>p.category===cat);
  if(mats.length>0) list = list.filter(p=>mats.includes(p.material));
  document.getElementById("katalogGrid").innerHTML = list.length ? list.map(productCardHTML).join("") :
    `<div class="empty-state" style="grid-column:1/-1"><div>🔍</div>Tidak ada produk yang cocok dengan filter ini.</div>`;
}

/* ---------- DETAIL ---------- */
let detailQty=1;
function openDetail(id){ currentDetailId=id; detailQty=1; go("detail"); }
function renderDetail(){
  const p = db.products().find(x=>x.id===currentDetailId);
  if(!p){ document.getElementById("detailWrap").innerHTML="<p>Produk tidak ditemukan.</p>"; return; }
  document.getElementById("detailWrap").innerHTML = `
    <div class="detail-img">${p.icon}</div>
    <div class="detail-info">
      <div class="stars">★★★★★ <span style="color:var(--muted);font-size:13px">(${p.rating})</span></div>
      <h1>${p.name}</h1>
      <div class="price">${fmt(p.price)}</div>
      <p style="color:var(--muted);font-size:14px;line-height:1.7">${p.desc}</p>
      <p style="font-size:13px;color:var(--muted)">Stok tersedia: ${p.stock}</p>
      <div class="qty-row">
        <div class="qty-box">
          <button onclick="changeQty(-1)">−</button><span id="qtyVal">${detailQty}</span><button onclick="changeQty(1)">+</button>
        </div>
        <button class="btn btn-primary" onclick="addToCart(${p.id},detailQty)">Tambahkan ke Keranjang</button>
      </div>
    </div>`;
}
function changeQty(d){
  const p=db.products().find(x=>x.id===currentDetailId);
  detailQty=Math.max(1,Math.min(p.stock,detailQty+d));
  document.getElementById("qtyVal").textContent=detailQty;
}

/* ---------- CART ---------- */
function getCart(){
  if(!currentUser()) return [];
  const carts=db.carts();
  return carts[currentUser().id] || [];
}
function setCart(items){
  const carts=db.carts();
  carts[currentUser().id]=items;
  db.saveCarts(carts);
}
function addToCart(productId,qty){
  if(!requireLogin()) return;
  qty = qty || 1;
  const items = getCart();
  const existing = items.find(i=>i.productId===productId);
  if(existing) existing.qty += qty; else items.push({productId,qty});
  setCart(items);
  updateCartBadge(true);
  toast("Produk ditambahkan ke keranjang.");
}
function updateCartBadge(pulse){
  const items=getCart();
  const count=items.reduce((s,i)=>s+i.qty,0);
  const badge=document.getElementById("cartBadge");
  if(!badge) return;
  badge.textContent=count;
  badge.style.display = count>0 ? "flex" : "none";
  if(pulse){
    badge.classList.remove("pulse");
    void badge.offsetWidth;
    badge.classList.add("pulse");
  }
}
function cartWithDetails(){
  const products=db.products();
  return getCart().map(i=>({...i, product:products.find(p=>p.id===i.productId)})).filter(i=>i.product);
}
function cartTotal(){ return cartWithDetails().reduce((s,i)=>s+i.product.price*i.qty,0); }

function renderCart(){
  if(!requireLogin()) return;
  const items = cartWithDetails();
  if(items.length===0){
    document.getElementById("cartLayout").innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div>🛒</div>Keranjang Anda masih kosong.<br><br><button class="btn btn-primary" onclick="go('katalog')">Mulai Belanja</button></div>`;
    return;
  }
  const left = items.map(i=>`
    <div class="cart-item">
      <div class="thumb">${i.product.icon}</div>
      <div class="info">
        <div class="name">${i.product.name}</div>
        <div class="price">${fmt(i.product.price)}</div>
      </div>
      <div class="qty-box">
        <button onclick="updateCartQty(${i.productId},-1)">−</button><span>${i.qty}</span><button onclick="updateCartQty(${i.productId},1)">+</button>
      </div>
      <button class="remove-x" onclick="removeFromCart(${i.productId})">Hapus</button>
    </div>`).join("");
  const right = `<div class="cart-summary">
      <div class="sum-row"><span>Subtotal</span><span>${fmt(cartTotal())}</span></div>
      <div class="sum-row"><span>Ongkos Kirim</span><span>Gratis</span></div>
      <div class="sum-row total"><span>Total</span><span>${fmt(cartTotal())}</span></div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="go('checkout')">Lanjut ke Checkout</button>
    </div>`;
  document.getElementById("cartLayout").innerHTML = `<div>${left}</div>${right}`;
}
function updateCartQty(productId,d){
  const items=getCart();
  const it=items.find(i=>i.productId===productId);
  if(!it) return;
  it.qty=Math.max(1,it.qty+d);
  setCart(items); renderCart(); updateCartBadge();
}
function removeFromCart(productId){
  setCart(getCart().filter(i=>i.productId!==productId));
  renderCart(); updateCartBadge();
  toast("Produk dihapus dari keranjang.");
}

/* ---------- CHECKOUT ---------- */
let selectedPayment="Transfer Bank";
const BANKS=[
  {code:"BCA",name:"BCA",prefix:"39017"},
  {code:"BNI",name:"BNI",prefix:"98817"},
  {code:"MANDIRI",name:"Mandiri",prefix:"89017"},
  {code:"KB",name:"KB Bank",prefix:"80107"},
  {code:"BRI",name:"BRI",prefix:"26107"}
];
let selectedBank="BCA";
let vaCache={};
function getVA(code){
  if(!vaCache[code]){ const b=BANKS.find(x=>x.code===code); vaCache[code]=b.prefix+String(Date.now()).slice(-8); }
  return vaCache[code];
}
function copyVA(){
  const va=getVA(selectedBank);
  navigator.clipboard.writeText(va).then(()=>toast("Nomor VA disalin: "+va)).catch(()=>toast("Nomor VA: "+va));
}
function choosePayment(m){ selectedPayment=m; stopQrisTimer(); if(m==="QRIS") startQrisTimer(); renderCheckout(); }
function chooseBank(code){ selectedBank=code; renderCheckout(); }
let qrisInterval=null, qrisSeconds=600;
function startQrisTimer(){
  qrisSeconds=600;
  qrisInterval=setInterval(()=>{
    qrisSeconds--;
    const el=document.getElementById("qrisTimer");
    if(el){ const m=String(Math.floor(qrisSeconds/60)).padStart(2,"0"); const s=String(qrisSeconds%60).padStart(2,"0"); el.textContent=m+":"+s; }
    if(qrisSeconds<=0){ stopQrisTimer(); toast("Kode QRIS kedaluwarsa, silakan pilih ulang metode pembayaran."); }
  },1000);
}
function stopQrisTimer(){ if(qrisInterval){ clearInterval(qrisInterval); qrisInterval=null; } }
function renderBankChooser(){
  return `<div class="bank-grid">
      ${BANKS.map(b=>`<div class="bank-option ${selectedBank===b.code?'active':''}" onclick="chooseBank('${b.code}')">${b.name}</div>`).join("")}
    </div>
    <div class="va-box">
      <div style="font-size:12px;color:var(--muted)">Nomor Virtual Account ${BANKS.find(b=>b.code===selectedBank).name}</div>
      <div style="font-size:19px;font-weight:700;letter-spacing:1px;margin:4px 0">${getVA(selectedBank)}</div>
      <button class="btn btn-outline" style="font-size:12.5px;padding:8px 14px" onclick="copyVA()">Salin Nomor VA</button>
      <p style="font-size:12px;color:var(--muted);margin-top:8px;margin-bottom:0">Selesaikan pembayaran ke nomor VA di atas sebelum pesanan kedaluwarsa.</p>
    </div>`;
}
function renderQrisBox(){
  return `<div class="qris-box">
      <div class="qris-frame"><div class="qris-placeholder">Kode QRIS<br>segera hadir</div></div>
      <div style="font-size:12.5px;color:var(--muted);margin-top:10px">Kode QRIS dinamis akan otomatis kedaluwarsa dalam <b id="qrisTimer">10:00</b></div>
    </div>`;
}
function renderCheckout(){
  if(!requireLogin()) return;
  const items=cartWithDetails();
  const u=currentUser();
  if(items.length===0){ document.getElementById("checkoutLayout").innerHTML=`<div class="empty-state" style="grid-column:1/-1"><div>🧾</div>Keranjang kosong, tidak ada yang bisa di-checkout.</div>`; return; }
  const left = `
    <div class="card" style="margin-bottom:16px">
      <h3 style="margin-top:0">1. Alamat Pengiriman</h3>
      <p style="font-size:14px"><b>${u.name}</b><br>${u.phone}<br>${u.address}</p>
    </div>
    <div class="card">
      <h3 style="margin-top:0">2. Metode Pembayaran</h3>
      ${["Transfer Bank","QRIS","Bayar di Tempat (COD)"].map(m=>`
        <label class="pay-option">
          <input type="radio" name="pay" value="${m}" ${selectedPayment===m?'checked':''} onchange="choosePayment('${m}')"> ${m}
        </label>`).join("")}
      ${selectedPayment==="Transfer Bank" ? renderBankChooser() : ""}
      ${selectedPayment==="QRIS" ? renderQrisBox() : ""}
    </div>`;
  const right = `<div class="cart-summary">
      <h3 style="margin-top:0">3. Ringkasan Pesanan</h3>
      ${items.map(i=>`<div class="sum-row"><span>${i.product.name} x${i.qty}</span><span>${fmt(i.product.price*i.qty)}</span></div>`).join("")}
      <div class="sum-row total"><span>Total Bayar</span><span>${fmt(cartTotal())}</span></div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="placeOrder()">Buat Pesanan</button>
    </div>`;
  document.getElementById("checkoutLayout").innerHTML = `<div>${left}</div>${right}`;
  if(selectedPayment==="QRIS" && !qrisInterval) startQrisTimer();
}
function placeOrder(){
  const u=currentUser();
  const items=cartWithDetails();
  let paymentLabel=selectedPayment;
  if(selectedPayment==="Transfer Bank") paymentLabel="Transfer Bank "+BANKS.find(b=>b.code===selectedBank).name+" (VA: "+getVA(selectedBank)+")";
  const order={
    id:"HW"+Date.now().toString().slice(-8),
    userId:u.id,
    items:items.map(i=>({name:i.product.name,qty:i.qty,price:i.product.price})),
    total:cartTotal(),
    payment:paymentLabel,
    status:"Menunggu Verifikasi",
    date:new Date().toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"})
  };
  const orders=db.orders(); orders.push(order); db.saveOrders(orders);
  setCart([]); updateCartBadge(); stopQrisTimer(); vaCache={};
  toast("Pesanan berhasil dibuat! Menunggu verifikasi pembayaran.");
  go("profile");
}

/* ---------- PROFILE ---------- */
function renderProfile(){
  if(!requireLogin()) return;
  const u=currentUser();
  const myOrders=db.orders().filter(o=>o.userId===u.id).reverse();
  const initials=u.name.split(" ").map(s=>s[0]).join("").slice(0,2).toUpperCase();
  document.getElementById("profileContent").innerHTML = `
    <div class="profile-head">
      <div class="avatar">${initials}</div>
      <div>
        <div style="font-weight:700;font-size:17px">${u.name}</div>
        <div style="font-size:13px;color:var(--muted)">${u.email}</div>
      </div>
    </div>
    <div class="card" style="margin-bottom:24px">
      <h3 style="margin-top:0">Informasi Pribadi</h3>
      <div class="two-col">
        <div><div style="font-size:12px;color:var(--muted)">Nama Lengkap</div><div style="font-size:14.5px;font-weight:600">${u.name}</div></div>
        <div><div style="font-size:12px;color:var(--muted)">Email</div><div style="font-size:14.5px;font-weight:600">${u.email}</div></div>
        <div><div style="font-size:12px;color:var(--muted)">No. WhatsApp</div><div style="font-size:14.5px;font-weight:600">${u.phone}</div></div>
        <div><div style="font-size:12px;color:var(--muted)">Alamat</div><div style="font-size:14.5px;font-weight:600">${u.address}</div></div>
      </div>
    </div>
    <h3>Riwayat Pembelian</h3>
    ${myOrders.length===0 ? `<div class="empty-state"><div>📦</div>Belum ada riwayat pembelian.</div>` :
      myOrders.map(o=>`
      <div class="order-row">
        <div>
          <div style="font-weight:600;font-size:14px">${o.id} · ${o.date}</div>
          <div style="font-size:12.5px;color:var(--muted)">${o.items.map(i=>i.name+" x"+i.qty).join(", ")}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;margin-bottom:6px">${fmt(o.total)}</div>
          <span class="status-pill ${o.status==='Selesai'?'status-done':o.status==='Ditolak'?'status-rejected':'status-pending'}">${o.status}</span>
        </div>
      </div>`).join("")}
  `;
}

/* ---------- KONTAK ---------- */
function submitKontak(){
  const nama=document.getElementById("kNama").value.trim();
  const email=document.getElementById("kEmail").value.trim();
  const alasan=document.getElementById("kAlasan").value.trim();
  const wa=document.getElementById("kWa").value.trim();
  if(!nama||!email||!alasan||!wa){ toast("Mohon lengkapi semua kolom."); return; }
  const messages=db.messages();
  messages.push({nama,email,alasan,wa,date:new Date().toISOString()});
  db.saveMessages(messages);
  document.getElementById("kNama").value="";
  document.getElementById("kEmail").value="";
  document.getElementById("kAlasan").value="";
  document.getElementById("kWa").value="";
  toast("Pesan terkirim! Tim kami akan segera menghubungi Anda.");
}

/* ---------- ADMIN: DASHBOARD ---------- */
function renderAdminDashboard(){
  const u=currentUser();
  if(!u||u.role!=="admin"){ toast("Halaman khusus admin."); go("login"); return; }
  document.getElementById("adminSidebar1").innerHTML = adminSidebarHTML("admin-dashboard");
  document.getElementById("adminHeader1").innerHTML = adminHeaderHTML("Dashboard Laporan Penjualan","Ringkasan performa dan transaksi toko Homey Wood");
  document.getElementById("footer-admin-dashboard").innerHTML = adminFooterHTML();
  const orders=db.orders();
  const totalRevenue=orders.filter(o=>o.status!=="Ditolak").reduce((s,o)=>s+o.total,0);
  document.getElementById("kpiGrid").innerHTML = `
    <div class="kpi"><span>Total Pendapatan</span><b>${fmt(totalRevenue)}</b></div>
    <div class="kpi"><span>Total Transaksi</span><b>${orders.length}</b></div>
    <div class="kpi"><span>Produk Terdaftar</span><b>${db.products().length}</b></div>
    <div class="kpi"><span>Total Pengguna</span><b>${db.users().filter(x=>x.role==='user').length}</b></div>`;
  const tbody=document.querySelector("#adminRecentTable tbody");
  const recent=orders.slice().reverse().slice(0,6);
  tbody.innerHTML = recent.length ? recent.map(o=>{
    const buyer=db.users().find(u2=>u2.id===o.userId);
    return `<tr><td>${o.id}</td><td>${buyer?buyer.name:'-'}</td><td>${fmt(o.total)}</td><td><span class="status-pill ${o.status==='Selesai'?'status-done':o.status==='Ditolak'?'status-rejected':'status-pending'}">${o.status}</span></td></tr>`;
  }).join("") : `<tr><td colspan="4" style="text-align:center;color:var(--muted)">Belum ada transaksi.</td></tr>`;
}

/* ---------- ADMIN: KATALOG ---------- */
function showAddProductForm(){ document.getElementById("addProductForm").style.display="block"; editingProductId=null; clearProductForm(); }
function hideAddProductForm(){ document.getElementById("addProductForm").style.display="none"; }
function clearProductForm(){ apName.value=""; apPrice.value=""; apStock.value=""; apDesc.value=""; apCat.value="Sofa"; }
let editingProductId=null;
function renderAdminKatalog(){
  const u=currentUser();
  if(!u||u.role!=="admin"){ toast("Halaman khusus admin."); go("login"); return; }
  document.getElementById("adminSidebar2").innerHTML = adminSidebarHTML("admin-katalog");
  document.getElementById("adminHeader2").innerHTML = adminHeaderHTML("Kelola Katalog Produk","Portal Pemantauan dan Operasional Furniture Homey Wood");
  document.getElementById("footer-admin-katalog").innerHTML = adminFooterHTML();
  const tbody=document.querySelector("#adminProductTable tbody");
  tbody.innerHTML = db.products().map(p=>`
    <tr>
      <td><div class="mini">${p.icon}</div></td>
      <td>${p.name}</td>
      <td>${p.category}</td>
      <td>${fmt(p.price)}</td>
      <td>${p.stock}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="editProduct(${p.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})">Hapus</button>
      </td>
    </tr>`).join("");
}
function editProduct(id){
  const p=db.products().find(x=>x.id===id);
  editingProductId=id;
  document.getElementById("addProductForm").style.display="block";
  apName.value=p.name; apCat.value=p.category; apPrice.value=p.price; apStock.value=p.stock; apDesc.value=p.desc;
  window.scrollTo(0,0);
}
function saveProduct(){
  const name=apName.value.trim(), cat=apCat.value, price=Number(apPrice.value), stock=Number(apStock.value), desc=apDesc.value.trim();
  if(!name||!price||!stock){ toast("Lengkapi data produk."); return; }
  const products=db.products();
  if(editingProductId){
    const p=products.find(x=>x.id===editingProductId);
    Object.assign(p,{name,category:cat,price,stock,desc});
    toast("Produk berhasil diperbarui.");
  } else {
    products.push({id:Date.now(),name,category:cat,price,stock,desc,icon:"🪵",rating:4.5});
    toast("Produk baru berhasil ditambahkan.");
  }
  db.saveProducts(products);
  hideAddProductForm();
  renderAdminKatalog();
}
function deleteProduct(id){
  if(!confirm("Hapus produk ini?")) return;
  db.saveProducts(db.products().filter(p=>p.id!==id));
  toast("Produk dihapus.");
  renderAdminKatalog();
}

/* ---------- ADMIN: KELOLA USER ---------- */
function renderAdminUser(){
  const u=currentUser();
  if(!u||u.role!=="admin"){ toast("Halaman khusus admin."); go("login"); return; }
  document.getElementById("adminSidebar4").innerHTML = adminSidebarHTML("admin-user");
  document.getElementById("adminHeader4").innerHTML = adminHeaderHTML("Kelola User","Data pengguna terdaftar di platform Homey Wood");
  document.getElementById("footer-admin-user").innerHTML = adminFooterHTML();
  const tbody=document.querySelector("#adminUserTable tbody");
  const users=db.users().filter(x=>x.role==="user");
  tbody.innerHTML = users.length ? users.map(x=>`
    <tr>
      <td>${x.name}</td>
      <td>${x.email}</td>
      <td>${x.phone}</td>
      <td>${x.address}</td>
      <td>${x.joined||'-'}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteUser(${x.id})">Hapus</button></td>
    </tr>`).join("") : `<tr><td colspan="6" style="text-align:center;color:var(--muted)">Belum ada pengguna terdaftar.</td></tr>`;
}
function deleteUser(id){
  if(!confirm("Hapus pengguna ini?")) return;
  db.saveUsers(db.users().filter(x=>x.id!==id));
  toast("Pengguna dihapus.");
  renderAdminUser();
}

/* ---------- ADMIN: VERIFIKASI ---------- */
function renderAdminVerifikasi(){
  const u=currentUser();
  if(!u||u.role!=="admin"){ toast("Halaman khusus admin."); go("login"); return; }
  document.getElementById("adminSidebar3").innerHTML = adminSidebarHTML("admin-verifikasi");
  document.getElementById("adminHeader3").innerHTML = adminHeaderHTML("Verifikasi Pembayaran Manual","Tinjau dan konfirmasi bukti pembayaran pelanggan");
  document.getElementById("footer-admin-verifikasi").innerHTML = adminFooterHTML();
  const orders=db.orders().filter(o=>o.status==="Menunggu Verifikasi").reverse();
  const list=document.getElementById("verifList");
  if(orders.length===0){ list.innerHTML=`<div class="empty-state"><div>✅</div>Tidak ada pembayaran yang perlu diverifikasi.</div>`; return; }
  list.innerHTML = orders.map(o=>{
    const buyer=db.users().find(u2=>u2.id===o.userId);
    return `<div class="order-row">
      <div>
        <div style="font-weight:600">${o.id} · ${buyer?buyer.name:'-'}</div>
        <div style="font-size:12.5px;color:var(--muted)">${o.items.map(i=>i.name+" x"+i.qty).join(", ")} · ${o.payment}</div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:700;margin-bottom:8px">${fmt(o.total)}</div>
        <button class="btn btn-primary btn-sm" onclick="verifyOrder('${o.id}','Selesai')">Setujui</button>
        <button class="btn btn-danger btn-sm" onclick="verifyOrder('${o.id}','Ditolak')">Tolak</button>
      </div>
    </div>`;
  }).join("");
}
function verifyOrder(id,status){
  const orders=db.orders();
  const o=orders.find(x=>x.id===id);
  o.status=status;
  db.saveOrders(orders);
  toast("Pesanan "+id+" ditandai "+status+".");
  renderAdminVerifikasi();
}

/* ---------- FOOTER ---------- */
const SOCIAL_ICONS = {
  instagram:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1"/></svg>',
  facebook:'<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M14 9h3V5h-3c-2.2 0-4 1.8-4 4v2H8v4h2v6h4v-6h3l1-4h-4v-2c0-.6.4-1 1-1z"/></svg>',
  share:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><line x1="8.1" y1="10.8" x2="15.9" y2="7.2"/><line x1="8.1" y1="13.2" x2="15.9" y2="16.8"/></svg>',
  youtube:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="4"/><path d="M10.5 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none"/></svg>'
};
function soon(label){ toast(label+" akan segera hadir."); }
function footerHTML(){
  return `<footer>
    <div class="footer-wrap">
      <div class="footer-col" style="max-width:260px">
        <h4>Homey Wood</h4>
        <p>Menghadirkan kehangatan dan keindahan alami ke dalam rumah Anda lewat pilihan mebel kayu jati dan linen berkualitas tinggi bergaya Scandinavian-rustic.</p>
        <p>Workshop: Batam, Kepulauan Riau<br>Showroom: Batu Aji, Batam</p>
      </div>
      <div class="footer-col">
        <h4>Koleksi</h4>
        <a onclick="go('katalog')">Ruang Tamu</a>
        <a onclick="go('katalog')">Ruang Makan</a>
        <a onclick="go('katalog')">Kamar Tidur</a>
        <a onclick="go('katalog')">Dekorasi Alami</a>
        <a onclick="go('katalog')">Terlaris</a>
      </div>
      <div class="footer-col">
        <h4>Layanan</h4>
        <a onclick="soon('Kustom Desain')">Kustom Desain</a>
        <a onclick="soon('Kebijakan Garansi')">Kebijakan Garansi</a>
        <a onclick="soon('Pengiriman &amp; Instalasi')">Pengiriman &amp; Instalasi</a>
        <a onclick="go('kontak')">Hubungi Kami</a>
        <a onclick="soon('F.A.Q')">F.A.Q</a>
      </div>
      <div class="footer-col">
        <h4>Hubungi Kami</h4>
        <p>Email: anyeongg@homeywood.co.id</p>
        <p>Telepon: +62 21-555-890</p>
        <div class="social-row">
          <a class="social-icon" onclick="soon('Instagram')">${SOCIAL_ICONS.instagram}</a>
          <a class="social-icon" onclick="soon('Facebook')">${SOCIAL_ICONS.facebook}</a>
          <a class="social-icon" onclick="soon('Bagikan')">${SOCIAL_ICONS.share}</a>
          <a class="social-icon" onclick="soon('YouTube')">${SOCIAL_ICONS.youtube}</a>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© 2026 Homey Wood. Hak Cipta Dilindungi.</span>
      <span><a onclick="soon('Syarat &amp; Ketentuan')">Syarat &amp; Ketentuan</a> • <a onclick="soon('Kebijakan Privasi')">Kebijakan Privasi</a></span>
    </div>
  </footer>`;
}
function adminFooterHTML(){
  return `<footer class="admin-footer">© 2026 Homey Wood — Admin Portal. Seluruh hak cipta dilindungi.</footer>`;
}

/* ---------- LUPA / RESET KATA SANDI ---------- */
let resetState=null; // {email, code, expiresAt}
let resetInterval=null;
function initResetForm(){
  const step1=document.getElementById("resetStep1");
  const step2=document.getElementById("resetStep2");
  if(!step1||!step2) return;
  clearInterval(resetInterval);
  if(resetState && Date.now()<resetState.expiresAt){
    step1.style.display="none"; step2.style.display="block";
    document.getElementById("resetEmailShown").textContent=resetState.email;
    startResetTimer();
  } else {
    resetState=null;
    step1.style.display="block"; step2.style.display="none";
  }
}
function sendResetCode(isResend){
  const emailInput=document.getElementById("resetEmail");
  const email = (isResend && resetState) ? resetState.email : (emailInput?emailInput.value.trim():"");
  if(!email){ toast("Masukkan email Anda terlebih dahulu."); return; }
  const u=db.users().find(x=>x.email.toLowerCase()===email.toLowerCase());
  if(!u){ toast("Email tidak terdaftar di Homey Wood."); return; }
  const code=String(Math.floor(100000+Math.random()*900000));
  resetState={email,code,expiresAt:Date.now()+5*60*1000};
  document.getElementById("resetStep1").style.display="none";
  document.getElementById("resetStep2").style.display="block";
  document.getElementById("resetEmailShown").textContent=email;
  toast("Kode verifikasi (demo): "+code);
  startResetTimer();
}
function startResetTimer(){
  clearInterval(resetInterval);
  const tick=()=>{
    if(!resetState){ clearInterval(resetInterval); return; }
    const remain=Math.max(0,Math.round((resetState.expiresAt-Date.now())/1000));
    const el=document.getElementById("resetTimer");
    if(el){ const m=String(Math.floor(remain/60)).padStart(2,"0"); const s=String(remain%60).padStart(2,"0"); el.textContent=m+":"+s; }
    if(remain<=0){ clearInterval(resetInterval); resetState=null; toast("Kode verifikasi kedaluwarsa, silakan kirim ulang."); initResetForm(); }
  };
  tick();
  resetInterval=setInterval(tick,1000);
}
function confirmResetPassword(){
  if(!resetState){ toast("Sesi reset kata sandi tidak valid, mulai ulang."); return; }
  const code=document.getElementById("resetCode").value.trim();
  const pass=document.getElementById("resetNewPass").value;
  const passConfirm=document.getElementById("resetNewPassConfirm").value;
  if(!code||!pass||!passConfirm){ toast("Lengkapi semua kolom."); return; }
  if(code!==resetState.code){ toast("Kode verifikasi salah."); return; }
  if(pass.length<8){ toast("Kata sandi minimal 8 karakter."); return; }
  if(pass!==passConfirm){ toast("Konfirmasi kata sandi tidak cocok."); return; }
  const users=db.users();
  const u=users.find(x=>x.email.toLowerCase()===resetState.email.toLowerCase());
  if(!u){ toast("Akun tidak ditemukan."); return; }
  u.password=pass;
  db.saveUsers(users);
  clearInterval(resetInterval);
  resetState=null;
  toast("Kata sandi berhasil diperbarui. Silakan masuk kembali.");
  go("login");
}

/* ---------- INTERAKTIVITAS & ANIMASI ---------- */
function animateCounters(scope){
  scope.querySelectorAll(".stat-grid b").forEach(el=>{
    if(el.dataset.animated) return;
    const text=el.textContent;
    const match=text.match(/[\d.,]+/);
    if(!match) return;
    const numStr=match[0];
    const target=parseInt(numStr.replace(/[.,]/g,""),10);
    if(isNaN(target)){ return; }
    el.dataset.animated="1";
    const suffix=text.slice(text.indexOf(numStr)+numStr.length);
    let cur=0; const step=Math.max(1,Math.round(target/36));
    const timer=setInterval(()=>{
      cur+=step;
      if(cur>=target){ cur=target; clearInterval(timer); }
      el.textContent = cur.toLocaleString("id-ID")+suffix;
    },28);
  });
}
function initScrollReveal(){
  const app=document.getElementById("app");
  if(!app) return;
  const els=app.querySelectorAll(".reveal:not(.in)");
  if(!("IntersectionObserver" in window)){
    els.forEach(el=>el.classList.add("in"));
    animateCounters(app);
    return;
  }
  const io=new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add("in");
        if(entry.target.classList.contains("stat-grid")) animateCounters(app);
        io.unobserve(entry.target);
      }
    });
  },{threshold:.15});
  els.forEach(el=>io.observe(el));
  animateCounters(app); // in case stat-grid already visible on load
}
document.addEventListener("click",(e)=>{
  const btn=e.target.closest(".btn");
  if(!btn) return;
  const rect=btn.getBoundingClientRect();
  const size=Math.max(rect.width,rect.height);
  const span=document.createElement("span");
  span.className="ripple";
  span.style.width=span.style.height=size+"px";
  span.style.left=(e.clientX-rect.left-size/2)+"px";
  span.style.top=(e.clientY-rect.top-size/2)+"px";
  btn.appendChild(span);
  setTimeout(()=>span.remove(),550);
});

/* ---------- INIT ---------- */
go("home");
