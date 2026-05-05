// HTML5 Banner Builder — generates animated ad banners in IAB standard formats
// Takes brand assets (logo, colors, copy) and composes animated HTML5 creatives

const BANNER_TEMPLATES = {
  // Each template defines a visual style with CSS animations
  'fade-slide': {
    name: 'Fade & Slide',
    description: 'Logo fade-in, headline slides up, CTA pulses',
    style: 'modern'
  },
  'zoom-reveal': {
    name: 'Zoom Reveal',
    description: 'Background zooms slowly, text reveals with mask',
    style: 'dramatic'
  },
  'minimal-type': {
    name: 'Minimal Typography',
    description: 'Clean text animation, no image background',
    style: 'minimal'
  },
  'gradient-wave': {
    name: 'Gradient Wave',
    description: 'Animated gradient background with floating elements',
    style: 'vibrant'
  }
};

const IAB_FORMATS = {
  '300x250': { w: 300, h: 250, label: 'Medium Rectangle', tier: 'primary' },
  '728x90':  { w: 728, h: 90,  label: 'Leaderboard', tier: 'primary' },
  '320x50':  { w: 320, h: 50,  label: 'Mobile Banner', tier: 'primary' },
  '160x600': { w: 160, h: 600, label: 'Wide Skyscraper', tier: 'secondary' },
  '300x600': { w: 300, h: 600, label: 'Half Page', tier: 'secondary' },
  '970x250': { w: 970, h: 250, label: 'Billboard', tier: 'secondary' },
  '320x480': { w: 320, h: 480, label: 'Mobile Interstitial', tier: 'mobile' },
  '300x50':  { w: 300, h: 50,  label: 'Mobile Banner Small', tier: 'mobile' }
};

/**
 * Generate an animated HTML5 banner
 * @param {Object} opts
 * @param {string} opts.brandName - Brand display name
 * @param {string} opts.headline - Main headline text
 * @param {string} opts.subheadline - Supporting text
 * @param {string} opts.ctaText - CTA button text
 * @param {string} opts.clickUrl - Click-through URL
 * @param {string} opts.pixelUrl - Impression tracking pixel URL
 * @param {string} opts.logoUrl - Logo image URL (optional)
 * @param {string} opts.backgroundUrl - Background image URL (optional)
 * @param {string} opts.bgColor - Background color
 * @param {string} opts.fgColor - Foreground/text color
 * @param {string} opts.accentColor - Accent color for CTA
 * @param {string} opts.format - IAB format key (e.g. '300x250')
 * @param {string} opts.template - Template key (e.g. 'fade-slide')
 */
