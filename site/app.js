'use strict';
(function () {
  var REPO = 'miskatul-anwar/normaflow';
  var RELEASES = 'https://github.com/' + REPO + '/releases';
  var $ = function (id) { return document.getElementById(id); };

  /** Which system is the visitor on? macOS cannot be told apart by chip, so it shows both builds. */
  function detectOS() {
    var ua = navigator.userAgent || '';
    var plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    if (/android|iphone|ipod/i.test(ua)) return 'mobile';
    if (/mac/i.test(plat + ua) && navigator.maxTouchPoints > 1) return 'mobile'; // iPadOS reports a Mac
    if (/win/i.test(plat) || /windows/i.test(ua)) return 'windows';
    if (/mac/i.test(plat) || /macintosh/i.test(ua)) return 'macos';
    if (/linux|x11|cros/i.test(plat + ua)) return 'linux';
    return 'unknown';
  }

  var OS_NAME = { windows: 'Windows', macos: 'macOS', linux: 'Linux' };

  /** Sort release files into the ones a person would download. Updater bundles (.app.tar.gz) are left out. */
  function classify(asset) {
    var n = asset.name;
    if (/\.app\.tar\.gz$/i.test(n) || /\.sig$/i.test(n) || /latest\.json$/i.test(n)) return null;
    if (/-setup\.exe$/i.test(n) || /\.exe$/i.test(n)) return { os: 'windows', kind: '.exe installer', note: 'Windows, 64-bit', rank: 1 };
    if (/\.msi$/i.test(n)) return { os: 'windows', kind: '.msi installer', note: 'Windows, 64-bit, for managed installs', rank: 2 };
    if (/aarch64\.dmg$/i.test(n) || /arm64\.dmg$/i.test(n)) return { os: 'macos', kind: 'Apple Silicon', note: 'macOS, M1 or later', rank: 1, arch: 'arm' };
    if (/\.dmg$/i.test(n)) return { os: 'macos', kind: 'Intel', note: 'macOS, Intel', rank: 2, arch: 'intel' };
    if (/\.AppImage$/i.test(n)) return { os: 'linux', kind: 'AppImage', note: 'Linux x86_64, runs anywhere', rank: 1 };
    if (/\.deb$/i.test(n)) return { os: 'linux', kind: '.deb', note: 'Debian, Ubuntu', rank: 2 };
    if (/\.rpm$/i.test(n)) return { os: 'linux', kind: '.rpm', note: 'Fedora, RHEL, openSUSE', rank: 3 };
    return null;
  }

  function size(bytes) {
    if (!bytes) return '';
    return bytes >= 1e9 ? (bytes / 1e9).toFixed(2) + ' GB' : (bytes / 1e6).toFixed(bytes >= 1e8 ? 0 : 1) + ' MB';
  }
  function safeUrl(u) { return typeof u === 'string' && u.indexOf('https://github.com/' + REPO + '/') === 0 ? u : RELEASES; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function link(href, text, cls) { var a = el('a', cls, text); a.href = safeUrl(href); return a; }

  function fail(why) {
    var box = $('dl-status'); box.textContent = '';
    box.appendChild(document.createTextNode(why + ' '));
    box.appendChild(link(RELEASES + '/latest', 'Open the latest release on GitHub.'));
  }

  function render(rel) {
    var files = (rel.assets || []).map(function (a) { var c = classify(a); return c && { a: a, c: c }; }).filter(Boolean);
    if (!files.length) return fail('This release has no installers yet.');
    var version = String(rel.tag_name || '').replace(/^v/, '');
    var os = detectOS();
    var box = $('dl-status'); var card = box.parentNode;
    box.remove();

    var mine = files.filter(function (f) { return f.c.os === os; }).sort(function (x, y) { return x.c.rank - y.c.rank; });
    if (mine.length) {
      card.appendChild(el('p', 'meta')).appendChild(el('span', 'chip', 'NormaFlow ' + version));
      var btns = el('div', 'btns');
      var shown = os === 'macos' ? mine.slice(0, 2) : mine.slice(0, 1);
      shown.forEach(function (f, i) {
        var label = os === 'macos' ? 'Download for macOS (' + f.c.kind + ')' : 'Download for ' + OS_NAME[os];
        var b = link(f.a.browser_download_url, label, 'btn' + (i > 0 ? ' alt' : '')); b.setAttribute('download', '');
        btns.appendChild(b);
      });
      card.appendChild(btns);
      var f0 = shown[0];
      card.appendChild(el('p', 'meta', os === 'macos'
        ? 'Not sure which Mac you have? Apple menu, About This Mac: “Apple M…” means Apple Silicon, “Intel” means Intel. ' + shown.map(function (f) { return f.c.kind + ' ' + size(f.a.size); }).join(' · ') + '.'
        : f0.c.kind + ' · ' + size(f0.a.size) + ' · ' + f0.c.note));
      if (os === 'windows' || os === 'macos') {
        card.appendChild(el('p', 'warn', os === 'windows'
          ? 'The installer is not code-signed, so Windows may warn you. Choose More info, then Run anyway.'
          : 'The app is not notarized. The first time, right-click it and choose Open.'));
      }
      var d = $('n-' + os); if (d) d.open = true;
    } else {
      card.appendChild(el('p', 'meta')).appendChild(el('span', 'chip', 'NormaFlow ' + version));
      card.appendChild(el('p', null, os === 'mobile'
        ? 'NormaFlow is a desktop app for Windows, macOS and Linux. Open this page on a computer to download it.'
        : 'Pick your system from the list below.'));
    }

    var body = $('files'); var total = 0;
    ['windows', 'macos', 'linux'].forEach(function (name) {
      files.filter(function (f) { return f.c.os === name; }).sort(function (x, y) { return x.c.rank - y.c.rank; }).forEach(function (f) {
        total = Math.max(total, f.a.size || 0);
        var tr = el('tr', f.c.os === os ? 'mine' : '');
        var sys = el('td'); sys.appendChild(el('strong', null, OS_NAME[name])); sys.appendChild(el('div', 'muted small', f.c.note + (f.c.arch ? '' : '')));
        var file = el('td'); file.appendChild(link(f.a.browser_download_url, f.a.name));
        var sum = el('td', 'sum'); var h = String(f.a.digest || '').replace(/^sha256:/, '');
        if (/^[0-9a-f]{64}$/i.test(h)) {
          sum.appendChild(document.createTextNode(h));
          var cp = el('button', 'copy', 'Copy'); cp.type = 'button';
          cp.setAttribute('aria-label', 'Copy SHA-256 of ' + f.a.name);
          cp.addEventListener('click', function () {
            if (navigator.clipboard) navigator.clipboard.writeText(h).then(function () { cp.textContent = 'Copied'; setTimeout(function () { cp.textContent = 'Copy'; }, 1500); });
          });
          sum.appendChild(cp);
        } else sum.textContent = 'not listed';
        tr.appendChild(sys); tr.appendChild(file); tr.appendChild(el('td', 'nowrap', size(f.a.size))); tr.appendChild(sum);
        body.appendChild(tr);
      });
    });
    $('more').hidden = false;
    $('size-note').textContent = total > 3e8
      ? 'Each installer is large because it includes the two models the app runs on your computer.'
      : '';
  }

  fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then(render)
    .catch(function (e) { fail(String(e && e.message) === '403' ? 'GitHub is limiting requests from your network right now.' : 'Could not reach GitHub to look up the latest version.'); });
})();
