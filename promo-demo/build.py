#!/usr/bin/env python3
"""Монтаж демо зі справжніх записів екрана (Android, 1080×2340).

Читає clips.tsv: id  запис  початок  кінець  швидкість  розділ
  → обрізає статус-бар і жест-смугу,
  → догенерує проміжні кадри до 60 к/с (minterpolate), щоб рух був плавним,
  → склеює в work/master.mp4 (60 к/с),
  → прописує розділи й тривалість у ../assets/demo.js,
  → кодує для сайту ../assets/demo/atom-demo.{mp4,webm,jpg},
  → розкладає кадри в frames-src/ (їх бере video.html для рендеру відео).

Записи: REC_DIR (за замовчуванням ~/Desktop/screens/video), імена Screen_Recording_20261016_<id>.mp4.
Потрібні python3 і ffmpeg у PATH. Інтерполяція повільна (хвилини на кожну хвилину запису) — це нормально.
"""
import json, os, re, shutil, subprocess
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE)
REC = os.path.expanduser(os.environ.get('REC_DIR', '~/Desktop/screens/video'))
ASSETS = os.path.abspath(os.environ.get('ASSETS', os.path.join(HERE, '..', 'assets')))
WORK = os.path.join(HERE, 'work'); os.makedirs(WORK + '/seg', exist_ok=True)
FPS = 60
# кадр запису 1080×2340: зверху статус-бар (з особистими даними), знизу жест-смуга — обрізаємо
CROP = 'crop=1080:2171:0:104'

def run(*a): subprocess.run(a, check=True)

def src_fps(path):
    n, d = subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries',
                                    'stream=avg_frame_rate', '-of', 'csv=p=0', path]).decode().strip().split('/')
    return float(n) / float(d)

clips = []
for l in open('clips.tsv', encoding='utf-8'):
    l = l.strip()
    if l and not l.startswith('#'):
        i, rec, ss, to, sp, ch = l.split()
        clips.append((i, rec, float(ss), float(to), float(sp), ch))

def make(c):
    i, rec, ss, to, sp, ch = c
    out = f'{WORK}/seg/{i}.mp4'
    if os.path.exists(out): return
    src = f'{REC}/Screen_Recording_20261016_{rec}.mp4'
    dur = round((to - ss) / sp, 3)
    interp = src_fps(src) < 45  # записи з ~20–30 к/с добудовуємо до 60; ~58 к/с лишаємо як є
    mi = (f'minterpolate=fps={FPS}:mi_mode=mci:mc_mode=obmc:me_mode=bidir:me=epzs:vsbmc=1:scd=fdiff:scd_threshold=2,'
          if interp else '')
    vf = (f'{CROP},scale=720:-2:flags=lanczos,{mi}setpts=(PTS-STARTPTS)/{sp},fps={FPS},'
          f'fade=t=in:st=0:d=0.15:color=0xf7f8fa,fade=t=out:st={dur-0.15:.3f}:d=0.15:color=0xf7f8fa,format=yuv420p')
    run('ffmpeg', '-nostdin', '-v', 'error', '-y', '-ss', str(ss), '-t', str(to - ss), '-i', src, '-an', '-vf', vf,
        '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', '-r', str(FPS), out)
    print('  ok', i, flush=True)

with ThreadPoolExecutor(max_workers=int(os.environ.get('JOBS', '2'))) as ex:
    list(ex.map(make, clips))

man, T = [], 0.0
for i, rec, ss, to, sp, ch in clips:
    d = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f'{WORK}/seg/{i}.mp4']))
    man.append({'id': i, 'ch': ch, 't': round(T, 3), 'd': round(d, 3)}); T += d

open(f'{WORK}/list.txt', 'w').write(''.join(f"file 'seg/{c[0]}.mp4'\n" for c in clips))
m = f'{WORK}/master.mp4'
raw = f'{WORK}/master_raw.mp4'
run('ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', f'{WORK}/list.txt',
    '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', '-r', str(FPS), '-pix_fmt', 'yuv420p', raw)
# Нижній рядок клавіатури (мікрофон і «галочка») у записі різко обрізаний — замальовуємо його кольором клавіатури.
# Лише коли в кадрі справді клавіатура (сіра смуга по краю); для екранів із вкладками нічого не змінюється.
H = int(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=height', '-of', 'csv=p=0', raw]))
y0 = int(H * 0.965); sh = H - y0
K = 'between(r(10,%d),210,240)*between(g(10,%d),210,242)' % (sh // 2, sh // 2)
fc = (f"split[a][b];[b]crop=720:{sh}:0:{y0},format=gbrp,"
      f"geq=r='if({K},r(10,Y),r(X,Y))':g='if({K},g(10,Y),g(X,Y))':b='if({K},b(10,Y),b(X,Y))'[s];"
      f"[a][s]overlay=0:{y0},format=yuv420p")
run('ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', raw, '-filter_complex', fc,
    '-c:v', 'libx264', '-crf', '15', '-preset', 'fast', '-r', str(FPS), '-pix_fmt', 'yuv420p', m)
tot = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', m]))
tot = round(tot, 3)

ch = []
for c in man:
    if ch and ch[-1][0] == c['ch']: ch[-1][2] = round(c['t'] + c['d'], 3)
    else: ch.append([c['ch'], c['t'], round(c['t'] + c['d'], 3)])

# розділи й тривалість → assets/demo.js
p = f'{ASSETS}/demo.js'; s = open(p, encoding='utf-8').read()
s = re.sub(r'var FPS = \d+, TOTAL = /\*TOTAL\*/[0-9.]+;', f'var FPS = {FPS}, TOTAL = /*TOTAL*/{tot};', s)
s = re.sub(r'var CH = /\*CH\*/\[.*?\];\n', 'var CH = /*CH*/' + json.dumps(ch, separators=(',', ':')) + ';\n', s, flags=re.S)
open(p, 'w', encoding='utf-8').write(s)

# відео для сайту
o = f'{ASSETS}/demo/'; os.makedirs(o, exist_ok=True)
run('ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', m, '-vf', 'scale=600:-2:flags=lanczos', '-c:v', 'libx264', '-crf', '28',
    '-preset', 'slow', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', o + 'atom-demo.mp4')
run('ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', m, '-vf', 'scale=600:-2:flags=lanczos', '-c:v', 'libvpx-vp9', '-crf', '40',
    '-b:v', '0', '-row-mt', '1', '-an', o + 'atom-demo.webm')
lib = [c for c in ch if c[0] == 'library'][0]  # постер: сторінка секції з плитками режимів
run('ffmpeg', '-nostdin', '-v', 'error', '-y', '-ss', str(lib[2] - 1.7), '-i', m, '-frames:v', '1', '-vf', 'scale=600:-2', '-q:v', '4', o + 'atom-demo.jpg')

# кадри для рендеру відео (video.html → frames-src/f00001.jpg …)
shutil.rmtree('frames-src', ignore_errors=True); os.makedirs('frames-src')
run('ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', m, '-vf', f'fps={FPS}', '-q:v', '3', 'frames-src/f%05d.jpg')
print('готово:', tot, 'с,', len(ch), 'розділів')
