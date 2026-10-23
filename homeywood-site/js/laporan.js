(function(){
  var COLORS = {Sofa:"#C1703F", Meja:"#6B4A32", Kursi:"#E0A458", Lemari:"#9A7A5C", Lainnya:"#B9AE9F", Aktif:"#4C7A4C", Nonaktif:"#B5493A"};
  var box = document.getElementById("kpiDonuts");
  if(!box) return;

  var elFrom = document.getElementById("repFrom"), elTo = document.getElementById("repTo");

  function pad(n){ return n<10 ? "0"+n : ""+n; }
  function iso(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
  function rp(n){ return "Rp "+Math.round(n).toLocaleString("id-ID"); }
  function esc(s){ return String(s).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }

  var now = new Date();
  elFrom.value = iso(new Date(now.getFullYear(), now.getMonth(), 1));
  elTo.value = iso(now);

  function donut(items, fmt){
    var total = items.reduce(function(a,i){ return a+i.value; },0);
    var bg;
    if(total<=0){ bg = "conic-gradient(#E3D6C0 0 100%)"; }
    else{
      var acc=0, parts=[];
      items.forEach(function(i){
        if(i.value<=0) return;
        var s=acc/total*100; acc+=i.value; var e=acc/total*100;
        parts.push((COLORS[i.name]||COLORS.Lainnya)+" "+s+"% "+e+"%");
      });
      bg = "conic-gradient("+parts.join(",")+")";
    }
    var legend = items.map(function(i){
      var pct = total>0 ? Math.round(i.value/total*100)+"%" : "-";
      return '<div class="lg-row"><i style="background:'+(COLORS[i.name]||COLORS.Lainnya)+'"></i>'+esc(i.name)+'<em>'+esc(fmt(i.value))+' · '+pct+'</em></div>';
    }).join("");
    return '<div class="donut-row"><div class="donut" style="background:'+bg+'"></div><div class="lg">'+legend+'</div></div>';
  }

  function card(label, big, inner, note){
    return '<div class="kpi kpi-donut"><span>'+label+'</span><b>'+big+'</b>'+inner+(note?'<small>'+note+'</small>':'')+'</div>';
  }

  function render(d){
    var num = function(n){ return String(n); };
    box.innerHTML =
      card("Total Pendapatan", rp(d.revenue.total), donut(d.revenue.by_cat, rp)) +
      card("Total Transaksi", d.orders.total, donut(d.orders.by_cat, num), "Pesanan berisi 2 kategori dihitung di keduanya.") +
      card("Produk Terdaftar", d.products.total, donut(d.products.by_cat, num), "Produk aktif saat ini.") +
      card("Total Pengguna", d.users.total, donut([{name:"Aktif",value:d.users.active},{name:"Nonaktif",value:d.users.inactive}], num), "Seluruh pelanggan saat ini.");

    document.getElementById("repPeriod").textContent = "("+d.from+" s/d "+d.to+")";
    var totQty = 0;
    var rows = d.recap.map(function(r){
      totQty += r.qty;
      return "<tr><td>"+esc(r.name)+"</td><td>"+r.qty+"</td><td>"+r.orders+"</td><td>"+rp(r.revenue)+"</td></tr>";
    }).join("");
    rows += '<tr class="total-row"><td>Total</td><td>'+totQty+'</td><td>'+d.orders.total+'</td><td>'+rp(d.revenue.total)+'</td></tr>';
    document.querySelector("#repTable tbody").innerHTML = rows;
  }

  function query(){ return "from="+encodeURIComponent(elFrom.value)+"&to="+encodeURIComponent(elTo.value); }

  window.loadReport = function(){
    if(!elFrom.value || !elTo.value){ return; }
    box.classList.add("loading");
    fetch("/api/admin/report?"+query(), {credentials:"same-origin"})
      .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(d){ render(d); })
      .catch(function(){
        box.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:24px">Gagal memuat laporan. Pastikan kamu login sebagai admin.</div>';
      })
      .then(function(){ box.classList.remove("loading"); });
  };
  window.exportReport = function(kind){
    if(!elFrom.value || !elTo.value){ return; }
    window.location.href = "/api/admin/report/export."+kind+"?"+query();
  };

  loadReport();
})();
