/*  DATA / DB (localStorage) */
const CATS = [
  {key:"Sofa",icon:"🛋️"},{key:"Meja",icon:"🪑"},{key:"Kursi",icon:"💺"},{key:"Lemari",icon:"🚪"}
];

function seedIfEmpty(){
  if(!localStorage.getItem("hw_users")){
    const users = [
      {id:1,name:"Admin Homey Wood",username:"admin",email:"admin@homeywood.com",phone:"081200000000",address:"Kantor Pusat Homey Wood, Jakarta",password:"admin123",role:"admin",joined:"01 Januari 2026"}
    ];
    localStorage.setItem("hw_users",JSON.stringify(users));
  }
  if(!localStorage.getItem("hw_orders")) localStorage.setItem("hw_orders","[]");
  if(!localStorage.getItem("hw_carts")) localStorage.setItem("hw_carts","{}");
  if(!localStorage.getItem("hw_messages")) localStorage.setItem("hw_messages","[]");
  if(!localStorage.getItem("hw_reviews")) localStorage.setItem("hw_reviews","[]");
}
seedIfEmpty();

let PRODUCTS_CACHE = {};

async function fetchProductList(params){
  const qs = new URLSearchParams();
  if(params && params.category && params.category!=="Semua") qs.set("category", params.category);
  if(params && params.materials) params.materials.forEach(m=>qs.append("material", m));
  if(params && params.search) qs.set("search", params.search);
  const res = await fetch("/api/products?"+qs.toString());
  const data = await res.json();
  const list = data.products || [];
  list.forEach(p=>{ PRODUCTS_CACHE[p.id]=p; });
  return list;
}

async function fetchProductDetail(id){
  const res = await fetch("/api/products/"+id);
  if(!res.ok) return null;
  const data = await res.json();
  PRODUCTS_CACHE[data.product.id]=data.product;
  return data.product;
}

const db = {
  products:()=>Object.values(PRODUCTS_CACHE),
  saveProducts:(p)=>{ },
  users:()=>JSON.parse(localStorage.getItem("hw_users")),
  saveUsers:(u)=>localStorage.setItem("hw_users",JSON.stringify(u)),
  orders:()=>JSON.parse(localStorage.getItem("hw_orders")),
  saveOrders:(o)=>localStorage.setItem("hw_orders",JSON.stringify(o)),
  carts:()=>JSON.parse(localStorage.getItem("hw_carts")),
  saveCarts:(c)=>localStorage.setItem("hw_carts",JSON.stringify(c)),
  messages:()=>JSON.parse(localStorage.getItem("hw_messages")),
  saveMessages:(m)=>localStorage.setItem("hw_messages",JSON.stringify(m)),
  reviews:()=>JSON.parse(localStorage.getItem("hw_reviews")||"[]"),
  saveReviews:(r)=>localStorage.setItem("hw_reviews",JSON.stringify(r))
};

const _ss = (k,d)=>{ try{ const v=sessionStorage.getItem(k); return v===null?d:JSON.parse(v);}catch(e){return d;} };
let currentDetailId = _ss("hw_detailId", null);
let currentFilterCat = _ss("hw_filterCat", "Semua");

/* SESI (dari backend, bukan localStorage lagi) */
let _authUser = null; // diisi refreshAuth() saat boot() dan tiap habis login/register/logout

function currentUser(){
  return _authUser;
}

function displayName(u){ return (u && (u.username||u.name)) || ""; }

async function refreshAuth(){
  try{
    const res = await fetch("/api/me");
    const data = await res.json();
    _authUser = data.user;
  }catch(e){
    _authUser = null;
  }
}
// Foto produk kalau ada, kalau belum ada pakai emoji cadangan
function productImgHTML(p){
  return p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">` : p.icon;
}
// Foto profil kalau ada, kalau belum ada pakai inisial nama
function avatarInner(u){
  if(u.avatar_url) return `<img src="${esc(u.avatar_url)}" alt="Foto profil">`;
  return esc(displayName(u).slice(0,2).toUpperCase());
}
function fmt(n){ return "Rp " + n.toLocaleString("id-ID"); }
function toast(msg){
  const t=document.getElementById("toast");
  t.textContent=msg; t.style.display="block"; window._lastToast={m:msg,t:Date.now()};
  clearTimeout(window._toastTimer);
  window._toastTimer=setTimeout(()=>t.style.display="none",2200);
}

