(function () {
  var store = {};
  function el(id) { return document.getElementById(id); }
  function out(id, obj, code) {
    el(id).textContent = (code ? code + " " : "") + JSON.stringify(obj);
  }
  var form = el("order-form");
  if (!form) return;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var orderId = el("f-id").value.trim();
    var qty = parseInt(el("f-qty").value, 10);
    var price = parseInt(el("f-price").value, 10);
    var total = parseInt(el("f-total").value, 10);
    var changed = el("f-changed").checked;
    if (!orderId || !(qty > 0) || !(price >= 0) || !(total >= 0)) {
      out("order-out", { error: "INVALID", message: "orderId/qty/price/total required" }, "400");
      return;
    }
    if (total !== qty * price) {
      out("order-out", { error: "TOTAL_MISMATCH", message: "total != sum(qty*price)" }, "400");
      return;
    }
    var canon = JSON.stringify({ orderId: orderId, qty: qty, price: price, total: total });
    if (store[orderId] && (changed || store[orderId].canon !== canon)) {
      out("order-out", { error: "CONFLICT", message: "duplicate orderId different payload" }, "409");
      return;
    }
    store[orderId] = { status: "RECEIVED", total: total, canon: canon };
    out("order-out", { orderId: orderId, status: "RECEIVED" }, "202");
    renderTimeline(["RECEIVED"]);
    setTimeout(function () {
      store[orderId].status = "PACKING";
      out("order-out", { orderId: orderId, status: "PACKING" }, "200");
      renderTimeline(["RECEIVED", "PACKING"]);
      el("mail-owner").textContent = "Owner mail: new order " + orderId + " RECEIVED, " + qty + "x @ " + price;
      el("mail-buyer").textContent = "Buyer mail: order " + orderId + " is PACKING, total " + total;
    }, 2500);
  });
  function renderTimeline(steps) {
    var all = ["RECEIVED", "PACKING", "DONE"];
    var ul = el("timeline");
    ul.innerHTML = "";
    all.forEach(function (s) {
      var li = document.createElement("li");
      li.textContent = (steps.indexOf(s) >= 0 ? "\u2713 " : "\u00B7 ") + s;
      if (steps.indexOf(s) >= 0) li.className = "done";
      ul.appendChild(li);
    });
  }
  var lookup = el("lookup-form");
  if (lookup) lookup.addEventListener("submit", function (e) {
    e.preventDefault();
    var id = el("f-get").value.trim();
    if (!store[id]) { out("get-out", { error: "NOT_FOUND", message: "unknown id" }, "404"); return; }
    out("get-out", { orderId: id, status: store[id].status, total: store[id].total }, "200");
  });
  var deliver = el("deliver");
  if (deliver) deliver.addEventListener("click", function () {
    var id = el("f-id").value.trim();
    if (!store[id]) { out("order-out", { error: "NOT_FOUND", message: "send the order first" }, "404"); return; }
    if (store[id].status !== "PACKING") { out("order-out", { orderId: id, status: store[id].status }, "200"); return; }
    store[id].status = "DONE";
    out("order-out", { orderId: id, status: "DONE" }, "200");
    renderTimeline(["RECEIVED", "PACKING", "DONE"]);
    el("mail-buyer").textContent = "Buyer mail: order " + id + " DELIVERED. Enjoy the Neem Soap.";
  });
})();
