// R04 UI 시안 공통 아이콘 인라인 로더 & ?theme=light / ?font=large|xlarge URL 프리뷰 지원
(function () {
  var params = new URLSearchParams(window.location.search);
  var theme = params.get('theme');
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme;
  }
  var font = params.get('font');
  if (font === 'base' || font === 'large' || font === 'xlarge') {
    document.documentElement.dataset.fontScale = font;
  }

  async function hydrateIcons() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-icon]'));
    var cache = {};
    await Promise.all(
      nodes.map(async function (el) {
        var name = el.getAttribute('data-icon');
        if (!name) return;
        var size = el.getAttribute('data-size') || '20';
        var basePath = el.getAttribute('data-icon-base') || '../icons/';
        var url = basePath + name + '.svg';
        try {
          if (!cache[url]) {
            cache[url] = fetch(url).then(function (res) {
              if (!res.ok) throw new Error('HTTP ' + res.status);
              return res.text();
            });
          }
          var text = await cache[url];
          var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
          var svg = doc.querySelector('svg');
          if (!svg) return;
          svg.setAttribute('width', size);
          svg.setAttribute('height', size);
          svg.setAttribute('aria-hidden', 'true');
          var extraClass = el.getAttribute('class') || '';
          svg.setAttribute('class', ('r04-icon ' + extraClass).trim());
          el.replaceWith(svg);
        } catch (err) {
          console.warn('Icon load failed:', url, err);
        }
      })
    );
  }

  window.__iconsReady = new Promise(function (resolve) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        hydrateIcons().then(resolve, resolve);
      });
    } else {
      hydrateIcons().then(resolve, resolve);
    }
  });
})();