/* NAV / ROUTER */
function showPage(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  const el = document.getElementById("page-"+page);
  if(el) el.classList.add("active");
  document.querySelectorAll("[data-nav]").forEach(n=>n.classList.toggle("on",n.dataset.nav===page));
  document.getElementById("dropdownMenu").parentElement.classList.remove("open");
  window.scrollTo(0,0);

  const isAdminPage = page.indexOf("admin")===0;
  document.querySelector(".navbar").style.display = isAdminPage ? "none" : "";

  if(page==="home") renderHome();
  if(page==="katalog") renderKatalog();
  if(page==="detail") renderDetail();
  if(page==="keranjang") renderCart();
  if(page==="checkout") renderCheckout();
  if(page==="profile") renderProfile();
  if(page==="admin-dashboard") renderAdminDashboard();
  if(page==="admin-katalog") renderAdminKatalog();
  if(page==="admin-user") renderAdminUser();
  if(page==="admin-verifikasi") renderAdminVerifikasi();

  if(!isAdminPage) renderNavbar();
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
    menu.innerHTML = `<div class="who">Halo, <b>${esc(displayName(u))}</b></div>
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
      <div class="sidebar-user">${u?esc(displayName(u)):''}</div>
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

/* AUTH */
async function apiRequest(method, url, body){
  const opts = { method, headers: {} };
  if(body instanceof FormData){
    opts.body = body; // upload file, biarkan browser yang mengisi Content-Type (multipart)
  } else if(body !== undefined){
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  let data = {};
  try{ data = await res.json(); }catch(e){ /* respons kosong, misal 204 */ }
  return {ok: res.ok, status: res.status, data};
}
function apiPost(url, body){ return apiRequest("POST", url, body || {}); }

async function doLogin(){
  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPass").value;
  if(!email||!pass){toast("Isi email dan password.");return;}

  const {ok, data} = await apiPost("/api/login", {email, password: pass});
  if(!ok){ toast(data.error || "Email atau password salah."); return; }

  _authUser = data.user;
  document.getElementById("loginEmail").value="";
  document.getElementById("loginPass").value="";
  if(_authUser.role==="admin"){ toast("Berhasil masuk sebagai Admin."); go("admin-dashboard"); }
  else { toast("Selamat datang kembali, "+displayName(_authUser)+"!"); go("home"); }
}

async function doRegister(){
  const full_name=document.getElementById("regName").value.trim();
  const username=document.getElementById("regUsername").value.trim();
  const email=document.getElementById("regEmail").value.trim();
  const phone=document.getElementById("regPhone").value.trim();
  const address=document.getElementById("regAddress").value.trim();
  const password=document.getElementById("regPass").value;
  const passConfirm=document.getElementById("regPassConfirm").value;
  const termsOk=document.getElementById("regTerms").checked;

  if(!full_name||!username||!email||!phone||!address||!password||!passConfirm){toast("Lengkapi semua data terlebih dahulu.");return;}
  if(password.length<8){toast("Kata sandi minimal 8 karakter.");return;}
  if(password!==passConfirm){toast("Konfirmasi kata sandi tidak cocok.");return;}
  if(!termsOk){toast("Setujui Syarat & Ketentuan dan Kebijakan Privasi terlebih dahulu.");return;}

  const {ok, data} = await apiPost("/api/register", {full_name, username, email, phone, address, password});
  if(!ok){ toast(data.error || "Pendaftaran gagal."); return; }

  _authUser = data.user;
  document.getElementById("regPass").value="";
  document.getElementById("regPassConfirm").value="";
  toast("Akun berhasil dibuat. Selamat datang, "+username+"!");
  go("home");
}

async function logout(){
  await apiPost("/api/logout");
  _authUser=null;
  toast("Anda telah keluar.");
  go("home");
}

function requireLogin(){
  if(!currentUser()){ toast("Silakan masuk terlebih dahulu."); go("login"); return false; }
  return true;
}

/* HELPER: ESCAPE, RATING, STATUS */
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function todayStr(){ return new Date().toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"}); }
function ratingStatsFrom(rs){ const n=rs.length; const avg=n? rs.reduce((t,r)=>t+r.rating,0)/n : 0; return {n,avg,rs}; }
function ratingOf(p){ const r=p.rating||{}; return {n:r.count||0, avg:r.avg||0, latest:r.latest||null}; }
function starsHTML(v){ const f=Math.round(v); return '<span class="stars">'+"★".repeat(f)+'<span style="color:#D9CDB8">'+"★".repeat(5-f)+'</span></span>'; }
function statusClass(st){ return st==="Selesai"?"status-done":st==="Ditolak"?"status-rejected":(st==="Dikirim"||st==="Diproses")?"status-ship":"status-pending"; }

/* ULASAN, RATING & KOMENTAR */
async function renderReviews(p){
  let box=document.getElementById("reviewSection");
  if(!box){ box=document.createElement("div"); box.id="reviewSection"; document.getElementById("detailWrap").insertAdjacentElement("afterend",box); }
  const res=await fetch(`/api/products/${p.id}/reviews`);
  const rs=res.ok ? ((await res.json()).reviews||[]) : [];
  const st=ratingStatsFrom(rs);
  const dist=[5,4,3,2,1].map(k=>{ const c=rs.filter(r=>r.rating===k).length;
    return `<div class="dist-row"><span>${k}★</span><div class="dist-bar"><i style="width:${st.n?c/st.n*100:0}%"></i></div><span>${c}</span></div>`; }).join("");
  box.innerHTML = `<h3 style="margin:34px 0 12px">Rating & Ulasan Pembeli</h3>
    <div class="review-summary card">
      <div class="big-rating"><b>${st.n?st.avg.toFixed(1):"–"}</b>${starsHTML(st.avg)}<small class="muted">${st.n} ulasan</small></div>
      <div class="dist">${dist}</div>
    </div>
    ${st.n ? rs.map(reviewHTML).join("") : `<div class="empty-state"><div>💬</div>Belum ada ulasan. Ulasan bisa ditulis pembeli setelah barang tiba di alamat tujuan.</div>`}`;
}
function reviewHTML(r){
  const cs=(r.comments||[]).map(c=>`<div class="comment ${c.isAdmin?'by-admin':''}"><b>${esc(c.name)}</b>${c.isAdmin?' <em>Penjual</em>':''} <span class="muted">· ${esc(c.date)}</span><div>${esc(c.text)}</div></div>`).join("");
  return `<div class="review-item card">
    <div class="review-head"><div class="avatar-sm">${esc(r.userName.charAt(0).toUpperCase())}</div>
      <div><b>${esc(r.userName)}</b><div>${starsHTML(r.rating)} <span class="muted" style="font-size:12px">${esc(r.date)}</span></div></div></div>
    <p class="review-text">${esc(r.text)}</p>
    ${(r.images&&r.images.length)?`<div class="rv-gallery">${r.images.map(d=>`<img src="${d}" onclick="viewImage(this.src)">`).join("")}</div>`:""}
    <div class="comments">${cs}</div>
    <div class="comment-form"><input id="cm-${r.id}" placeholder="Tulis komentar..." maxlength="200" onkeydown="if(event.key==='Enter')addComment('${r.id}')"><button class="btn btn-outline btn-sm" onclick="addComment('${r.id}')">Kirim</button></div>
  </div>`;
}
async function addComment(rid){
  if(!requireLogin()) return;
  const inp=document.getElementById("cm-"+rid); const text=inp.value.trim();
  if(!text){ toast("Komentar tidak boleh kosong."); return; }
  const {ok,data}=await apiPost(`/api/reviews/${rid}/comments`,{text});
  if(!ok){ toast(data.error||"Gagal mengirim komentar."); return; }
  toast("Komentar terkirim.");
  renderReviews(db.products().find(x=>x.id===currentDetailId));
}
let reviewCtx=null, reviewStars=0, reviewImages=[];
const MAX_REVIEW_IMG=3;
function openReviewModal(orderId,pid){
  const p=db.products().find(x=>x.id===pid); reviewCtx={orderId,pid}; reviewStars=0; reviewImages=[];
  const m=document.createElement("div"); m.className="modal-back"; m.id="reviewModal";
  m.innerHTML=`<div class="modal"><h3 style="margin-top:0">Beri Rating & Ulasan</h3>
    <p class="muted" style="margin-top:-6px;font-size:13.5px">${esc(p?p.name:"")}</p>
    <div class="star-pick" id="starPick">${[1,2,3,4,5].map(n=>`<span onclick="pickStar(${n})" data-n="${n}">★</span>`).join("")}</div>
    <textarea id="rvText" rows="4" maxlength="400" placeholder="Ceritakan kualitas produk, kondisi barang saat tiba, dan pengirimannya..."></textarea>
    <div class="rv-photos"><div id="rvPreview" class="rv-preview"></div>
      <label class="btn btn-outline btn-sm rv-add" id="rvAddBtn">📷 Tambah foto (maks ${MAX_REVIEW_IMG})<input type="file" accept="image/*" multiple hidden onchange="addReviewImages(this)"></label></div>
    <div class="modal-btns"><button class="btn btn-outline btn-sm" onclick="closeReviewModal()">Batal</button><button class="btn btn-primary btn-sm" onclick="submitReview()">Kirim Ulasan</button></div></div>`;
  m.addEventListener("click",e=>{ if(e.target===m) closeReviewModal(); });
  document.body.appendChild(m);
}
function pickStar(n){ reviewStars=n; document.querySelectorAll("#starPick span").forEach(x=>x.classList.toggle("on",+x.dataset.n<=n)); }
function addReviewImages(inp){
  const files=Array.from(inp.files||[]).filter(f=>f.type.startsWith("image/")).slice(0,MAX_REVIEW_IMG-reviewImages.length);
  if(!files.length){ toast("Pilih file gambar (JPG/PNG)."); inp.value=""; return; }
  Promise.all(files.map(f=>compressImage(f,800,0.7))).then(arr=>{ reviewImages=reviewImages.concat(arr); inp.value=""; drawReviewPreview(); }).catch(()=>toast("Gagal membaca gambar."));
}
function removeReviewImage(i){ reviewImages.splice(i,1); drawReviewPreview(); }
function drawReviewPreview(){
  const box=document.getElementById("rvPreview"); if(!box) return;
  box.innerHTML=reviewImages.map((d,i)=>`<div class="rv-thumb"><img src="${d}"><button onclick="removeReviewImage(${i})" title="Hapus">×</button></div>`).join("");
  const b=document.getElementById("rvAddBtn"); if(b) b.style.display=reviewImages.length>=MAX_REVIEW_IMG?"none":"";
}
function viewImage(src){
  const m=document.createElement("div"); m.className="modal-back";
  m.innerHTML=`<img src="${src}" style="max-width:92vw;max-height:88vh;border-radius:10px;animation:pop .25s ease">`;
  m.addEventListener("click",()=>m.remove()); document.body.appendChild(m);
}
function closeReviewModal(){ const m=document.getElementById("reviewModal"); if(m) m.remove(); }
async function submitReview(){
  const text=document.getElementById("rvText").value.trim();
  if(!reviewStars){ toast("Pilih rating bintang dulu."); return; }
  if(text.length<5){ toast("Tulis ulasan minimal 5 karakter."); return; }
  const {ok,data}=await apiPost("/api/reviews",{orderCode:reviewCtx.orderId, productId:reviewCtx.pid, rating:reviewStars, text, images:reviewImages});
  if(!ok){ toast(data.error||"Gagal mengirim ulasan."); return; }
  closeReviewModal(); toast("Terima kasih, ulasan terkirim!"); renderProfile();
}
async function confirmArrived(id){
  const {ok, data} = await apiRequest("POST", `/api/orders/${id}/confirm-arrived`);
  if(!ok){ toast(data.error || "Gagal mengonfirmasi pesanan."); return; }
  toast("Pesanan diterima. Silakan beri rating & ulasan!"); renderProfile();
}
function orderActionsHTML(o){
  let h="";
  if(o.status==="Dikirim") h+=`<button class="btn btn-primary btn-sm" onclick="confirmArrived('${o.id}')">📦 Barang Sudah Tiba</button>`;
  if(o.status==="Selesai"){
    h+=o.items.map(i=>{ if(!i.productId) return "";
      return i.reviewed
        ? `<span class="reviewed">✓ Sudah diulas: ${esc(i.name)}</span>`
        : `<button class="btn btn-outline btn-sm" onclick="openReviewModal('${o.id}',${i.productId})">⭐ Beri ulasan: ${esc(i.name)}</button>`; }).join("");
  }
  return h? `<div class="order-actions">${h}</div>` : "";
}

/* HOME */
function productCardHTML(p){
  const st=ratingOf(p);
  const last=st.latest;
  return `<div class="pcard" onclick="openDetail(${p.id})">
    <div class="thumb">${productImgHTML(p)}</div>
    <div class="info">
      <div class="name">${p.name}</div>
      <div class="price">${fmt(p.price)}</div>
      <div class="rating-line">${st.n ? starsHTML(st.avg)+` <b>${st.avg.toFixed(1)}</b> <span class="muted">(${st.n} ulasan)</span>` : `<span class="muted">Belum ada ulasan</span>`}</div>
      ${last ? `<div class="review-snippet">"${esc(last.text)}"${last.hasImages?" 📷":""} <span>— ${esc(last.userName)}</span></div>` : ""}
      <div class="row"><span></span>
        <button class="add-btn" onclick="event.stopPropagation();addToCart(${p.id})">+</button>
      </div>
    </div>
  </div>`;
}

async function renderHome(){
  document.getElementById("catRow").innerHTML = CATS.map(c=>`
    <div class="cat-item" onclick="goToKatalogCat('${c.key}')">
      <div class="cat-circle">${c.icon}</div><span>${c.key}</span>
    </div>`).join("");
  const all = await fetchProductList();
  const top = all.slice(0,4);
  document.getElementById("homeProducts").innerHTML = top.map(productCardHTML).join("");
  document.getElementById("footer-home").innerHTML = footerHTML();
}
function goToKatalogCat(cat){ currentFilterCat=cat; sessionStorage.setItem("hw_filterCat",JSON.stringify(cat)); go("katalog"); }

/* KATALOG */
async function renderKatalog(){
  const checked = document.querySelector('input[name="fcat"]:checked');
  const cat = checked ? checked.value : currentFilterCat;
  const mats = Array.from(document.querySelectorAll('.fmat:checked')).map(m=>m.value);
  const list = await fetchProductList({category: cat, materials: mats});
  document.getElementById("katalogGrid").innerHTML = list.length ? list.map(productCardHTML).join("") :
    `<div class="empty-state" style="grid-column:1/-1"><div>🔍</div>Tidak ada produk yang cocok dengan filter ini.</div>`;
  document.getElementById("footer-katalog").innerHTML = footerHTML();
}

/* DETAIL */
let detailQty=1;
function openDetail(id){ currentDetailId=id; sessionStorage.setItem("hw_detailId",JSON.stringify(id)); detailQty=1; go("detail"); }
async function renderDetail(){
  const p = await fetchProductDetail(currentDetailId);
  if(!p){ document.getElementById("detailWrap").innerHTML="<p>Produk tidak ditemukan.</p>"; return; }
  const st=ratingOf(p);
  document.getElementById("detailWrap").innerHTML = `
    <div class="detail-img">${productImgHTML(p)}</div>
    <div class="detail-info">
      <div>${st.n ? starsHTML(st.avg)+` <span style="color:var(--muted);font-size:13px">${st.avg.toFixed(1)} · ${st.n} ulasan</span>` : `<span style="color:var(--muted);font-size:13px">Belum ada ulasan</span>`}</div>
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
  renderReviews(p);
  document.getElementById("footer-detail").innerHTML = footerHTML();
}
function changeQty(d){
  const p=db.products().find(x=>x.id===currentDetailId);
  detailQty=Math.max(1,Math.min(p.stock,detailQty+d));
  document.getElementById("qtyVal").textContent=detailQty;
}

