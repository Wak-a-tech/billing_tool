/* Générateur de factures WAK — 100 % navigateur, aucune dépendance réseau. */
(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Stockage local
  // ---------------------------------------------------------------------------
  var K = {
    seq: "bt.seq",
    logo: "bt.logo",
    issuers: "bt.issuers",
    clients: "bt.clients",
    settings: "bt.settings",
  };

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      toast("Impossible d'enregistrer localement : " + e.message, "error");
    }
  }

  // Notification non bloquante (remplace alert)
  var toastTimer = null;
  function toast(msg, kind) {
    var el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = "toast show" + (kind ? " toast-" + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.className = "toast";
    }, 3200);
  }

  function getSeq() {
    var n = parseInt(load(K.seq, 1), 10);
    return isNaN(n) || n < 1 ? 1 : n;
  }
  function setSeq(n) {
    save(K.seq, n);
  }

  // ---------------------------------------------------------------------------
  // Utilitaires
  // ---------------------------------------------------------------------------
  var $ = function (id) {
    return document.getElementById(id);
  };

  var moneyFmt = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  var dateLongFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  var DEVISES = {
    EUR: "€",
    USD: "$",
    GBP: "£",
    CHF: "CHF",
  };

  function deviseSymbol() {
    return DEVISES[$("devise").value] || "€";
  }
  // Les polices embarquées dans le PDF n'ont pas de glyphe pour l'espace fine
  // insécable (U+202F) ni l'espace insécable (U+00A0) utilisées par Intl en
  // français : on les remplace par une espace normale.
  function normSpace(s) {
    return String(s).replace(/[\u00a0\u202f\u2009\u2007]/g, " ");
  }
  function fmtNumber(n) {
    return normSpace(moneyFmt.format(Number(n) || 0));
  }
  function fmtMoney(n) {
    return fmtNumber(n) + " " + deviseSymbol();
  }

  function pad4(n) {
    return String(n).padStart(4, "0");
  }

  function parseDate(str) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((str || "").trim());
    if (!m) return null;
    var d = new Date(+m[3], +m[2] - 1, +m[1]);
    if (d.getFullYear() !== +m[3] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[1]) return null;
    return d;
  }
  function fmtDateInput(d) {
    return (
      String(d.getDate()).padStart(2, "0") +
      "/" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "/" +
      d.getFullYear()
    );
  }
  function fmtDateLong(d) {
    return dateLongFmt.format(d);
  }
  function addMonths(d, n) {
    var r = new Date(d.getTime());
    var day = r.getDate();
    r.setMonth(r.getMonth() + n);
    if (r.getDate() < day) r.setDate(0); // reste en fin de mois si débordement
    return r;
  }

  // Masque de saisie jj/mm/aaaa
  function attachDateMask(input) {
    input.addEventListener("input", function () {
      var v = input.value.replace(/\D/g, "").slice(0, 8);
      var out = v;
      if (v.length > 4) out = v.slice(0, 2) + "/" + v.slice(2, 4) + "/" + v.slice(4);
      else if (v.length > 2) out = v.slice(0, 2) + "/" + v.slice(2);
      input.value = out;
    });
  }

  function uid() {
    return "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // ---------------------------------------------------------------------------
  // Logo
  // ---------------------------------------------------------------------------
  // pdfmake n'accepte que des images PNG/JPEG en dataURL. On normalise donc
  // tout fichier choisi (PNG, JPG, WEBP, GIF, SVG…) en PNG via un canvas.
  var logoData = load(K.logo, null); // { dataUrl:pngDataURL, w:Number, h:Number }
  if (logoData && !logoData.dataUrl) logoData = null; // ancien format -> à re-sélectionner

  function renderLogo() {
    var img = $("logoPreview");
    var ph = $("logoPlaceholder");
    if (!logoData) {
      img.classList.add("hidden");
      ph.classList.remove("hidden");
      img.removeAttribute("src");
      return;
    }
    ph.classList.add("hidden");
    img.classList.remove("hidden");
    img.src = logoData.dataUrl;
  }

  // Charge un fichier image et le rasterise en PNG (max ~1400 px de large).
  function fileToPng(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () {
        reject(new Error("lecture du fichier impossible"));
      };
      reader.onload = function () {
        var src = String(reader.result);
        var image = new Image();
        image.onload = function () {
          var w = image.naturalWidth || image.width || 400;
          var h = image.naturalHeight || image.height || 200;
          var maxW = 1400;
          if (w > maxW) {
            h = Math.round((h * maxW) / w);
            w = maxW;
          }
          var canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(image, 0, 0, w, h);
          try {
            resolve({ dataUrl: canvas.toDataURL("image/png"), w: w, h: h });
          } catch (err) {
            reject(err);
          }
        };
        image.onerror = function () {
          reject(new Error("format d'image non reconnu"));
        };
        image.src = src;
      };
      reader.readAsDataURL(file);
    });
  }

  $("logoDrop").addEventListener("click", function () {
    $("logoInput").click();
  });
  $("logoInput").addEventListener("change", function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    fileToPng(file)
      .then(function (result) {
        logoData = result;
        save(K.logo, logoData);
        renderLogo();
      })
      .catch(function (err) {
        toast("Logo : " + (err && err.message ? err.message : "import impossible"), "error");
      });
  });
  $("logoClear").addEventListener("click", function () {
    logoData = null;
    localStorage.removeItem(K.logo);
    $("logoInput").value = "";
    renderLogo();
  });

  // ---------------------------------------------------------------------------
  // Entreprises enregistrées (émetteur / client)
  // ---------------------------------------------------------------------------
  var ISSUER_FIELDS = [
    "raisonSociale",
    "rue",
    "cp",
    "ville",
    "pays",
    "formeJuridique",
    "capital",
    "siren",
    "siret",
    "rcs",
  ];
  var CLIENT_FIELDS = ["raisonSociale", "nomPrenom", "adresse", "telephone", "email"];

  function makeParty(cfg) {
    var list = load(cfg.storeKey, []);
    var selectEl = $(cfg.selectId);

    function readForm() {
      var obj = {};
      cfg.fields.forEach(function (f) {
        obj[f] = $(cfg.prefix + f).value.trim();
      });
      return obj;
    }
    function writeForm(obj) {
      cfg.fields.forEach(function (f) {
        $(cfg.prefix + f).value = obj && obj[f] != null ? obj[f] : "";
      });
    }
    function refreshOptions(selectedId) {
      selectEl.innerHTML = '<option value="">— Nouvelle entreprise —</option>';
      list.forEach(function (item) {
        var o = document.createElement("option");
        o.value = item.id;
        o.textContent = item.raisonSociale || item.nomPrenom || "(sans nom)";
        selectEl.appendChild(o);
      });
      selectEl.value = selectedId || "";
    }

    selectEl.addEventListener("change", function () {
      var item = list.filter(function (x) {
        return x.id === selectEl.value;
      })[0];
      if (item) writeForm(item);
      else writeForm(null);
      persistSettings();
      recompute();
    });

    $(cfg.saveId).addEventListener("click", function () {
      var data = readForm();
      if (!data.raisonSociale && !data[cfg.fields[1]]) {
        toast("Renseignez au moins la raison sociale avant d'enregistrer.", "error");
        return;
      }
      var existing = list.filter(function (x) {
        return x.id === selectEl.value;
      })[0];
      if (existing) {
        Object.assign(existing, data);
      } else {
        existing = Object.assign({ id: uid() }, data);
        list.push(existing);
      }
      save(cfg.storeKey, list);
      refreshOptions(existing.id);
      persistSettings();
      toast("Entreprise enregistrée.");
    });

    $(cfg.deleteId).addEventListener("click", function () {
      if (!selectEl.value) return;
      if (!confirm("Supprimer cette entreprise enregistrée ?")) return;
      list = list.filter(function (x) {
        return x.id !== selectEl.value;
      });
      save(cfg.storeKey, list);
      refreshOptions("");
      writeForm(null);
      persistSettings();
      recompute();
    });

    return {
      refreshOptions: refreshOptions,
      writeForm: writeForm,
      selectEl: selectEl,
      getList: function () {
        return list;
      },
    };
  }

  var issuer = makeParty({
    storeKey: K.issuers,
    selectId: "issuerSelect",
    saveId: "issuerSave",
    deleteId: "issuerDelete",
    prefix: "i_",
    fields: ISSUER_FIELDS,
  });
  var client = makeParty({
    storeKey: K.clients,
    selectId: "clientSelect",
    saveId: "clientSave",
    deleteId: "clientDelete",
    prefix: "c_",
    fields: CLIENT_FIELDS,
  });

  // ---------------------------------------------------------------------------
  // Réglages persistants (devise, TVA, sélections, dernières entreprises)
  // ---------------------------------------------------------------------------
  function persistSettings() {
    var prev = load(K.settings, {});
    save(K.settings, {
      prefix: prev.prefix || "WAK",
      devise: $("devise").value,
      tvaNonApplicable: $("tvaNonApplicable").checked,
      issuerId: issuer.selectEl.value,
      clientId: client.selectEl.value,
    });
  }

  // ---------------------------------------------------------------------------
  // Lignes de facturation
  // ---------------------------------------------------------------------------
  var TVA_RATES = [
    { v: "20", label: "20 %" },
    { v: "10", label: "10 %" },
    { v: "5.5", label: "5,5 %" },
    { v: "2.1", label: "2,1 %" },
  ];

  function addLine(data) {
    data = data || {};
    var row = document.createElement("div");
    row.className = "line-row";

    var desc = document.createElement("input");
    desc.type = "text";
    desc.placeholder = "Description";
    desc.value = data.description || "";
    desc.className = "desc-cell";

    var qty = document.createElement("input");
    qty.type = "number";
    qty.min = "0";
    qty.step = "any";
    qty.placeholder = "0";
    qty.value = data.qty != null ? data.qty : "";
    qty.className = "qty-cell";

    var pu = document.createElement("input");
    pu.type = "number";
    pu.min = "0";
    pu.step = "any";
    pu.placeholder = "0.00";
    pu.value = data.pu != null ? data.pu : "";
    pu.className = "pu-cell";

    var tvaWrap = document.createElement("div");
    tvaWrap.className = "tva-cell";
    var tva = document.createElement("select");
    TVA_RATES.forEach(function (r) {
      var o = document.createElement("option");
      o.value = r.v;
      o.textContent = r.label;
      tva.appendChild(o);
    });
    tva.value = data.tva || "20";
    tvaWrap.appendChild(tva);

    var amount = document.createElement("div");
    amount.className = "amount";
    amount.textContent = fmtMoney(0);

    var del = document.createElement("button");
    del.type = "button";
    del.className = "line-del";
    del.setAttribute("aria-label", "Supprimer la ligne");
    del.textContent = "✕";
    del.addEventListener("click", function () {
      row.remove();
      recompute();
    });

    [desc, qty, pu].forEach(function (el) {
      el.addEventListener("input", recompute);
    });
    tva.addEventListener("change", recompute);

    row.append(desc, qty, pu, tvaWrap, amount, del);
    row._get = function () {
      return {
        description: desc.value.trim(),
        qty: parseFloat(qty.value) || 0,
        pu: parseFloat(pu.value) || 0,
        tva: parseFloat(tva.value) || 0,
        _amountEl: amount,
      };
    };
    $("linesBody").appendChild(row);
    recompute();
  }

  function getLines() {
    return Array.prototype.map.call($("linesBody").children, function (row) {
      return row._get();
    });
  }

  // ---------------------------------------------------------------------------
  // Calcul des totaux
  // ---------------------------------------------------------------------------
  function computeTotals() {
    var noTva = $("tvaNonApplicable").checked;
    var lines = getLines();
    var subtotal = 0;
    var tvaByRate = {};

    lines.forEach(function (l) {
      var amt = l.qty * l.pu;
      l._amount = amt;
      subtotal += amt;
      if (!noTva && l.tva > 0) {
        tvaByRate[l.tva] = (tvaByRate[l.tva] || 0) + amt * (l.tva / 100);
      }
    });

    var tvaTotal = Object.keys(tvaByRate).reduce(function (s, k) {
      return s + tvaByRate[k];
    }, 0);
    var total = noTva ? subtotal : subtotal + tvaTotal;

    return {
      noTva: noTva,
      lines: lines,
      subtotal: subtotal,
      tvaByRate: tvaByRate,
      tvaTotal: tvaTotal,
      total: total,
    };
  }

  function recompute() {
    var t = computeTotals();
    t.lines.forEach(function (l) {
      if (l._amountEl) l._amountEl.textContent = fmtMoney(l._amount);
    });

    // aperçu totaux
    var box = $("totalsPreview");
    box.innerHTML = "";
    function trow(label, value, cls) {
      var d = document.createElement("div");
      d.className = "t-row" + (cls ? " " + cls : "");
      var a = document.createElement("span");
      a.textContent = label;
      var b = document.createElement("span");
      b.textContent = value;
      d.append(a, b);
      box.appendChild(d);
    }
    if (t.noTva) {
      trow("Sous-total", fmtMoney(t.subtotal));
      trow("Total", fmtMoney(t.total));
    } else {
      trow("Sous-total HT", fmtMoney(t.subtotal));
      Object.keys(t.tvaByRate)
        .sort(function (a, b) {
          return b - a;
        })
        .forEach(function (rate) {
          trow("TVA " + String(rate).replace(".", ",") + " %", fmtMoney(t.tvaByRate[rate]));
        });
      trow("Total TTC", fmtMoney(t.total));
    }
    trow("Montant dû", fmtMoney(t.total), "grand");
    if (t.noTva) {
      var m = document.createElement("div");
      m.className = "t-mention";
      m.textContent = "TVA non applicable, art. 293 B du CGI";
      box.appendChild(m);
    }
  }

  // ---------------------------------------------------------------------------
  // Numéro de facture
  // ---------------------------------------------------------------------------
  function getPrefix() {
    var p = (load(K.settings, {}).prefix || "WAK").toString().trim().toUpperCase();
    return p.replace(/[^A-Z0-9-]/g, "") || "WAK";
  }
  function currentInvoiceNumber() {
    var d = parseDate($("dateEmission").value) || new Date();
    return getPrefix() + "-" + d.getFullYear() + "-" + pad4(getSeq());
  }
  function renderInvoiceNumber() {
    $("invoiceNumber").textContent = "Facture n°" + currentInvoiceNumber();
  }

  // ---------------------------------------------------------------------------
  // Construction du PDF (pdfmake)
  // ---------------------------------------------------------------------------
  function partyStackIssuer() {
    var g = function (f) {
      return $("i_" + f).value.trim();
    };
    var lines = [];
    if (g("raisonSociale")) lines.push({ text: g("raisonSociale"), bold: true });
    if (g("rue")) lines.push(g("rue"));
    var cpVille = [g("cp"), g("ville")].filter(Boolean).join(" ");
    if (cpVille) lines.push(cpVille);
    if (g("pays")) lines.push(g("pays"));

    var legal = [];
    var fjCap = [];
    if (g("formeJuridique")) fjCap.push(g("formeJuridique"));
    if (g("capital")) {
      var capNum = parseFloat(String(g("capital")).replace(/\s/g, "").replace(",", "."));
      // Le capital social d'une société française est libellé en euros.
      var capTxt = isNaN(capNum) ? g("capital") : normSpace(moneyFmt.format(capNum)) + " €";
      fjCap.push("au capital de " + capTxt);
    }
    if (fjCap.length) legal.push(fjCap.join(" "));
    var siren = [];
    if (g("siren")) siren.push("SIREN " + g("siren"));
    if (g("siret")) siren.push("SIRET " + g("siret"));
    if (siren.length) legal.push(siren.join(" - "));
    if (g("rcs")) legal.push("RCS " + g("rcs"));

    var stack = lines.map(function (l) {
      return typeof l === "string" ? { text: l } : l;
    });
    if (legal.length) {
      stack.push({ text: " ", margin: [0, 4, 0, 0] });
      legal.forEach(function (l) {
        stack.push({ text: l, color: "#333" });
      });
    }
    return stack;
  }

  function partyStackClient() {
    var g = function (f) {
      return $("c_" + f).value.trim();
    };
    var stack = [{ text: "Facturer à", bold: true, margin: [0, 0, 0, 2] }];
    if (g("raisonSociale")) stack.push({ text: g("raisonSociale") });
    if (g("nomPrenom")) stack.push({ text: g("nomPrenom") });
    if (g("adresse"))
      g("adresse")
        .split(/\n/)
        .forEach(function (l) {
          if (l.trim()) stack.push({ text: l.trim() });
        });
    if (g("telephone")) stack.push({ text: g("telephone") });
    if (g("email")) stack.push({ text: g("email") });
    return stack;
  }

  function logoNode() {
    if (!logoData || !logoData.dataUrl) return { text: "" };
    return { image: logoData.dataUrl, fit: [170, 80], alignment: "right" };
  }

  function buildDocDefinition(number) {
    var t = computeTotals();
    var emission = parseDate($("dateEmission").value) || new Date();
    var echeance = parseDate($("dateEcheance").value) || addMonths(emission, 1);
    var tvaApplicable = !t.noTva;

    // Tableau des lignes
    var head = [
      { text: "Description", style: "th" },
      { text: "Qté", style: "th", alignment: "right" },
      { text: "Prix unitaire", style: "th", alignment: "right" },
    ];
    if (tvaApplicable) head.push({ text: "TVA", style: "th", alignment: "right" });
    head.push({ text: "Montant", style: "th", alignment: "right" });

    var body = [head];
    var pdfLines = t.lines.filter(function (l) {
      return l.description || l._amount !== 0 || l.qty !== 0 || l.pu !== 0;
    });
    pdfLines.forEach(function (l) {
      var qtyStr = normSpace(
        new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(l.qty)
      );
      var r = [
        { text: l.description || "" },
        { text: qtyStr, alignment: "right" },
        { text: fmtMoney(l.pu), alignment: "right" },
      ];
      if (tvaApplicable)
        r.push({ text: String(l.tva).replace(".", ",") + " %", alignment: "right" });
      r.push({ text: fmtMoney(l._amount), alignment: "right" });
      body.push(r);
    });

    var widths = tvaApplicable ? ["*", 34, 74, 44, 74] : ["*", 40, 90, 90];

    // Totaux
    var totalsBody = [];
    if (t.noTva) {
      totalsBody.push(["Sous-total", fmtMoney(t.subtotal)]);
      totalsBody.push(["Total", fmtMoney(t.total)]);
    } else {
      totalsBody.push(["Sous-total HT", fmtMoney(t.subtotal)]);
      Object.keys(t.tvaByRate)
        .sort(function (a, b) {
          return b - a;
        })
        .forEach(function (rate) {
          totalsBody.push(["TVA " + String(rate).replace(".", ",") + " %", fmtMoney(t.tvaByRate[rate])]);
        });
      totalsBody.push(["Total TTC", fmtMoney(t.total)]);
    }

    var content = [
      {
        columns: [
          { text: "Facture", fontSize: 30, bold: true },
          logoNode(),
        ],
      },
      { text: " ", margin: [0, 18, 0, 0] },
      {
        table: {
          body: [
            [{ text: "Numéro de facture", bold: true }, number],
            [{ text: "Date d'émission", bold: true }, fmtDateLong(emission)],
            [{ text: "Date d'échéance", bold: true }, fmtDateLong(echeance)],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 20],
      },
      {
        columns: [
          { width: "*", stack: partyStackIssuer() },
          { width: "*", stack: partyStackClient() },
        ],
        columnGap: 24,
      },
      {
        text: fmtMoney(t.total) + " dus le " + fmtDateLong(echeance),
        fontSize: 15,
        bold: true,
        margin: [0, 26, 0, 12],
      },
      {
        table: { headerRows: 1, widths: widths, body: body },
        layout: {
          fillColor: function (rowIndex) {
            return rowIndex === 0 ? "#efefef" : null;
          },
          hLineWidth: function () {
            return 0.5;
          },
          vLineWidth: function () {
            return 0.5;
          },
          hLineColor: function () {
            return "#8a8a8a";
          },
          vLineColor: function () {
            return "#8a8a8a";
          },
          paddingTop: function () {
            return 5;
          },
          paddingBottom: function () {
            return 5;
          },
        },
      },
      {
        columns: [
          { width: "*", text: "" },
          {
            width: "auto",
            table: {
              body: totalsBody.map(function (r, i) {
                return [
                  { text: r[0], alignment: "right", bold: i === totalsBody.length - 1 },
                  { text: r[1], alignment: "right", bold: i === totalsBody.length - 1 },
                ];
              }),
            },
            layout: "noBorders",
            margin: [0, 14, 0, 0],
          },
        ],
      },
      {
        columns: [
          { width: "*", text: "" },
          {
            width: "auto",
            table: { body: [[{ text: "Montant dû", bold: true }, { text: fmtMoney(t.total), bold: true }]] },
            layout: {
              hLineWidth: function (i) {
                return i === 0 ? 1 : 0;
              },
              vLineWidth: function () {
                return 0;
              },
              hLineColor: function () {
                return "#1c1c1a";
              },
              paddingTop: function () {
                return 6;
              },
            },
            margin: [0, 2, 0, 0],
          },
        ],
      },
    ];

    if (t.noTva) {
      content.push({
        text: "TVA non applicable, art. 293 B du CGI",
        italics: true,
        alignment: "right",
        margin: [0, 26, 0, 0],
        color: "#555",
      });
    }

    var dd = {
      pageSize: "A4",
      pageMargins: [42, 44, 42, 54],
      defaultStyle: { fontSize: 10, color: "#1c1c1a", lineHeight: 1.25 },
      styles: { th: { bold: true, fontSize: 10 } },
      content: content,
    };
    return dd;
  }

  // ---------------------------------------------------------------------------
  // Prévisualiser / Générer
  // ---------------------------------------------------------------------------
  function ensureReady() {
    if (typeof pdfMake === "undefined") {
      toast("La librairie PDF n'est pas chargée : ouvrez la page via un serveur local (voir README).", "error");
      return false;
    }
    return true;
  }

  var previewUrl = null;
  function revokePreview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
  }

  $("btnPreview").addEventListener("click", function () {
    if (!ensureReady()) return;
    var dd = buildDocDefinition(currentInvoiceNumber());
    Promise.resolve(pdfMake.createPdf(dd).getBlob())
      .then(function (blob) {
        revokePreview();
        previewUrl = URL.createObjectURL(blob);
        $("previewFrame").src = previewUrl;
        $("previewModal").classList.remove("hidden");
      })
      .catch(function (e) {
        toast("Erreur lors de la génération de l'aperçu : " + (e && e.message), "error");
      });
  });
  $("previewClose").addEventListener("click", function () {
    $("previewModal").classList.add("hidden");
    $("previewFrame").removeAttribute("src");
    revokePreview();
  });
  $("previewModal").addEventListener("click", function (e) {
    if (e.target === $("previewModal")) $("previewClose").click();
  });

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Lien de secours : certains navigateurs bloquent les téléchargements
    // successifs déclenchés par script tant que l'utilisateur n'a pas
    // autorisé « télécharger plusieurs fichiers » pour le site. Ce lien
    // ouvre le PDF dans un onglet (toujours autorisé) d'où il peut être
    // enregistré ou imprimé.
    var fb = $("fallbackLink");
    if (!fb) {
      fb = document.createElement("a");
      fb.id = "fallbackLink";
      fb.className = "fallback-link";
      fb.target = "_blank";
      fb.rel = "noopener";
      document.querySelector(".actions").insertAdjacentElement("beforebegin", fb);
    }
    if (fb.dataset.url) URL.revokeObjectURL(fb.dataset.url);
    fb.dataset.url = url;
    fb.href = url;
    fb.textContent = "Le téléchargement n'a pas démarré ? Ouvrir " + filename;
    fb.style.display = "block";
  }

  $("btnGenerate").addEventListener("click", function () {
    if (!ensureReady()) return;
    var number = currentInvoiceNumber();
    var dd = buildDocDefinition(number);
    Promise.resolve(pdfMake.createPdf(dd).getBlob())
      .then(function (blob) {
        downloadBlob(blob, "Facture_" + number + ".pdf");
        setSeq(getSeq() + 1);
        renderInvoiceNumber();
        $("nextSeq").value = getSeq();
        toast("Facture " + number + " générée.");
      })
      .catch(function (e) {
        toast("Erreur lors de la génération : " + (e && e.message), "error");
      });
  });

  // ---------------------------------------------------------------------------
  // Paramètres
  // ---------------------------------------------------------------------------
  $("toggleSettings").addEventListener("click", function () {
    $("settingsPanel").classList.toggle("hidden");
  });
  $("saveSettings").addEventListener("click", function () {
    var n = parseInt($("nextSeq").value, 10);
    if (isNaN(n) || n < 1) {
      toast("Numéro de séquence invalide.", "error");
      return;
    }
    var prefix = ($("numPrefix").value || "WAK").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (!prefix) prefix = "WAK";
    var st = load(K.settings, {});
    st.prefix = prefix;
    save(K.settings, st);
    $("numPrefix").value = prefix;
    $("prefixHint").textContent = prefix;
    setSeq(n);
    renderInvoiceNumber();
    $("settingsPanel").classList.add("hidden");
  });
  $("numPrefix").addEventListener("input", function () {
    var p = $("numPrefix").value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "") || "WAK";
    $("prefixHint").textContent = p;
  });

  // ---------------------------------------------------------------------------
  // TVA / devise
  // ---------------------------------------------------------------------------
  function applyTvaVisibility() {
    document.querySelector(".lines").classList.toggle("no-tva", $("tvaNonApplicable").checked);
  }
  $("tvaNonApplicable").addEventListener("change", function () {
    applyTvaVisibility();
    persistSettings();
    recompute();
  });
  $("devise").addEventListener("change", function () {
    persistSettings();
    recompute();
    renderInvoiceNumber();
  });

  $("addLine").addEventListener("click", function () {
    addLine();
  });

  // dates → numéro dépend de l'année d'émission
  ["dateEmission"].forEach(function (id) {
    $(id).addEventListener("input", renderInvoiceNumber);
  });

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  function init() {
    attachDateMask($("dateEmission"));
    attachDateMask($("dateEcheance"));

    var today = new Date();
    $("dateEmission").value = fmtDateInput(today);
    $("dateEcheance").value = fmtDateInput(addMonths(today, 1));

    var s = load(K.settings, {});
    if (s.devise) $("devise").value = s.devise;
    $("tvaNonApplicable").checked = !!s.tvaNonApplicable;
    $("numPrefix").value = getPrefix();
    $("prefixHint").textContent = getPrefix();

    issuer.refreshOptions(s.issuerId || "");
    client.refreshOptions(s.clientId || "");
    if (s.issuerId) issuer.selectEl.dispatchEvent(new Event("change"));
    if (s.clientId) client.selectEl.dispatchEvent(new Event("change"));

    $("nextSeq").value = getSeq();
    renderLogo();
    renderInvoiceNumber();
    applyTvaVisibility();

    addLine();
    recompute();
  }

  init();
})();
