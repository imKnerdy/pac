const $ = id => document.getElementById(id);
const out = $('out');
const ctx = out.getContext('2d');
let img = null;

$('file').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    img = new Image();
    img.onload = render;
    img.src = URL.createObjectURL(f);
});

['g', 'k', 's', 'c', 'grid'].forEach(id => $(id).addEventListener('input', render));

function rng(seed) {
    return () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
    };
}

function dist(a, b) {
    const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    return dr * dr + dg * dg + db * db;
}

function nearest(p, cents) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < cents.length; i++) {
        const d = dist(p, cents[i]);
        if (d < bd) { bd = d; best = i; }
    }
    return best;
}

function kmeans(px, k) {
    const rand = rng(7);
    const cents = [px[Math.floor(rand() * px.length)].slice()];

    // k means++ initialisation
    while (cents.length < k) {
        const d = px.map(p => Math.min(...cents.map(c => dist(p, c))));
        const sum = d.reduce((a, b) => a + b, 0);
        let r = rand() * sum, i = 0;
        for (; i < d.length - 1; i++) {
            r -= d[i];
            if (r <= 0) break;
        }
        cents.push(px[i].slice());
    }

    const assign = new Array(px.length).fill(0);
    for (let iter = 0; iter < 12; iter++) {
        for (let i = 0; i < px.length; i++) assign[i] = nearest(px[i], cents);
        const sums = cents.map(() => [0, 0, 0, 0]);
        for (let i = 0; i < px.length; i++) {
            const s = sums[assign[i]];
            s[0] += px[i][0]; s[1] += px[i][1]; s[2] += px[i][2]; s[3]++;
        }
        sums.forEach((s, i) => {
            if (s[3]) cents[i] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
        });
    }
    for (let i = 0; i < px.length; i++) assign[i] = nearest(px[i], cents);
    return { cents: cents.map(c => c.map(Math.round)), assign };
}

const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');

function render() {
    const n = parseInt($('g').value, 10);
    const k = parseInt($('k').value, 10);
    const sat = parseFloat($('s').value);
    const cell = parseInt($('c').value, 10);
    $('gVal').textContent = n;
    $('kVal').textContent = k;
    $('sVal').textContent = sat;
    $('cVal').textContent = cell;
    if (!img) return;

    // Centre crop to a square, then downscale to n x n
    const side = Math.min(img.width, img.height);
    const sx = (img.width - side) / 2;
    const sy = (img.height - side) / 2;
    const small = document.createElement('canvas');
    small.width = n;
    small.height = n;
    const sctx = small.getContext('2d');
    sctx.fillStyle = '#fff';
    sctx.fillRect(0, 0, n, n);
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(img, sx, sy, side, side, 0, 0, n, n);

    const data = sctx.getImageData(0, 0, n, n).data;
    const px = [];
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const adj = v => Math.max(0, Math.min(255, gray + (v - gray) * sat));
        px.push([adj(r), adj(g), adj(b)]);
    }

    const { cents, assign } = kmeans(px, Math.min(k, px.length));

    out.width = n * cell;
    out.height = n * cell;
    for (let i = 0; i < assign.length; i++) {
        ctx.fillStyle = hex(cents[assign[i]]);
        ctx.fillRect((i % n) * cell, Math.floor(i / n) * cell, cell, cell);
    }

    if ($('grid').checked) {
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
            const p = i * cell + 0.5;
            ctx.moveTo(p, 0); ctx.lineTo(p, out.height);
            ctx.moveTo(0, p); ctx.lineTo(out.width, p);
        }
        ctx.stroke();
    }

    // Palette legend with cell counts
    const counts = new Array(cents.length).fill(0);
    assign.forEach(a => counts[a]++);
    $('palette').innerHTML = cents.map((c, i) =>
    `<div class="sw"><div style="background:${hex(c)}"></div>${hex(c)}<br>${counts[i]} cells</div>`
    ).join('');
}

$('save').addEventListener('click', () => {
    const a = document.createElement('a');
    a.download = 'pixel-pattern.png';
    a.href = out.toDataURL('image/png');
    a.click();
});