/* CART */
let _cart = [];

async function refreshCart(){
  if(!currentUser()){ _cart=[]; return; }
  try{
    const res = await fetch("/api/cart");
    _cart = res.ok ? ((await res.json()).items || []) : [];
  }catch(e){
    _cart = [];
  }
}
function getCart(){ return _cart; }
async function addToCart(productId,qty){
  if(!requireLogin()) return;
  const {ok,data} = await apiPost("/api/cart/items", {productId, qty: qty||1});
  if(!ok){ toast(data.error || "Gagal menambahkan ke keranjang."); return; }
  _cart = data.items;
  updateCartBadge();
  const bd=document.getElementById("cartBadge"); bd.classList.remove("bump"); void bd.offsetWidth; bd.classList.add("bump");
  toast("Produk ditambahkan ke keranjang.");
}
function updateCartBadge(){
  const items=getCart();
  const count=items.reduce((s,i)=>s+i.qty,0);
  const badge=document.getElementById("cartBadge");
  badge.textContent=count;
  badge.style.display = count>0 ? "flex" : "none";
}
function cartWithDetails(){
  const products=db.products();
  return getCart().map(i=>({...i, product:products.find(p=>p.id===i.productId)})).filter(i=>i.product);
}
function cartTotal(){ return cartWithDetails().reduce((s,i)=>s+i.product.price*i.qty,0); }

