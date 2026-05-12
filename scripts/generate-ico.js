'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const decodeIco = require('decode-ico');
const pngToIco = require('png-to-ico');

const buildDir = path.join(__dirname, '..', 'build');
const outIco = path.join(buildDir, 'icon.ico');
const pngPath = path.join(buildDir, 'icon.png');
const icoPath = path.join(buildDir, 'icon.ico');

function findSource() {
    if (fs.existsSync(pngPath)) return pngPath;
    if (fs.existsSync(icoPath)) return icoPath;
    return null;
}

function sharpFromIcoBuffer(buf) {
    const images = decodeIco(buf);
    if (!images.length) throw new Error('ICO içinde görüntü yok');
    const largest = images.reduce((a, b) => (a.width >= b.width ? a : b));
    if (largest.type === 'png') {
        return sharp(Buffer.from(largest.data));
    }
    return sharp(Buffer.from(largest.data), {
        raw: {
            width: largest.width,
            height: largest.height,
            channels: 4
        }
    });
}

async function openSource(src) {
    const ext = path.extname(src).toLowerCase();
    if (ext === '.ico') {
        return sharpFromIcoBuffer(fs.readFileSync(src));
    }
    return sharp(src);
}

async function main() {
    if (!fs.existsSync(buildDir)) {
        fs.mkdirSync(buildDir, { recursive: true });
    }
    const src = findSource();
    if (!src) {
        console.error(
            'build/icon.png veya build/icon.ico koyun (PNG tercih, kare).'
        );
        process.exit(1);
    }

    const base = await openSource(src);
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const buffers = await Promise.all(
        sizes.map((s) => base.clone().resize(s, s, { fit: 'cover' }).png().toBuffer())
    );
    fs.writeFileSync(outIco, await pngToIco(buffers));
    console.log('build/icon.ico güncellendi (256×256 dahil, electron-builder uyumlu).');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
