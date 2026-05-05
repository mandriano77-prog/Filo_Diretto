// Video Builder — generates MP4 ad creatives using FFmpeg
// Produces 6-30 second animated video ads from brand assets + text overlays

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const VIDEO_FORMATS = {
  '1080x1920': { w: 1080, h: 1920, label: 'Story / Reel (9:16)', tier: 'social' },
  '1080x1080': { w: 1080, h: 1080, label: 'Feed Square (1:1)', tier: 'social' },
  '1920x1080': { w: 1920, h: 1080, label: 'Landscape (16:9)', tier: 'display' },
  '720x1280':  { w: 720,  h: 1280, label: 'Story SD (9:16)', tier: 'social' },
  '1200x628':  { w: 1200, h: 628,  label: 'Facebook/LinkedIn (1.91:1)', tier: 'social' },
  '300x250':   { w: 300,  h: 250,  label: 'Medium Rectangle Video', tier: 'display' },
  '640x480':   { w: 640,  h: 480,  label: 'Standard (4:3)', tier: 'display' }
};

const VIDEO_TEMPLATES = {
  'brand-reveal': {
    name: 'Brand Reveal',
    description: 'Logo emerge da sfondo, headline fade-in, CTA pulse',
    duration: 5,
    style: 'corporate'
  },
  'dynamic-text': {
    name: 'Dynamic Text',
    description: 'Testo animato parola per parola con accent color',
    duration: 4,
    style: 'modern'
  },
  'gradient-shift': {
    name: 'Gradient Shift',
    description: 'Background gradiente animato con testo overlay',
    duration: 5,
    style: 'vibrant'
  },
  'photo-kenburns': {
    name: 'Photo Ken Burns',
    description: 'Zoom lento su immagine background con overlay testo',
    duration: 6,
    style: 'editorial'
  }
};

/**
 * Generate an MP4 video ad
 * @param {Object} opts
 * @param {string} opts.headline - Main headline text
 * @param {string} opts.subheadline - Secondary text
 * @param {string} opts.ctaText - CTA text
 * @param {string} opts.brandName - Brand name for watermark
 * @param {string} opts.bgColor - Background hex color
 * @param {string} opts.fgColor - Foreground/text hex color
 * @param {string} opts.accentColor - Accent hex color for CTA
 * @param {string} opts.format - Format key (e.g. '1080x1920')
 * @param {string} opts.template - Template key
 * @param {string} opts.logoPath - Path to logo image (optional)
 * @param {string} opts.backgroundPath - Path to background image (optional)
 * @param {number} opts.duration - Override duration in seconds
 * @returns {Promise<{path: string, filename: string, width: number, height: number, duration: number}>}
 */