function generateBanner(opts) {
  const fmt = IAB_FORMATS[opts.format] || IAB_FORMATS['300x250'];
  const w = fmt.w;
  const h = fmt.h;
  const template = opts.template || 'fade-slide';

  const bgColor = opts.bgColor || '#000000';
  const fgColor = opts.fgColor || '#ffffff';
  const accentColor = opts.accentColor || '#7c3aed';
  const brandName = escHtml(opts.brandName || '');
  const headline = escHtml(opts.headline || '');
  const subheadline = escHtml(opts.subheadline || '');
  const ctaText = escHtml(opts.ctaText || 'Scopri di più');
  const clickUrl = opts.clickUrl || '#';
  const pixelUrl = opts.pixelUrl || '';
  const logoUrl = opts.logoUrl || '';
  const backgroundUrl = opts.backgroundUrl || '';

  // Adaptive sizing based on format
  const isSmall = h <= 90;
  const isTall = h > w;
  const headlineSize = isSmall ? 14 : (isTall ? 22 : Math.min(24, Math.floor(w / 14)));
  const subSize = isSmall ? 10 : Math.max(11, headlineSize - 6);
  const ctaSize = isSmall ? 10 : 13;
  const ctaPad = isSmall ? '4px 10px' : '8px 20px';
  const brandSize = isSmall ? 9 : 11;

  let layoutCss = '';
  let bodyHtml = '';

  if (template === 'fade-slide') {
    layoutCss = generateFadeSlideCSS(w, h, bgColor, fgColor, accentColor, isSmall, isTall, headlineSize, subSize, ctaSize, ctaPad, brandSize);
    bodyHtml = generateFadeSlideHTML(brandName, headline, subheadline, ctaText, logoUrl, backgroundUrl, isSmall, isTall);
  } else if (template === 'zoom-reveal') {
    layoutCss = generateZoomRevealCSS(w, h, bgColor, fgColor, accentColor, isSmall, isTall, headlineSize, subSize, ctaSize, ctaPad, brandSize);
    bodyHtml = generateZoomRevealHTML(brandName, headline, subheadline, ctaText, logoUrl, backgroundUrl, isSmall, isTall);
  } else if (template === 'minimal-type') {
    layoutCss = generateMinimalTypeCSS(w, h, bgColor, fgColor, accentColor, isSmall, isTall, headlineSize, subSize, ctaSize, ctaPad, brandSize);
    bodyHtml = generateMinimalTypeHTML(brandName, headline, subheadline, ctaText, logoUrl, isSmall, isTall);
  } else if (template === 'gradient-wave') {
    layoutCss = generateGradientWaveCSS(w, h, bgColor, fgColor, accentColor, isSmall, isTall, headlineSize, subSize, ctaSize, ctaPad, brandSize);
    bodyHtml = generateGradientWaveHTML(brandName, headline, subheadline, ctaText, logoUrl, isSmall, isTall);
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{overflow:hidden;width:${w}px;height:${h}px}
a.wa-wrap{display:block;width:${w}px;height:${h}px;text-decoration:none;position:relative;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.wa-badge{position:absolute;top:4px;right:4px;background:rgba(0,0,0,.4);color:#fff;font-size:8px;padding:1px 4px;border-radius:2px;z-index:10;letter-spacing:.5px}
${layoutCss}
</style></head><body>
<a class="wa-wrap" href="${clickUrl}" target="_blank" rel="noopener">
<span class="wa-badge">AD</span>
${bodyHtml}
</a>
${pixelUrl ? `<img src="${pixelUrl}" width="1" height="1" style="position:absolute;opacity:0">` : ''}
</body></html>`;
}

// ─── Template: Fade & Slide ─────────────────────────────────────────

function generateFadeSlideCSS(w, h, bg, fg, accent, isSmall, isTall, hs, ss, cs, cp, bs) {
  const bgImg = 'background-size:cover;background-position:center;';
  return `
.wa-wrap{background:${bg};color:${fg}}
.wa-bg{position:absolute;inset:0;${bgImg}opacity:0;animation:waBgFade 1s .3s forwards}
.wa-overlay{position:absolute;inset:0;background:linear-gradient(${isTall?'to bottom':'135deg'},${bg}ee 40%,${bg}88)}
.wa-content{position:absolute;${isSmall?'left:12px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:12px;right:12px':(isTall?'bottom:24px;left:16px;right:16px':'bottom:20px;left:20px;right:20px')}}
.wa-logo{${isSmall?'width:24px;height:24px':'width:40px;height:40px'};object-fit:contain;opacity:0;animation:waFadeIn .6s .5s forwards;flex-shrink:0}
.wa-text{${isSmall?'flex:1':''}}
.wa-headline{font-size:${hs}px;font-weight:800;line-height:1.15;opacity:0;transform:translateY(15px);animation:waSlideUp .6s .7s forwards;${isSmall?'white-space:nowrap;overflow:hidden;text-overflow:ellipsis':''}}
.wa-sub{font-size:${ss}px;opacity:0;transform:translateY(10px);animation:waSlideUp .5s .9s forwards;margin-top:${isSmall?0:4}px;line-height:1.3;${isSmall?'display:none':''}}
.wa-cta{display:inline-block;margin-top:${isSmall?0:10}px;padding:${cp};background:${accent};color:#fff;border-radius:6px;font-size:${cs}px;font-weight:700;opacity:0;animation:waSlideUp .5s 1.1s forwards,waPulse 2s 2s infinite;${isSmall?'margin-left:auto;white-space:nowrap':''}}
.wa-brand{font-size:${bs}px;opacity:.5;margin-top:${isSmall?0:6}px;letter-spacing:1px;text-transform:uppercase;opacity:0;animation:waFadeIn .5s 1.4s forwards;${isSmall?'display:none':''}}
@keyframes waBgFade{to{opacity:.6}}
@keyframes waFadeIn{to{opacity:1}}
@keyframes waSlideUp{to{opacity:1;transform:translateY(0)}}
@keyframes waPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}`;
}

function generateFadeSlideHTML(brand, headline, sub, cta, logoUrl, bgUrl, isSmall, isTall) {
  return `
${bgUrl ? `<div class="wa-bg" style="background-image:url('${bgUrl}')"></div>` : ''}
<div class="wa-overlay"></div>
<div class="wa-content">
  ${logoUrl ? `<img class="wa-logo" src="${logoUrl}" alt="">` : ''}
  <div class="wa-text">
    <div class="wa-headline">${headline}</div>
    <div class="wa-sub">${sub}</div>
    ${isSmall ? '' : `<div class="wa-brand">${brand}</div>`}
  </div>
  <span class="wa-cta">${cta}</span>
</div>`;
}

// ─── Template: Zoom Reveal ──────────────────────────────────────────

function generateZoomRevealCSS(w, h, bg, fg, accent, isSmall, isTall, hs, ss, cs, cp, bs) {
  return `
.wa-wrap{background:${bg};color:${fg}}
.wa-bg{position:absolute;inset:-10%;background-size:cover;background-position:center;animation:waZoom 8s linear infinite alternate}
.wa-overlay{position:absolute;inset:0;background:${bg}cc}
.wa-content{position:absolute;${isSmall?'inset:0;display:flex;align-items:center;padding:0 12px;gap:10px':(isTall?'inset:0;display:flex;flex-direction:column;justify-content:center;padding:20px':'inset:0;display:flex;flex-direction:column;justify-content:center;padding:20px 24px')}}
.wa-logo{${isSmall?'width:22px;height:22px':'width:44px;height:44px'};object-fit:contain;opacity:0;animation:waReveal .8s .4s forwards}
.wa-headline{font-size:${hs}px;font-weight:900;line-height:1.1;clip-path:inset(0 100% 0 0);animation:waWipe .8s .6s forwards;${isSmall?'flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis':'margin-top:8px'}}
.wa-sub{font-size:${ss}px;opacity:.8;margin-top:4px;clip-path:inset(0 100% 0 0);animation:waWipe .7s .9s forwards;${isSmall?'display:none':''}}
.wa-cta{display:inline-block;margin-top:${isSmall?'0':'12px'};padding:${cp};background:${accent};color:#fff;border-radius:8px;font-size:${cs}px;font-weight:700;opacity:0;transform:scale(.8);animation:waPop .4s 1.2s forwards;${isSmall?'margin-left:auto;white-space:nowrap':''}}
@keyframes waZoom{0%{transform:scale(1)}100%{transform:scale(1.15)}}
@keyframes waReveal{to{opacity:1}}
@keyframes waWipe{to{clip-path:inset(0 0 0 0)}}
@keyframes waPop{to{opacity:1;transform:scale(1)}}`;
}

function generateZoomRevealHTML(brand, headline, sub, cta, logoUrl, bgUrl, isSmall, isTall) {
  return `
${bgUrl ? `<div class="wa-bg" style="background-image:url('${bgUrl}')"></div>` : ''}
<div class="wa-overlay"></div>
<div class="wa-content">
  ${logoUrl ? `<img class="wa-logo" src="${logoUrl}" alt="">` : ''}
  <div class="wa-headline">${headline}</div>
  <div class="wa-sub">${sub}</div>
  <span class="wa-cta">${cta}</span>
</div>`;
}

// ─── Template: Minimal Typography ───────────────────────────────────

function generateMinimalTypeCSS(w, h, bg, fg, accent, isSmall, isTall, hs, ss, cs, cp, bs) {
  return `
.wa-wrap{background:${bg};color:${fg}}
.wa-line{position:absolute;left:${isSmall?12:20}px;top:50%;width:2px;height:0;background:${accent};animation:waLine .6s .2s forwards;transform:translateY(-50%)}
.wa-content{position:absolute;${isSmall?'left:22px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:10px;right:12px':'left:'+(isTall?20:30)+'px;top:50%;transform:translateY(-50%)'}}
.wa-headline{font-size:${hs}px;font-weight:300;line-height:1.2;letter-spacing:-.5px;opacity:0;animation:waTypeIn .8s .5s forwards;${isSmall?'white-space:nowrap;overflow:hidden;text-overflow:ellipsis':''}}
.wa-headline strong{font-weight:800}
.wa-sub{font-size:${ss}px;opacity:0;animation:waTypeIn .6s .8s forwards;margin-top:4px;font-weight:300;color:${fg}aa;${isSmall?'display:none':''}}
.wa-cta{display:inline-block;margin-top:${isSmall?'0':'14px'};padding:${cp};border:2px solid ${accent};color:${accent};border-radius:4px;font-size:${cs}px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;opacity:0;animation:waTypeIn .5s 1s forwards;transition:background .2s,color .2s;${isSmall?'margin-left:auto;white-space:nowrap':''}}
.wa-cta:hover{background:${accent};color:#fff}
.wa-brand{position:absolute;${isSmall?'display:none':'bottom:12px;right:16px'};font-size:${bs}px;letter-spacing:2px;text-transform:uppercase;opacity:0;animation:waTypeIn .5s 1.2s forwards;color:${fg}66}
@keyframes waLine{to{height:${isSmall?20:isTall?60:40}px}}
@keyframes waTypeIn{to{opacity:1}}`;
}

function generateMinimalTypeHTML(brand, headline, sub, cta, logoUrl, isSmall, isTall) {
  // Split headline — first word normal, rest bold
  const words = headline.split(' ');
  const styledHeadline = words.length > 1
    ? `${words[0]} <strong>${words.slice(1).join(' ')}</strong>`
    : `<strong>${headline}</strong>`;
  return `
<div class="wa-line"></div>
<div class="wa-content">
  <div>
    <div class="wa-headline">${styledHeadline}</div>
    <div class="wa-sub">${sub}</div>
  </div>
  <span class="wa-cta">${cta}</span>
</div>
<div class="wa-brand">${brand}</div>`;
}

// ─── Template: Gradient Wave ────────────────────────────────────────

function generateGradientWaveCSS(w, h, bg, fg, accent, isSmall, isTall, hs, ss, cs, cp, bs) {
  return `
.wa-wrap{background:${bg};color:${fg}}
.wa-gradient{position:absolute;inset:0;background:linear-gradient(135deg,${bg},${accent}44,${bg});background-size:300% 300%;animation:waGrad 6s ease infinite}
.wa-dots{position:absolute;inset:0;opacity:.1}
.wa-dot{position:absolute;border-radius:50%;background:${fg};animation:waFloat 4s ease-in-out infinite}
.wa-content{position:absolute;${isSmall?'inset:0;display:flex;align-items:center;padding:0 12px;gap:10px':'inset:0;display:flex;flex-direction:column;justify-content:center;align-items:'+(isTall?'center;text-align:center':'flex-start')+';padding:20px'}}
.wa-logo{${isSmall?'width:22px;height:22px':'width:36px;height:36px'};object-fit:contain;opacity:0;animation:waPopIn .5s .3s forwards}
.wa-headline{font-size:${hs}px;font-weight:800;line-height:1.15;opacity:0;animation:waPopIn .6s .5s forwards;${isSmall?'flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis':'margin-top:8px'}}
.wa-sub{font-size:${ss}px;opacity:0;animation:waPopIn .5s .7s forwards;margin-top:4px;${isSmall?'display:none':''}}
.wa-cta{display:inline-block;margin-top:${isSmall?'0':'10px'};padding:${cp};background:${fg};color:${bg};border-radius:50px;font-size:${cs}px;font-weight:700;opacity:0;animation:waPopIn .5s .9s forwards;${isSmall?'margin-left:auto;white-space:nowrap':''}}
@keyframes waGrad{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes waFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes waPopIn{to{opacity:1}}`;
}

function generateGradientWaveHTML(brand, headline, sub, cta, logoUrl, isSmall, isTall) {
  // Generate a few floating dots for visual interest
  const dots = [
    { size: 6, x: 10, y: 20, delay: 0 },
    { size: 4, x: 80, y: 60, delay: 1 },
    { size: 8, x: 50, y: 80, delay: 2 },
    { size: 3, x: 90, y: 30, delay: 0.5 },
    { size: 5, x: 30, y: 70, delay: 1.5 }
  ];
  const dotsHtml = dots.map(d =>
    `<div class="wa-dot" style="width:${d.size}px;height:${d.size}px;left:${d.x}%;top:${d.y}%;animation-delay:${d.delay}s"></div>`
  ).join('');

  return `
<div class="wa-gradient"></div>
<div class="wa-dots">${dotsHtml}</div>
<div class="wa-content">
  ${logoUrl ? `<img class="wa-logo" src="${logoUrl}" alt="">` : ''}
  <div class="wa-headline">${headline}</div>
  <div class="wa-sub">${sub}</div>
  <span class="wa-cta">${cta}</span>
</div>`;
}

// ─── Helpers ────────────────────────────────────────────────────────

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = {
  generateBanner,
  BANNER_TEMPLATES,
  IAB_FORMATS
};