async function renderCart(){
  if(!requireLogin()) return;
  await fetchProductList();
  const items = cartWithDetails();
  if(items.length===0){
    document.getElementById("cartLayout").innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div>🛒</div>Keranjang Anda masih kosong.<br><br><button class="btn btn-primary" onclick="go('katalog')">Mulai Belanja</button></div>`;
    document.getElementById("footer-keranjang").innerHTML = footerHTML();
    return;
  }
  const left = items.map(i=>`
    <div class="cart-item">
      <div class="thumb">${productImgHTML(i.product)}</div>
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
      <div class="sum-row"><span>Ongkos Kirim</span><span>Dihitung di checkout</span></div>
      <div class="sum-row total"><span>Total Sementara</span><span>${fmt(cartTotal())}</span></div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="go('checkout')">Lanjut ke Checkout</button>
    </div>`;
  document.getElementById("cartLayout").innerHTML = `<div>${left}</div>${right}`;
  document.getElementById("footer-keranjang").innerHTML = footerHTML();
}
async function updateCartQty(productId,d){
  const it=_cart.find(i=>i.productId===productId);
  if(!it) return;
  const qty=Math.max(1,it.qty+d);
  if(qty===it.qty) return;
  const {ok,data} = await apiRequest("PUT", `/api/cart/items/${productId}`, {qty});
  if(!ok){ toast(data.error || "Gagal mengubah jumlah."); return; }
  _cart=data.items; renderCart(); updateCartBadge();
}
async function removeFromCart(productId){
  const {ok,data} = await apiRequest("DELETE", `/api/cart/items/${productId}`);
  if(!ok){ toast(data.error || "Gagal menghapus produk."); return; }
  _cart=data.items; renderCart(); updateCartBadge();
  toast("Produk dihapus dari keranjang.");
}

/* CHECKOUT */
/* Ongkir: atur tarif di sini. Tarif dasar per wilayah, barang besar (sofa/lemari) lebih berat. */
const ZONES=[
  {key:"batam",name:"Batam",rate:150000,freeMin:5000000},
  {key:"sumatra",name:"Sumatra & Kepri lainnya",rate:350000,freeMin:10000000},
  {key:"jawa",name:"Jawa",rate:500000,freeMin:null},
  {key:"kalsul",name:"Kalimantan & Sulawesi",rate:750000,freeMin:null},
  {key:"timur",name:"Bali, NTB/NTT, Maluku & Papua",rate:1000000,freeMin:null}
];
const SIZE_UNITS={Sofa:3,Lemari:3,Meja:2,Kursi:1};
let selectedZone=_ss("hw_zone","batam");
let paymentProof=null;
function chooseZone(k){ selectedZone=k; sessionStorage.setItem("hw_zone",JSON.stringify(k)); renderCheckout(); }
function calcShipping(items){
  const z=ZONES.find(x=>x.key===selectedZone)||ZONES[0];
  const sub=items.reduce((t,i)=>t+i.product.price*i.qty,0);
  const units=items.reduce((t,i)=>t+(SIZE_UNITS[i.product.category]||1)*i.qty,0);
  if(!units) return {zone:z,fee:0,free:false};
  if(z.freeMin && sub>=z.freeMin) return {zone:z,fee:0,free:true};
  const mult=Math.min(3,1+0.5*(units-1));
  return {zone:z,fee:Math.round(z.rate*mult/1000)*1000,free:false};
}
function compressImage(file,max,q){
  return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onerror=rej;
    fr.onload=()=>{ const img=new Image(); img.onerror=rej;
      img.onload=()=>{ const sc=Math.min(1,max/Math.max(img.width,img.height)); const c=document.createElement("canvas");
        c.width=Math.round(img.width*sc); c.height=Math.round(img.height*sc);
        c.getContext("2d").drawImage(img,0,0,c.width,c.height); res(c.toDataURL("image/jpeg",q)); };
      img.src=fr.result; };
    fr.readAsDataURL(file); });
}
function handleProof(inp){
  const f=inp.files&&inp.files[0]; if(!f) return;
  if(!f.type.startsWith("image/")){ toast("File harus berupa gambar (JPG/PNG)."); return; }
  compressImage(f,900,0.72).then(d=>{ paymentProof=d; renderCheckout(); toast("Bukti pembayaran terlampir."); }).catch(()=>toast("Gagal membaca gambar."));
}
function clearProof(){ paymentProof=null; renderCheckout(); }
function renderProofBox(){
  return `<div class="proof-box">
    <div style="font-weight:600;font-size:14px;margin-bottom:8px">Bukti Pembayaran <span style="color:var(--err)">* wajib</span></div>
    <input type="file" accept="image/*" onchange="handleProof(this)">
    ${paymentProof ? `<div><img class="proof-preview" src="${paymentProof}" alt="Bukti pembayaran"></div><button class="btn btn-danger btn-sm" onclick="clearProof()">Hapus bukti</button>`
      : `<p class="muted" style="font-size:12px;margin:8px 0 0">Unggah screenshot/foto bukti transfer atau QRIS setelah membayar.</p>`}
  </div>`;
}
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
      <div class="qris-merchant">
        <div class="qris-label">QRIS</div>
        <div class="qris-name">HOMEYWOOD, BTM KT</div>
      </div>
      <div class="qris-frame">
        <img src="/img/qris.jpeg" alt="Kode QRIS Homeywood" class="qris-img">
      </div>
      <div style="font-size:12.5px;color:var(--muted);margin-top:10px">Kode QRIS dinamis akan otomatis kedaluwarsa dalam <b id="qrisTimer">10:00</b></div>
    </div>`;
}
async function renderCheckout(){
  if(!requireLogin()) return;
  await fetchProductList();
  const items=cartWithDetails();
  const u=currentUser();
  const ship=calcShipping(items);
  if(items.length===0){ document.getElementById("checkoutLayout").innerHTML=`<div class="empty-state" style="grid-column:1/-1"><div>🧾</div>Keranjang kosong, tidak ada yang bisa di-checkout.</div>`; document.getElementById("footer-checkout").innerHTML=footerHTML(); return; }
  const left = `
    <div class="card" style="margin-bottom:16px">
      <h3 style="margin-top:0">1. Alamat Pengiriman</h3>
      <p style="font-size:14px"><span class="muted" style="font-size:12px">Penerima (sesuai nama lengkap)</span><br><b>${esc(u.name)}</b><br>${esc(u.phone)}<br>${esc(u.address)}</p>
      <label class="zone-label">Wilayah tujuan (untuk hitung ongkir)</label>
      <select class="zone-select" onchange="chooseZone(this.value)">${ZONES.map(z=>`<option value="${z.key}" ${z.key===selectedZone?'selected':''}>${z.name}</option>`).join("")}</select>
    </div>
    <div class="card">
      <h3 style="margin-top:0">2. Metode Pembayaran</h3>
      ${["Transfer Bank","QRIS","Bayar di Tempat (COD)"].map(m=>`
        <label class="pay-option">
          <input type="radio" name="pay" value="${m}" ${selectedPayment===m?'checked':''} onchange="choosePayment('${m}')"> ${m}
        </label>`).join("")}
      ${selectedPayment==="Transfer Bank" ? renderBankChooser() : ""}
      ${selectedPayment==="QRIS" ? renderQrisBox() : ""}
      ${selectedPayment!=="Bayar di Tempat (COD)" ? renderProofBox() : `<p class="cod-note">💵 COD: bayar tunai saat barang tiba. Tidak perlu unggah bukti pembayaran.</p>`}
    </div>`;
  const right = `<div class="cart-summary">
      <h3 style="margin-top:0">3. Ringkasan Pesanan</h3>
      ${items.map(i=>`<div class="sum-row"><span>${i.product.name} x${i.qty}</span><span>${fmt(i.product.price*i.qty)}</span></div>`).join("")}
      <div class="sum-row"><span>Subtotal</span><span>${fmt(cartTotal())}</span></div>
      <div class="sum-row"><span>Ongkos Kirim (${ship.zone.name})</span><span>${ship.free?'<b style="color:var(--ok)">Gratis</b>':fmt(ship.fee)}</span></div>
      <div class="sum-row total"><span>Total Bayar</span><span>${fmt(cartTotal()+ship.fee)}</span></div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="placeOrder()">Buat Pesanan</button>
    </div>`;
  document.getElementById("checkoutLayout").innerHTML = `<div>${left}</div>${right}`;
  document.getElementById("footer-checkout").innerHTML = footerHTML();
  if(selectedPayment==="QRIS" && !qrisInterval) startQrisTimer();
}
async function placeOrder(){
  const items=cartWithDetails();
  const isCOD=selectedPayment==="Bayar di Tempat (COD)";
  if(!isCOD && !paymentProof){
    toast("Lampirkan bukti pembayaran dulu untuk Transfer/QRIS.");
    const pb=document.querySelector(".proof-box"); if(pb){ pb.classList.add("shake"); pb.scrollIntoView({behavior:"smooth",block:"center"}); setTimeout(()=>pb.classList.remove("shake"),600); }
    return;
  }
  let paymentLabel=selectedPayment;
  if(selectedPayment==="Transfer Bank") paymentLabel="Transfer Bank "+BANKS.find(b=>b.code===selectedBank).name+" (VA: "+getVA(selectedBank)+")";

  const payload = {
    items: items.map(i=>({productId:i.productId, qty:i.qty})), // harga/nama TIDAK dikirim -- server yang tentukan dari database
    zone: selectedZone,
    payment_method: selectedPayment,
    payment_label: paymentLabel,
    payment_proof: isCOD ? null : paymentProof,
  };
  const {ok, data} = await apiRequest("POST", "/api/orders", payload);
  if(!ok){ toast(data.error || "Gagal membuat pesanan."); return; }

  _cart=[]; updateCartBadge(); stopQrisTimer(); vaCache={}; paymentProof=null;
  toast(isCOD ? "Pesanan dibuat! Bayar tunai saat barang tiba." : "Pesanan dibuat! Menunggu verifikasi pembayaran.");
  go("profile");
}

/* PROFILE */
let profileEditing=false;
function toggleProfileEdit(on){ profileEditing=on; renderProfile(); }
async function saveProfile(){
  const payload={
    full_name:document.getElementById("pfName").value.trim(),
    phone:document.getElementById("pfPhone").value.trim(),
    address:document.getElementById("pfAddress").value.trim()
  };
  const {ok,data}=await apiRequest("PUT","/api/profile",payload);
  if(!ok){ toast(data.error||"Gagal menyimpan profil."); return; }
  await refreshAuth(); profileEditing=false;
  toast("Profil berhasil diperbarui."); renderNavbar(); renderProfile();
}
async function uploadAvatar(inp){
  const f=inp.files&&inp.files[0]; if(!f) return;
  if(f.size>2*1024*1024){ toast("Ukuran foto maksimal 2 MB."); inp.value=""; return; }
  const fd=new FormData(); fd.append("avatar",f);
  const {ok,data}=await apiRequest("POST","/api/profile/avatar",fd);
  if(!ok){ toast(data.error||"Gagal mengunggah foto."); inp.value=""; return; }
  await refreshAuth(); toast("Foto profil diperbarui."); renderProfile();
}
async function removeAvatar(){
  if(!confirm("Hapus foto profil?")) return;
  const {ok,data}=await apiRequest("DELETE","/api/profile/avatar");
  if(!ok){ toast(data.error||"Gagal menghapus foto."); return; }
  await refreshAuth(); toast("Foto profil dihapus."); renderProfile();
}
async function renderProfile(){
  if(!requireLogin()) return;
  const u=currentUser();
  const orderRes = await fetch("/api/orders");
  const orderData = await orderRes.json();
  const myOrders = orderRes.ok ? (orderData.orders || []) : [];
  const infoCard = profileEditing ? `
    <div class="card" style="margin-bottom:24px">
      <h3 style="margin-top:0">Edit Informasi Pribadi</h3>
      <div class="two-col">
        <div class="form-row"><label>Nama Lengkap</label><input id="pfName" value="${esc(u.name)}"></div>
        <div class="form-row"><label>No. WhatsApp</label><input id="pfPhone" value="${esc(u.phone)}"></div>
      </div>
      <div class="form-row"><label>Alamat</label><textarea id="pfAddress" rows="2">${esc(u.address)}</textarea></div>
      <button class="btn btn-primary btn-sm" onclick="saveProfile()">Simpan</button>
      <button class="btn btn-outline btn-sm" onclick="toggleProfileEdit(false)">Batal</button>
    </div>` : `
    <div class="card" style="margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0 0 12px">Informasi Pribadi</h3>
        <button class="btn btn-outline btn-sm" onclick="toggleProfileEdit(true)">Edit Profil</button>
      </div>
      <div class="two-col">
        <div><div style="font-size:12px;color:var(--muted)">Nama Lengkap <span style="font-weight:400">(untuk label pengiriman)</span></div><div style="font-size:14.5px;font-weight:600">${esc(u.name)}</div></div>
        <div><div style="font-size:12px;color:var(--muted)">Username</div><div style="font-size:14.5px;font-weight:600">${u.username||'-'}</div></div>
        <div><div style="font-size:12px;color:var(--muted)">Email</div><div style="font-size:14.5px;font-weight:600">${u.email}</div></div>
        <div><div style="font-size:12px;color:var(--muted)">No. WhatsApp</div><div style="font-size:14.5px;font-weight:600">${u.phone}</div></div>
        <div><div style="font-size:12px;color:var(--muted)">Alamat</div><div style="font-size:14.5px;font-weight:600">${u.address}</div></div>
      </div>
    </div>`;
  document.getElementById("profileContent").innerHTML = `
    <div class="profile-head">
      <div class="avatar avatar-lg">${avatarInner(u)}</div>
      <div>
        <div style="font-weight:700;font-size:17px">${esc(displayName(u))}</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:8px">${esc(u.email)}</div>
        <label class="btn btn-outline btn-sm" style="cursor:pointer">📷 ${u.avatar_url?"Ganti":"Tambah"} Foto
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden onchange="uploadAvatar(this)">
        </label>
        ${u.avatar_url?`<button class="btn btn-outline btn-sm" onclick="removeAvatar()">Hapus Foto</button>`:""}
      </div>
    </div>
    ${infoCard}
    <h3>Riwayat Pembelian</h3>
    ${myOrders.length===0 ? `<div class="empty-state"><div>📦</div>Belum ada riwayat pembelian.</div>` :
      myOrders.map(o=>`
      <div class="order-row">
        <div>
          <div style="font-weight:600;font-size:14px">${o.id} · ${o.date}</div>
          <div style="font-size:12.5px;color:var(--muted)">${o.items.map(i=>i.name+" x"+i.qty).join(", ")}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;margin-bottom:2px">${fmt(o.total)}</div>
          ${o.shipping!=null?`<div class="muted" style="font-size:11.5px;margin-bottom:6px">incl. ongkir ${o.shipping?fmt(o.shipping):"gratis"}</div>`:""}
          <span class="status-pill ${statusClass(o.status)}">${o.status}</span>
        </div>
        ${orderActionsHTML(o)}
      </div>`).join("")}
  `;
  document.getElementById("footer-profile").innerHTML = footerHTML();
}

/* KONTAK */
const WA_STORE_NUMBER = "6281270655757";

function submitKontak(){
  const nama=document.getElementById("kNama").value.trim();
  const email=document.getElementById("kEmail").value.trim();
  const alasan=document.getElementById("kAlasan").value.trim();
  const wa=document.getElementById("kWa").value.trim();
  if(!nama||!email||!alasan||!wa){ toast("Mohon lengkapi semua kolom."); return; }
  if(alasan.length>800){ toast("Pesan terlalu panjang (maksimal 800 karakter)."); return; }

  const text =
    "Halo Homey Wood, saya ingin bertanya.\n\n" +
    "Nama: "+nama+"\n" +
    "Email: "+email+"\n" +
    "No. WhatsApp: "+wa+"\n\n" +
    "Pesan:\n"+alasan;
  window.open("https://wa.me/"+WA_STORE_NUMBER+"?text="+encodeURIComponent(text), "_blank", "noopener");
  toast("Membuka WhatsApp... tekan Kirim di sana untuk mengirim pesan.");
}

/* ADMIN: DASHBOARD */
async function renderAdminDashboard(){
  const u=currentUser();
  if(!u||u.role!=="admin"){ toast("Halaman khusus admin."); go("login"); return; }
  document.getElementById("adminSidebar1").innerHTML = adminSidebarHTML("admin-dashboard");
  document.getElementById("adminHeader1").innerHTML = adminHeaderHTML("Dashboard Laporan Penjualan","Ringkasan performa dan transaksi toko Homey Wood");
  document.getElementById("footer-admin-dashboard").innerHTML = adminFooterHTML();

  const tbody=document.querySelector("#adminRecentTable tbody");
  const res=await fetch("/api/admin/dashboard");
  if(!res.ok){
    document.getElementById("kpiGrid").innerHTML="";
    tbody.innerHTML=`<tr><td colspan="4" style="text-align:center;color:var(--muted)">Gagal memuat data dashboard.</td></tr>`;
    return;
  }
  const d=await res.json();
  document.getElementById("kpiGrid").innerHTML = `
    <div class="kpi"><span>Total Pendapatan</span><b>${fmt(d.total_revenue)}</b></div>
    <div class="kpi"><span>Total Transaksi</span><b>${d.total_orders}</b></div>
    <div class="kpi"><span>Produk Terdaftar</span><b>${d.total_products}</b></div>
    <div class="kpi"><span>Total Pengguna</span><b>${d.total_customers}</b></div>`;
  tbody.innerHTML = d.recent_orders.length ? d.recent_orders.map(o=>`
    <tr><td>${esc(o.id)}</td><td>${esc(o.buyer)}</td><td>${fmt(o.total)}</td><td><span class="status-pill ${statusClass(o.status)}">${esc(o.status)}</span></td></tr>`).join("")
    : `<tr><td colspan="4" style="text-align:center;color:var(--muted)">Belum ada transaksi.</td></tr>`;
}

/* ADMIN: KATALOG */
function showAddProductForm(){ document.getElementById("addProductForm").style.display="block"; editingProductId=null; clearProductForm(); }
function hideAddProductForm(){ document.getElementById("addProductForm").style.display="none"; }
function clearProductForm(){
  apName.value=""; apPrice.value=""; apStock.value=""; apDesc.value=""; apCat.value="Sofa"; apMat.value="Kayu Jati";
  apImage.value=""; removeImageFlag=false; showImagePreview(null);
}
let removeImageFlag=false;
function showImagePreview(src){
  const box=document.getElementById("apImagePreview");
  box.innerHTML = src ? `<img src="${esc(src)}" alt="Preview">` : `<span class="muted" style="font-size:12px">Belum ada foto</span>`;
  document.getElementById("apImageRemove").style.display = src ? "inline-block" : "none";
}
function onProductImagePick(inp){
  const f=inp.files&&inp.files[0]; if(!f) return;
  if(f.size>2*1024*1024){ toast("Ukuran foto maksimal 2 MB."); inp.value=""; return; }
  removeImageFlag=false;
  showImagePreview(URL.createObjectURL(f));
}
function clearProductImage(){
  apImage.value=""; removeImageFlag=true; showImagePreview(null);
}
let editingProductId=null;
let adminProductsList=[];
async function renderAdminKatalog(){
  const u=currentUser();
  if(!u||u.role!=="admin"){ toast("Halaman khusus admin."); go("login"); return; }
  document.getElementById("adminSidebar2").innerHTML = adminSidebarHTML("admin-katalog");
  document.getElementById("adminHeader2").innerHTML = adminHeaderHTML("Kelola Katalog Produk","Portal Pemantauan dan Operasional Furniture Homey Wood");
  document.getElementById("footer-admin-katalog").innerHTML = adminFooterHTML();
  adminProductsList = await fetchProductList();
  const tbody=document.querySelector("#adminProductTable tbody");
  tbody.innerHTML = adminProductsList.map(p=>`
    <tr>
      <td><div class="mini">${productImgHTML(p)}</div></td>
      <td>${p.name}</td>
      <td>${p.category}</td>
      <td>${p.material||"-"}</td>
      <td>${fmt(p.price)}</td>
      <td>${p.stock}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="editProduct(${p.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})">Hapus</button>
      </td>
    </tr>`).join("");
}
function editProduct(id){
  const p=adminProductsList.find(x=>x.id===id);
  if(!p) return;
  editingProductId=id;
  document.getElementById("addProductForm").style.display="block";
  apName.value=p.name; apCat.value=p.category; apMat.value=p.material||"Kayu Jati"; apPrice.value=p.price; apStock.value=p.stock; apDesc.value=p.desc;
  apImage.value=""; removeImageFlag=false; showImagePreview(p.image||null);
  window.scrollTo(0,0);
}
async function saveProduct(){
  const name=apName.value.trim(), cat=apCat.value, material=apMat.value, price=Number(apPrice.value), stock=Number(apStock.value), desc=apDesc.value.trim();
  if(!name||!price||apStock.value===""){ toast("Lengkapi data produk."); return; }
  const file=apImage.files&&apImage.files[0];
  const wantsRemove=removeImageFlag && editingProductId;
  let payload;
  if(file || wantsRemove){
    payload=new FormData();
    payload.append("name",name); payload.append("category",cat); payload.append("material",material);
    payload.append("price",price); payload.append("stock",stock); payload.append("desc",desc);
    if(file) payload.append("image",file);
    else payload.append("remove_image","1");
  } else {
    payload={name, category:cat, material, price, stock, desc};
  }

  const {ok, data} = editingProductId
    ? await apiRequest("PUT", `/api/admin/products/${editingProductId}`, payload)
    : await apiRequest("POST", "/api/admin/products", payload);

  if(!ok){ toast(data.error || "Gagal menyimpan produk."); return; }
  toast(editingProductId ? "Produk berhasil diperbarui." : "Produk baru berhasil ditambahkan.");
  hideAddProductForm();
  renderAdminKatalog();
}
async function deleteProduct(id){
  if(!confirm("Hapus produk ini?")) return;
  const {ok, data} = await apiRequest("DELETE", `/api/admin/products/${id}`);
  if(!ok){ toast(data.error || "Gagal menghapus produk."); return; }
  toast("Produk dihapus.");
  renderAdminKatalog();
}

/* ADMIN: KELOLA USER */
let userSearchTimer=null;
function onUserSearchInput(){
  clearTimeout(userSearchTimer);
  userSearchTimer=setTimeout(loadAdminUsers,300); // tunggu user selesai mengetik
}
async function renderAdminUser(){
  const u=currentUser();
  if(!u||u.role!=="admin"){ toast("Halaman khusus admin."); go("login"); return; }
  document.getElementById("adminSidebar4").innerHTML = adminSidebarHTML("admin-user");
  document.getElementById("adminHeader4").innerHTML = adminHeaderHTML("Kelola User","Data pengguna terdaftar di platform Homey Wood");
  document.getElementById("footer-admin-user").innerHTML = adminFooterHTML();
  loadAdminUsers();
}
async function loadAdminUsers(){
  const tbody=document.querySelector("#adminUserTable tbody");
  const search=document.getElementById("userSearch").value.trim();
  const status=document.getElementById("userStatus").value;
  const qs=new URLSearchParams();
  if(search) qs.set("search",search);
  if(status!=="all") qs.set("status",status);
  const res=await fetch("/api/admin/users?"+qs.toString());
  if(!res.ok){
    tbody.innerHTML=`<tr><td colspan="8" style="text-align:center;color:var(--muted)">Gagal memuat data pengguna.</td></tr>`;
    return;
  }
  const users=(await res.json()).users||[];
  tbody.innerHTML = users.length ? users.map(x=>`
    <tr>
      <td>${esc(x.name)}<div class="muted" style="font-size:12px">@${esc(x.username)}</div></td>
      <td>${esc(x.email)}</td>
      <td>${esc(x.phone)}</td>
      <td>${esc(x.address)}</td>
      <td>${esc(x.joined)||'-'}</td>
      <td>${x.order_count}</td>
      <td><span class="status-pill ${x.is_active?'status-done':'status-rejected'}">${x.is_active?'Aktif':'Nonaktif'}</span></td>
      <td>${x.is_active
        ? `<button class="btn btn-danger btn-sm" onclick="toggleUserActive(${x.id},false)">Nonaktifkan</button>`
        : `<button class="btn btn-primary btn-sm" onclick="toggleUserActive(${x.id},true)">Aktifkan</button>`}</td>
    </tr>`).join("") : `<tr><td colspan="8" style="text-align:center;color:var(--muted)">Tidak ada pengguna yang cocok.</td></tr>`;
}
async function toggleUserActive(id,makeActive){
  if(!makeActive && !confirm("Nonaktifkan akun ini? User tidak akan bisa login sampai diaktifkan lagi.")) return;
  const {ok,data}=await apiRequest("PATCH",`/api/admin/users/${id}/status`,{is_active:makeActive});
  if(!ok){ toast(data.error||"Gagal mengubah status akun."); return; }
  toast(makeActive?"Akun diaktifkan.":"Akun dinonaktifkan.");
  loadAdminUsers();
}

/* ADMIN: VERIFIKASI */
let adminOrdersList=[];
async function renderAdminVerifikasi(){
  const u=currentUser();
  if(!u||u.role!=="admin"){ toast("Halaman khusus admin."); go("login"); return; }
  document.getElementById("adminSidebar3").innerHTML = adminSidebarHTML("admin-verifikasi");
  document.getElementById("adminHeader3").innerHTML = adminHeaderHTML("Verifikasi & Pengiriman Pesanan","Cek bukti pembayaran, lalu proses pengiriman pesanan");
  document.getElementById("footer-admin-verifikasi").innerHTML = adminFooterHTML();
  const res = await fetch("/api/admin/orders");
  const data = await res.json();
  adminOrdersList = res.ok ? (data.orders || []) : [];
  const all=adminOrdersList;
  const row=(o,actions)=>{
    return `<div class="order-row">
      <div>
        <div style="font-weight:600">${o.id} · ${o.recipient?esc(o.recipient.name):(o.buyer?esc(o.buyer.name):'-')}${o.buyer?` <span class="muted" style="font-weight:400;font-size:12px">@${esc(o.buyer.username)}</span>`:''}</div>
        ${o.recipient?`<div style="font-size:12.5px;color:var(--muted)">📍 ${esc(o.recipient.phone)} · ${esc(o.recipient.address)}</div>`:''}
        <div style="font-size:12.5px;color:var(--muted)">${o.items.map(i=>esc(i.name)+" x"+i.qty).join(", ")} · ${esc(o.payment||'')}</div>
        ${o.proof?`<img class="proof-thumb" src="${o.proof}" onclick="viewProof('${o.id}')" title="Klik untuk memperbesar">`:`<div style="font-size:12px;color:var(--muted);margin-top:6px">${/COD/.test(o.payment||"")?"COD · tanpa bukti":"Bukti tidak tersedia"}</div>`}
      </div>
      <div style="text-align:right"><div style="font-weight:700;margin-bottom:8px">${fmt(o.total)}</div>${actions} <button class="btn btn-outline btn-sm" onclick="printLabel('${o.id}')">🖨️ Label pengiriman</button></div>
    </div>`;
  };
  const sec=(t,list,fn,empty)=>`<h3 style="margin:22px 0 10px">${t} (${list.length})</h3>`+(list.length?list.map(fn).join(""):`<div class="empty-state" style="padding:18px">${empty}</div>`);
  document.getElementById("verifList").innerHTML =
    sec("Menunggu Verifikasi Pembayaran",all.filter(o=>o.status==="Menunggu Verifikasi"),o=>row(o,`<button class="btn btn-primary btn-sm" onclick="verifyOrder('${o.id}','approve')">Setujui</button> <button class="btn btn-danger btn-sm" onclick="verifyOrder('${o.id}','reject')">Tolak</button>`),"Tidak ada pembayaran yang perlu diverifikasi.")+
    sec("Diproses (siap dikirim)",all.filter(o=>o.status==="Diproses"),o=>row(o,`<button class="btn btn-primary btn-sm" onclick="shipOrder('${o.id}')">Tandai Dikirim</button>`),"Tidak ada pesanan yang menunggu dikirim.")+
    sec("Dalam Pengiriman",all.filter(o=>o.status==="Dikirim"),o=>row(o,`<span style="font-size:12px;color:var(--muted)">Menunggu konfirmasi pembeli</span>`),"Tidak ada pesanan dalam pengiriman.");
}
async function verifyOrder(id,action){
  const {ok, data} = await apiRequest("POST", `/api/admin/orders/${id}/verify`, {action});
  if(!ok){ toast(data.error || "Gagal memproses verifikasi."); return; }
  toast("Pesanan "+id+(action==="reject"?" ditolak.":" disetujui & diproses."));
  renderAdminVerifikasi();
}
async function shipOrder(id){
  const {ok, data} = await apiRequest("POST", `/api/admin/orders/${id}/ship`);
  if(!ok){ toast(data.error || "Gagal menandai pesanan."); return; }
  toast("Pesanan "+id+" ditandai dikirim."); renderAdminVerifikasi();
}
function viewProof(id){
  const o=adminOrdersList.find(x=>x.id===id); if(!o||!o.proof) return;
  const m=document.createElement("div"); m.className="modal-back";
  m.innerHTML=`<div class="modal" style="max-width:520px;text-align:center"><img src="${o.proof}" style="max-width:100%;max-height:70vh;border-radius:8px"><div style="margin-top:12px"><button class="btn btn-outline btn-sm" onclick="this.closest('.modal-back').remove()">Tutup</button></div></div>`;
  m.addEventListener("click",e=>{ if(e.target===m) m.remove(); });
  document.body.appendChild(m);
}

/* FOOTER */
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

/* LUPA & RESET PASSWORD */
async function doForgotPassword(){
  const email=document.getElementById("forgotEmail").value.trim();
  if(!email){ toast("Isi email Anda."); return; }
  const btn=document.getElementById("forgotBtn"); btn.disabled=true;
  const {ok,data}=await apiPost("/api/forgot-password",{email});
  btn.disabled=false;
  if(!ok){ toast(data.error||"Gagal mengirim permintaan."); return; }
  document.getElementById("forgotEmail").value="";
  toast(data.message);
}
async function doResetPassword(){
  const token=new URLSearchParams(location.search).get("token")||"";
  const password=document.getElementById("resetPass").value;
  const confirmPass=document.getElementById("resetPassConfirm").value;
  if(!token){ toast("Link reset tidak valid. Minta link baru."); return; }
  if(password.length<8){ toast("Kata sandi minimal 8 karakter."); return; }
  if(password!==confirmPass){ toast("Konfirmasi kata sandi tidak cocok."); return; }
  const btn=document.getElementById("resetBtn"); btn.disabled=true;
  const {ok,data}=await apiPost("/api/reset-password",{token,password});
  btn.disabled=false;
  if(!ok){ toast(data.error||"Gagal mengubah kata sandi."); return; }
  toast("Kata sandi berhasil diubah. Silakan masuk.");
  setTimeout(()=>go("login"),1200);
}

/* CETAK LABEL PENGIRIMAN (admin) */
function printLabel(id){
  const o=(adminOrdersList||[]).find(x=>x.id===id); if(!o||!o.recipient){ toast("Data pesanan tidak ditemukan."); return; }
  const r=o.recipient;
  const w=window.open("","_blank","width=640,height=760"); if(!w){ toast("Izinkan pop-up untuk mencetak label."); return; }
  w.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Label Pengiriman ${esc(o.id)}</title>
    <style>body{font-family:Arial,sans-serif;margin:24px}.box{border:2px solid #000;padding:18px;max-width:520px}
    h2{margin:0 0 4px}.row{margin:14px 0}.lbl{font-size:11px;text-transform:uppercase;color:#555}
    .big{font-size:20px;font-weight:700}table{width:100%;border-collapse:collapse;font-size:13px}td{padding:3px 0}</style></head><body>
    <div class="box"><h2>Homey Wood</h2><div style="font-size:12px;color:#555">Label Pengiriman · ${esc(o.id)} · ${esc(o.date)}</div><hr>
    <div class="row"><div class="lbl">Penerima</div><div class="big">${esc(r.name)}</div><div>${esc(r.phone)}</div></div>
    <div class="row"><div class="lbl">Alamat</div><div>${esc(r.address)}</div></div>
    <div class="row"><div class="lbl">Isi paket</div><table>${o.items.map(i=>`<tr><td>${esc(i.name)}</td><td style="text-align:right">x${i.qty}</td></tr>`).join("")}</table></div>
    <div class="row"><div class="lbl">Pembayaran</div><div>${esc(o.payment||"")}</div></div></div>
    <script>window.onload=function(){window.print();}<\/script></body></html>`);
  w.document.close();
}

/* NAVIGASI ANTAR FILE */
function go(page){
  if(window._lastToast && Date.now()-window._lastToast.t<2200){
    sessionStorage.setItem("hw_pendingToast",window._lastToast.m);
  }
  location.href = page + ".html";
}

/* INIT */
const NAVBAR_HTML = `<nav class="navbar">
  <div class="container">
    <div class="brand" onclick="go('home')"><span class="dot"></span>Homey Wood</div>
    <ul class="nav-links" id="navLinks">
      <li onclick="go('home')" data-nav="home">Beranda</li>
      <li onclick="go('katalog')" data-nav="katalog">Katalog</li>
      <li onclick="go('tentang')" data-nav="tentang">Tentang Kami</li>
      <li onclick="go('kontak')" data-nav="kontak">Kontak</li>
    </ul>
    <div class="nav-right">
      <div class="icon-btn" onclick="go('keranjang')" id="cartIconWrap">🛒<span class="badge" id="cartBadge" style="display:none">0</span></div>
      <div class="dropdown" id="profileDropdown">
        <div class="icon-btn" onclick="onProfileIconClick()">👤</div>
        <div class="dropdown-menu" id="dropdownMenu"></div>
      </div>
    </div>
  </div>
</nav>`;
(async function boot(){
  const page = document.body.dataset.page;
  document.body.insertAdjacentHTML("afterbegin", NAVBAR_HTML);
  if(page==="katalog"){
    const r=document.querySelector('input[name="fcat"][value="'+currentFilterCat+'"]'); if(r) r.checked=true;
  }
  await refreshAuth();
  await refreshCart();
  showPage(page);
  if(page==="tentang"||page==="kontak") document.getElementById("footer-"+page).innerHTML = footerHTML();
  const pt=sessionStorage.getItem("hw_pendingToast");
  if(pt){ sessionStorage.removeItem("hw_pendingToast"); toast(pt); }
})();


/* ANIMASI (scroll reveal, stagger) */
(function motion(){
  const sel=".pcard,.cat-item,.review-item,.order-row,.kpi,.hero-text,.hero-img,.review-summary,.cart-item";
  const io=("IntersectionObserver" in window) ? new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } }),{threshold:.08}) : null;
  let sched=false;
  function scan(){
    sched=false; let n=0;
    document.querySelectorAll(sel).forEach(el=>{
      if(el.dataset.rv) return; el.dataset.rv="1";
      el.classList.add("reveal"); el.style.setProperty("--d",Math.min(n++,8)*70+"ms");
      if(io) io.observe(el); else el.classList.add("in");
    });
  }
  new MutationObserver(()=>{ if(!sched){ sched=true; requestAnimationFrame(scan); } }).observe(document.body,{childList:true,subtree:true});
  scan();
})();