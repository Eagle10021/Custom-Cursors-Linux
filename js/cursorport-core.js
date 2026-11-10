/*
 * CursorPort core
 * ----------------
 * Everything that does not touch the page UI:
 *   - cursor roles and the Linux cursor names linked to each role
 *   - Windows cursor parsing (.cur, .ico, .ani; BMP and PNG frames)
 *   - Xcursor encoding (the format Linux desktops load)
 *   - install.inf parsing and filename guessing for automatic role mapping
 *   - .zip reading, .tar.gz theme packaging
 *   - the generated bash install script
 *
 * Plain browser JavaScript with no build step. It also loads in Node
 * (module.exports) so the converter and script generator can be tested
 * against real cursor packs.
 */
(function (root) {
    'use strict';

    // =====================================================================
    // ROLES
    // =====================================================================
    // key:      mapping key used by the page (kept stable for saved settings)
    // reg:      Windows registry value names (Control Panel\Cursors)
    // guess:    filenames tried when the mapping entry does not match a file
    // fallback: role whose file is used when this role has no file of its own
    // links:    Linux cursor names; the first one holds the real file in a
    //           browser-built theme, the rest are symlinks to it
    const ROLES = [
        {
            key: 'normal',
            label: 'Normal',
            reg: ['Arrow'],
            guess: ['Normal', 'Normal Select', 'Arrow', 'Pointer', 'Select', 'default', 'left_ptr'],
            links: ['left_ptr', 'default', 'arrow', 'top_left_arrow'],
        },
        {
            key: 'working',
            label: 'Working',
            reg: ['AppStarting'],
            fallback: 'busy',
            guess: ['Working', 'Working in Background', 'Work', 'AppStarting', 'progress'],
            links: ['progress', 'left_ptr_watch', 'half-busy'],
        },
        {
            key: 'busy',
            label: 'Busy',
            reg: ['Wait'],
            fallback: 'working',
            guess: ['Busy', 'Wait', 'watch'],
            links: ['wait', 'watch'],
        },
        {
            key: 'link',
            label: 'Link',
            reg: ['Hand'],
            guess: ['Link', 'Link Select', 'Hand', 'pointer'],
            links: ['pointer', 'hand1', 'hand2', 'pointing_hand'],
        },
        {
            key: 'text',
            label: 'Text',
            reg: ['IBeam'],
            guess: ['Text', 'Text Select', 'IBeam', 'Beam', 'xterm'],
            links: ['text', 'xterm', 'ibeam'],
        },
        {
            key: 'precision',
            label: 'Precision',
            reg: ['Crosshair'],
            guess: ['Precision', 'Precision Select', 'Crosshair', 'Cross', 'Precise'],
            links: ['crosshair', 'cross', 'diamond_cross', 'tcross'],
        },
        {
            key: 'hand',
            label: 'Handwriting',
            reg: ['NWPen'],
            guess: ['Handwriting', 'Handwrite', 'NWPen', 'Pen', 'pencil'],
            links: ['pencil'],
        },
        {
            key: 'unavailable',
            label: 'Unavailable',
            reg: ['No'],
            guess: ['Unavailable', 'Unavailiable', 'No', 'Forbidden', 'Not Allowed'],
            links: ['forbidden', 'crossed_circle'],
        },
        {
            key: 'not_allowed',
            label: 'Not Allowed',
            reg: [],
            fallback: 'unavailable',
            guess: ['Not Allowed', 'not-allowed', 'no-drop'],
            links: ['not-allowed', 'no-drop', 'dnd-no-drop'],
        },
        {
            key: 'help',
            label: 'Help',
            reg: ['Help'],
            guess: ['Help', 'Help Select', 'Question'],
            links: ['help', 'question_arrow', 'whats_this', 'left_ptr_help', 'dnd-ask'],
        },
        {
            key: 'move',
            label: 'Move',
            reg: ['SizeAll'],
            guess: ['Move', 'SizeAll', 'Size All', 'fleur'],
            links: ['move', 'fleur', 'size_all', 'grabbing', 'closedhand', 'dnd-move'],
        },
        {
            key: 'all_scroll',
            label: 'All Scroll',
            reg: [],
            fallback: 'move',
            guess: ['All Scroll', 'all-scroll'],
            links: ['all-scroll'],
        },
        {
            key: 'vertical',
            label: 'Vertical',
            reg: ['SizeNS'],
            guess: ['Vertical', 'Vertical Resize', 'SizeNS', 'Vert', 'VertRes'],
            links: [
                'ns-resize',
                'n-resize',
                's-resize',
                'size_ver',
                'sb_v_double_arrow',
                'v_double_arrow',
                'double_arrow',
                'row-resize',
                'split_v',
                'top_side',
                'bottom_side',
            ],
        },
        {
            key: 'horizontal',
            label: 'Horizontal',
            reg: ['SizeWE'],
            guess: ['Horizontal', 'Horizontal Resize', 'SizeWE', 'Horz', 'HoriRes'],
            links: [
                'ew-resize',
                'e-resize',
                'w-resize',
                'size_hor',
                'sb_h_double_arrow',
                'h_double_arrow',
                'col-resize',
                'split_h',
                'left_side',
                'right_side',
            ],
        },
        {
            key: 'diag1',
            label: 'Diagonal NW-SE',
            reg: ['SizeNWSE'],
            guess: ['Diagonal1', 'Diagonal Resize 1', 'Diagonal 1', 'SizeNWSE', 'Dgn1', 'DiaRes1'],
            links: [
                'nwse-resize',
                'nw-resize',
                'se-resize',
                'size_fdiag',
                'bd_double_arrow',
                'top_left_corner',
                'bottom_right_corner',
                'ul_angle',
                'lr_angle',
            ],
        },
        {
            key: 'diag2',
            label: 'Diagonal NE-SW',
            reg: ['SizeNESW'],
            guess: ['Diagonal2', 'Diagonal Resize 2', 'Diagonal 2', 'SizeNESW', 'Dgn2', 'DiaRes2'],
            links: [
                'nesw-resize',
                'ne-resize',
                'sw-resize',
                'size_bdiag',
                'fd_double_arrow',
                'top_right_corner',
                'bottom_left_corner',
                'ur_angle',
                'll_angle',
            ],
        },
        {
            key: 'pin',
            label: 'Pin',
            reg: ['Pin'],
            guess: ['Pin', 'Location Select', 'Location'],
            links: ['pin', 'alias', 'location-arrow', 'dnd-link'],
        },
        {
            key: 'alternate',
            label: 'Alternate',
            reg: ['UpArrow'],
            guess: ['Alternate', 'Alternate Select', 'UpArrow', 'Up Arrow'],
            links: ['up_arrow', 'center_ptr', 'sb_up_arrow', 'cell', 'plus'],
        },
        {
            key: 'person',
            label: 'Person',
            reg: ['Person'],
            guess: ['Person', 'Person Select', 'People'],
            links: ['person'],
        },
    ];
    const ROLE_BY_KEY = Object.fromEntries(ROLES.map((r) => [r.key, r]));

    // Order of the comma-separated list in "Control Panel\Cursors\Schemes".
    const SCHEME_ORDER = [
        'Arrow',
        'Help',
        'AppStarting',
        'Wait',
        'Crosshair',
        'IBeam',
        'NWPen',
        'No',
        'SizeNS',
        'SizeWE',
        'SizeNWSE',
        'SizeNESW',
        'SizeAll',
        'UpArrow',
        'Hand',
        'Pin',
        'Person',
    ];
    const REG_TO_ROLE = {};
    ROLES.forEach((r) =>
        r.reg.forEach((n) => {
            REG_TO_ROLE[n.toLowerCase()] = r.key;
        })
    );

    const DEFAULT_MAPPINGS = {
        normal: 'Normal',
        working: 'Working',
        busy: 'Busy',
        link: 'Link',
        text: 'Text',
        precision: 'Precision',
        hand: 'Handwriting',
        unavailable: 'Unavailable',
        not_allowed: 'Unavailable',
        help: 'Help',
        move: 'Move',
        vertical: 'Vertical',
        horizontal: 'Horizontal',
        diag1: 'Diagonal1',
        diag2: 'Diagonal2',
        pin: 'Pin',
        all_scroll: 'Move',
        alternate: 'Alternate',
        person: 'Person',
    };

    // =====================================================================
    // SMALL HELPERS
    // =====================================================================
    const u16 = (b, o) => b[o] | (b[o + 1] << 8);
    const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
    const i32 = (b, o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);
    const fourcc = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
    const baseName = (p) => String(p).split(/[\\/]/).pop();
    const stripExt = (n) => n.replace(/\.(ani|cur|ico)$/i, '');
    const extOf = (n) => {
        const m = /\.([^.\\/]+)$/.exec(n);
        return m ? m[1].toLowerCase() : '';
    };

    async function streamThrough(bytes, transform) {
        const stream = new Blob([bytes]).stream().pipeThrough(transform);
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    const inflateZlib = (bytes) => streamThrough(bytes, new DecompressionStream('deflate'));
    const inflateRaw = (bytes) => streamThrough(bytes, new DecompressionStream('deflate-raw'));
    const gzip = (bytes) => streamThrough(bytes, new CompressionStream('gzip'));

    // Theme folder names must be a single path component.
    function sanitizeThemeName(name) {
        const clean = String(name || '')
            .replace(/[\/\\\0]/g, '-')
            .replace(/^[.\s]+/, '')
            .trim();
        return clean || 'MyCursors';
    }

    // =====================================================================
    // PNG DECODER (cursor frames are often PNG-compressed)
    // =====================================================================
    async function decodePng(bytes) {
        let o = 8,
            width = 0,
            height = 0,
            depth = 0,
            color = 0,
            interlace = 0;
        let palette = null,
            trns = null;
        const idat = [];
        while (o + 8 <= bytes.length) {
            const len =
                ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>>
                0;
            const type = fourcc(bytes, o + 4);
            const data = bytes.subarray(o + 8, o + 8 + len);
            if (type === 'IHDR') {
                width = ((data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]) >>> 0;
                height = ((data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7]) >>> 0;
                depth = data[8];
                color = data[9];
                interlace = data[12];
            } else if (type === 'PLTE') palette = data;
            else if (type === 'tRNS') trns = data;
            else if (type === 'IDAT') idat.push(data);
            else if (type === 'IEND') break;
            o += 12 + len;
        }
        if (!width || !height) throw new Error('PNG frame has no size');
        if (interlace) return decodePngWithCanvas(bytes);

        const total = idat.reduce((n, c) => n + c.length, 0);
        const joined = new Uint8Array(total);
        let p = 0;
        for (const c of idat) {
            joined.set(c, p);
            p += c.length;
        }
        const raw = await inflateZlib(joined);

        const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color];
        if (!channels) throw new Error('Unsupported PNG colour type ' + color);
        const bitsPP = channels * depth;
        const bpp = Math.max(1, bitsPP >> 3);
        const stride = (width * bitsPP + 7) >> 3;
        const pixels = new Uint8Array(stride * height);
        let prev = new Uint8Array(stride);
        for (let y = 0; y < height; y++) {
            const f = raw[y * (stride + 1)];
            const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
            const out = pixels.subarray(y * stride, (y + 1) * stride);
            for (let x = 0; x < stride; x++) {
                const a = x >= bpp ? out[x - bpp] : 0,
                    b = prev[x],
                    c = x >= bpp ? prev[x - bpp] : 0;
                let v = line[x];
                if (f === 1) v += a;
                else if (f === 2) v += b;
                else if (f === 3) v += (a + b) >> 1;
                else if (f === 4) {
                    const pa = Math.abs(b - c),
                        pb = Math.abs(a - c),
                        pc = Math.abs(a + b - 2 * c);
                    v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
                }
                out[x] = v & 255;
            }
            prev = out;
        }

        const rgba = new Uint8ClampedArray(width * height * 4);
        const sample = (row, i) => {
            // Reads sample i of a row at any bit depth (16-bit keeps the high byte).
            if (depth === 8) return row[i];
            if (depth === 16) return row[i * 2];
            const perByte = 8 / depth,
                byte = row[Math.floor(i / perByte)];
            const shift = 8 - depth * ((i % perByte) + 1);
            const v = (byte >> shift) & ((1 << depth) - 1);
            return color === 3 ? v : Math.round((v * 255) / ((1 << depth) - 1));
        };
        for (let y = 0; y < height; y++) {
            const row = pixels.subarray(y * stride, (y + 1) * stride);
            for (let x = 0; x < width; x++) {
                const d = (y * width + x) * 4;
                if (color === 6) {
                    for (let k = 0; k < 4; k++) rgba[d + k] = sample(row, x * 4 + k);
                } else if (color === 2) {
                    for (let k = 0; k < 3; k++) rgba[d + k] = sample(row, x * 3 + k);
                    rgba[d + 3] = 255;
                } else if (color === 0) {
                    rgba[d] = rgba[d + 1] = rgba[d + 2] = sample(row, x);
                    rgba[d + 3] = 255;
                } else if (color === 4) {
                    rgba[d] = rgba[d + 1] = rgba[d + 2] = sample(row, x * 2);
                    rgba[d + 3] = sample(row, x * 2 + 1);
                } else {
                    const idx = sample(row, x);
                    rgba[d] = palette ? palette[idx * 3] : 0;
                    rgba[d + 1] = palette ? palette[idx * 3 + 1] : 0;
                    rgba[d + 2] = palette ? palette[idx * 3 + 2] : 0;
                    rgba[d + 3] = trns && idx < trns.length ? trns[idx] : 255;
                }
            }
        }
        return { width, height, rgba };
    }

    // Interlaced PNGs are rare in cursors; the browser decodes those.
    async function decodePngWithCanvas(bytes) {
        if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') {
            throw new Error('Interlaced PNG frames need a browser to decode');
        }
        const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const canvas = new OffscreenCanvas(bmp.width, bmp.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bmp, 0, 0);
        const data = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
        return { width: bmp.width, height: bmp.height, rgba: new Uint8ClampedArray(data) };
    }

    // =====================================================================
    // BMP (DIB) DECODER: the classic icon/cursor frame format
    // =====================================================================
    function decodeDib(bytes, hintW, hintH) {
        const hdrSize = u32(bytes, 0);
        const width = Math.abs(i32(bytes, 4));
        const rawH = i32(bytes, 8);
        const bitCount = u16(bytes, 14);
        const compression = u32(bytes, 16);
        const clrUsed = u32(bytes, 32);
        // The stored height covers the colour (XOR) image plus the AND mask.
        const height =
            hintH && Math.abs(rawH) >= hintH * 2
                ? hintH
                : Math.max(1, Math.abs(rawH) >> 1) || hintH;
        const bottomUp = rawH > 0;
        let o = hdrSize;
        if (compression === 3 && hdrSize === 40) o += 12; // BI_BITFIELDS masks follow the header
        const palCount = bitCount <= 8 ? clrUsed || 1 << bitCount : 0;
        const palette = bytes.subarray(o, o + palCount * 4);
        o += palCount * 4;
        const xorStride = ((width * bitCount + 31) >> 5) * 4;
        const xor = bytes.subarray(o, o + xorStride * height);
        o += xorStride * height;
        const andStride = ((width + 31) >> 5) * 4;
        const hasMask = o + andStride * height <= bytes.length;
        const and = hasMask ? bytes.subarray(o, o + andStride * height) : null;

        const rgba = new Uint8ClampedArray(width * height * 4);
        let anyAlpha = false;
        for (let y = 0; y < height; y++) {
            const sy = bottomUp ? height - 1 - y : y;
            const row = xor.subarray(sy * xorStride, (sy + 1) * xorStride);
            for (let x = 0; x < width; x++) {
                const d = (y * width + x) * 4;
                let r,
                    g,
                    b,
                    a = 255;
                if (bitCount === 32) {
                    b = row[x * 4];
                    g = row[x * 4 + 1];
                    r = row[x * 4 + 2];
                    a = row[x * 4 + 3];
                    if (a) anyAlpha = true;
                } else if (bitCount === 24) {
                    b = row[x * 3];
                    g = row[x * 3 + 1];
                    r = row[x * 3 + 2];
                } else if (bitCount === 16) {
                    const v = row[x * 2] | (row[x * 2 + 1] << 8);
                    r = (((v >> 10) & 31) * 255) / 31;
                    g = (((v >> 5) & 31) * 255) / 31;
                    b = ((v & 31) * 255) / 31;
                } else {
                    const bit = x * bitCount;
                    const idx =
                        (row[bit >> 3] >> (8 - bitCount - (bit & 7))) & ((1 << bitCount) - 1);
                    b = palette[idx * 4];
                    g = palette[idx * 4 + 1];
                    r = palette[idx * 4 + 2];
                }
                rgba[d] = r;
                rgba[d + 1] = g;
                rgba[d + 2] = b;
                rgba[d + 3] = a;
            }
        }
        // Without a real alpha channel, transparency comes from the AND mask.
        // Masked pixels with a non-black colour invert the screen on Windows;
        // Xcursor cannot invert, so those become opaque black.
        if (!(bitCount === 32 && anyAlpha) && and) {
            for (let y = 0; y < height; y++) {
                const sy = bottomUp ? height - 1 - y : y;
                for (let x = 0; x < width; x++) {
                    const masked = (and[sy * andStride + (x >> 3)] >> (7 - (x & 7))) & 1;
                    const d = (y * width + x) * 4;
                    if (!masked) {
                        rgba[d + 3] = 255;
                        continue;
                    }
                    const lit = rgba[d] | rgba[d + 1] | rgba[d + 2];
                    if (lit) {
                        rgba[d] = rgba[d + 1] = rgba[d + 2] = 0;
                        rgba[d + 3] = 255;
                    } else rgba[d + 3] = 0;
                }
            }
        }
        return { width, height, rgba, depth: bitCount };
    }

    // =====================================================================
    // ICO / CUR CONTAINER
    // =====================================================================
    // Returns one image per size: { size, width, height, xhot, yhot, rgba }.
    async function parseIco(bytes) {
        if (u16(bytes, 0) !== 0 || (u16(bytes, 2) !== 1 && u16(bytes, 2) !== 2)) {
            throw new Error('Not a Windows cursor or icon');
        }
        const isCursor = u16(bytes, 2) === 2;
        const count = u16(bytes, 4);
        const bySize = new Map();
        for (let i = 0; i < count; i++) {
            const e = 6 + i * 16;
            if (e + 16 > bytes.length) break;
            const w = bytes[e] || 256,
                h = bytes[e + 1] || 256;
            const xhot = isCursor ? u16(bytes, e + 4) : 0;
            const yhot = isCursor ? u16(bytes, e + 6) : 0;
            const size = u32(bytes, e + 8),
                offset = u32(bytes, e + 12);
            const data = bytes.subarray(offset, offset + size);
            if (data.length < 8) continue;
            const isPng =
                data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
            const img = isPng ? await decodePng(data) : decodeDib(data, w, h);
            img.depth = isPng ? 64 : img.depth;
            const nominal = img.width; // Xcursor nominal size follows the width, as win2xcur does
            const prev = bySize.get(nominal);
            // Some files store the same size at several colour depths; keep the richest.
            if (prev && prev.depth >= img.depth) continue;
            bySize.set(nominal, {
                size: nominal,
                width: img.width,
                height: img.height,
                depth: img.depth,
                xhot: Math.min(xhot, img.width - 1),
                yhot: Math.min(yhot, img.height - 1),
                rgba: img.rgba,
            });
        }
        if (!bySize.size) throw new Error('No images found in cursor file');
        return [...bySize.values()].sort((a, b) => a.size - b.size);
    }

    // =====================================================================
    // ANI (RIFF "ACON") CONTAINER
    // =====================================================================
    async function parseAni(bytes) {
        if (fourcc(bytes, 0) !== 'RIFF' || fourcc(bytes, 8) !== 'ACON')
            throw new Error('Not an animated cursor');
        let dispRate = 10,
            rates = null,
            seq = null,
            flags = 1;
        const iconChunks = [];
        const walk = (start, end) => {
            let o = start;
            while (o + 8 <= end) {
                const id = fourcc(bytes, o);
                const size = Math.min(u32(bytes, o + 4), end - o - 8);
                const data = bytes.subarray(o + 8, o + 8 + size);
                if (id === 'anih' && size >= 36) {
                    dispRate = u32(data, 28) || dispRate;
                    flags = u32(data, 32);
                } else if (id === 'rate') {
                    rates = [];
                    for (let i = 0; i + 4 <= size; i += 4) rates.push(u32(data, i));
                } else if (id === 'seq ') {
                    seq = [];
                    for (let i = 0; i + 4 <= size; i += 4) seq.push(u32(data, i));
                } else if (id === 'LIST' && fourcc(bytes, o + 8) === 'fram') {
                    walk(o + 12, o + 8 + size);
                } else if (id === 'icon') {
                    iconChunks.push(data);
                }
                o += 8 + size + (size & 1);
            }
        };
        walk(12, bytes.length);
        if (!iconChunks.length) throw new Error('Animated cursor has no frames');

        const frames = [];
        for (const chunk of iconChunks) {
            const looksIco = chunk[0] === 0 && chunk[1] === 0 && (chunk[2] === 1 || chunk[2] === 2);
            if (looksIco || flags & 1) frames.push(await parseIco(chunk));
            else {
                const img = decodeDib(chunk, 0, 0);
                frames.push([{ size: Math.max(img.width, img.height), xhot: 0, yhot: 0, ...img }]);
            }
        }
        const order = seq && seq.length ? seq : frames.map((_, i) => i);
        return order.map((frameIndex, i) => ({
            images: frames[Math.min(frameIndex, frames.length - 1)],
            // Windows counts frame time in jiffies (1/60 s).
            delay: Math.max(1, Math.floor((((rates && rates[i]) || dispRate) * 1000) / 60)),
        }));
    }

    // Parses any Windows cursor file into { frames: [{ images, delay }], sizes }.
    async function parseCursor(bytes, name) {
        bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        const isAni = fourcc(bytes, 0) === 'RIFF';
        const frames = isAni
            ? await parseAni(bytes)
            : [{ images: await parseIco(bytes), delay: 0 }];
        const sizes = [...new Set(frames.flatMap((f) => f.images.map((i) => i.size)))].sort(
            (a, b) => a - b
        );
        return { name: name || '', animated: frames.length > 1, frames, sizes };
    }

    function imageForSize(images, size) {
        return images.reduce(
            (best, img) => (Math.abs(img.size - size) < Math.abs(best.size - size) ? img : best),
            images[0]
        );
    }

    // =====================================================================
    // XCURSOR ENCODER
    // =====================================================================
    function encodeXcursor(cursor) {
        const chunks = [];
        for (const size of cursor.sizes) {
            for (const frame of cursor.frames) {
                const img = imageForSize(frame.images, size);
                chunks.push({ size, img, delay: cursor.frames.length > 1 ? frame.delay : 0 });
            }
        }
        const headerLen = 16 + chunks.length * 12;
        const total =
            headerLen + chunks.reduce((n, c) => n + 36 + c.img.width * c.img.height * 4, 0);
        const out = new Uint8Array(total);
        const dv = new DataView(out.buffer);
        out.set([0x58, 0x63, 0x75, 0x72]); // "Xcur"
        dv.setUint32(4, 16, true);
        dv.setUint32(8, 0x10000, true);
        dv.setUint32(12, chunks.length, true);
        let pos = headerLen;
        chunks.forEach((c, i) => {
            dv.setUint32(16 + i * 12, 0xfffd0002, true);
            dv.setUint32(20 + i * 12, c.size, true);
            dv.setUint32(24 + i * 12, pos, true);
            const { width, height, xhot, yhot, rgba } = c.img;
            [36, 0xfffd0002, c.size, 1, width, height, xhot, yhot, c.delay].forEach((v, k) =>
                dv.setUint32(pos + k * 4, v, true)
            );
            let p = pos + 36;
            // Xcursor pixels are premultiplied ARGB stored as little-endian words.
            for (let s = 0; s < width * height * 4; s += 4) {
                const a = rgba[s + 3];
                out[p] = Math.round((rgba[s + 2] * a) / 255);
                out[p + 1] = Math.round((rgba[s + 1] * a) / 255);
                out[p + 2] = Math.round((rgba[s] * a) / 255);
                out[p + 3] = a;
                p += 4;
            }
            pos = p;
        });
        return out;
    }

    // Reads an Xcursor file back (used by tests to compare against win2xcur).
    function decodeXcursor(bytes) {
        const n = u32(bytes, 12),
            images = [];
        for (let i = 0; i < n; i++) {
            if (u32(bytes, 16 + i * 12) !== 0xfffd0002) continue;
            const p = u32(bytes, 24 + i * 12);
            images.push({
                size: u32(bytes, p + 8),
                width: u32(bytes, p + 16),
                height: u32(bytes, p + 20),
                xhot: u32(bytes, p + 24),
                yhot: u32(bytes, p + 28),
                delay: u32(bytes, p + 32),
                pixels: bytes.subarray(
                    p + 36,
                    p + 36 + u32(bytes, p + 16) * u32(bytes, p + 20) * 4
                ),
            });
        }
        return images;
    }

    // =====================================================================
    // INSTALL.INF PARSING AND FILENAME GUESSING
    // =====================================================================
    function decodeText(bytes) {
        if (bytes[0] === 0xff && bytes[1] === 0xfe)
            return new TextDecoder('utf-16le').decode(bytes.subarray(2));
        if (bytes[0] === 0xfe && bytes[1] === 0xff)
            return new TextDecoder('utf-16be').decode(bytes.subarray(2));
        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch (e) {
            return new TextDecoder('windows-1252').decode(bytes);
        }
    }

    // Splits an INF line on commas, keeping quoted parts together.
    function splitInfFields(line) {
        const out = [];
        let cur = '',
            q = false;
        for (const ch of line) {
            if (ch === '"') {
                q = !q;
                continue;
            }
            if (ch === ',' && !q) {
                out.push(cur.trim());
                cur = '';
                continue;
            }
            cur += ch;
        }
        out.push(cur.trim());
        return out;
    }

    function stripInfComment(line) {
        let q = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') q = !q;
            else if (line[i] === ';' && !q) return line.slice(0, i);
        }
        return line;
    }

    // Returns { mapping: { roleKey: fileNameWithoutExtension }, schemeName }.
    function parseInf(input) {
        const text = typeof input === 'string' ? input : decodeText(input);
        const sections = {};
        let section = '';
        for (const raw of text.replace(/\r/g, '').split('\n')) {
            const line = stripInfComment(raw).trim();
            if (!line) continue;
            const head = /^\[(.+)\]$/.exec(line);
            if (head) {
                section = head[1].trim().toLowerCase();
                continue;
            }
            (sections[section] = sections[section] || []).push(line);
        }
        const strings = {};
        (sections.strings || []).forEach((line) => {
            const eq = line.indexOf('=');
            if (eq > 0)
                strings[line.slice(0, eq).trim().toLowerCase()] = line
                    .slice(eq + 1)
                    .trim()
                    .replace(/^"(.*)"$/, '$1');
        });
        const subst = (s) => {
            for (let pass = 0; pass < 3; pass++) {
                s = s.replace(/%([^%]+)%/g, (_, k) =>
                    strings[k.toLowerCase()] !== undefined ? strings[k.toLowerCase()] : ''
                );
            }
            return s;
        };
        const toName = (value) => stripExt(baseName(subst(value).trim()));

        const mapping = {};
        let schemeList = null,
            schemeName = strings.scheme_name || '';
        Object.values(sections)
            .flat()
            .forEach((line) => {
                if (!/^HKCU|^HKEY_CURRENT_USER/i.test(line)) return;
                const f = splitInfFields(line);
                const key = (f[1] || '').toLowerCase().replace(/\\+$/, '');
                if (key === 'control panel\\cursors') {
                    const role = REG_TO_ROLE[(f[2] || '').toLowerCase()];
                    if (role && f[4]) {
                        const name = toName(f[4]);
                        if (name) mapping[role] = name;
                    }
                } else if (key === 'control panel\\cursors\\schemes' && f[4] !== undefined) {
                    schemeName = schemeName || subst(f[2] || '');
                    // The scheme value is one quoted string of comma-separated paths.
                    const m = /"([^"]*)"\s*$/.exec(line);
                    schemeList = (m ? m[1] : f.slice(4).join(',')).split(',');
                }
            });
        if (schemeList) {
            schemeList.forEach((p, i) => {
                const role = REG_TO_ROLE[(SCHEME_ORDER[i] || '').toLowerCase()];
                const name = toName(p);
                if (role && name && !mapping[role]) mapping[role] = name;
            });
        }
        if (mapping.unavailable && !mapping.not_allowed) mapping.not_allowed = mapping.unavailable;
        if (mapping.move && !mapping.all_scroll) mapping.all_scroll = mapping.move;
        return { mapping, schemeName: subst(schemeName).trim() };
    }

    // Keyword rules for packs without an install.inf. Roles are matched in
    // this order and each file is used once, so specific words come first
    // ("handwriting" before "hand", "normal" last because "select" is common).
    const KEYWORDS = [
        ['hand', ['handwriting', 'handwrite', 'nwpen', 'pen', 'pencil']],
        ['working', ['working', 'background', 'appstarting', 'work', 'progress']],
        ['busy', ['busy', 'wait', 'loading']],
        ['link', ['link', 'hand', 'pointer']],
        ['text', ['text', 'ibeam', 'beam']],
        ['precision', ['precision', 'precise', 'crosshair', 'cross']],
        ['unavailable', ['unavailable', 'unavailiable', 'unavail', 'unaval', 'forbidden', 'no']],
        ['help', ['help', 'question']],
        [
            'diag1',
            ['diagonal resize 1', 'diagonal1', 'diagonal 1', 'diag1', 'dgn1', 'nwse', 'sizenwse'],
        ],
        [
            'diag2',
            ['diagonal resize 2', 'diagonal2', 'diagonal 2', 'diag2', 'dgn2', 'nesw', 'sizenesw'],
        ],
        ['vertical', ['vertical', 'resizever', 'sizever', 'vert', 'sizens', 'ns']],
        ['horizontal', ['horizontal', 'resizehor', 'sizehor', 'horz', 'hori', 'sizewe', 'we']],
        ['move', ['move', 'sizeall', 'size all', 'fleur']],
        ['alternate', ['alternate', 'alt select', 'altselect', 'uparrow', 'up arrow']],
        ['person', ['person', 'people']],
        ['pin', ['pin', 'location']],
        ['normal', ['normal', 'arrow', 'default', 'pointer', 'select']],
    ];

    function guessMapping(fileNames) {
        const items = fileNames.map((n) => {
            const plain = stripExt(baseName(n));
            const norm = plain
                .toLowerCase()
                .replace(/[_\-.]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            return { plain, norm, words: new Set(norm.split(' ')) };
        });
        // Short keywords must be a whole word ("no" must not match "normal").
        const hit = (it, kw) => (kw.length <= 3 ? it.words.has(kw) : it.norm.includes(kw));
        const used = new Set(),
            mapping = {};
        for (const [role, kws] of KEYWORDS) {
            let pick = null;
            for (const kw of kws) {
                const matches = items.filter((it) => !used.has(it.plain) && hit(it, kw));
                if (matches.length) {
                    // Prefer animated versions, then the shortest name ("Busy" over "Busy 2").
                    const anim = (it) => (/\banim/.test(it.norm) ? 0 : 1);
                    matches.sort((a, b) => anim(a) - anim(b) || a.norm.length - b.norm.length);
                    pick = matches[0];
                    break;
                }
            }
            if (pick) {
                mapping[role] = pick.plain;
                used.add(pick.plain);
            }
        }
        // A pack with unrecognised names still gets its first file as the normal cursor.
        if (!mapping.normal) {
            const rest = items.filter((it) => !used.has(it.plain));
            if (rest.length) mapping.normal = rest[0].plain;
        }
        if (mapping.unavailable) mapping.not_allowed = mapping.unavailable;
        if (mapping.move) mapping.all_scroll = mapping.move;
        return mapping;
    }

    // Finds the file for a role among loaded names, using the same order as
    // the shell script: mapping entry, built-in guesses, then the fallback role.
    function resolveRoleFile(roleKey, mappings, names, prefix, suffix) {
        const lower = new Map(names.map((n) => [n.toLowerCase(), n]));
        const tryRole = (key) => {
            const role = ROLE_BY_KEY[key];
            const cands = [mappings[key], ...role.guess].filter(Boolean);
            for (const c of cands) {
                for (const n of [`${prefix || ''}${c}${suffix || ''}`, c]) {
                    const hitName = lower.get(n.toLowerCase());
                    if (hitName) return hitName;
                }
            }
            return null;
        };
        const own = tryRole(roleKey);
        if (own) return { file: own, viaFallback: false };
        const fb = ROLE_BY_KEY[roleKey].fallback;
        const other = fb ? tryRole(fb) : null;
        return other ? { file: other, viaFallback: true } : null;
    }

    // =====================================================================
    // ZIP READER (cursor packs are usually shared as .zip)
    // =====================================================================
    async function readZip(bytes) {
        bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        let eocd = -1;
        for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
            if (u32(bytes, i) === 0x06054b50) {
                eocd = i;
                break;
            }
        }
        if (eocd < 0) throw new Error('Not a zip file');
        const count = u16(bytes, eocd + 10);
        let p = u32(bytes, eocd + 16);
        const files = [];
        for (let i = 0; i < count; i++) {
            if (u32(bytes, p) !== 0x02014b50) break;
            const flags = u16(bytes, p + 8),
                method = u16(bytes, p + 10);
            const csize = u32(bytes, p + 20);
            const nlen = u16(bytes, p + 28),
                xlen = u16(bytes, p + 30),
                clen = u16(bytes, p + 32);
            const local = u32(bytes, p + 42);
            const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nlen));
            p += 46 + nlen + xlen + clen;
            if (name.endsWith('/') || flags & 1) continue; // folders and encrypted entries
            const start = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
            const raw = bytes.subarray(start, start + csize);
            if (method === 0) files.push({ path: name, bytes: raw });
            else if (method === 8) files.push({ path: name, bytes: await inflateRaw(raw) });
        }
        return files;
    }

    // =====================================================================
    // TAR WRITER (keeps symlinks; gzip via CompressionStream)
    // =====================================================================
    function tarHeader(path, size, type, linkName, mode) {
        const enc = new TextEncoder();
        const h = new Uint8Array(512);
        let name = enc.encode(path),
            prefix = new Uint8Array(0);
        if (name.length > 100) {
            const cut = path.lastIndexOf('/', path.length - 2);
            prefix = enc.encode(path.slice(0, cut));
            name = enc.encode(path.slice(cut + 1));
        }
        const put = (str, off, len) => {
            const b = typeof str === 'string' ? enc.encode(str) : str;
            h.set(b.subarray(0, len), off);
        };
        const oct = (n, len) => n.toString(8).padStart(len - 1, '0');
        put(name, 0, 100);
        put(oct(mode, 8), 100, 8);
        put(oct(0, 8), 108, 8);
        put(oct(0, 8), 116, 8);
        put(oct(size, 12), 124, 12);
        put(oct(Math.floor(Date.now() / 1000), 12), 136, 12);
        put('        ', 148, 8);
        h[156] = type.charCodeAt(0);
        if (linkName) put(linkName, 157, 100);
        put('ustar\0', 257, 6);
        put('00', 263, 2);
        put(prefix, 345, 155);
        let sum = 0;
        for (let i = 0; i < 512; i++) sum += h[i];
        put(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
        return h;
    }

    // entries: [{ path, bytes } | { path, dir: true } | { path, link }]
    function buildTar(entries) {
        const parts = [];
        for (const e of entries) {
            if (e.dir) parts.push(tarHeader(e.path.replace(/\/?$/, '/'), 0, '5', '', 0o755));
            else if (e.link) parts.push(tarHeader(e.path, 0, '2', e.link, 0o777));
            else {
                parts.push(tarHeader(e.path, e.bytes.length, '0', '', e.mode || 0o644));
                parts.push(e.bytes);
                const pad = (512 - (e.bytes.length % 512)) % 512;
                if (pad) parts.push(new Uint8Array(pad));
            }
        }
        parts.push(new Uint8Array(1024));
        const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
        let o = 0;
        for (const p of parts) {
            out.set(p, o);
            o += p.length;
        }
        return out;
    }

    // =====================================================================
    // SHELL SCRIPT GENERATION
    // =====================================================================
    // Single-quotes a value for bash.
    const sq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

    // Turns a path typed on the page into a bash expression. "~" and $HOME
    // stay dynamic so the script works for any user; the rest is quoted.
    function bashPath(p) {
        const t = String(p || '').trim();
        if (t === '$HOME/.local/share/icons' || t === '~/.local/share/icons')
            return '"${XDG_DATA_HOME:-$HOME/.local/share}/icons"';
        const home = /^(~|\$HOME|\$\{HOME\})(\/.*)?$/.exec(t);
        if (home) return home[2] && home[2] !== '/' ? `"$HOME"${sq(home[2])}` : '"$HOME"';
        return sq(t);
    }

    // Shared by the install script and the browser-built theme's install.sh.
    const BASH_COMMON = String.raw`
info() { printf '\033[1;36m::\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

case "$THEME_NAME" in ''|*/*) die "Invalid theme name: '$THEME_NAME'" ;; esac
THEME_DIR="$ICON_ROOT/$THEME_NAME"
CURSOR_DIR="$THEME_DIR/cursors"

# Running everything under sudo would install for root and apply the theme
# to root's session. The script asks for sudo itself when it needs it.
if [ "$(id -u)" -eq 0 ] && [ -n "${'$'}{SUDO_USER:-}" ]; then
    die "Run this script as your normal user, without sudo. It asks for your password only if the install folder needs it."
fi

# sudo is used only when the install folder is not writable (e.g. /usr/share/icons).
SUDO=''
if ! mkdir -p "$CURSOR_DIR" 2>/dev/null || [ ! -w "$CURSOR_DIR" ]; then
    command -v sudo >/dev/null 2>&1 || die "Cannot write to $THEME_DIR and sudo is not available."
    SUDO='sudo'
    info "$ICON_ROOT needs administrator rights; sudo will ask for your password."
    sudo mkdir -p "$CURSOR_DIR"
fi
run() { if [ -n "$SUDO" ]; then sudo "$@"; else "$@"; fi; }

DESKTOP="${'$'}{XDG_CURRENT_DESKTOP:-}:${'$'}{XDG_SESSION_DESKTOP:-}:${'$'}{DESKTOP_SESSION:-}"
DESKTOP="${'$'}{DESKTOP,,}"

write_index_theme() {
    # Cursors this theme lacks come from the desktop's own cursor theme.
    local inherits='Adwaita,breeze_cursors'
    case "$DESKTOP" in *kde*|*plasma*|*lxqt*) inherits='breeze_cursors,Adwaita' ;; esac
    printf '[Icon Theme]\nName=%s\nComment=Converted from Windows cursors with CursorPort\nInherits=%s\n' \
        "$THEME_NAME" "$inherits" | run tee "$THEME_DIR/index.theme" >/dev/null
}

check_links() {
    local f broken=0
    for f in "$CURSOR_DIR"/*; do
        if [ -L "$f" ] && [ ! -e "$f" ]; then
            warn "Broken link: ${'$'}{f##*/} -> $(readlink "$f")"
            broken=$((broken + 1))
        fi
    done
    [ "$broken" -eq 0 ] || warn "$broken cursor link(s) point to missing files."
}

apply_theme() {
    if [ "$AUTO_APPLY" != 1 ]; then
        info "Automatic apply is off. Pick '$THEME_NAME' in your desktop's cursor settings."
        return 0
    fi
    if [ "$(id -u)" -eq 0 ]; then
        warn "Running as root, so the theme was not applied. Pick '$THEME_NAME' in your desktop's cursor settings."
        return 0
    fi
    local applied='' kw kr
    case "$DESKTOP" in
        *kde*|*plasma*)
            kw=$(command -v kwriteconfig6 || command -v kwriteconfig5 || true)
            kr=$(command -v kreadconfig6 || command -v kreadconfig5 || true)
            [ -n "$kw" ] && "$kw" --file kcminputrc --group Mouse --key cursorSize "$CURSOR_SIZE"
            if command -v plasma-apply-cursortheme >/dev/null 2>&1; then
                plasma-apply-cursortheme "$THEME_NAME" >/dev/null 2>&1
            elif [ -n "$kw" ]; then
                "$kw" --file kcminputrc --group Mouse --key cursorTheme "$THEME_NAME"
            fi
            if [ -n "$kr" ] && [ "$("$kr" --file kcminputrc --group Mouse --key cursorTheme 2>/dev/null)" = "$THEME_NAME" ]; then
                applied='KDE Plasma'
            fi
            ;;
        *xfce*)
            if command -v xfconf-query >/dev/null 2>&1; then
                xfconf-query -c xsettings -p /Gtk/CursorThemeName -n -t string -s "$THEME_NAME" &&
                    xfconf-query -c xsettings -p /Gtk/CursorThemeSize -n -t int -s "$CURSOR_SIZE" && applied='XFCE'
            fi
            ;;
        *cinnamon*)
            gsettings set org.cinnamon.desktop.interface cursor-theme "$THEME_NAME" &&
                gsettings set org.cinnamon.desktop.interface cursor-size "$CURSOR_SIZE" && applied='Cinnamon'
            ;;
        *mate*)
            gsettings set org.mate.peripherals-mouse cursor-theme "$THEME_NAME" &&
                gsettings set org.mate.peripherals-mouse cursor-size "$CURSOR_SIZE" && applied='MATE'
            ;;
        *hyprland*)
            hyprctl setcursor "$THEME_NAME" "$CURSOR_SIZE" >/dev/null && applied='Hyprland (this session)'
            info "To keep it, add to hyprland.conf:  env = XCURSOR_THEME,$THEME_NAME  and  env = XCURSOR_SIZE,$CURSOR_SIZE"
            ;;
        *sway*)
            swaymsg "seat * xcursor_theme '$THEME_NAME' $CURSOR_SIZE" >/dev/null && applied='Sway (this session)'
            info "To keep it, add to your sway config:  seat * xcursor_theme '$THEME_NAME' $CURSOR_SIZE"
            ;;
    esac
    # GNOME and its relatives, plus GTK apps everywhere except KDE (KDE syncs GTK itself).
    case "$DESKTOP" in *kde*|*plasma*) ;; *)
        if command -v gsettings >/dev/null 2>&1 && gsettings list-keys org.gnome.desktop.interface 2>/dev/null | grep -qx cursor-theme; then
            gsettings set org.gnome.desktop.interface cursor-theme "$THEME_NAME" &&
                gsettings set org.gnome.desktop.interface cursor-size "$CURSOR_SIZE" && applied="${'$'}{applied:-GNOME}"
        fi
    ;; esac
    if [ -z "$applied" ]; then
        # Unknown desktop or bare X11: the "default" theme is what X apps fall back to.
        local def="$HOME/.icons/default/index.theme"
        if [ ! -e "$def" ] || grep -q 'CursorPort' "$def" 2>/dev/null; then
            mkdir -p "$HOME/.icons/default"
            printf '[Icon Theme]\n# Written by CursorPort\nInherits=%s\n' "$THEME_NAME" > "$def"
            applied='~/.icons/default'
        else
            warn "Could not detect your desktop. Pick '$THEME_NAME' in your cursor settings."
            return 0
        fi
    fi
    ok "Applied with $applied. Log out and back in if some apps keep the old cursor."
}
`;

    function roleCandidates(key, mappings) {
        const own = [mappings[key], ...ROLE_BY_KEY[key].guess];
        const fb = ROLE_BY_KEY[key].fallback;
        const all = fb ? [...own, mappings[fb], ...ROLE_BY_KEY[fb].guess] : own;
        return [...new Set(all.filter(Boolean))];
    }

    // o: { themeName, sourcePath, installPath, mappings, prefix, suffix,
    //      useSymlinks, cursorSize, autoApply }
    function buildInstallScript(o) {
        const theme = sanitizeThemeName(o.themeName);
        const mappings = { ...DEFAULT_MAPPINGS, ...(o.mappings || {}) };
        const roleLines = ROLES.map(
            (r) =>
                `role ${sq(r.label)} ${roleCandidates(r.key, mappings)
                    .map(sq)
                    .join(' ')} -- ${r.links.join(' ')}`
        ).join('\n');

        return `#!/usr/bin/env bash
# CursorPort install script
# Theme: ${theme}
# Generated by https://cursorport.01blue.org/
#
# Usage:  bash install_cursors.sh [folder with .ani/.cur files]
# Converts the Windows cursors with win2xcur, installs them as a Linux cursor
# theme, links every Linux cursor name to the right file and applies the theme.
# Set CURSORPORT_APPLY=0 to install without applying.
set -eu -o pipefail

# ---- Settings from the CursorPort page ----
THEME_NAME=${sq(theme)}
DEFAULT_SOURCE=${bashPath(o.sourcePath || '~/Downloads/MyCursors')}
SOURCE_DIR="\${1:-$DEFAULT_SOURCE}"
ICON_ROOT=${bashPath(o.installPath || '$HOME/.local/share/icons')}
LINK_MODE=${o.useSymlinks === false ? "'copy'" : "'symlink'"}
CURSOR_SIZE=${parseInt(o.cursorSize, 10) || 32}
AUTO_APPLY="\${CURSORPORT_APPLY:-${o.autoApply === false ? 0 : 1}}"
PREFIX=${sq(o.prefix || '')}
SUFFIX=${sq(o.suffix || '')}
${BASH_COMMON}
# ---- 1. Convert .ani and .cur files (any letter case) ----
win_files=()
if [ -d "$SOURCE_DIR" ]; then
    shopt -s nullglob nocaseglob
    win_files=("$SOURCE_DIR"/*.ani "$SOURCE_DIR"/*.cur)
    shopt -u nullglob nocaseglob
fi

if [ "\${#win_files[@]}" -gt 0 ]; then
    W2X=$(command -v win2xcur || true)
    if [ -z "$W2X" ] && [ -x "$HOME/.local/bin/win2xcur" ]; then W2X="$HOME/.local/bin/win2xcur"; fi
    if [ -z "$W2X" ]; then
        die "win2xcur is not installed. Install it, then run this again:
     Arch:                        yay -S win2xcur
     Ubuntu / Kubuntu / Debian:   sudo apt install pipx && pipx install win2xcur
     Fedora:                      sudo dnf install pipx && pipx install win2xcur
   Or skip win2xcur: use 'Build theme in browser' on cursorport.01blue.org."
    fi
    info "Converting \${#win_files[@]} Windows cursor file(s) from $SOURCE_DIR"
    TMP_OUT=$(mktemp -d)
    trap 'rm -rf "$TMP_OUT"' EXIT
    failed=0
    for f in "\${win_files[@]}"; do
        if ! "$W2X" "$f" -o "$TMP_OUT" >/dev/null 2>"$TMP_OUT/.log"; then
            warn "Could not convert \${f##*/}: $(tail -n 1 "$TMP_OUT/.log")"
            failed=$((failed + 1))
        fi
    done
    rm -f "$TMP_OUT/.log"
    for f in "$TMP_OUT"/*; do
        [ -f "$f" ] || continue
        run rm -f "$CURSOR_DIR/\${f##*/}"
        run cp "$f" "$CURSOR_DIR/\${f##*/}"
    done
    [ "$failed" -eq 0 ] || warn "$failed file(s) failed to convert."
else
    existing=0
    for f in "$CURSOR_DIR"/*; do [ -f "$f" ] && existing=1 && break; done
    [ "$existing" -eq 1 ] || die "No .ani or .cur files found in: $SOURCE_DIR
   Pass the folder that holds them:  bash install_cursors.sh /path/to/cursors"
    info "No Windows files in $SOURCE_DIR; linking the files already in $CURSOR_DIR"
fi

# ---- 2. Register the theme ----
write_index_theme

# ---- 3. Link every Linux cursor name to its file ----
# Prints the first candidate that exists in the cursor folder. Matching
# ignores letter case and skips links made by earlier runs.
resolve() {
    local want f base
    for want in "$@"; do
        for f in "$CURSOR_DIR/$PREFIX$want$SUFFIX" "$CURSOR_DIR/$want"; do
            if [ -f "$f" ] && [ ! -L "$f" ]; then printf '%s\\n' "\${f##*/}"; return 0; fi
        done
        for f in "$CURSOR_DIR"/*; do
            base="\${f##*/}"
            [ -f "$f" ] && [ ! -L "$f" ] || continue
            if [ "\${base,,}" = "\${PREFIX,,}\${want,,}\${SUFFIX,,}" ] || [ "\${base,,}" = "\${want,,}" ]; then
                printf '%s\\n' "$base"; return 0
            fi
        done
    done
    return 1
}

LINKED=0
MISSING=()
SOURCES=()
declare -A TARGETS=()
# role LABEL CANDIDATE... -- LINUX_NAME...
role() {
    local label="$1" src name
    local cands=()
    shift
    while [ "$#" -gt 0 ] && [ "$1" != "--" ]; do cands+=("$1"); shift; done
    shift
    for name in "$@"; do TARGETS[$name]=1; done
    if ! src=$(resolve "\${cands[@]}"); then
        MISSING+=("$label")
        return 0
    fi
    printf '   %-15s %s\\n' "$label" "$src"
    SOURCES+=("$src")
    for name in "$@"; do
        [ "$name" = "$src" ] && continue
        run rm -f "$CURSOR_DIR/$name"
        if [ "$LINK_MODE" = copy ]; then
            run cp "$CURSOR_DIR/$src" "$CURSOR_DIR/$name"
        else
            # Relative link inside the same folder: survives moving or copying the theme.
            run ln -s "$src" "$CURSOR_DIR/$name"
        fi
        LINKED=$((LINKED + 1))
    done
}

info "Linking cursor names"
${roleLines}

if [ "$LINK_MODE" = copy ]; then
    # Copies are in place, so the converted originals are no longer needed.
    for src in "\${SOURCES[@]}"; do
        [ -n "\${TARGETS[$src]:-}" ] || run rm -f "$CURSOR_DIR/$src"
    done
fi
check_links

echo
ok "Installed '$THEME_NAME' to $THEME_DIR ($LINKED cursor names)"
if [ "\${#MISSING[@]}" -gt 0 ]; then
    warn "No file found for: \${MISSING[*]}"
    warn "Those cursors use the inherited theme. Fix the names under File Mapping on the CursorPort page."
fi

# ---- 4. Apply ----
apply_theme || warn "Could not apply automatically. Pick '$THEME_NAME' in your desktop's cursor settings."
`;
    }

    // install.sh shipped inside a browser-built theme archive.
    function buildThemeInstaller(themeName, cursorSize) {
        const theme = sanitizeThemeName(themeName);
        return `#!/usr/bin/env bash
# Installs the '${theme}' cursor theme built by CursorPort (cursorport.01blue.org).
# Usage:  bash install.sh [icon folder]     (default: ~/.local/share/icons)
# Set CURSORPORT_APPLY=0 to install without applying.
set -eu -o pipefail
HERE="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
THEME_NAME=${sq(theme)}
ICON_ROOT="\${1:-\${XDG_DATA_HOME:-$HOME/.local/share}/icons}"
CURSOR_SIZE=${parseInt(cursorSize, 10) || 32}
AUTO_APPLY="\${CURSORPORT_APPLY:-1}"
${BASH_COMMON}
[ -d "$HERE/cursors" ] || die "Run this from the extracted theme folder (cursors/ not found next to install.sh)."
info "Installing '$THEME_NAME' to $THEME_DIR"
run rm -rf "$CURSOR_DIR"
# tar keeps the cursor symlinks exactly as built.
(cd "$HERE" && tar cf - cursors) | run tar xf - -C "$THEME_DIR"
write_index_theme
check_links
ok "Installed '$THEME_NAME'"
apply_theme || warn "Could not apply automatically. Pick '$THEME_NAME' in your desktop's cursor settings."
`;
    }

    // =====================================================================
    // BROWSER THEME BUILD
    // =====================================================================
    // files: Map(name without extension -> parsed cursor from parseCursor)
    // Returns { bytes (gzip or tar), gzipped, report }
    async function buildTheme({ themeName, cursors, mappings, prefix, suffix, cursorSize }) {
        const theme = sanitizeThemeName(themeName);
        const names = [...cursors.keys()];
        const entries = [
            { path: `${theme}/`, dir: true },
            { path: `${theme}/cursors/`, dir: true },
        ];
        const written = new Map(); // source name -> primary Linux name
        const report = [];
        for (const role of ROLES) {
            const hit = resolveRoleFile(
                role.key,
                { ...DEFAULT_MAPPINGS, ...mappings },
                names,
                prefix,
                suffix
            );
            if (!hit) {
                report.push({ role: role.key, label: role.label, file: null });
                continue;
            }
            let primary = written.get(hit.file);
            const links = role.links.slice();
            if (!primary) {
                primary = links.shift();
                written.set(hit.file, primary);
                entries.push({
                    path: `${theme}/cursors/${primary}`,
                    bytes: encodeXcursor(cursors.get(hit.file)),
                });
            }
            links
                .filter((l) => l !== primary)
                .forEach((l) => entries.push({ path: `${theme}/cursors/${l}`, link: primary }));
            report.push({
                role: role.key,
                label: role.label,
                file: hit.file,
                viaFallback: hit.viaFallback,
            });
        }
        if (!written.size) throw new Error('None of the cursor roles matched a loaded file');
        const enc = new TextEncoder();
        entries.push({
            path: `${theme}/index.theme`,
            bytes: enc.encode(
                `[Icon Theme]\nName=${theme}\nComment=Converted from Windows cursors with CursorPort\nInherits=breeze_cursors,Adwaita\n`
            ),
        });
        entries.push({
            path: `${theme}/install.sh`,
            bytes: enc.encode(buildThemeInstaller(theme, cursorSize)),
            mode: 0o755,
        });
        const tar = buildTar(entries);
        if (typeof CompressionStream === 'function')
            return { bytes: await gzip(tar), gzipped: true, theme, report };
        return { bytes: tar, gzipped: false, theme, report };
    }

    const api = {
        ROLES,
        ROLE_BY_KEY,
        DEFAULT_MAPPINGS,
        SCHEME_ORDER,
        parseCursor,
        parseIco,
        parseAni,
        decodePng,
        decodeDib,
        imageForSize,
        encodeXcursor,
        decodeXcursor,
        parseInf,
        guessMapping,
        resolveRoleFile,
        decodeText,
        readZip,
        buildTar,
        buildTheme,
        buildInstallScript,
        buildThemeInstaller,
        bashPath,
        sanitizeThemeName,
        stripExt,
        extOf,
        baseName,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.CursorPort = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