async function generateVideo(opts) {
  const fmt = VIDEO_FORMATS[opts.format] || VIDEO_FORMATS['1080x1080'];
  const w = fmt.w;
  const h = fmt.h;
  const template = opts.template || 'brand-reveal';
  const tmpl = VIDEO_TEMPLATES[template] || VIDEO_TEMPLATES['brand-reveal'];
  const duration = opts.duration || tmpl.duration;

  const bgColor = (opts.bgColor || '#000000').replace('#', '');
  const fgColor = (opts.fgColor || '#ffffff').replace('#', '');
  const accentColor = (opts.accentColor || '#7c3aed').replace('#', '');
  const headline = sanitizeText(opts.headline || '');
  const subheadline = sanitizeText(opts.subheadline || '');
  const ctaText = sanitizeText(opts.ctaText || 'Scopri di più');
  const brandName = sanitizeText(opts.brandName || '');

  const tmpDir = `/tmp/video-build-${uuidv4()}`;
  fs.mkdirSync(tmpDir, { recursive: true });

  const outputFile = `${tmpDir}/output.mp4`;

  try {
    let ffmpegCmd;

    if (template === 'brand-reveal') {
      ffmpegCmd = buildBrandReveal({ w, h, duration, bgColor, fgColor, accentColor, headline, subheadline, ctaText, brandName, logoPath: opts.logoPath, backgroundPath: opts.backgroundPath, tmpDir, outputFile });
    } else if (template === 'dynamic-text') {
      ffmpegCmd = buildDynamicText({ w, h, duration, bgColor, fgColor, accentColor, headline, subheadline, ctaText, brandName, tmpDir, outputFile });
    } else if (template === 'gradient-shift') {
      ffmpegCmd = buildGradientShift({ w, h, duration, bgColor, fgColor, accentColor, headline, subheadline, ctaText, brandName, tmpDir, outputFile });
    } else if (template === 'photo-kenburns') {
      ffmpegCmd = buildPhotoKenBurns({ w, h, duration, bgColor, fgColor, accentColor, headline, subheadline, ctaText, brandName, backgroundPath: opts.backgroundPath, tmpDir, outputFile });
    } else {
      ffmpegCmd = buildBrandReveal({ w, h, duration, bgColor, fgColor, accentColor, headline, subheadline, ctaText, brandName, logoPath: opts.logoPath, backgroundPath: opts.backgroundPath, tmpDir, outputFile });
    }

    // Execute FFmpeg — timeout scales with duration (min 30s, max 120s)
    const timeout = Math.max(30000, Math.min(120000, duration * 5000));
    execSync(ffmpegCmd, { stdio: 'pipe', timeout });

    if (!fs.existsSync(outputFile)) {
      throw new Error('FFmpeg did not produce output file');
    }

    const stats = fs.statSync(outputFile);
    return {
      path: outputFile,
      filename: `ad-${template}-${w}x${h}.mp4`,
      width: w,
      height: h,
      duration,
      size: stats.size,
      tmpDir
    };
  } catch (err) {
    // Cleanup on error
    try { fs.rmSync(tmpDir, { recursive: true }); } catch(e) {}
    throw new Error(`Video generation failed: ${err.message}`);
  }
}

// ─── Template: Brand Reveal ─────────────────────────────────────────
function buildBrandReveal({ w, h, duration, bgColor, fgColor, accentColor, headline, subheadline, ctaText, brandName, logoPath, backgroundPath, tmpDir, outputFile }) {
  const fps = 30;
  const isVertical = h > w;
  const headlineSize = isVertical ? Math.floor(w / 14) : Math.floor(w / 22);
  const subSize = Math.floor(headlineSize * 0.6);
  const ctaSize = Math.floor(headlineSize * 0.55);
  const brandSize = Math.floor(headlineSize * 0.4);

  // Text Y positions
  const headlineY = isVertical ? Math.floor(h * 0.45) : Math.floor(h * 0.4);
  const subY = headlineY + headlineSize + 20;
  const ctaY = subY + subSize + 30;
  const brandY = h - 60;

  // Build filter complex
  let filters = [];
  let inputs = '';

  if (backgroundPath && fs.existsSync(backgroundPath)) {
    inputs = `-loop 1 -i "${backgroundPath}" `;
    filters.push(`[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},zoompan=z='min(zoom+0.0005,1.08)':d=${duration*fps}:s=${w}x${h}:fps=${fps},format=yuv420p[bg]`);
  } else {
    inputs = `-f lavfi -i "color=c=0x${bgColor}:s=${w}x${h}:d=${duration}:r=${fps}" `;
    filters.push(`[0:v]format=yuv420p[bg]`);
  }

  // Text overlays with fade-in timing
  const drawOpts = `fontcolor=0x${fgColor}:fontsize=${headlineSize}:x=(w-text_w)/2`;
  filters.push(`[bg]drawtext=text='${headline}':${drawOpts}:y=${headlineY}:alpha='if(lt(t,0.8),0,min((t-0.8)/0.5,1))'[t1]`);

  if (subheadline) {
    filters.push(`[t1]drawtext=text='${subheadline}':fontcolor=0x${fgColor}@0.7:fontsize=${subSize}:x=(w-text_w)/2:y=${subY}:alpha='if(lt(t,1.3),0,min((t-1.3)/0.5,1))'[t2]`);
  } else {
    filters.push(`[t1]null[t2]`);
  }

  // CTA with accent background (simulated with drawbox + text)
  const ctaPad = 20;
  filters.push(`[t2]drawbox=x='(w-${ctaText.length*ctaSize*0.55+ctaPad*2})/2':y=${ctaY-8}:w='${ctaText.length*ctaSize*0.55+ctaPad*2}':h=${ctaSize+20}:color=0x${accentColor}@0.9:t=fill:enable='gte(t,1.8)'[t3]`);
  filters.push(`[t3]drawtext=text='${ctaText}':fontcolor=0xffffff:fontsize=${ctaSize}:x=(w-text_w)/2:y=${ctaY}:alpha='if(lt(t,1.8),0,min((t-1.8)/0.4,1))'[t4]`);

  // Brand watermark
  if (brandName) {
    filters.push(`[t4]drawtext=text='${brandName}':fontcolor=0x${fgColor}@0.5:fontsize=${brandSize}:x=(w-text_w)/2:y=${brandY}:alpha='if(lt(t,2.5),0,min((t-2.5)/0.5,1))'[out]`);
  } else {
    filters.push(`[t4]null[out]`);
  }

  // Final fade out in last 0.5s
  const fadeStart = duration - 0.5;
  const finalFilter = filters.join(';') + `;[out]fade=t=out:st=${fadeStart}:d=0.5[final]`;

  return `ffmpeg -y ${inputs}-filter_complex "${finalFilter}" -map "[final]" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -t ${duration} -movflags +faststart "${outputFile}"`;
}

