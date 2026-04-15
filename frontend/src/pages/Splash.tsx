import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';

// ── Easing helpers ──────────────────────────────────────────────────────────
function easeOutCubic(t: number): number { return 1 - Math.pow(1 - t, 3); }
function easeInOutQuart(t: number): number { return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2; }
function easeOutBack(t: number): number { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

export default function Splash() {
  const navigate = useNavigate();
  const { setPortal } = useTheme();

  useEffect(() => { setPortal('auth'); }, [setPortal]);

  const bgRef   = useRef<HTMLCanvasElement>(null);
  const scRef   = useRef<HTMLCanvasElement>(null);
  const apertureRef  = useRef<HTMLDivElement>(null);
  const scanLineRef  = useRef<HTMLDivElement>(null);
  const vfRef        = useRef<HTMLDivElement>(null);
  const logoGroupRef = useRef<HTMLDivElement>(null);
  const brandMainRef = useRef<HTMLDivElement>(null);
  const brandTagRef  = useRef<HTMLDivElement>(null);
  const loadTrackRef = useRef<HTMLDivElement>(null);
  const loadFillRef  = useRef<HTMLDivElement>(null);
  const lensGlowRef  = useRef<HTMLDivElement>(null);
  const recIndRef    = useRef<HTMLDivElement>(null);
  const timecodeRef  = useRef<HTMLDivElement>(null);
  const bottomLblRef = useRef<HTMLDivElement>(null);
  const flashRef     = useRef<HTMLDivElement>(null);
  const skipRef      = useRef<HTMLButtonElement>(null);

  const exitingRef = useRef(false);

  const goToApp = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;

    const rec = recIndRef.current;
    const tc  = timecodeRef.current;
    const lt  = loadTrackRef.current;
    const sk  = skipRef.current;
    const bl  = bottomLblRef.current;
    const lg  = logoGroupRef.current;
    const fl  = flashRef.current;

    if (rec) { rec.style.transition = 'opacity 0.25s ease'; rec.style.opacity = '0'; }
    if (tc)  { tc.style.transition  = 'opacity 0.25s ease'; tc.style.opacity  = '0'; }
    if (lt)  lt.style.opacity = '0';
    if (sk)  sk.style.opacity = '0';
    if (bl)  bl.style.opacity = '0';
    if (lg) {
      lg.style.transition = 'transform 0.7s ease, opacity 0.7s ease, filter 0.7s ease';
      lg.style.transform  = 'scale(1.2) translateY(-10px)';
      lg.style.filter     = 'blur(6px)';
      lg.style.opacity    = '0';
    }
    setTimeout(() => {
      if (fl) { fl.style.transition = 'opacity 0.5s ease'; fl.style.opacity = '1'; }
    }, 350);
    setTimeout(() => {
      const tok     = localStorage.getItem('shotzoo_token');
      const isAdmin = localStorage.getItem('shotzoo_admin') === 'true';
      if (!tok)     navigate('/landing', { replace: true });
      else if (isAdmin) navigate('/admin/attendance', { replace: true });
      else          navigate('/employee/dashboard', { replace: true });
    }, 750);
  }, [navigate]);

  useEffect(() => {
    const bgCanvas = bgRef.current;
    const scCanvas = scRef.current;
    if (!bgCanvas || !scCanvas) return;

    const bgCtx = bgCanvas.getContext('2d')!;
    const scCtx = scCanvas.getContext('2d')!;
    let W = 0, H = 0, dpr = 1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      [bgCanvas!, scCanvas!].forEach(c => {
        c.width  = W * dpr; c.height = H * dpr;
        c.style.width  = W + 'px'; c.style.height = H + 'px';
        c.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
      });
    }
    resize();
    window.addEventListener('resize', resize);

    // ── Stars ──
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * 2, y: Math.random() * 0.9,
      r: Math.random() * 1.2 + 0.2, a: Math.random() * 0.4 + 0.05,
      pulse: Math.random() * Math.PI * 2, speed: Math.random() * 0.008 + 0.002,
    }));
    const glowParticles = Array.from({ length: 50 }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0003, vy: -(Math.random() * 0.0004 + 0.0001),
      r: Math.random() * 2 + 0.8, a: Math.random() * 0.12 + 0.03,
      pulse: Math.random() * Math.PI * 2,
    }));

    // ── Trees ──
    interface Tree { x: number; baseY: number; scale: number; sway: number; swayAmt: number; alpha: number; kind: string; }
    const trees: Tree[] = [
      { x: 0.02, baseY: 1.0, scale: 0.22, sway: 0,   swayAmt: 0.008, alpha: 0, kind: 'jungle' },
      { x: 0.06, baseY: 1.0, scale: 0.30, sway: 1,   swayAmt: 0.006, alpha: 0, kind: 'palm' },
      { x: 0.11, baseY: 1.0, scale: 0.18, sway: 2,   swayAmt: 0.01,  alpha: 0, kind: 'jungle' },
      { x: 0.15, baseY: 1.0, scale: 0.25, sway: 0.5, swayAmt: 0.007, alpha: 0, kind: 'bush' },
      { x: 0.18, baseY: 1.0, scale: 0.20, sway: 3,   swayAmt: 0.009, alpha: 0, kind: 'palm' },
      { x: 0.82, baseY: 1.0, scale: 0.24, sway: 1,   swayAmt: 0.007, alpha: 0, kind: 'palm' },
      { x: 0.87, baseY: 1.0, scale: 0.18, sway: 0,   swayAmt: 0.008, alpha: 0, kind: 'bush' },
      { x: 0.91, baseY: 1.0, scale: 0.28, sway: 2,   swayAmt: 0.006, alpha: 0, kind: 'jungle' },
      { x: 0.95, baseY: 1.0, scale: 0.22, sway: 0.8, swayAmt: 0.009, alpha: 0, kind: 'palm' },
      { x: 0.99, baseY: 1.0, scale: 0.20, sway: 1.5, swayAmt: 0.007, alpha: 0, kind: 'jungle' },
      { x: 0.0,  baseY: 1.0, scale: 0.35, sway: 0.2, swayAmt: 0.005, alpha: 0, kind: 'big' },
      { x: 0.96, baseY: 1.0, scale: 0.33, sway: 1.8, swayAmt: 0.005, alpha: 0, kind: 'big' },
    ];

    // ── Ad objects ──
    interface AdObj { type: string; x: number; y: number; scale: number; angle: number; alpha: number; pulse: number; bobPhase: number; }
    const adObjects: AdObj[] = [
      { type: 'billboard', x: 0.14, y: 0.38, scale: 0.11, angle: -0.08, alpha: 0, pulse: 0, bobPhase: Math.random() * Math.PI * 2 },
      { type: 'billboard', x: 0.86, y: 0.42, scale: 0.10, angle: 0.07,  alpha: 0, pulse: 1, bobPhase: Math.random() * Math.PI * 2 },
      { type: 'megaphone', x: 0.22, y: 0.22, scale: 0.08, angle: 0.15,  alpha: 0, pulse: 2, bobPhase: Math.random() * Math.PI * 2 },
      { type: 'filmstrip', x: 0.78, y: 0.20, scale: 0.09, angle: -0.1,  alpha: 0, pulse: 0, bobPhase: Math.random() * Math.PI * 2 },
      { type: 'camera',    x: 0.50, y: 0.12, scale: 0.06, angle: 0,     alpha: 0, pulse: 1, bobPhase: Math.random() * Math.PI * 2 },
      { type: 'starburst', x: 0.80, y: 0.60, scale: 0.07, angle: 0,     alpha: 0, pulse: 3, bobPhase: Math.random() * Math.PI * 2 },
      { type: 'starburst', x: 0.20, y: 0.62, scale: 0.065, angle: 0,    alpha: 0, pulse: 2, bobPhase: Math.random() * Math.PI * 2 },
    ];

    // ── Draw helpers ──
    function drawPalm(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, sway: number, alpha: number) {
      if (alpha <= 0) return;
      ctx.save(); ctx.globalAlpha = alpha;
      const h = H * scale, sw = Math.sin(sway) * 8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x+sw*0.3, y-h*0.35, x+sw*0.6+10, y-h*0.65, x+sw*0.9, y-h);
      ctx.lineWidth = Math.max(2, scale * H * 0.035); ctx.strokeStyle = '#2d1a06'; ctx.lineCap = 'round'; ctx.stroke();
      const tx = x + sw * 0.9, ty = y - h;
      const fronds = [{ a: -0.5, len: 1.0, droop: 0.35 }, { a: 0.4, len: 0.95, droop: 0.3 }, { a: -1.3, len: 0.85, droop: 0.45 }, { a: 1.2, len: 0.88, droop: 0.4 }, { a: -2.1, len: 0.75, droop: 0.5 }, { a: 2.0, len: 0.7, droop: 0.5 }, { a: -2.9, len: 0.6, droop: 0.55 }, { a: Math.PI, len: 0.65, droop: 0.4 }];
      const fl = h * 0.7;
      fronds.forEach(f => {
        const fa = f.a + sway * 0.15;
        const endX = tx + Math.cos(fa) * fl * f.len, endY = ty + Math.sin(fa) * fl * f.len;
        const cpX = tx + Math.cos(fa) * fl * f.len * 0.5, cpY = ty + Math.sin(fa) * fl * f.len * 0.5 + fl * f.droop;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        ctx.strokeStyle = '#2d5e0e'; ctx.lineWidth = Math.max(1.5, scale * H * 0.018); ctx.lineCap = 'round'; ctx.stroke();
        for (let s = 2; s < 6; s++) {
          const t2 = s / 6;
          const lx = (1-t2)*(1-t2)*tx + 2*(1-t2)*t2*cpX + t2*t2*endX;
          const ly = (1-t2)*(1-t2)*ty + 2*(1-t2)*t2*cpY + t2*t2*endY;
          const lw = (1 - t2) * fl * 0.18 * scale, la = fa + Math.PI / 2;
          ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + Math.cos(la)*lw, ly + Math.sin(la)*lw); ctx.lineTo(lx - Math.cos(la)*lw, ly - Math.sin(la)*lw);
          ctx.fillStyle = t2 > 0.5 ? '#3d7a14' : '#4a9418'; ctx.fill();
        }
      });
      ctx.restore();
    }

    function drawJungle(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, sway: number, alpha: number) {
      if (alpha <= 0) return;
      ctx.save(); ctx.globalAlpha = alpha;
      const h = H * scale, sw = Math.sin(sway) * 6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sw * 0.5, y - h * 0.5);
      ctx.lineWidth = Math.max(3, scale * H * 0.045); ctx.strokeStyle = '#1e0f04'; ctx.lineCap = 'round'; ctx.stroke();
      [{ dy: 0.85, r: 0.13, c: '#1e4d08' }, { dy: 0.75, r: 0.15, c: '#256010' }, { dy: 0.65, r: 0.13, c: '#2d7212' }, { dy: 0.55, r: 0.10, c: '#35881a' }, { dy: 0.45, r: 0.08, c: '#3d9a20' }].forEach(l => {
        const cx2 = x + sw * l.dy * 0.4, cy2 = y - h * l.dy, r = H * l.r * scale;
        for (let b = 0; b < 3; b++) { ctx.beginPath(); ctx.ellipse(cx2 + (b - 1)*r*0.4, cy2 + b*r*0.1, r*(0.8+b*0.1), r*0.75, sway*0.05, 0, Math.PI*2); ctx.fillStyle = l.c; ctx.fill(); }
      });
      ctx.restore();
    }

    function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, sway: number, alpha: number) {
      if (alpha <= 0) return;
      ctx.save(); ctx.globalAlpha = alpha;
      const r = H * scale * 0.3, sw = Math.sin(sway) * 4;
      [{ ox: 0, oy: 0, rx: 1.2, ry: 0.8, c: '#2a5e0e' }, { ox: -r*0.4, oy: r*0.15, rx: 0.9, ry: 0.7, c: '#346814' }, { ox: r*0.4, oy: r*0.1, rx: 0.9, ry: 0.7, c: '#3d7a18' }, { ox: 0, oy: -r*0.2, rx: 0.8, ry: 0.65, c: '#448e1c' }].forEach(b => {
        ctx.beginPath(); ctx.ellipse(x + b.ox + sw*0.3, y - r*0.4 + b.oy, r*b.rx, r*b.ry, sway*0.05, 0, Math.PI*2); ctx.fillStyle = b.c; ctx.fill();
      });
      ctx.restore();
    }

    function drawBigTree(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, sway: number, alpha: number) {
      if (alpha <= 0) return;
      ctx.save(); ctx.globalAlpha = alpha * 0.9;
      const h = H * scale, sw = Math.sin(sway) * 5;
      ctx.beginPath(); ctx.moveTo(x - H*scale*0.04, y); ctx.lineTo(x + H*scale*0.04, y); ctx.lineTo(x + H*scale*0.025 + sw*0.4, y - h*0.7); ctx.lineTo(x - H*scale*0.025 + sw*0.4, y - h*0.7); ctx.closePath(); ctx.fillStyle = '#150a03'; ctx.fill();
      const cx2 = x + sw * 0.4, cy2 = y - h * 0.78, rr = H * scale * 0.4;
      ctx.beginPath(); ctx.ellipse(cx2, cy2, rr*1.1, rr, sway*0.02, 0, Math.PI*2); ctx.fillStyle = '#162d06'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx2 - rr*0.3, cy2 + rr*0.1, rr*0.9, rr*0.8, 0, 0, Math.PI*2); ctx.fillStyle = '#1a3608'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx2 + rr*0.3, cy2 - rr*0.1, rr*0.85, rr*0.75, 0, 0, Math.PI*2); ctx.fillStyle = '#1e3e0a'; ctx.fill();
      ctx.restore();
    }

    function drawBillboard(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, alpha: number, t: number) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle + Math.sin(t * 0.8) * 0.03); ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.moveTo(0, size*0.3); ctx.lineTo(0, size*1.1); ctx.lineWidth = size*0.05; ctx.strokeStyle = '#5a4a2a'; ctx.lineCap = 'round'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(size*0.2, size*0.5); ctx.lineTo(size*0.15, size*1.1); ctx.lineWidth = size*0.035; ctx.strokeStyle = '#4a3a20'; ctx.stroke();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- roundRect is newer API
      (ctx as any).roundRect(-size*0.75, -size*0.6, size*1.5, size*0.9, size*0.05); ctx.fillStyle = '#1a2a0a'; ctx.fill(); ctx.strokeStyle = '#A8CD62'; ctx.lineWidth = size*0.025; ctx.stroke();
      ctx.font = 'bold ' + Math.round(size*0.45) + 'px Space Grotesk, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#A8CD62'; ctx.fillText('AD', 0, -size*0.15);
      ctx.font = 'bold ' + Math.round(size*0.18) + 'px Space Grotesk, sans-serif'; ctx.fillStyle = 'rgba(168,205,98,0.5)'; ctx.fillText('SHOTZOO', 0, size*0.2);
      ctx.restore();
    }

    function drawMegaphone(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, alpha: number, t: number) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle + Math.sin(t * 1.1) * 0.04); ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.moveTo(-size*0.6, -size*0.15); ctx.lineTo(size*0.25, -size*0.35); ctx.lineTo(size*0.25, size*0.35); ctx.lineTo(-size*0.6, size*0.15); ctx.closePath(); ctx.fillStyle = '#A8CD62'; ctx.fill();
      ctx.beginPath(); (ctx as unknown as { roundRect: (...a: number[]) => void }).roundRect(-size*0.55, -size*0.12, size*0.2, size*0.24, size*0.04); ctx.fillStyle = '#6aad20'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(size*0.25, -size*0.45); ctx.lineTo(size*0.65, -size*0.7); ctx.lineTo(size*0.65, size*0.7); ctx.lineTo(size*0.25, size*0.45); ctx.closePath(); ctx.fillStyle = '#7dc030'; ctx.fill(); ctx.strokeStyle = '#A8CD62'; ctx.lineWidth = size*0.025; ctx.stroke();
      for (let w = 1; w <= 3; w++) { const wr = w * size * 0.3, pulse = (Math.sin(t * 2 + w) * 0.3 + 0.7); ctx.beginPath(); ctx.arc(size*0.65, 0, wr, -Math.PI*0.55, Math.PI*0.55); ctx.strokeStyle = 'rgba(168,205,98,' + (0.5*pulse/w) + ')'; ctx.lineWidth = size*0.03; ctx.stroke(); }
      ctx.restore();
    }

    function drawCamera(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, alpha: number, t: number) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle + Math.sin(t * 0.9) * 0.025); ctx.globalAlpha = alpha;
      ctx.beginPath(); (ctx as unknown as { roundRect: (...a: number[]) => void }).roundRect(-size, -size*0.65, size*2, size*1.3, size*0.18); ctx.fillStyle = '#1a1a0a'; ctx.fill(); ctx.strokeStyle = 'rgba(168,205,98,0.4)'; ctx.lineWidth = size*0.04; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, size*0.1, size*0.5, 0, Math.PI*2); ctx.fillStyle = '#0d1a06'; ctx.fill(); ctx.strokeStyle = 'rgba(168,205,98,0.25)'; ctx.lineWidth = size*0.04; ctx.stroke();
      [0.38, 0.27, 0.16].forEach((r, i) => { ctx.beginPath(); ctx.arc(0, size*0.1, size*r, 0, Math.PI*2); ctx.strokeStyle = 'rgba(168,205,98,' + (0.12 + i*0.06) + ')'; ctx.lineWidth = size*0.025; ctx.stroke(); });
      ctx.beginPath(); ctx.arc(0, size*0.1, size*0.07, 0, Math.PI*2); ctx.fillStyle = 'rgba(168,205,98,0.6)'; ctx.fill();
      ctx.restore();
    }

    function drawFilmStrip(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, alpha: number, t: number) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle + Math.sin(t * 0.7) * 0.025); ctx.globalAlpha = alpha;
      const w = size * 2.2, h = size * 1.1;
      ctx.beginPath(); (ctx as unknown as { roundRect: (...a: number[]) => void }).roundRect(-w/2, -h/2, w, h, size*0.06); ctx.fillStyle = '#1a1a10'; ctx.fill(); ctx.strokeStyle = 'rgba(168,205,98,0.3)'; ctx.lineWidth = size*0.03; ctx.stroke();
      for (let n = 0; n < 5; n++) { const hx = -w*0.4 + n*(w*0.8/4); ctx.beginPath(); (ctx as unknown as { roundRect: (...a: number[]) => void }).roundRect(hx - size*0.06, -h/2 + size*0.05, size*0.12, size*0.16, size*0.03); ctx.fillStyle = '#0a0a06'; ctx.fill(); ctx.beginPath(); (ctx as unknown as { roundRect: (...a: number[]) => void }).roundRect(hx - size*0.06, h/2 - size*0.21, size*0.12, size*0.16, size*0.03); ctx.fillStyle = '#0a0a06'; ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(-size*0.12, -size*0.18); ctx.lineTo(size*0.18, 0); ctx.lineTo(-size*0.12, size*0.18); ctx.closePath(); ctx.fillStyle = 'rgba(168,205,98,0.7)'; ctx.fill();
      ctx.restore();
    }

    function drawStarburst(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number, t: number) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.4); ctx.globalAlpha = alpha;
      const points = 8, outer = size, inner = size * 0.45;
      ctx.beginPath();
      for (let p = 0; p < points * 2; p++) { const r2 = p % 2 === 0 ? outer : inner, a2 = (p * Math.PI) / points - Math.PI / 2; p === 0 ? ctx.moveTo(Math.cos(a2)*r2, Math.sin(a2)*r2) : ctx.lineTo(Math.cos(a2)*r2, Math.sin(a2)*r2); }
      ctx.closePath();
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, outer); g.addColorStop(0, 'rgba(168,205,98,0.9)'); g.addColorStop(0.5, 'rgba(120,180,50,0.7)'); g.addColorStop(1, 'rgba(80,140,20,0.3)');
      ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, size*0.3, 0, Math.PI*2); ctx.fillStyle = 'rgba(210,240,130,0.8)'; ctx.fill();
      ctx.font = 'bold ' + Math.round(size*0.3) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#1a3a06'; ctx.fillText('%', 0, 1);
      ctx.restore();
    }

    // ── Burst particles ──
    interface BurstP { x: number; y: number; vx: number; vy: number; r: number; a: number; decay: number; isLeaf: boolean; rot: number; rotSpd: number; green: boolean; }
    let burst: BurstP[] = [];
    let burstDone = false;
    function triggerBurst() {
      if (burstDone) return; burstDone = true;
      const cx = W / 2, cy = H / 2;
      for (let k = 0; k < 80; k++) {
        const a = Math.random() * Math.PI * 2, spd = Math.random() * 5 + 2, isLeaf = k < 20;
        burst.push({ x: cx, y: cy, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd, r: isLeaf ? Math.random()*5+3 : Math.random()*2.5+0.8, a: 1, decay: Math.random()*0.014+0.007, isLeaf, rot: Math.random()*Math.PI*2, rotSpd: (Math.random()-0.5)*0.12, green: Math.random() > 0.25 });
      }
    }

    let time = 0, treeRevealStart = -1, adRevealStart = -1;
    let rafId: number;

    function render() {
      if (exitingRef.current) return;
      time += 0.016;

      bgCtx.clearRect(0, 0, W, H);
      const skyGrad = bgCtx.createLinearGradient(0, 0, 0, H * 0.85);
      skyGrad.addColorStop(0, '#020a01'); skyGrad.addColorStop(0.5, '#061205'); skyGrad.addColorStop(1, '#0e1e08');
      bgCtx.fillStyle = skyGrad; bgCtx.fillRect(0, 0, W, H * 0.85);
      const gndGrad = bgCtx.createLinearGradient(0, H * 0.8, 0, H);
      gndGrad.addColorStop(0, '#0d1e08'); gndGrad.addColorStop(1, '#060e04');
      bgCtx.fillStyle = gndGrad; bgCtx.fillRect(0, H * 0.8, W, H * 0.2);
      const hGrad = bgCtx.createRadialGradient(W/2, H*0.8, 0, W/2, H*0.8, W*0.6);
      hGrad.addColorStop(0, 'rgba(168,205,98,0.07)'); hGrad.addColorStop(1, 'transparent');
      bgCtx.fillStyle = hGrad; bgCtx.fillRect(0, 0, W, H);

      stars.forEach(s => { s.pulse += s.speed; const sa = s.a * (0.5 + Math.sin(s.pulse) * 0.5); bgCtx.beginPath(); bgCtx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2); bgCtx.fillStyle = 'rgba(200,230,150,' + sa + ')'; bgCtx.fill(); });
      glowParticles.forEach(p => { p.x += p.vx; p.y += p.vy; p.pulse += 0.025; if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); } const pa = p.a * (0.5 + Math.sin(p.pulse) * 0.5); bgCtx.beginPath(); bgCtx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2); bgCtx.fillStyle = 'rgba(168,205,98,' + pa + ')'; bgCtx.fill(); });

      scCtx.clearRect(0, 0, W, H);
      trees.forEach(tr => {
        if (treeRevealStart > 0) tr.alpha = Math.min(1, easeOutCubic((time - treeRevealStart) / 2.5));
        tr.sway += tr.swayAmt;
        const px = tr.x * W, py = tr.baseY * H;
        if (tr.kind === 'palm')   drawPalm(scCtx, px, py, tr.scale, tr.sway, tr.alpha);
        else if (tr.kind === 'jungle') drawJungle(scCtx, px, py, tr.scale, tr.sway, tr.alpha);
        else if (tr.kind === 'bush')   drawBush(scCtx, px, py, tr.scale, tr.sway, tr.alpha);
        else if (tr.kind === 'big')    drawBigTree(scCtx, px, py, tr.scale, tr.sway, tr.alpha);
      });
      adObjects.forEach((obj, idx) => {
        if (adRevealStart > 0) { const del = idx * 0.12, elapsed2 = time - adRevealStart - del; obj.alpha = Math.min(1, Math.max(0, easeOutBack(Math.min(1, elapsed2 / 0.8)))); }
        const bob = Math.sin(time * 0.9 + obj.bobPhase) * 0.008 * H;
        const px = obj.x * W, py = obj.y * H + bob, sz = H * obj.scale;
        if (obj.type === 'billboard')  drawBillboard(scCtx, px, py, sz, obj.angle, obj.alpha, time);
        else if (obj.type === 'megaphone') drawMegaphone(scCtx, px, py, sz, obj.angle, obj.alpha, time);
        else if (obj.type === 'filmstrip') drawFilmStrip(scCtx, px, py, sz, obj.angle, obj.alpha, time);
        else if (obj.type === 'camera')    drawCamera(scCtx, px, py, sz, obj.angle, obj.alpha, time);
        else if (obj.type === 'starburst') drawStarburst(scCtx, px, py, sz, obj.alpha, time);
      });
      for (let k = burst.length - 1; k >= 0; k--) {
        const bp = burst[k];
        bp.x += bp.vx; bp.y += bp.vy; bp.vx *= 0.96; bp.vy *= 0.96; bp.a -= bp.decay; bp.rot += bp.rotSpd;
        if (bp.a <= 0) { burst.splice(k, 1); continue; }
        if (bp.isLeaf) {
          scCtx.save(); scCtx.translate(bp.x, bp.y); scCtx.rotate(bp.rot); scCtx.globalAlpha = bp.a * 0.6;
          scCtx.beginPath(); scCtx.moveTo(0, -bp.r); scCtx.bezierCurveTo(bp.r*0.6, -bp.r*0.5, bp.r*0.6, bp.r*0.5, 0, bp.r); scCtx.bezierCurveTo(-bp.r*0.6, bp.r*0.5, -bp.r*0.6, -bp.r*0.5, 0, -bp.r);
          scCtx.fillStyle = '#A8CD62'; scCtx.fill(); scCtx.restore();
        } else {
          scCtx.beginPath(); scCtx.arc(bp.x, bp.y, bp.r, 0, Math.PI * 2);
          scCtx.fillStyle = bp.green ? 'rgba(168,205,98,' + bp.a + ')' : 'rgba(255,255,255,' + (bp.a * 0.4) + ')'; scCtx.fill();
        }
      }
      rafId = requestAnimationFrame(render);
    }
    rafId = requestAnimationFrame(render);

    // ── Timecode ──
    const t0 = Date.now();
    let tcRaf: number;
    function tickTC() {
      if (exitingRef.current || !timecodeRef.current) return;
      const e = Date.now() - t0, s = Math.floor(e / 1000), fr = Math.floor((e % 1000) / (1000 / 24));
      timecodeRef.current.textContent = '00:00:' + String(s).padStart(2, '0') + ':' + String(fr).padStart(2, '0');
      tcRaf = requestAnimationFrame(tickTC);
    }

    // ── Timeline ──
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => {
      const sl = scanLineRef.current; if (!sl) return;
      sl.style.opacity = '1'; sl.style.transition = 'top 0.85s cubic-bezier(0.4,0,0.2,1)';
      requestAnimationFrame(() => { if (sl) sl.style.top = '100%'; });
      setTimeout(() => { if (sl) sl.style.opacity = '0'; }, 900);
    }, 200));

    timers.push(setTimeout(() => { treeRevealStart = time; }, 400));
    timers.push(setTimeout(() => { adRevealStart = time; }, 600));

    timers.push(setTimeout(() => {
      const vf = vfRef.current; if (vf) { vf.style.transition = 'opacity 0.4s ease'; vf.style.opacity = '1'; }
    }, 800));

    timers.push(setTimeout(() => {
      const ap = apertureRef.current; if (!ap) return;
      const start = performance.now();
      function openAp(now: number) {
        const t = Math.min((now - start) / 1000, 1), pct = easeInOutQuart(t) * 85;
        if (ap) { ap.style.webkitMaskImage = 'radial-gradient(circle ' + pct + 'vmax at 50% 50%, transparent 99%, black 100%)'; ap.style.maskImage = ap.style.webkitMaskImage; }
        if (t < 1) requestAnimationFrame(openAp); else if (ap) ap.style.display = 'none';
      }
      requestAnimationFrame(openAp);
      setTimeout(() => {
        const lg = logoGroupRef.current, gl = lensGlowRef.current;
        if (lg) { lg.style.transition = 'opacity 0.55s cubic-bezier(0.22,1,0.36,1), transform 0.55s cubic-bezier(0.22,1,0.36,1)'; lg.style.opacity = '1'; lg.style.transform = 'scale(1) translateY(0)'; }
        triggerBurst();
        if (gl) { gl.style.transition = 'opacity 1.2s ease'; gl.style.opacity = '1'; }
      }, 150);
    }, 1000));

    timers.push(setTimeout(() => {
      const ri = recIndRef.current, tc2 = timecodeRef.current;
      if (ri) { ri.style.transition = 'opacity 0.35s ease'; ri.style.opacity = '1'; }
      if (tc2) { tc2.style.transition = 'opacity 0.35s ease'; tc2.style.opacity = '1'; tickTC(); }
    }, 1200));

    timers.push(setTimeout(() => {
      const bm = brandMainRef.current;
      if (bm) { bm.style.transition = 'transform 0.6s cubic-bezier(0.22,1,0.36,1), opacity 0.5s ease'; bm.style.transform = 'translateY(0)'; bm.style.opacity = '1'; }
    }, 1400));

    timers.push(setTimeout(() => {
      const bt = brandTagRef.current;
      if (bt) { bt.style.transition = 'transform 0.5s cubic-bezier(0.22,1,0.36,1), opacity 0.5s ease'; bt.style.transform = 'translateY(0)'; bt.style.opacity = '1'; }
    }, 1700));

    timers.push(setTimeout(() => {
      const lt = loadTrackRef.current, lf = loadFillRef.current, bl = bottomLblRef.current;
      if (lt) { lt.style.transition = 'opacity 0.4s ease'; lt.style.opacity = '1'; }
      if (bl) { bl.style.transition = 'opacity 0.5s ease'; bl.style.opacity = '1'; }
      const s2 = performance.now();
      function fillBar(now: number) {
        const t = Math.min((now - s2) / 2400, 1);
        if (lf) lf.style.width = easeOutCubic(t) * 100 + '%';
        if (t < 1) requestAnimationFrame(fillBar);
      }
      requestAnimationFrame(fillBar);
    }, 1800));

    timers.push(setTimeout(() => { const vf = vfRef.current; if (vf) vf.style.opacity = '0'; }, 1900));

    timers.push(setTimeout(() => {
      const sk = skipRef.current;
      if (sk) { sk.style.transition = 'opacity 0.4s ease'; sk.style.opacity = '1'; }
    }, 2200));

    timers.push(setTimeout(goToApp, 4500));

    return () => {
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(tcRaf);
      window.removeEventListener('resize', resize);
      timers.forEach(clearTimeout);
    };
  }, [goToApp]);

  return (
    <div className="splash-root">
      <canvas ref={bgRef} id="bg-canvas" />
      <canvas ref={scRef} id="scene-canvas" />

      <div className="grain" />
      <div className="vignette" />
      <div className="lens-glow" ref={lensGlowRef} />
      <div className="aperture-cover" ref={apertureRef} />
      <div className="scan-line" ref={scanLineRef} />

      {/* HUD */}
      <div className="rec-ind" ref={recIndRef}>
        <div className="rec-dot" />
        <span className="rec-lbl">REC</span>
      </div>
      <div className="timecode" ref={timecodeRef}>00:00:00:00</div>
      <div className="bottom-label" ref={bottomLblRef}>SHOTZOO STUDIOS</div>

      {/* Center overlay */}
      <div className="overlay">
        <div className="viewfinder" ref={vfRef}>
          <div className="vf-corner tl" /><div className="vf-corner tr" />
          <div className="vf-corner bl" /><div className="vf-corner br" />
          <div className="vf-h" /><div className="vf-v" />
        </div>
        <div className="logo-group" ref={logoGroupRef}>
          <div className="logo-mark">
            <img src="/company_logo.jpeg" alt="ShotZoo Logo" />
          </div>
          <div className="brand-wrap">
            <div className="brand-main" ref={brandMainRef}><span className="g">Shot</span>Zoo</div>
          </div>
          <div className="brand-sub-wrap">
            <div className="brand-tag" ref={brandTagRef}>Jungle of Ad Creation</div>
          </div>
        </div>
      </div>

      <div className="load-track" ref={loadTrackRef}>
        <div className="load-fill" ref={loadFillRef} />
      </div>
      <div className="flash-out" ref={flashRef} />
      <button className="skip-btn" ref={skipRef} onClick={goToApp} type="button">Skip ›</button>
    </div>
  );
}
