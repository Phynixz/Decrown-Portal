/**
 * landlord-dashboard.js
 * ------------------------------------------------------------------
 * Renders the Landlord Dashboard.
 *
 * Reads landlord info from localStorage (haven_user) and submitted
 * properties from localStorage (haven_submitted_properties), then
 * merges them with the demo data in landlord-data.js.
 *
 * Depends on: utils.js and landlord-data.js being loaded first.
 */

document.addEventListener("DOMContentLoaded", function () {
  var STAGES = ["Submitted", "Under Review", "Approved", "Published"];

  // ---- Read data from localStorage -----------------------------------
  var storedUser = null;
  try {
    storedUser = JSON.parse(localStorage.getItem("haven_user"));
  } catch (err) {
    storedUser = null;
  }

  var storedProperties = [];
  try {
    storedProperties = JSON.parse(localStorage.getItem("haven_submitted_properties")) || [];
  } catch (err) {
    storedProperties = [];
  }

  // Use stored user info if available, otherwise fall back to demo data
  var landlord = storedUser || (window.LANDLORD || {});

  // Merge: stored properties come first (newest), then demo properties
  var properties = storedProperties.concat(window.LANDLORD_PROPERTIES || []);

  var activity = (window.LANDLORD_ACTIVITY || []).slice();

  // If there are stored properties, add activity entries for them
  for (var i = 0; i < storedProperties.length; i++) {
    var sp = storedProperties[i];
    activity.unshift({
      id: "sa" + i,
      type: "submitted",
      message: 'You submitted "' + sp.title + '" for review.',
      date: sp.dateSubmitted,
    });
  }

  // ---- Display the landlord's name -----------------------------------
  var displayName = landlord.firstName
    ? landlord.firstName
    : landlord.name || "Landlord";
  document.getElementById("landlord-name").textContent = displayName;

  // ---- Check for a ?submitted=true flag ------------------------------
  var params = new URLSearchParams(window.location.search);
  var justSubmitted = params.get("submitted") === "true";

  renderStats();
  renderSummary();
  renderPropertiesList();
  renderActivity();
  wireQuickActions();

  // ---- Stats ---------------------------------------------------------
  function renderStats() {
    var total = properties.length;
    var active = 0;
    var applications = 0;
    var pending = 0;

    for (var i = 0; i < properties.length; i++) {
      var p = properties[i];
      if (p.listingStatus === "Published") active++;
      if (p.listingStatus === "Submitted" || p.listingStatus === "Under Review") pending++;
      applications += p.applications || 0;
    }

    setText("stat-total", total);
    setText("stat-active", active);
    setText("stat-applications", applications);
    setText("stat-pending", pending);
  }

  // ---- Latest submission summary -------------------------------------
  function getLatest() {
    var sorted = properties.slice();
    sorted.sort(function (a, b) {
      return new Date(b.dateSubmitted) - new Date(a.dateSubmitted);
    });
    return sorted[0];
  }

  function renderSummary() {
    var p = getLatest();
    var card = document.getElementById("summary-card");
    if (!p) {
      card.innerHTML =
        '<p class="p-6 text-[13px] text-muted">No properties submitted yet.</p>';
      return;
    }

    setSrc("summary-image", p.image, p.title);
    setText("summary-title", p.title);
    setText("summary-location-text", p.location);
    setText("summary-type", p.type);
    setText("summary-price", Utils.formatPrice(p));
    setText("summary-date", Utils.formatDate(p.dateSubmitted));

    var badge = document.getElementById("summary-status-badge");
    badge.textContent = p.listingStatus;
    badge.className =
      "rounded-full px-2.5 py-1 text-[11px] font-semibold " +
      statusBadgeClasses(p.listingStatus);

    renderStepper(p.listingStatus);
    renderSummaryGuidance(p);
  }

  function renderStepper(status) {
    var wrap = document.getElementById("summary-stepper");

    if (status === "Rejected") {
      wrap.innerHTML =
        '<div class="flex items-center gap-2 rounded-lg border border-negative/25 bg-negative/[0.05] px-3.5 py-2.5 text-[13px] text-negative">' +
        '<i class="fa-solid fa-circle-exclamation shrink-0"></i>' +
        "This listing was not approved by the agency." +
        "</div>";
      return;
    }

    var currentIndex = STAGES.indexOf(status);
    var parts = [];

    for (var i = 0; i < STAGES.length; i++) {
      var stage = STAGES[i];
      var isDone = i < currentIndex;
      var isCurrentFinal = i === currentIndex && stage === "Published";
      var dotClasses;

      if (isDone || isCurrentFinal) {
        dotClasses = "border-accent bg-accent text-white";
      } else if (i === currentIndex) {
        dotClasses = "border-ink bg-white text-ink";
      } else {
        dotClasses = "border-border bg-white text-muted";
      }

      if (i > 0) {
        var lineClasses = i <= currentIndex ? "bg-ink" : "bg-border";
        parts.push(
          '<div class="mt-3 h-px flex-1 ' + lineClasses + '"></div>',
        );
      }

      var labelClass = i === currentIndex ? "text-ink" : "text-muted";
      parts.push(
        '<div class="flex shrink-0 flex-col items-center gap-1.5 text-center" style="width:72px">' +
          '<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ' +
          dotClasses +
          '">' +
          (i + 1) +
          "</span>" +
          '<span class="text-[10px] font-medium leading-tight ' +
          labelClass +
          '">' +
          stage +
          "</span>" +
          "</div>",
      );
    }

    wrap.innerHTML =
      '<div class="flex items-start">' + parts.join("") + "</div>";
  }

  function renderSummaryGuidance(p) {
    var wrap = document.getElementById("summary-cta");
    var status = p.listingStatus;

    if (status === "Rejected") {
      wrap.innerHTML =
        '<p class="mt-5 text-[13px] text-muted">Contact the agency to find out what needs to change before resubmitting.</p>' +
        '<a href="mailto:hello@haven.example" class="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-ink px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-ink hover:text-white">Contact Agency</a>';
      return;
    }

    var messages = {
      Submitted:
        "Our team is reviewing your submission. We\u2019ll notify you once it moves forward.",
      "Under Review":
        "Your listing is under review. This usually takes 1\u20132 business days.",
      Approved:
        "Your listing has been approved and will be published shortly.",
      Published:
        "Your listing is live and visible to buyers and tenants.",
    };

    var html =
      '<p class="mt-5 text-[13px] text-muted">' +
      (messages[status] || "") +
      "</p>";

    if (status === "Published") {
      html +=
        '<a href="property-details.html?id=' +
        encodeURIComponent(p.publicId || p.id) +
        '" class="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-ink px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-ink hover:text-white">View Property</a>';
    }

    wrap.innerHTML = html;
  }

  // ---- Status badge styling ------------------------------------------
  function statusBadgeClasses(status) {
    if (status === "Published")
      return "border border-accent/25 bg-accent/[0.06] text-accent";
    if (status === "Rejected")
      return "border border-negative/25 bg-negative/[0.06] text-negative";
    if (status === "Approved")
      return "border border-ink/20 bg-ink/[0.04] text-ink";
    return "border border-border bg-surface text-muted";
  }

  // ---- My Properties list --------------------------------------------
  function renderPropertiesList() {
    var wrap = document.getElementById("properties-list");
    if (!properties.length) {
      wrap.innerHTML =
        '<p class="p-6 text-[13px] text-muted">You haven\u2019t submitted any properties yet.</p>';
      return;
    }

    // Sort newest first
    var sorted = properties.slice();
    sorted.sort(function (a, b) {
      return new Date(b.dateSubmitted) - new Date(a.dateSubmitted);
    });

    var html = "";
    for (var i = 0; i < sorted.length; i++) {
      var p = sorted[i];
      var badge =
        '<span class="inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ' +
        statusBadgeClasses(p.listingStatus) +
        '">' +
        p.listingStatus +
        "</span>";

      var action =
        p.listingStatus === "Published"
          ? '<a href="property-details.html?id=' +
            encodeURIComponent(p.publicId || p.id) +
            '" class="text-[12px] font-medium text-ink transition-colors hover:text-accent">View Details</a>'
          : '<span class="text-[12px] text-muted">Not yet published</span>';

      html +=
        '<div class="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">' +
          '<img src="' +
          (p.image || "") +
          '" alt="' +
          Utils.escapeHTML(p.title) +
          '" class="h-14 w-14 shrink-0 rounded-lg object-cover" />' +
          '<div class="min-w-0 flex-1">' +
            '<p class="truncate text-[14px] font-medium text-ink">' +
            Utils.escapeHTML(p.title) +
            "</p>" +
            '<p class="mt-0.5 truncate text-[12px] text-muted">' +
            Utils.escapeHTML(p.location) +
            " \u00B7 " +
            Utils.escapeHTML(p.type) +
            "</p>" +
            '<p class="mt-1 font-mono text-[12px] font-medium text-ink sm:hidden">' +
            Utils.formatPrice(p) +
            "</p>" +
          "</div>" +
          '<p class="hidden shrink-0 font-mono text-[13px] font-medium text-ink sm:block">' +
          Utils.formatPrice(p) +
          "</p>" +
          '<div class="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-4">' +
            badge +
            action +
          "</div>" +
        "</div>";
    }

    wrap.innerHTML = html;
  }

  // ---- Activity / notifications --------------------------------------
  function renderActivity() {
    var wrap = document.getElementById("activity-list");
    if (!activity.length) {
      wrap.innerHTML =
        '<p class="p-6 text-[13px] text-muted">No recent activity.</p>';
      return;
    }

    var sorted = activity.slice();
    sorted.sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });

    var html = "";
    for (var i = 0; i < sorted.length; i++) {
      var item = sorted[i];
      var dotClass = "bg-muted/40";
      if (item.type === "published" || item.type === "approved")
        dotClass = "bg-accent";
      if (item.type === "info-request") dotClass = "bg-negative";

      html +=
        '<div class="flex items-start gap-3 p-4 sm:p-5">' +
          '<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ' +
          dotClass +
          '"></span>' +
          '<div class="min-w-0 flex-1">' +
            '<p class="text-[13px] leading-snug text-ink">' +
            Utils.escapeHTML(item.message) +
            "</p>" +
            '<p class="mt-0.5 text-[11px] text-muted">' +
            Utils.formatDate(item.date) +
            "</p>" +
          "</div>" +
        "</div>";
    }

    wrap.innerHTML = html;
  }

  // ---- Quick actions -------------------------------------------------
  function wireQuickActions() {
    var published = null;
    for (var i = 0; i < properties.length; i++) {
      if (properties[i].listingStatus === "Published") {
        published = properties[i];
        break;
      }
    }

    var btn = document.getElementById("qa-view-property");
    if (published) {
      btn.href =
        "property-details.html?id=" +
        encodeURIComponent(published.publicId || published.id);
    } else {
      btn.removeAttribute("href");
      btn.classList.add("pointer-events-none", "opacity-40");
      btn.setAttribute("aria-disabled", "true");
      btn.textContent = "No Published Property Yet";
    }
  }

  // ---- Small helpers -------------------------------------------------
  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function setSrc(id, src, alt) {
    var el = document.getElementById(id);
    if (el) {
      el.src = src;
      el.alt = alt || "";
    }
  }
});