// ─── Template: Dynamic Text ─────────────────────────────────────────
function buildDynamicText({ w, h, duration, bgColor, fgColor, accentColor, headline, subheadline, ctaText, brandName, tmpDir, outputFile }) {
  const fps = 30;
  const isVertical = h > w;
  const headlineSize = isVertical ? Math.floor(w / 10) : Math.floor(w / 16);
  const subSize = Math.floor(headlineSize * 0.5);
  const ctaSize = Math.floor(headlineSize * 0.5);

  // Split headline into words for sequential reveal
  const words = headline.split(' ');
  const wordDuration = Math.min(0.6, (duration - 2) / Math.max(words.length, 1));

  let filters = [];
  filters.push(`[0:v]format=yuv420p[bg]`);

  // Accent line (static, centered)
  const lineX = Math.floor(w / 4);
  const lineY = Math.floor(h / 2) - 2;
  const lineW = Math.floor(w / 2);
  filters.push(`[bg]drawbox=x=${lineX}:y=${lineY}:w=${lineW}:h=4:color=0x${accentColor}:t=fill[line]`);

  // Each word appears sequentially
  let lastLabel = 'line';
  words.forEach((word, i) => {
    const start = 0.5 + i * wordDuration;
    const yPos = isVertical ? Math.floor(h * 0.35) + i * (headlineSize + 10) : Math.floor(h * 0.4);
    const xPos = isVertical ? `(w-text_w)/2` : `${Math.floor(w * 0.1) + i * Math.floor(w / (words.length + 1))}`;
    const nextLabel = `w${i}`;
    filters.push(`[${lastLabel}]drawtext=text='${sanitizeText(word)}':fontcolor=0x${fgColor}:fontsize=${headlineSize}:x=${xPos}:y=${yPos}:alpha='if(lt(t,${start}),0,min((t-${start})/0.3,1))'[${nextLabel}]`);
    lastLabel = nextLabel;
  });

  // Subheadline
  const subStart = 0.5 + words.length * wordDuration + 0.3;
  const subY = isVertical ? Math.floor(h * 0.65) : Math.floor(h * 0.6);
  if (subheadline) {
    filters.push(`[${lastLabel}]drawtext=text='${subheadline}':fontcolor=0x${fgColor}@0.7:fontsize=${subSize}:x=(w-text_w)/2:y=${subY}:alpha='if(lt(t,${subStart}),0,min((t-${subStart})/0.4,1))'[sub]`);
    lastLabel = 'sub';
  }

  // CTA
  const ctaStart = subStart + 0.5;
  const ctaY = isVertical ? Math.floor(h * 0.75) : Math.floor(h * 0.72);
  filters.push(`[${lastLabel}]drawtext=text='${ctaText}':fontcolor=0x${accentColor}:fontsize=${ctaSize}:x=(w-text_w)/2:y=${ctaY}:alpha='if(lt(t,${ctaStart}),0,min((t-${ctaStart})/0.3,1))'[cta]`);

  // Fade out
  const fadeStart = duration - 0.5;
  filters.push(`[cta]fade=t=out:st=${fadeStart}:d=0.5[final]`);

  const filterStr = filters.join(';');
  return `ffmpeg -y -f lavfi -i "color=c=0x${bgColor}:s=${w}x${h}:d=${duration}:r=${fps}" -filter_complex "${filterStr}" -map "[final]" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -t ${duration} -movflags +faststart "${outputFile}"`;
}

