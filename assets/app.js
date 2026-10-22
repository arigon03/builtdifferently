/* Built Differently: scroll plays the film, anchors find the visible layout, buy buttons. */
(function () {
  "use strict";

  // Digistore24-Kauflink hier eintragen. Dann führen alle Kauf-Buttons direkt zur Kasse.
  var KAUFLINK = "https://www.checkout-ds24.com/product/752800";
  var KONTAKT = "builtdifferently.book@gmail.com";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var portraitQuery = window.matchMedia("(orientation: portrait) and (max-width: 1024px)");

  /* ---------------- anchors + buy buttons ---------------- */

  function visibleTarget(id) {
    var base = id.replace(/-d$/, "");
    var candidates = [base, base + "-d"];
    for (var i = 0; i < candidates.length; i++) {
      var el = document.getElementById(candidates[i]);
      if (el && el.getClientRects().length > 0) {
        return el;
      }
    }
    return null;
  }

  if (KAUFLINK) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-kauf]"), function (a) {
      a.href = KAUFLINK;
      a.target = "_blank";
      a.rel = "noopener";
    });
  }

  document.addEventListener("click", function (event) {
    var link = event.target && event.target.closest ? event.target.closest("a") : null;
    if (!link) {
      return;
    }
    if (link.hasAttribute("data-kauf") && !KAUFLINK) {
      event.preventDefault();
      if (!link.parentElement.querySelector(".kauf-hinweis")) {
        var note = document.createElement("p");
        note.className = "kauf-hinweis";
        note.setAttribute("role", "status");
        note.appendChild(document.createTextNode("Der Verkauf startet in Kürze. Fragen an "));
        var mail = document.createElement("span");
        mail.textContent = KONTAKT;
        note.appendChild(mail);
        link.insertAdjacentElement("afterend", note);
      }
      return;
    }
    var href = link.getAttribute("href") || "";
    if (href.charAt(0) !== "#" || href.length < 2) {
      return;
    }
    var el = visibleTarget(href.slice(1));
    if (!el) {
      return;
    }
    event.preventDefault();
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    try {
      history.replaceState(null, "", "#" + href.slice(1).replace(/-d$/, ""));
    } catch (e) {
      /* ignore */
    }
  });

  if (location.hash.length > 1) {
    var initial = visibleTarget(location.hash.slice(1));
    if (initial) {
      requestAnimationFrame(function () {
        initial.scrollIntoView({ block: "start" });
      });
    }
  }

  /* ---------------- the film ---------------- */

  var journey = document.querySelector(".journey");
  if (!journey) {
    return;
  }
  var video = journey.querySelector("video");
  var stillImg = journey.querySelector(".journey__media img");
  var stillSource = journey.querySelector(".journey__media source");
  var bar = journey.querySelector(".journey__progress");
  var chapters = Array.prototype.slice.call(journey.querySelectorAll(".chapter"));
  var routeButtons = Array.prototype.slice.call(journey.querySelectorAll(".journey__route button"));

  var ready = false;
  var seeking = false;
  var pendingTime = -1;
  var active = -1;
  var ticking = false;
  var blobUrl = null;
  var clipKind = null;

  function clipFor() {
    return portraitQuery.matches ? "mobil" : "desktop";
  }

  function scrollState() {
    var rect = journey.getBoundingClientRect();
    var total = Math.max(1, journey.offsetHeight - window.innerHeight);
    var scrolled = Math.min(Math.max(-rect.top, 0), total);
    var n = chapters.length;
    var index = n - 1;
    for (var i = 0; i < n; i++) {
      var end = i < n - 1 ? chapters[i + 1].offsetTop : total;
      if (scrolled < end) {
        index = i;
        break;
      }
    }
    var start = chapters[index].offsetTop;
    var stop = index < n - 1 ? chapters[index + 1].offsetTop : total;
    var local = stop > start ? Math.min(Math.max((scrolled - start) / (stop - start), 0), 1) : 1;
    return { index: index, film: (index + local) / n, progress: scrolled / total };
  }

  function setActive(index) {
    if (index === active) {
      return;
    }
    active = index;
    routeButtons.forEach(function (b, i) {
      if (i === index) {
        b.setAttribute("aria-current", "step");
      } else {
        b.removeAttribute("aria-current");
      }
    });
    if (reduceMotion) {
      var ch = chapters[index];
      var kind = clipFor();
      var still = ch.getAttribute("data-still-" + kind);
      if (still) {
        if (stillSource) {
          stillSource.srcset = ch.getAttribute("data-still-mobil");
        }
        stillImg.src = ch.getAttribute("data-still-desktop");
      }
    }
  }

  function seekTo(t) {
    if (!ready) {
      return;
    }
    if (seeking) {
      pendingTime = t;
      return;
    }
    if (Math.abs(video.currentTime - t) < 0.015) {
      return;
    }
    seeking = true;
    try {
      video.currentTime = t;
    } catch (e) {
      seeking = false;
    }
  }

  function update() {
    ticking = false;
    var s = scrollState();
    if (bar) {
      bar.style.setProperty("--p", s.progress.toFixed(4));
    }
    setActive(s.index);
    if (ready && video.duration) {
      seekTo(s.film * Math.max(0, video.duration - 0.05));
    }
  }

  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  routeButtons.forEach(function (b, i) {
    b.addEventListener("click", function () {
      var top = journey.getBoundingClientRect().top + window.scrollY + chapters[i].offsetTop + 2;
      window.scrollTo({ top: top, behavior: reduceMotion ? "auto" : "smooth" });
    });
  });

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  update();

  if (reduceMotion || !video) {
    return;
  }

  video.muted = true;
  video.addEventListener("seeked", function () {
    seeking = false;
    if (!journey.classList.contains("is-live")) {
      journey.classList.add("is-live");
    }
    if (pendingTime >= 0) {
      var t = pendingTime;
      pendingTime = -1;
      seekTo(t);
    }
  });
  video.addEventListener("loadeddata", function () {
    ready = true;
    video.pause();
    var s = scrollState();
    var t = s.film * Math.max(0, video.duration - 0.05);
    seeking = true;
    video.currentTime = t > 0.01 ? t : 0.01;
  });

  function load() {
    var kind = clipFor();
    if (kind === clipKind) {
      return;
    }
    clipKind = kind;
    ready = false;
    seeking = false;
    journey.classList.remove("is-live");
    var src = video.getAttribute("data-src-" + kind);
    var setSrc = function (url) {
      video.src = url;
      video.load();
    };
    if (window.fetch && window.URL && URL.createObjectURL) {
      fetch(src)
        .then(function (r) {
          if (!r.ok) {
            throw new Error("HTTP " + r.status);
          }
          return r.blob();
        })
        .then(function (blob) {
          if (clipKind !== kind) {
            return;
          }
          if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
          }
          blobUrl = URL.createObjectURL(blob);
          setSrc(blobUrl);
        })
        .catch(function () {
          setSrc(src);
        });
    } else {
      setSrc(src);
    }
  }

  // iOS only paints a muted inline video after it has played once.
  document.addEventListener(
    "touchstart",
    function () {
      var p = video.play();
      if (p && p.then) {
        p.then(function () {
          video.pause();
          requestUpdate();
        }).catch(function () {});
      }
    },
    { once: true, passive: true }
  );

  if (portraitQuery.addEventListener) {
    portraitQuery.addEventListener("change", load);
  }

  if (document.readyState === "complete") {
    load();
  } else {
    window.addEventListener("load", load);
  }
})();
