/**
 * FD — shared stroke icons (24px viewBox).
 */
(function () {
  'use strict';

  var STROKE =
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

  var PATHS = {
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    trash:
      '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    kebab: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>'
  };

  function svg(name, size) {
    var paths = PATHS[name];
    if (!paths) return '';
    var s = size || 16;
    return (
      '<svg class="fd-icon fd-icon--' +
      name +
      '" viewBox="0 0 24 24" width="' +
      s +
      '" height="' +
      s +
      '" ' +
      STROKE +
      ' aria-hidden="true">' +
      paths +
      '</svg>'
    );
  }

  window.FD_ICONS = { svg: svg, paths: PATHS };
})();