// ─── Template: Gradient Shift ───────────────────────────────────────
function buildGradientShift({ w, h, duration, bgColor, fgColor, accentColor, headline, subheadline, ctaText, brandName, tmpDir, outputFile }) {
  const fps = 30;
  const isVertical = h > w;
  const headlineSize = isVertical ? Math.floor(w / 12) : Math.floor(w / 18);
  const subSize = Math.floor(headlineSize * 0.55);
  const ctaSize = Math.floor(headlineSize * 0.5);

  // Create gradient frames using geq (gradient equation)
  const headlineY = isVertical ? Math.floor(h * 0.4) : Math.floor(h * 0.38);
  const subY = headlineY + headlineSize + 20;
  const ctaY = subY + (subheadline ? subSize + 30 : 15);

  // Animated gradient via hue rotation
  let filters = [];
  filters.push(`color=c=0x${bgColor}:s=${w}x${h}:d=${duration}:r=${fps}[base]`);
  filters.push(`color=c=0x${accentColor}:s=${w}x${h}:d=${duration}:r=${fps}[accent]`);
  filters.push(`[base][accent]blend=all_expr='A*(1-abs(sin(T*0.5)))+B*abs(sin(T*0.5))'[grad]`);

  // Text overlays
  filters.push(`[grad]drawtext=text='${headline}':fontcolor=0x${fgColor}:fontsize=${headlineSize}:x=(w-text_w)/2:y=${headlineY}:alpha='if(lt(t,0.5),0,min((t-0.5)/0.6,1))'[t1]`);

  if (subheadline) {
    filters.push(`[t1]drawtext=text='${subheadline}':fontcolor=0x${fgColor}@0.8:fontsize=${subSize}:x=(w-text_w)/2:y=${subY}:alpha='if(lt(t,1.2),0,min((t-1.2)/0.5,1))'[t2]`);
  } else {
    filters.push(`[t1]null[t2]`);
  }

  // CTA
  filters.push(`[t2]drawbox=x='(w-${ctaText.length*ctaSize*0.55+40})/2':y=${ctaY-8}:w='${ctaText.length*ctaSize*0.55+40}':h=${ctaSize+20}:color=0x${fgColor}@0.9:t=fill:enable='gte(t,2)'[t3]`);
  filters.push(`[t3]drawtext=text='${ctaText}':fontcolor=0x${bgColor}:fontsize=${ctaSize}:x=(w-text_w)/2:y=${ctaY}:alpha='if(lt(t,2),0,min((t-2)/0.3,1))'[t4]`);

  // Brand
  if (brandName) {
    filters.push(`[t4]drawtext=text='${brandName}':fontcolor=0x${fgColor}@0.4:fontsize=${Math.floor(headlineSize*0.35)}:x=(w-text_w)/2:y=${h-50}:alpha='if(lt(t,2.5),0,min((t-2.5)/0.5,1))'[t5]`);
  } else {
    filters.push(`[t4]null[t5]`);
  }

  const fadeStart = duration - 0.5;
  filters.push(`[t5]fade=t=out:st=${fadeStart}:d=0.5[final]`);

  const filterStr = filters.join(';');
  return `ffmpeg -y -f lavfi -i "color=c=0x${bgColor}:s=${w}x${h}:d=${duration}:r=${fps}" -f lavfi -i "color=c=0x${accentColor}:s=${w}x${h}:d=${duration}:r=${fps}" -filter_complex "${filterStr}" -map "[final]" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -t ${duration} -movflags +faststart "${outputFile}"`;
}

// ─── Template: Photo Ken Burns ──────────────────────────────────────
function buildPhotoKenBurns({ w, h, duration, bgColor, fgColor, accentColor, headline, subheadline, ctaText, brandName, backgroundPath, tmpDir, outputFile }) {
  const fps = 30;
  const isVertical = h > w;
  const headlineSize = isVertical ? Math.floor(w / 12) : Math.floor(w / 18);
  const subSize = Math.floor(headlineSize * 0.55);
  const ctaSize = Math.floor(headlineSize * 0.5);

  const headlineY = isVertical ? Math.floor(h * 0.55) : Math.floor(h * 0.5);
  const subY = headlineY + headlineSize + 16;
  const ctaY = subY + (subheadline ? subSize + 24 : 10);

  let inputs, filters = [];

  if (backgroundPath && fs.existsSync(backgroundPath)) {
    inputs = `-loop 1 -i "${backgroundPath}" `;
    // Ken Burns zoom effect
    filters.push(`[0:v]scale=${Math.floor(w*1.2)}:${Math.floor(h*1.2)},zoompan=z='1.0+0.001*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${duration*fps}:s=${w}x${h}:fps=${fps}[kb]`);
    // Dark overlay for text readability
    filters.push(`[kb]drawbox=x=0:y=0:w=${w}:h=${h}:color=0x000000@0.4:t=fill[bg]`);
  } else {
    inputs = `-f lavfi -i "color=c=0x${bgColor}:s=${w}x${h}:d=${duration}:r=${fps}" `;
    filters.push(`[0:v]null[bg]`);
  }

  // Text overlays
  filters.push(`[bg]drawtext=text='${headline}':fontcolor=0x${fgColor}:fontsize=${headlineSize}:x=(w-text_w)/2:y=${headlineY}:alpha='if(lt(t,1),0,min((t-1)/0.7,1))'[t1]`);

  if (subheadline) {
    filters.push(`[t1]drawtext=text='${subheadline}':fontcolor=0x${fgColor}@0.8:fontsize=${subSize}:x=(w-text_w)/2:y=${subY}:alpha='if(lt(t,1.8),0,min((t-1.8)/0.5,1))'[t2]`);
  } else {
    filters.push(`[t1]null[t2]`);
  }

  // CTA
  filters.push(`[t2]drawbox=x='(w-${ctaText.length*ctaSize*0.55+40})/2':y=${ctaY-8}:w='${ctaText.length*ctaSize*0.55+40}':h=${ctaSize+20}:color=0x${accentColor}@0.85:t=fill:enable='gte(t,2.5)'[t3]`);
  filters.push(`[t3]drawtext=text='${ctaText}':fontcolor=0xffffff:fontsize=${ctaSize}:x=(w-text_w)/2:y=${ctaY}:alpha='if(lt(t,2.5),0,min((t-2.5)/0.3,1))'[t4]`);

  if (brandName) {
    filters.push(`[t4]drawtext=text='${brandName}':fontcolor=0x${fgColor}@0.5:fontsize=${Math.floor(headlineSize*0.35)}:x=(w-text_w)/2:y=${h-50}:alpha='if(lt(t,3),0,min((t-3)/0.5,1))'[t5]`);
  } else {
    filters.push(`[t4]null[t5]`);
  }

  const fadeStart = duration - 0.7;
  filters.push(`[t5]fade=t=in:st=0:d=0.5,fade=t=out:st=${fadeStart}:d=0.7[final]`);

  const filterStr = filters.join(';');
  return `ffmpeg -y ${inputs}-filter_complex "${filterStr}" -map "[final]" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -t ${duration} -movflags +faststart "${outputFile}"`;
}

// ─── Helpers ────────────────────────────────────────────────────────

function sanitizeText(text) {
  // Escape characters that break FFmpeg drawtext
  return String(text || '')
    .replace(/\\/g, '\\\\\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/%/g, '%%')
    .replace(/\n/g, ' ');
}

/**
 * Cleanup temp directory after video has been read/sent
 */
function cleanupVideo(tmpDir) {
  try { fs.rmSync(tmpDir, { recursive: true }); } catch(e) {}
}

module.exports = {
  generateVideo,
  cleanupVideo,
  VIDEO_FORMATS,
  VIDEO_TEMPLATES
};
